/**
 * Безопасное обновление verification_status платёжного профиля.
 * Только admin/super_admin через сессию.
 * State machine: not_filled → pending_review → {approved, rejected}
 */
import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

const VALID_TRANSITIONS = {
  not_filled: ["pending_review"],
  pending_review: ["approved", "rejected"],
  approved: [],
  rejected: ["pending_review"],
};

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return Response.json({ error: "POST only" }, { status: 405 });
  }

  try {
    const base44 = createClientFromRequest(req);
    const actor = await base44.auth.me();
    if (!actor || (actor.role !== "admin" && actor.role !== "super_admin")) {
      return Response.json({ error: "Admin required" }, { status: 403 });
    }

    const { profileId, newStatus, comment } = await req.json();
    if (!profileId || !newStatus) {
      return Response.json({ error: "profileId and newStatus required" }, { status: 400 });
    }

    if (newStatus === "rejected" && !comment) {
      return Response.json({ error: "comment required for reject" }, { status: 400 });
    }

    // Re-read actual profile state
    const profile = await base44.asServiceRole.entities.PaymentProfile.get(profileId);
    if (!profile) {
      return Response.json({ error: "Profile not found" }, { status: 404 });
    }

    // Validate state machine transition
    const allowed = VALID_TRANSITIONS[profile.verification_status] || [];
    if (!allowed.includes(newStatus)) {
      return Response.json(
        { error: `Cannot transition from ${profile.verification_status} to ${newStatus}` },
        { status: 400 }
      );
    }

    // Atomic: update + log
    try {
      const updates = { verification_status: newStatus };
      if (comment) {
        updates.admin_comment = comment;
      }
      if (newStatus === "approved" || newStatus === "rejected") {
        updates.reviewed_at = new Date().toISOString();
      }

      await base44.asServiceRole.entities.PaymentProfile.update(profileId, updates);

      await base44.asServiceRole.entities.ActionLog.create({
        actor_user_id: actor.id,
        actor_role: actor.role,
        action_type: "PAYMENT_PROFILE_STATUS_CHANGED",
        entity_type: "PaymentProfile",
        entity_id: profileId,
        action_payload: JSON.stringify({
          old_status: profile.verification_status,
          new_status: newStatus,
          comment,
        }),
      });

      return Response.json({
        success: true,
        profile: { id: profile.id, verification_status: newStatus },
      });
    } catch (e) {
      console.error("[safeUpdatePaymentProfileStatus] Operation failed:", e);
      return Response.json(
        { error: `Failed: ${e.message}`, critical: true },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[safeUpdatePaymentProfileStatus] Fatal error:", error);
    return Response.json({ error: error.message, critical: true }, { status: 500 });
  }
});
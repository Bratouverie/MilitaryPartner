/**
 * Безопасное обновление статуса выплаты с RBAC и state machine.
 * Только admin/super_admin через сессию.
 * Require reason для reject.
 */
import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

const VALID_TRANSITIONS = {
  pending: ["approved", "rejected"],
  approved: ["processing"],
  processing: ["paid"],
  paid: [], // terminal
  rejected: [], // terminal
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

    const { rewardId, newStatus, reason } = await req.json();
    if (!rewardId || !newStatus) {
      return Response.json({ error: "rewardId and newStatus required" }, { status: 400 });
    }

    if (newStatus === "rejected" && !reason) {
      return Response.json({ error: "reason required for reject" }, { status: 400 });
    }

    // Re-read actual reward state from DB (optimistic locking check)
    const reward = await base44.asServiceRole.entities.Reward.get(rewardId);
    if (!reward) {
      return Response.json({ error: "Reward not found" }, { status: 404 });
    }

    // Validate state machine transition
    const allowed = VALID_TRANSITIONS[reward.status] || [];
    if (!allowed.includes(newStatus)) {
      return Response.json(
        {
          error: `Cannot transition from ${reward.status} to ${newStatus}`,
          code: "INVALID_TRANSITION",
        },
        { status: 400 }
      );
    }

    // Prevent double-payment and rollback from terminal states
    if ((reward.status === "paid" || reward.status === "rejected") && newStatus !== reward.status) {
      return Response.json(
        { error: "Cannot change terminal state", code: "TERMINAL_STATE" },
        { status: 400 }
      );
    }

    // Atomic: update + log
    try {
      const updates = { status: newStatus };
      if (newStatus === "paid") {
        updates.paid_at = new Date().toISOString();
      }
      if (newStatus === "rejected" && reason) {
        updates.admin_comment = reason;
      }

      await base44.asServiceRole.entities.Reward.update(rewardId, updates);

      await base44.asServiceRole.entities.ActionLog.create({
        actor_user_id: actor.id,
        actor_role: actor.role,
        action_type: "REWARD_STATUS_CHANGED",
        entity_type: "Reward",
        entity_id: rewardId,
        action_payload: JSON.stringify({
          old_status: reward.status,
          new_status: newStatus,
          reason,
        }),
      });

      return Response.json({
        success: true,
        reward: { id: reward.id, status: newStatus },
      });
    } catch (e) {
      console.error("[safeUpdateRewardStatus] Operation failed:", e);
      return Response.json({ error: `Failed: ${e.message}`, critical: true }, { status: 500 });
    }
  } catch (error) {
    console.error("[safeUpdateRewardStatus] Fatal error:", error);
    return Response.json({ error: error.message, critical: true }, { status: 500 });
  }
});
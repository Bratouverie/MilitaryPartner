/**
 * Безопасная блокировка пользователя с защитой последнего super_admin.
 * Сервер проверяет: есть ли другие активные super_admin перед блокировкой.
 */
import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

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

    const { userId, newStatus } = await req.json();
    if (!userId || !["active", "blocked"].includes(newStatus)) {
      return Response.json({ error: "userId and newStatus required" }, { status: 400 });
    }

    // Re-read actual state from DB
    const user = await base44.asServiceRole.entities.ReferralProfile.get(userId);
    if (!user) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    // Защита: нельзя блокировать последнего активного super_admin
    if (user.role === "super_admin" && newStatus === "blocked") {
      const activeSuperAdmins = await base44.asServiceRole.entities.ReferralProfile.filter({
        role: "super_admin",
        status: "active",
      });
      if (activeSuperAdmins.length <= 1) {
        return Response.json(
          {
            error: "Cannot block last active super_admin",
            code: "LAST_SUPER_ADMIN",
          },
          { status: 400 }
        );
      }
    }

    // Atomic: update + log
    try {
      await base44.asServiceRole.entities.ReferralProfile.update(userId, { status: newStatus });

      await base44.asServiceRole.entities.ActionLog.create({
        actor_user_id: actor.id,
        actor_role: actor.role,
        action_type: "USER_STATUS_CHANGED",
        entity_type: "ReferralProfile",
        entity_id: userId,
        action_payload: JSON.stringify({
          old_status: user.status,
          new_status: newStatus,
          user_role: user.role,
        }),
      });

      return Response.json({
        success: true,
        profile: { id: user.id, status: newStatus },
      });
    } catch (e) {
      console.error("[safeBlockUser] Operation failed:", e);
      return Response.json({ error: `Failed: ${e.message}`, critical: true }, { status: 500 });
    }
  } catch (error) {
    console.error("[safeBlockUser] Fatal error:", error);
    return Response.json({ error: error.message, critical: true }, { status: 500 });
  }
});
/**
 * Безопасное перегенерирование секретного кода пользователя.
 * Только для super_admin, с атомарным логированием.
 */
import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

function genSecretCode() {
  const c = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: 28 }, () => c[Math.floor(Math.random() * c.length)]).join("");
}

function maskCode(code) {
  return code.slice(0, 4) + "••••••••••••••••••••" + code.slice(-4);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return Response.json({ error: "POST only" }, { status: 405 });
  }

  try {
    const base44 = createClientFromRequest(req);
    const actor = await base44.auth.me();
    if (!actor || actor.role !== "super_admin") {
      return Response.json({ error: "Super admin required" }, { status: 403 });
    }

    const { userId } = await req.json();
    if (!userId) {
      return Response.json({ error: "userId required" }, { status: 400 });
    }

    // Re-read actual state from DB
    const user = await base44.asServiceRole.entities.ReferralProfile.get(userId);
    if (!user) {
      return Response.json({ error: "User not found", code: "USER_NOT_FOUND" }, { status: 404 });
    }

    const secretCode = genSecretCode();
    const maskedCode = maskCode(secretCode);
    const now = new Date().toISOString();

    // Atomic: update + log in single operation (no race condition)
    try {
      await base44.asServiceRole.entities.ReferralProfile.update(userId, {
        secret_code: secretCode,
        masked_secret_code: maskedCode,
        secret_code_last_sent_at: now,
      });

      await base44.asServiceRole.entities.ActionLog.create({
        actor_user_id: actor.id,
        actor_role: actor.role,
        action_type: "SECRET_CODE_REGENERATED",
        entity_type: "ReferralProfile",
        entity_id: userId,
        action_payload: JSON.stringify({
          user_email: user.email,
          timestamp: now,
        }),
      });

      return Response.json({
        success: true,
        profile: {
          id: user.id,
          secret_code: secretCode,
          masked_secret_code: maskedCode,
          email: user.email,
        },
      });
    } catch (e) {
      console.error("[safeRegenerateSecret] Operation failed:", e);
      return Response.json(
        { error: `Failed to regenerate: ${e.message}`, critical: true },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[safeRegenerateSecret] Fatal error:", error);
    return Response.json({ error: error.message, critical: true }, { status: 500 });
  }
});
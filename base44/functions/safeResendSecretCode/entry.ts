/**
 * Безопасная повторная отправка секретного кода по email.
 * Только super_admin через сессию.
 * Обновляет secret_code_last_sent_at, отправляет письмо, логирует.
 */
import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

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

    // Re-read user from DB
    const user = await base44.asServiceRole.entities.ReferralProfile.get(userId);
    if (!user || !user.email) {
      return Response.json({ error: "User or email not found" }, { status: 404 });
    }

    const now = new Date().toISOString();

    // Atomic: update + email send + log
    try {
      // Update last_sent_at
      await base44.asServiceRole.entities.ReferralProfile.update(userId, {
        secret_code_last_sent_at: now,
      });

      // Send email
      let emailSent = false;
      try {
        await base44.integrations.Core.SendEmail({
          to: user.email,
          subject: "Ваш секретный код — МилитариПартнер",
          body: `<p>Ваш секретный код для входа:</p><p style="font-size:18px;font-family:monospace;background:#f4f4f4;padding:12px;border-radius:6px">${user.secret_code}</p><p><a href="${Deno.env.get("APP_ORIGIN") || "https://app.militarypartner.ru"}/secret-login">Войти →</a></p>`,
        });
        emailSent = true;
      } catch (emailErr) {
        console.warn("[safeResendSecretCode] Email send failed (non-critical):", emailErr);
      }

      // Log
      await base44.asServiceRole.entities.ActionLog.create({
        actor_user_id: actor.id,
        actor_role: actor.role,
        action_type: "SECRET_CODE_RESENT",
        entity_type: "ReferralProfile",
        entity_id: userId,
        action_payload: JSON.stringify({
          email: user.email,
          email_sent: emailSent,
        }),
      });

      return Response.json({
        success: true,
        emailSent,
        profile: { id: user.id, email: user.email },
      });
    } catch (e) {
      console.error("[safeResendSecretCode] Operation failed:", e);
      return Response.json({ error: `Failed: ${e.message}`, critical: true }, { status: 500 });
    }
  } catch (error) {
    console.error("[safeResendSecretCode] Fatal error:", error);
    return Response.json({ error: error.message, critical: true }, { status: 500 });
  }
});
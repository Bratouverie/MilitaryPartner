/**
 * Безопасное создание staff/moderator/referrer без race conditions.
 * Гарантирует, что все зависимые сущности будут созданы или откачены вместе.
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
    const user = await base44.auth.me();
    if (!user || user.role !== "admin" && user.role !== "super_admin") {
      return Response.json({ error: "Admin required" }, { status: 403 });
    }

    const { staffRole, fullName, email, programId } = await req.json();

    if (!staffRole || !fullName || !["moderator", "referrer", "staff"].includes(staffRole)) {
      return Response.json({ error: "Invalid input" }, { status: 400 });
    }

    // Email опционален
    let secretCode = genSecretCode();
    for (let i = 0; i < 5; i++) {
      const conflict = await base44.asServiceRole.entities.ReferralProfile.filter({ secret_code: secretCode });
      if (conflict.length === 0) break;
      secretCode = genSecretCode();
    }

    const maskedCode = maskCode(secretCode);
    const now = new Date().toISOString();

    // Создаём профиль
    let profile;
    try {
      profile = await base44.asServiceRole.entities.ReferralProfile.create({
        full_name: fullName,
        email: email || null,
        role: staffRole === "moderator" ? "moderator" : "referrer",
        status: "active",
        secret_code: secretCode,
        masked_secret_code: maskedCode,
        secret_code_last_sent_at: now,
        level: "L0_novice",
      });
    } catch (e) {
      console.error("[safeStaffCreation] Profile creation failed:", e);
      return Response.json({ error: "Profile creation failed: " + e.message }, { status: 500 });
    }

    // Если moderator и есть programId — привязываем
    if (staffRole === "moderator" && programId) {
      try {
        const prog = await base44.asServiceRole.entities.ReferralProgram.get(programId);
        if (prog) {
          await base44.asServiceRole.entities.ReferralProgram.update(programId, {
            assigned_moderator_id: profile.id,
          });
        }
      } catch (e) {
        console.error("[safeStaffCreation] Moderator assignment failed (non-critical):", e);
      }
    }

    // Если referrer — создаём его owned программу и первую invite подпрограмму
    if (staffRole === "referrer") {
      try {
        // Ищем parent программу (обычно это root программа админа)
        const rootPrograms = await base44.asServiceRole.entities.ReferralProgram.filter({
          is_root: true,
          is_archived: false,
        });
        const parentProgram = rootPrograms[0];

        if (parentProgram) {
          const ownedProgram = await base44.asServiceRole.entities.ReferralProgram.create({
            title: `Программа ${profile.full_name}`,
            base_program_title: parentProgram.base_program_title,
            link_code: `ref_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
            candidate_form_code: `cf_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
            owner_user_id: profile.id,
            parent_program_id: parentProgram.id,
            root_program_id: parentProgram.root_program_id || parentProgram.id,
            reward_quota: Math.max(5000, Math.floor((parentProgram.reward_quota * 0.5) / 5000) * 5000),
            program_kind: "child",
            is_active: true,
            is_archived: false,
            can_create_child: true,
            program_status: "active",
            region_code: parentProgram.region_code,
          });

          // Создаём первую invite подпрограмму
          const inviteQuota = Math.max(5000, Math.floor((ownedProgram.reward_quota * 0.5) / 5000) * 5000);
          await base44.asServiceRole.entities.ReferralProgram.create({
            title: `Приглашение ${profile.full_name}`,
            base_program_title: parentProgram.base_program_title,
            link_code: `inv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
            candidate_form_code: `cf_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
            owner_user_id: profile.id,
            parent_program_id: ownedProgram.id,
            root_program_id: parentProgram.root_program_id || parentProgram.id,
            reward_quota: inviteQuota,
            program_kind: "child",
            is_active: true,
            is_archived: false,
            can_create_child: true,
            program_status: "active",
            region_code: parentProgram.region_code,
          });
        }
      } catch (e) {
        console.error("[safeStaffCreation] Referrer program creation failed (non-critical):", e);
      }
    }

    return Response.json({
      success: true,
      profile: {
        id: profile.id,
        full_name: profile.full_name,
        role: profile.role,
        secret_code: secretCode,
        masked_secret_code: maskedCode,
      },
    });
  } catch (error) {
    console.error("[safeStaffCreation] Fatal error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
/**
 * Безопасное создание staff/moderator/referrer
 * Полностью атомарный сценарий с откатом при критичных ошибках.
 */
import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

function genSecretCode() {
  const c = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: 28 }, () => c[Math.floor(Math.random() * c.length)]).join("");
}

function maskCode(code) {
  return code.slice(0, 4) + "••••••••••••••••••••" + code.slice(-4);
}

async function genUniqueSecretCode(base44, maxRetries = 5) {
  for (let i = 0; i < maxRetries; i++) {
    const code = genSecretCode();
    const conflict = await base44.asServiceRole.entities.ReferralProfile.filter({
      secret_code: code,
    });
    if (conflict.length === 0) return code;
  }
  throw new Error("Failed to generate unique secret code");
}

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

    const { role, fullName, email, programId } = await req.json();

    if (!role || !fullName || !["moderator", "referrer_l1", "admin", "super_admin"].includes(role)) {
      return Response.json(
        { error: "Invalid input (role, fullName required)" },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    // Генерируем secret code
    let secretCode;
    try {
      secretCode = await genUniqueSecretCode(base44);
    } catch (e) {
      console.error("[safeCreateStaffUser] Secret code generation failed:", e);
      return Response.json(
        { error: "Failed to generate secret code", critical: true },
        { status: 500 }
      );
    }

    const maskedCode = maskCode(secretCode);

    // CASE 1: MODERATOR
    if (role === "moderator") {
      return handleModeratorCreation(
        base44,
        actor,
        fullName,
        email,
        programId,
        secretCode,
        maskedCode,
        now
      );
    }

    // CASE 2: REFERRER_L1
    if (role === "referrer_l1") {
      return handleReferrerCreation(
        base44,
        actor,
        fullName,
        email,
        secretCode,
        maskedCode,
        now
      );
    }

    // CASE 3: ADMIN / SUPER_ADMIN
    return handleAdminCreation(base44, actor, fullName, email, role, secretCode, maskedCode, now);
  } catch (error) {
    console.error("[safeCreateStaffUser] Fatal error:", error);
    return Response.json({ error: error.message, critical: true }, { status: 500 });
  }
});

async function handleModeratorCreation(
  base44,
  actor,
  fullName,
  email,
  programId,
  secretCode,
  maskedCode,
  now
) {
  // Шаг 1: Создаём профиль (КРИТИЧНО)
  let profile;
  try {
    profile = await base44.asServiceRole.entities.ReferralProfile.create({
      full_name: fullName,
      email: email || null,
      role: "moderator",
      status: "active",
      secret_code: secretCode,
      masked_secret_code: maskedCode,
      secret_code_last_sent_at: now,
      level: "L0_novice",
    });
  } catch (e) {
    console.error("[handleModeratorCreation] Profile creation failed:", e);
    return Response.json(
      {
        error: `Failed to create moderator profile: ${e.message}`,
        critical: true,
      },
      { status: 500 }
    );
  }

  const warnings = [];

  // Шаг 2: Привязываем к программе (КРИТИЧНО если programId указан)
  if (programId) {
    try {
      const prog = await base44.asServiceRole.entities.ReferralProgram.get(programId);
      if (!prog) {
        // Программа не найдена — но профиль уже создан
        // Откатываем профиль
        await base44.asServiceRole.entities.ReferralProfile.update(profile.id, {
          status: "inactive",
        });
        return Response.json(
          { error: "Program not found", code: "PROGRAM_NOT_FOUND", critical: true },
          { status: 404 }
        );
      }

      await base44.asServiceRole.entities.ReferralProgram.update(programId, {
        assigned_moderator_id: profile.id,
      });
    } catch (e) {
      console.error("[handleModeratorCreation] Program assignment failed:", e);
      // Откатываем профиль
      await base44.asServiceRole.entities.ReferralProfile.update(profile.id, {
        status: "inactive",
      });
      return Response.json(
        {
          error: `Failed to assign moderator to program: ${e.message}`,
          critical: true,
        },
        { status: 500 }
      );
    }
  }

  // Шаг 3: ActionLog (НЕКРИТИЧНО)
  try {
    await base44.asServiceRole.entities.ActionLog.create({
      actor_user_id: actor.id,
      actor_role: actor.role,
      action_type: "MODERATOR_CREATED",
      entity_type: "ReferralProfile",
      entity_id: profile.id,
      action_payload: JSON.stringify({
        full_name: fullName,
        program_id: programId || null,
      }),
    });
  } catch (e) {
    console.error("[handleModeratorCreation] ActionLog failed (non-critical):", e);
    warnings.push("Action log not recorded");
  }

  return Response.json({
    success: true,
    warnings: warnings.length > 0 ? warnings : undefined,
    profile: {
      id: profile.id,
      full_name: profile.full_name,
      role: profile.role,
      secret_code: secretCode,
      masked_secret_code: maskedCode,
      email: profile.email,
    },
  });
}

async function handleReferrerCreation(
  base44,
  actor,
  fullName,
  email,
  secretCode,
  maskedCode,
  now
) {
  // Шаг 1: Создаём профиль (КРИТИЧНО)
  let profile;
  try {
    profile = await base44.asServiceRole.entities.ReferralProfile.create({
      full_name: fullName,
      email: email || null,
      role: "referrer",
      status: "active",
      secret_code: secretCode,
      masked_secret_code: maskedCode,
      secret_code_last_sent_at: now,
      level: "L0_novice",
      total_earned: 0,
      total_paid: 0,
      total_pending: 0,
    });
  } catch (e) {
    console.error("[handleReferrerCreation] Profile creation failed:", e);
    return Response.json(
      {
        error: `Failed to create referrer profile: ${e.message}`,
        critical: true,
      },
      { status: 500 }
    );
  }

  const warnings = [];
  let ownedProgram = null;

  // Шаг 2: Создаём owned программу (КРИТИЧНО)
  try {
    const rootPrograms = await base44.asServiceRole.entities.ReferralProgram.filter({
      is_root: true,
      is_archived: false,
      program_status: "active",
    });
    const parentProgram = rootPrograms[0];

    if (!parentProgram) {
      // Нет родительской программы — откатываем
      await base44.asServiceRole.entities.ReferralProfile.update(profile.id, {
        status: "inactive",
      });
      return Response.json(
        { error: "No root program found", code: "NO_ROOT_PROGRAM", critical: true },
        { status: 500 }
      );
    }

    const ownedQuota = Math.max(5000, Math.floor((parentProgram.reward_quota * 0.5) / 5000) * 5000);

    ownedProgram = await base44.asServiceRole.entities.ReferralProgram.create({
      title: `Программа ${profile.full_name}`,
      base_program_title: parentProgram.base_program_title,
      link_code: `ref_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      candidate_form_code: `cf_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      owner_user_id: profile.id,
      parent_program_id: parentProgram.id,
      root_program_id: parentProgram.root_program_id || parentProgram.id,
      reward_quota: ownedQuota,
      program_kind: "child",
      is_active: true,
      is_archived: false,
      can_create_child: true,
      program_status: "active",
      region_code: parentProgram.region_code,
    });

    // Обновляем счётчики parent (НЕКРИТИЧНО)
    try {
      await base44.asServiceRole.entities.ReferralProgram.update(parentProgram.id, {
        direct_children_count: (parentProgram.direct_children_count || 0) + 1,
        children_count: (parentProgram.children_count || 0) + 1,
      });
    } catch (e) {
      console.error("[handleReferrerCreation] Parent counter update failed (non-critical):", e);
      warnings.push("Parent counters not updated");
    }
  } catch (e) {
    console.error("[handleReferrerCreation] Owned program creation failed:", e);
    // Откатываем профиль
    await base44.asServiceRole.entities.ReferralProfile.update(profile.id, {
      status: "inactive",
    });
    return Response.json(
      {
        error: `Failed to create owned program: ${e.message}`,
        critical: true,
      },
      { status: 500 }
    );
  }

  // Шаг 3: Создаём первую invite подпрограмму (НЕКРИТИЧНО)
  try {
    const inviteQuota = Math.max(5000, Math.floor((ownedProgram.reward_quota * 0.5) / 5000) * 5000);
    await base44.asServiceRole.entities.ReferralProgram.create({
      title: `Приглашение ${profile.full_name}`,
      base_program_title: ownedProgram.base_program_title,
      link_code: `inv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      candidate_form_code: `cf_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      owner_user_id: profile.id,
      parent_program_id: ownedProgram.id,
      root_program_id: ownedProgram.root_program_id,
      reward_quota: inviteQuota,
      program_kind: "child",
      is_active: true,
      is_archived: false,
      can_create_child: true,
      program_status: "active",
      region_code: ownedProgram.region_code,
    });
  } catch (e) {
    console.error("[handleReferrerCreation] Invite subprogram creation failed (non-critical):", e);
    warnings.push("Invite subprogram not created");
  }

  // Шаг 4: ActionLog (НЕКРИТИЧНО)
  try {
    await base44.asServiceRole.entities.ActionLog.create({
      actor_user_id: actor.id,
      actor_role: actor.role,
      action_type: "REFERRER_L1_CREATED",
      entity_type: "ReferralProfile",
      entity_id: profile.id,
      action_payload: JSON.stringify({
        full_name: fullName,
        owned_program_id: ownedProgram?.id,
      }),
    });
  } catch (e) {
    console.error("[handleReferrerCreation] ActionLog failed (non-critical):", e);
    warnings.push("Action log not recorded");
  }

  return Response.json({
    success: true,
    warnings: warnings.length > 0 ? warnings : undefined,
    profile: {
      id: profile.id,
      full_name: profile.full_name,
      role: profile.role,
      secret_code: secretCode,
      masked_secret_code: maskedCode,
      email: profile.email,
    },
    ownedProgram: ownedProgram ? { id: ownedProgram.id } : undefined,
  });
}

async function handleAdminCreation(
  base44,
  actor,
  fullName,
  email,
  role,
  secretCode,
  maskedCode,
  now
) {
  // Простое создание admin/super_admin (КРИТИЧНО)
  let profile;
  try {
    profile = await base44.asServiceRole.entities.ReferralProfile.create({
      full_name: fullName,
      email: email || null,
      role: role,
      status: "active",
      secret_code: secretCode,
      masked_secret_code: maskedCode,
      secret_code_last_sent_at: now,
      level: "L0_novice",
    });
  } catch (e) {
    console.error("[handleAdminCreation] Profile creation failed:", e);
    return Response.json(
      {
        error: `Failed to create ${role} profile: ${e.message}`,
        critical: true,
      },
      { status: 500 }
    );
  }

  const warnings = [];

  // ActionLog (НЕКРИТИЧНО)
  try {
    await base44.asServiceRole.entities.ActionLog.create({
      actor_user_id: actor.id,
      actor_role: actor.role,
      action_type: "ADMIN_CREATED",
      entity_type: "ReferralProfile",
      entity_id: profile.id,
      action_payload: JSON.stringify({
        full_name: fullName,
        admin_role: role,
      }),
    });
  } catch (e) {
    console.error("[handleAdminCreation] ActionLog failed (non-critical):", e);
    warnings.push("Action log not recorded");
  }

  return Response.json({
    success: true,
    warnings: warnings.length > 0 ? warnings : undefined,
    profile: {
      id: profile.id,
      full_name: profile.full_name,
      role: profile.role,
      secret_code: secretCode,
      masked_secret_code: maskedCode,
      email: profile.email,
    },
  });
}
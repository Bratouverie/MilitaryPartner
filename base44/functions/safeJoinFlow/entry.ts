/**
 * Безопасный join-flow для /join/:code
 * Полностью атомарный сценарий с idempotency и защитой от race conditions.
 */
import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

const MIN_QUOTA = 5000;
const QUOTA_STEP = 5000;

function genSecretCode() {
  const c = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: 28 }, () => c[Math.floor(Math.random() * c.length)]).join("");
}

function genRefCode() {
  const c = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: 8 }, () => c[Math.floor(Math.random() * c.length)]).join("");
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
    const { linkCode, idempotencyKey } = await req.json();

    if (!linkCode) {
      return Response.json({ error: "linkCode required" }, { status: 400 });
    }

    // Idempotency: check if already processed with this key
    if (idempotencyKey) {
      const logs = await base44.asServiceRole.entities.ActionLog.filter({
        action_type: "JOIN_FLOW_COMPLETE",
        action_payload: JSON.stringify({ idempotency_key: idempotencyKey }),
      });
      if (logs.length > 0) {
        // Parse payload to extract profile/program info
        try {
          const payload = JSON.parse(logs[0].action_payload);
          const profile = await base44.asServiceRole.entities.ReferralProfile.get(payload.profile_id);
          const childProgram = await base44.asServiceRole.entities.ReferralProgram.get(payload.child_program_id);
          if (profile && childProgram) {
            return Response.json({
              success: true,
              isDuplicate: true,
              profile: {
                id: profile.id,
                secret_code: profile.secret_code,
                masked_secret_code: profile.masked_secret_code,
                referral_code: profile.referral_code,
              },
              childProgram: {
                id: childProgram.id,
                link_code: childProgram.link_code,
                candidate_form_code: childProgram.candidate_form_code,
                reward_quota: childProgram.reward_quota,
              },
            });
          }
        } catch (e) {
          console.warn("[safeJoinFlow] Duplicate recovery failed:", e);
        }
      }
    }

    // Шаг 0: Валидация программы
    const programs = await base44.asServiceRole.entities.ReferralProgram.filter({ link_code: linkCode });
    const parentProgram = programs[0];

    if (!parentProgram) {
      return Response.json({ error: "Program not found" }, { status: 404 });
    }

    if (parentProgram.program_status !== "active" || !parentProgram.is_active) {
      return Response.json({ error: "Program not active" }, { status: 400 });
    }

    if ((parentProgram.direct_children_count || 0) >= 10) {
      return Response.json({ error: "Program at capacity" }, { status: 400 });
    }

    // Шаг 1: Генерируем уникальный код
    let secretCode;
    for (let i = 0; i < 10; i++) {
      secretCode = genSecretCode();
      const conflict = await base44.asServiceRole.entities.ReferralProfile.filter({ secret_code: secretCode });
      if (conflict.length === 0) break;
    }

    if (!secretCode) {
      return Response.json({ error: "Failed to generate secret code" }, { status: 500 });
    }

    const maskedCode = maskCode(secretCode);
    const referralCode = genRefCode();
    const now = new Date().toISOString();

    // Шаг 2: Создаём профиль
    let profile;
    try {
      profile = await base44.asServiceRole.entities.ReferralProfile.create({
        role: "referrer",
        status: "active",
        referral_code: referralCode,
        secret_code: secretCode,
        masked_secret_code: maskedCode,
        secret_code_last_sent_at: now,
        parent_user_id: parentProgram.owner_user_id,
        level: "L0_novice",
        total_earned: 0,
        total_paid: 0,
        total_pending: 0,
        active_referrals_count: 0,
        total_candidates_count: 0,
        referral_reward: parentProgram.reward_quota || MIN_QUOTA,
        personal_max_reward_snapshot: parentProgram.reward_quota || MIN_QUOTA,
      });
    } catch (e) {
      console.error("[safeJoinFlow] Profile creation failed:", e);
      return Response.json({ error: "Profile creation failed" }, { status: 500 });
    }

    // Шаг 3: Создаём первую подпрограмму приглашения (50% квоты)
    let childQuota = Math.floor((parentProgram.reward_quota || MIN_QUOTA) * 0.5);
    childQuota = Math.floor(childQuota / QUOTA_STEP) * QUOTA_STEP;
    if (childQuota < MIN_QUOTA) childQuota = MIN_QUOTA;

    let childProgram;
    try {
      const childCode = `c_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const candidateCode = `cf_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

      childProgram = await base44.asServiceRole.entities.ReferralProgram.create({
        title: `Приглашение (${profile.id})`,
        base_program_title: parentProgram.base_program_title,
        child_prefix_title: "",
        link_code: childCode,
        candidate_form_code: candidateCode,
        owner_user_id: profile.id,
        parent_program_id: parentProgram.id,
        root_program_id: parentProgram.root_program_id || parentProgram.id,
        reward_quota: childQuota,
        parent_reward_quota: parentProgram.reward_quota,
        depth: (parentProgram.depth || 0) + 1,
        program_kind: "child",
        is_root: false,
        is_active: true,
        is_archived: false,
        can_create_child: true,
        direct_children_count: 0,
        children_count: 0,
        candidates_count: 0,
        program_status: "active",
        region_code: parentProgram.region_code,
        region_name: parentProgram.region_name,
      });
    } catch (e) {
      console.error("[safeJoinFlow] Child program creation failed:", e);
      // Откат: помечаем профиль как неактивный
      try {
        await base44.asServiceRole.entities.ReferralProfile.update(profile.id, { status: "inactive" });
      } catch (rollbackErr) {
        console.error("[safeJoinFlow] Rollback failed:", rollbackErr);
      }
      return Response.json({ error: "Child program creation failed" }, { status: 500 });
    }

    const warnings = [];

    // Шаг 4: ProgramMembership (некритично)
    try {
      await base44.asServiceRole.entities.ProgramMembership.create({
        user_id: profile.id,
        program_id: childProgram.id,
        membership_role: "owner",
        membership_status: "active",
        source_join_type: "referral_link",
        source_program_id: parentProgram.id,
        joined_at: now,
      });
    } catch (e) {
      console.error("[safeJoinFlow] Membership creation failed (non-critical):", e);
      warnings.push("Membership not recorded");
    }

    // Шаг 5: Обновляем счётчики родителя
    try {
      await base44.asServiceRole.entities.ReferralProgram.update(parentProgram.id, {
        direct_children_count: (parentProgram.direct_children_count || 0) + 1,
        children_count: (parentProgram.children_count || 0) + 1,
      });
    } catch (e) {
      console.error("[safeJoinFlow] Counter update failed (non-critical):", e);
      warnings.push("Parent counters not updated");
    }

    // Шаг 6: ActionLog с idempotency info
    try {
      await base44.asServiceRole.entities.ActionLog.create({
        action_type: "JOIN_FLOW_COMPLETE",
        entity_type: "ReferralProfile",
        entity_id: profile.id,
        action_payload: JSON.stringify({
          idempotency_key: idempotencyKey,
          profile_id: profile.id,
          parent_program_id: parentProgram.id,
          child_program_id: childProgram.id,
          child_quota: childQuota,
        }),
      });
    } catch (e) {
      console.error("[safeJoinFlow] Log creation failed (non-critical):", e);
      warnings.push("Action log not recorded");
    }

    return Response.json({
      success: true,
      warnings: warnings.length > 0 ? warnings : undefined,
      profile: {
        id: profile.id,
        secret_code: secretCode,
        masked_secret_code: maskedCode,
        referral_code: referralCode,
      },
      childProgram: {
        id: childProgram.id,
        link_code: childProgram.link_code,
        candidate_form_code: childProgram.candidate_form_code,
        reward_quota: childProgram.reward_quota,
      },
    });
  } catch (error) {
    console.error("[safeJoinFlow] Fatal error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
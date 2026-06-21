/**
 * safePrepareReferralSubprogram
 * 
 * Находит или создаёт подпрограмму для шеринга с конкретной reward_quota.
 * Строго enforces: depth=1, max 10 children, owner check, anti-child-of-child.
 * Возвращает программу, ссылку, текст для шеринга и флаг wasReused/wasCreated.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const MIN_QUOTA = 5000;
const QUOTA_STEP = 5000;
const MAX_CHILDREN = 10;

function genCode(len) {
  const c = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: len }, () => c[Math.floor(Math.random() * c.length)]).join("");
}

async function genUniqueLinkCode(base44) {
  for (let i = 0; i < 6; i++) {
    const code = "j-" + genCode(10);
    const ex = await base44.asServiceRole.entities.ReferralProgram.filter({ link_code: code });
    if (ex.length === 0) return code;
  }
  return "j-" + genCode(14);
}

async function genUniqueCandidateCode(base44) {
  for (let i = 0; i < 6; i++) {
    const code = "cf-" + genCode(10);
    const ex = await base44.asServiceRole.entities.ReferralProgram.filter({ candidate_form_code: code });
    if (ex.length === 0) return code;
  }
  return "cf-" + genCode(14);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405 });

    const body = await req.json();
    const { requestedQuota } = body;

    // --- 1. Найти профиль пользователя ---
    const profiles = await base44.asServiceRole.entities.ReferralProfile.filter({ linked_user_id: user.id });
    const profile = profiles[0];
    if (!profile) return Response.json({ success: false, error: "Профиль не найден" });

    // --- 2. Найти все программы пользователя ---
    const allPrograms = await base44.asServiceRole.entities.ReferralProgram.filter({
      owner_user_id: profile.id,
      is_archived: false,
    });

    if (allPrograms.length === 0) {
      return Response.json({ success: false, error: "Нет доступных программ. Обратитесь к куратору." });
    }

    // --- 3. Определить базовую программу (depth=0 или root) ---
    // Базовая = корневая программа без родителя (depth=0, is_root=true или program_kind != "child")
    const basePrograms = allPrograms.filter(p =>
      p.program_status === "active" &&
      p.is_active &&
      !p.is_archived &&
      (p.is_root || p.program_kind === "root" || p.program_kind === "promoted_root" || (!p.parent_program_id && p.depth === 0))
    );

    // Также допустимы child-программы depth=1 как база (пользователь владеет depth=1)
    // Но нельзя создавать child от child (depth >= 1)
    // Стратегия: ищем сначала среди root-программ, затем среди depth=1 если root нет
    let baseProgram = basePrograms[0];
    if (!baseProgram) {
      // Попробуем найти любую программу depth=0
      baseProgram = allPrograms
        .filter(p => p.is_active && !p.is_archived && p.program_status === "active" && (p.depth || 0) === 0)
        .sort((a, b) => new Date(a.created_date) - new Date(b.created_date))[0];
    }

    if (!baseProgram) {
      return Response.json({
        success: false,
        error: "Не удалось определить базовую программу. Перейдите в «Мои программы» и выберите активную программу.",
        needsManualSelection: true,
      });
    }

    // --- 4. Проверить, что базовая программа позволяет создание подпрограмм ---
    if (baseProgram.program_status !== "active") {
      return Response.json({ success: false, error: `Программа «${baseProgram.title}» не активна (статус: ${baseProgram.program_status}). Управление в разделе «Мои программы».` });
    }

    const parentDepth = baseProgram.depth || 0;
    if (parentDepth >= 1) {
      return Response.json({
        success: false,
        error: "Нельзя создавать подпрограммы внутри уже существующей подпрограммы. Перейдите в «Мои программы» для управления.",
        childOfChildError: true,
      });
    }

    // --- 5. Вычислить и валидировать квоту ---
    const parentQuota = baseProgram.reward_quota || 0;
    let quota = Number(requestedQuota);

    if (!Number.isFinite(quota) || quota <= 0) {
      // Если квота не передана — вычислить default (50%)
      quota = Math.floor((parentQuota * 0.5) / QUOTA_STEP) * QUOTA_STEP;
      if (quota < MIN_QUOTA) quota = MIN_QUOTA;
    }

    // Валидация
    if (quota < MIN_QUOTA) {
      return Response.json({ success: false, error: `Минимальная квота — ${MIN_QUOTA.toLocaleString()} ₽`, minQuota: MIN_QUOTA });
    }
    if (quota % QUOTA_STEP !== 0) {
      return Response.json({ success: false, error: `Квота должна быть кратна ${QUOTA_STEP.toLocaleString()} ₽`, quotaStep: QUOTA_STEP });
    }
    if (quota >= parentQuota) {
      return Response.json({
        success: false,
        error: `Квота реферала должна быть меньше вашей программы (${parentQuota.toLocaleString()} ₽)`,
        maxQuota: parentQuota - QUOTA_STEP,
        parentQuota,
      });
    }

    // --- 6. Проверить лимит подпрограмм ---
    const existingChildren = await base44.asServiceRole.entities.ReferralProgram.filter({
      parent_program_id: baseProgram.id,
      is_archived: false,
    });

    // --- 7. Проверить reuse: уже есть подпрограмма с такой же квотой? ---
    const reuseCandidate = existingChildren.find(c =>
      c.reward_quota === quota &&
      c.owner_user_id === profile.id &&
      c.is_active &&
      !c.is_archived &&
      c.program_status === "active"
    );

    const origin = req.headers.get("origin") || "https://app.base44.com";

    if (reuseCandidate) {
      const inviteLink = `${origin}/join/${reuseCandidate.link_code}`;
      const programTitle = reuseCandidate.child_prefix_title || reuseCandidate.public_program_title || reuseCandidate.base_program_title || reuseCandidate.title;
      const shareText = `Присоединяйся по моей ссылке. Вознаграждение за участие — ${quota.toLocaleString()} ₽. Анкета: ${`${origin}/candidate/${reuseCandidate.candidate_form_code}`}`;
      const telegramText = `Присоединяйся по моей ссылке. Вознаграждение за участие — ${quota.toLocaleString()} ₽. Заполни анкету:`;

      await base44.asServiceRole.entities.ActionLog.create({
        actor_user_id: profile.id,
        actor_role: profile.role,
        action_type: "SUBPROGRAM_REUSED_FOR_SHARING",
        entity_type: "ReferralProgram",
        entity_id: reuseCandidate.id,
        action_payload: JSON.stringify({ quota, parent_id: baseProgram.id }),
      });

      return Response.json({
        success: true,
        wasReused: true,
        wasCreated: false,
        program: reuseCandidate,
        inviteLink,
        candidateLink: `${origin}/candidate/${reuseCandidate.candidate_form_code}`,
        programTitle,
        rewardAmount: quota,
        shareText,
        telegramText,
      });
    }

    // --- 8. Проверить лимит перед созданием ---
    if (existingChildren.filter(c => !c.is_archived).length >= MAX_CHILDREN) {
      return Response.json({
        success: false,
        error: `Достигнут лимит в ${MAX_CHILDREN} подпрограмм. Используйте уже созданные подпрограммы в разделе «Мои программы».`,
        limitReached: true,
      });
    }

    // --- 9. Создать новую подпрограмму ---
    const [linkCode, candidateFormCode] = await Promise.all([
      genUniqueLinkCode(base44),
      genUniqueCandidateCode(base44),
    ]);

    const baseProgramTitle = baseProgram.base_program_title || baseProgram.title || "";
    const childPrefixTitle = `Команда ${profile.full_name || "партнёра"} · ${quota.toLocaleString()} ₽`;
    const internalDisplayTitle = `${baseProgramTitle} — ${childPrefixTitle}`;
    const publicProgramTitle = baseProgramTitle;

    let ancestryIds = [];
    try { ancestryIds = JSON.parse(baseProgram.ancestry_path_ids || "[]"); } catch {}
    ancestryIds.push(baseProgram.id);

    const child = await base44.asServiceRole.entities.ReferralProgram.create({
      title: internalDisplayTitle,
      base_program_title: baseProgramTitle,
      child_prefix_title: childPrefixTitle,
      internal_display_title: internalDisplayTitle,
      public_program_title: publicProgramTitle,
      link_code: linkCode,
      candidate_form_code: candidateFormCode,
      owner_user_id: profile.id,
      parent_program_id: baseProgram.id,
      root_program_id: baseProgram.root_program_id || baseProgram.id,
      root_master_link_id: baseProgram.root_master_link_id,
      assigned_moderator_id: baseProgram.assigned_moderator_id,
      reward_quota: quota,
      parent_reward_quota: parentQuota,
      depth: 1,
      ancestry_path_ids: JSON.stringify(ancestryIds),
      ancestry_path_text: baseProgramTitle + " / " + childPrefixTitle,
      program_kind: "child",
      program_status: "active",
      is_root: false,
      is_active: true,
      is_archived: false,
      can_create_child: false, // depth=1, нельзя иметь детей
      direct_children_count: 0,
      children_count: 0,
      candidates_count: 0,
      contracts_count: 0,
      pending_rewards_sum: 0,
      paid_rewards_sum: 0,
      owner_program_level: 0,
      region_code: baseProgram.region_code,
      region_name: baseProgram.region_name,
      program_category: baseProgram.program_category,
    });

    // ProgramMembership
    try {
      await base44.asServiceRole.entities.ProgramMembership.create({
        user_id: profile.id,
        program_id: child.id,
        membership_role: "owner",
        membership_status: "active",
        source_join_type: "direct_assignment",
        source_program_id: baseProgram.id,
        joined_at: new Date().toISOString(),
      });
    } catch (e) {
      console.error("[safePrepareReferralSubprogram] ProgramMembership failed:", e);
    }

    // Обновить счётчик родителя
    try {
      await base44.asServiceRole.entities.ReferralProgram.update(baseProgram.id, {
        direct_children_count: (baseProgram.direct_children_count || 0) + 1,
        children_count: (baseProgram.children_count || 0) + 1,
        can_create_child: ((baseProgram.direct_children_count || 0) + 1 < MAX_CHILDREN) && (parentQuota > MIN_QUOTA),
      });
    } catch (e) {
      console.error("[safePrepareReferralSubprogram] Parent update failed:", e);
    }

    // ActionLog
    try {
      await base44.asServiceRole.entities.ActionLog.create({
        actor_user_id: profile.id,
        actor_role: profile.role,
        action_type: "SUBPROGRAM_CREATED_FOR_SHARING",
        entity_type: "ReferralProgram",
        entity_id: child.id,
        action_payload: JSON.stringify({ quota, parent_id: baseProgram.id, link_code: linkCode }),
      });
    } catch (e) {
      console.error("[safePrepareReferralSubprogram] ActionLog failed:", e);
    }

    const inviteLink = `${origin}/join/${linkCode}`;
    const shareText = `Присоединяйся по моей ссылке. Вознаграждение за участие — ${quota.toLocaleString()} ₽. Анкета: ${origin}/candidate/${candidateFormCode}`;
    const telegramText = `Присоединяйся по моей ссылке. Вознаграждение за участие — ${quota.toLocaleString()} ₽. Заполни анкету:`;

    return Response.json({
      success: true,
      wasReused: false,
      wasCreated: true,
      program: child,
      inviteLink,
      candidateLink: `${origin}/candidate/${candidateFormCode}`,
      programTitle: childPrefixTitle,
      rewardAmount: quota,
      shareText,
      telegramText,
    });

  } catch (error) {
    console.error("[safePrepareReferralSubprogram] Fatal:", error);
    return Response.json({ success: false, error: "Внутренняя ошибка сервера: " + error.message }, { status: 500 });
  }
});
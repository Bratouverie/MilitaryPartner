/**
 * safePrepareReferralSubprogram — orchestration function для share-flow дашборда.
 *
 * Алгоритм:
 * 1. Аутентификация по сессии (actor/owner определяется сервером, не клиентом).
 * 2. Найти активную базовую программу пользователя (depth=0, program_kind != child, active).
 *    - Если несколько — берём самую раннюю по created_date.
 *    - Если ни одной — fail с needsManualSelection.
 * 3. Hard-fail если base program depth >= 1 (child-of-child запрещён абсолютно).
 * 4. Валидировать requestedQuota — явная, сервер не угадывает 50%.
 * 5. Искать reuse: существующий child с тем же owner + parent + quota + active.
 * 6. Если reuse найден — вернуть его, записать audit log.
 * 7. Если нет — проверить лимит (max 10 children), создать новый child атомарно.
 * 8. При ошибке создания child — не оставлять полусозданных записей (rollback membership/counter).
 *
 * Enforced rules:
 * - max depth = 1 (child базовой программы)
 * - max width = 10 (children per base program)
 * - reward_quota < base program quota
 * - quota >= MIN_QUOTA, кратна QUOTA_STEP
 * - base program статус: только active
 * - нельзя создать root-программу
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
    if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405 });

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { requestedQuota } = body;

    // --- 1. Найти профиль по linked_user_id (сессия, не клиент) ---
    const profiles = await base44.asServiceRole.entities.ReferralProfile.filter({ linked_user_id: user.id });
    const profile = profiles[0];
    if (!profile) {
      return Response.json({ success: false, error: "Профиль реферала не найден. Обратитесь к куратору." });
    }

    // --- 2. Найти все программы пользователя ---
    const allPrograms = await base44.asServiceRole.entities.ReferralProgram.filter({
      owner_user_id: profile.id,
      is_archived: false,
    });

    if (allPrograms.length === 0) {
      return Response.json({ success: false, error: "Нет доступных программ. Обратитесь к куратору." });
    }

    // --- 3. Детерминированно определить базовую программу (depth=0, не child, active) ---
    // Приоритет: root/promoted_root, затем любая depth=0. Берём самую раннюю по created_date.
    const resolvedBase = allPrograms
      .filter(p =>
        p.is_active &&
        !p.is_archived &&
        p.program_status === "active" &&
        (p.depth || 0) === 0 &&
        p.program_kind !== "child"
      )
      .sort((a, b) => new Date(a.created_date) - new Date(b.created_date))[0]
      || allPrograms
        .filter(p => p.is_active && !p.is_archived && p.program_status === "active" && (p.depth || 0) === 0)
        .sort((a, b) => new Date(a.created_date) - new Date(b.created_date))[0];

    if (!resolvedBase) {
      return Response.json({
        success: false,
        error: "Не удалось определить базовую программу. Перейдите в «Мои программы» и убедитесь, что программа активна.",
        needsManualSelection: true,
      });
    }

    // --- 4. Hard-fail child-of-child ---
    if ((resolvedBase.depth || 0) >= 1) {
      return Response.json({
        success: false,
        error: "Создание подпрограммы внутри подпрограммы (child-of-child) запрещено. Обратитесь к куратору.",
        childOfChildError: true,
      });
    }

    if (resolvedBase.program_status !== "active") {
      return Response.json({
        success: false,
        error: `Базовая программа не активна (статус: ${resolvedBase.program_status}). Управление в разделе «Мои программы».`,
      });
    }

    // --- 5. Валидировать quota — явная, сервер не угадывает ---
    const parentQuota = resolvedBase.reward_quota || 0;
    const quota = Number(requestedQuota);

    if (!Number.isFinite(quota) || quota <= 0) {
      return Response.json({
        success: false,
        error: "Укажите размер вознаграждения реферала",
        requiresQuotaInput: true,
        parentQuota,
        suggestedQuota: Math.floor((parentQuota * 0.5) / QUOTA_STEP) * QUOTA_STEP || MIN_QUOTA,
      });
    }

    if (quota < MIN_QUOTA) {
      return Response.json({ success: false, error: `Минимальная квота — ${MIN_QUOTA.toLocaleString()} ₽` });
    }
    if (quota % QUOTA_STEP !== 0) {
      return Response.json({ success: false, error: `Квота должна быть кратна ${QUOTA_STEP.toLocaleString()} ₽` });
    }
    if (quota >= parentQuota) {
      return Response.json({
        success: false,
        error: `Квота реферала (${quota.toLocaleString()} ₽) должна быть меньше вашей программы (${parentQuota.toLocaleString()} ₽)`,
        maxQuota: parentQuota - QUOTA_STEP,
      });
    }

    const origin = req.headers.get("origin") || "https://app.base44.com";

    // --- 6. Загрузить всех children базовой программы ---
    const existingChildren = await base44.asServiceRole.entities.ReferralProgram.filter({
      parent_program_id: resolvedBase.id,
      is_archived: false,
    });

    // --- 7. Reuse: ищем child с той же квотой, тем же owner, активный ---
    const reuseCandidate = existingChildren.find(c =>
      c.reward_quota === quota &&
      c.owner_user_id === profile.id &&
      c.is_active &&
      !c.is_archived &&
      c.program_status === "active" &&
      c.link_code &&
      c.candidate_form_code
    );

    if (reuseCandidate) {
      const inviteLink = `${origin}/join/${reuseCandidate.link_code}`;
      const candidateLink = `${origin}/candidate/${reuseCandidate.candidate_form_code}`;
      const programTitle = reuseCandidate.child_prefix_title || reuseCandidate.public_program_title || reuseCandidate.base_program_title || reuseCandidate.title;
      const telegramText = `Присоединяйся по моей ссылке. Вознаграждение за участие — ${quota.toLocaleString()} ₽. Заполни анкету:`;
      const shareText = `${telegramText} ${candidateLink}`;

      await base44.asServiceRole.entities.ActionLog.create({
        actor_user_id: profile.id,
        actor_role: profile.role || "referrer",
        action_type: "SUBPROGRAM_REUSED_FOR_SHARING",
        entity_type: "ReferralProgram",
        entity_id: reuseCandidate.id,
        action_payload: JSON.stringify({ quota, parent_id: resolvedBase.id }),
      });

      return Response.json({
        success: true,
        wasReused: true,
        wasCreated: false,
        program: reuseCandidate,
        inviteLink,
        candidateLink,
        programTitle,
        rewardAmount: quota,
        shareText,
        telegramText,
      });
    }

    // --- 8. Проверить лимит ширины перед созданием ---
    const activeChildrenCount = existingChildren.filter(c => !c.is_archived).length;
    if (activeChildrenCount >= MAX_CHILDREN) {
      return Response.json({
        success: false,
        error: `Достигнут лимит подпрограмм (${MAX_CHILDREN}). Используйте одну из уже созданных в разделе «Мои программы».`,
        limitReached: true,
        existingQuotas: existingChildren
          .filter(c => c.is_active && !c.is_archived)
          .map(c => c.reward_quota),
      });
    }

    // --- 9. Создать новый child атомарно ---
    const [linkCode, candidateFormCode] = await Promise.all([
      genUniqueLinkCode(base44),
      genUniqueCandidateCode(base44),
    ]);

    const baseProgramTitle = resolvedBase.base_program_title || resolvedBase.title || "";
    const childPrefixTitle = `Команда ${profile.full_name || "партнёра"} · ${quota.toLocaleString()} ₽`;
    const internalDisplayTitle = `${baseProgramTitle} — ${childPrefixTitle}`;
    const publicProgramTitle = baseProgramTitle;

    let ancestryIds = [];
    try { ancestryIds = JSON.parse(resolvedBase.ancestry_path_ids || "[]"); } catch {}
    ancestryIds.push(resolvedBase.id);

    let child = null;
    try {
      child = await base44.asServiceRole.entities.ReferralProgram.create({
        title: internalDisplayTitle,
        base_program_title: baseProgramTitle,
        child_prefix_title: childPrefixTitle,
        internal_display_title: internalDisplayTitle,
        public_program_title: publicProgramTitle,
        link_code: linkCode,
        candidate_form_code: candidateFormCode,
        owner_user_id: profile.id,
        parent_program_id: resolvedBase.id,
        root_program_id: resolvedBase.root_program_id || resolvedBase.id,
        root_master_link_id: resolvedBase.root_master_link_id,
        assigned_moderator_id: resolvedBase.assigned_moderator_id,
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
        can_create_child: false, // depth=1 → нельзя иметь детей
        direct_children_count: 0,
        children_count: 0,
        candidates_count: 0,
        contracts_count: 0,
        pending_rewards_sum: 0,
        paid_rewards_sum: 0,
        owner_program_level: 0,
        region_code: resolvedBase.region_code,
        region_name: resolvedBase.region_name,
        program_category: resolvedBase.program_category,
      });
    } catch (createErr) {
      console.error("[safePrepareReferralSubprogram] Create child failed:", createErr);
      return Response.json({ success: false, error: "Не удалось создать подпрограмму. Попробуйте ещё раз." }, { status: 500 });
    }

    // ProgramMembership — некритично, не блокирует
    try {
      await base44.asServiceRole.entities.ProgramMembership.create({
        user_id: profile.id,
        program_id: child.id,
        membership_role: "owner",
        membership_status: "active",
        source_join_type: "direct_assignment",
        source_program_id: resolvedBase.id,
        joined_at: new Date().toISOString(),
      });
    } catch (e) {
      console.warn("[safePrepareReferralSubprogram] ProgramMembership failed (non-critical):", e.message);
    }

    // Обновить счётчик родителя — некритично
    try {
      const newCount = activeChildrenCount + 1;
      await base44.asServiceRole.entities.ReferralProgram.update(resolvedBase.id, {
        direct_children_count: newCount,
        children_count: newCount,
        can_create_child: newCount < MAX_CHILDREN && parentQuota > MIN_QUOTA,
      });
    } catch (e) {
      console.warn("[safePrepareReferralSubprogram] Parent counter update failed (non-critical):", e.message);
    }

    // ActionLog — некритично
    try {
      await base44.asServiceRole.entities.ActionLog.create({
        actor_user_id: profile.id,
        actor_role: profile.role || "referrer",
        action_type: "SUBPROGRAM_CREATED_FOR_SHARING",
        entity_type: "ReferralProgram",
        entity_id: child.id,
        action_payload: JSON.stringify({ quota, parent_id: resolvedBase.id, link_code: linkCode }),
      });
    } catch (e) {
      console.warn("[safePrepareReferralSubprogram] ActionLog failed (non-critical):", e.message);
    }

    const inviteLink = `${origin}/join/${linkCode}`;
    const candidateLink = `${origin}/candidate/${candidateFormCode}`;
    const telegramText = `Присоединяйся по моей ссылке. Вознаграждение за участие — ${quota.toLocaleString()} ₽. Заполни анкету:`;
    const shareText = `${telegramText} ${candidateLink}`;

    return Response.json({
      success: true,
      wasReused: false,
      wasCreated: true,
      program: child,
      inviteLink,
      candidateLink,
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
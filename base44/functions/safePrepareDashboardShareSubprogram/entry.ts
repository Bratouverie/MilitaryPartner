/**
 * safePrepareDashboardShareSubprogram — backend orchestration для dashboard share-flow.
 *
 * Алгоритм:
 * 1. Actor определяется ТОЛЬКО из серверной сессии.
 * 2. Детерминированно резолвит базовую программу (depth=0, active, не child).
 * 3. Валидирует requestedQuota явно — сервер не угадывает значения.
 * 4. Проверяет cachedSubprogramId (необязательный быстрый путь).
 * 5. Reuse-first: ищет существующий child с той же квотой.
 * 6. Если reuse нет — создаёт child атомарно (rollback при ошибке).
 * 7. Возвращает payload: inviteLink, candidateLink, telegramText, storageKey.
 *
 * Controlled error codes:
 * UNAUTHORIZED, NO_ACTIVE_BASE_PROGRAM, INVALID_QUOTA,
 * SUBPROGRAM_LIMIT_REACHED, CHILD_OF_CHILD_FORBIDDEN,
 * ROOT_CREATION_FORBIDDEN, PROGRAM_INACTIVE, PROGRAM_ARCHIVED, SERVER_ERROR
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const MIN_QUOTA = 5000;
const QUOTA_STEP = 5000;
const MAX_CHILDREN = 10;

// --- Helpers ---

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

function controlledError(code, message, extra = {}) {
  return Response.json({ ok: false, errorCode: code, error: message, ...extra });
}

// --- Main ---

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return Response.json({ ok: false, errorCode: "METHOD_NOT_ALLOWED", error: "POST only" }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);

    // === Шаг 1. Actor из серверной сессии — не доверяем клиенту ===
    const user = await base44.auth.me();
    if (!user) {
      return controlledError("UNAUTHORIZED", "Необходима авторизация");
    }

    const profiles = await base44.asServiceRole.entities.ReferralProfile.filter({
      linked_user_id: user.id,
    });
    const profile = profiles[0];
    if (!profile) {
      return controlledError("UNAUTHORIZED", "Профиль реферала не найден. Обратитесь к куратору.");
    }

    const body = await req.json().catch(() => ({}));
    const { requestedQuota, shareAction, cachedSubprogramId } = body;

    const origin = req.headers.get("origin") || "https://app.base44.com";
    const storageKey = `dashboard_share_sub_${profile.id}`;

    // === Шаг 2. Резолвить базовую программу ===
    // Загружаем ВСЕ программы без серверного фильтра по is_archived —
    // поле может быть undefined в старых записях, JS-фильтр надёжнее.
    const allPrograms = await base44.asServiceRole.entities.ReferralProgram.filter({
      owner_user_id: profile.id,
    });

    const isValidBase = (p) =>
      p.is_active === true &&
      p.is_archived !== true &&
      p.program_status === "active" &&
      (p.depth || 0) === 0 &&
      p.program_kind !== "child";

    const resolvedBase = allPrograms
      .filter(isValidBase)
      .sort((a, b) => new Date(a.created_date) - new Date(b.created_date))[0] || null;

    if (!resolvedBase) {
      return controlledError(
        "NO_ACTIVE_BASE_PROGRAM",
        "Нет активной базовой программы. Перейдите в «Мои программы».",
        { needsManualSelection: true }
      );
    }

    // Hard-fail: base program сама не должна быть child
    if ((resolvedBase.depth || 0) >= 1) {
      return controlledError(
        "CHILD_OF_CHILD_FORBIDDEN",
        "Создание подпрограммы внутри подпрограммы запрещено."
      );
    }

    if (resolvedBase.program_status !== "active") {
      return controlledError(
        "PROGRAM_INACTIVE",
        `Базовая программа не активна (статус: ${resolvedBase.program_status}).`
      );
    }

    if (resolvedBase.is_archived === true) {
      return controlledError("PROGRAM_ARCHIVED", "Базовая программа архивирована.");
    }

    const parentQuota = resolvedBase.reward_quota || 0;

    // === Шаг 3. Валидировать requestedQuota ===
    const quota = Number(requestedQuota);

    if (!Number.isFinite(quota) || quota <= 0) {
      return controlledError(
        "INVALID_QUOTA",
        "Укажите размер вознаграждения реферала.",
        {
          requiresQuotaInput: true,
          parentQuota,
          minQuota: MIN_QUOTA,
          quotaStep: QUOTA_STEP,
        }
      );
    }
    if (quota < MIN_QUOTA) {
      return controlledError("INVALID_QUOTA", `Минимальная квота — ${MIN_QUOTA.toLocaleString()} ₽`);
    }
    if (quota % QUOTA_STEP !== 0) {
      return controlledError("INVALID_QUOTA", `Квота должна быть кратна ${QUOTA_STEP.toLocaleString()} ₽`);
    }
    if (quota >= parentQuota) {
      return controlledError(
        "INVALID_QUOTA",
        `Квота реферала (${quota.toLocaleString()} ₽) должна быть меньше вашей программы (${parentQuota.toLocaleString()} ₽).`,
        { maxQuota: parentQuota - QUOTA_STEP }
      );
    }

    // === Шаг 4. Проверить cachedSubprogramId (быстрый путь) ===
    // Если кэш валиден и quota совпадает — reuse сразу без лишних запросов
    if (cachedSubprogramId) {
      const cached = allPrograms.find(p => p.id === cachedSubprogramId);
      if (
        cached &&
        cached.program_kind === "child" &&
        cached.is_active === true &&
        cached.is_archived !== true &&
        cached.program_status === "active" &&
        cached.parent_program_id === resolvedBase.id &&
        cached.owner_user_id === profile.id &&
        cached.reward_quota === quota &&
        cached.link_code &&
        cached.candidate_form_code
      ) {
        const inviteLink = `${origin}/join/${cached.link_code}`;
        const candidateLink = `${origin}/candidate/${cached.candidate_form_code}`;
        const telegramText = `Присоединяйся по моей ссылке. Вознаграждение за участие — ${quota.toLocaleString()} ₽. Заполни анкету:`;
        const shareText = `${telegramText} ${candidateLink}`;

        return Response.json({
          ok: true,
          wasReused: true,
          wasCreated: false,
          fromCache: true,
          baseProgram: { id: resolvedBase.id, title: resolvedBase.base_program_title || resolvedBase.title, reward_quota: parentQuota },
          shareSubprogram: cached,
          inviteLink,
          candidateLink,
          telegramText,
          shareText,
          rewardAmount: quota,
          storageKey,
        });
      }
      // Кэш невалиден — игнорируем, идём дальше (не падаем)
    }

    // === Шаг 5. Загрузить children базовой программы ===
    const existingChildren = await base44.asServiceRole.entities.ReferralProgram.filter({
      parent_program_id: resolvedBase.id,
    });

    // Reuse-first: ищем child с той же квотой, owner, активный
    const reuseCandidate = existingChildren.find(c =>
      c.reward_quota === quota &&
      c.owner_user_id === profile.id &&
      c.program_kind === "child" &&
      c.is_active === true &&
      c.is_archived !== true &&
      c.program_status === "active" &&
      c.link_code &&
      c.candidate_form_code
    );

    if (reuseCandidate) {
      const inviteLink = `${origin}/join/${reuseCandidate.link_code}`;
      const candidateLink = `${origin}/candidate/${reuseCandidate.candidate_form_code}`;
      const telegramText = `Присоединяйся по моей ссылке. Вознаграждение за участие — ${quota.toLocaleString()} ₽. Заполни анкету:`;
      const shareText = `${telegramText} ${candidateLink}`;

      // ActionLog обязателен для reuse — не best-effort
      await base44.asServiceRole.entities.ActionLog.create({
        actor_user_id: profile.id,
        actor_role: profile.role || "referrer",
        action_type: "DASHBOARD_SUBPROGRAM_REUSED",
        entity_type: "ReferralProgram",
        entity_id: reuseCandidate.id,
        action_payload: JSON.stringify({
          shareAction: shareAction || null,
          quota,
          parent_id: resolvedBase.id,
          storageKey,
        }),
      });

      return Response.json({
        ok: true,
        wasReused: true,
        wasCreated: false,
        fromCache: false,
        baseProgram: { id: resolvedBase.id, title: resolvedBase.base_program_title || resolvedBase.title, reward_quota: parentQuota },
        shareSubprogram: reuseCandidate,
        inviteLink,
        candidateLink,
        telegramText,
        shareText,
        rewardAmount: quota,
        storageKey,
      });
    }

    // === Шаг 6. Проверить лимит ширины перед созданием ===
    const activeChildrenCount = existingChildren.filter(c => c.is_archived !== true).length;
    if (activeChildrenCount >= MAX_CHILDREN) {
      return controlledError(
        "SUBPROGRAM_LIMIT_REACHED",
        `Достигнут лимит подпрограмм (${MAX_CHILDREN}). Используйте одну из уже созданных.`,
        {
          existingQuotas: existingChildren
            .filter(c => c.is_active && c.is_archived !== true)
            .map(c => c.reward_quota),
        }
      );
    }

    // === Шаг 7. Создать child атомарно ===
    const [linkCode, candidateFormCode] = await Promise.all([
      genUniqueLinkCode(base44),
      genUniqueCandidateCode(base44),
    ]);

    const baseProgramTitle = resolvedBase.base_program_title || resolvedBase.title || "";
    const childPrefixTitle = `Команда ${profile.full_name || "партнёра"} · ${quota.toLocaleString()} ₽`;
    const internalDisplayTitle = `${baseProgramTitle} — ${childPrefixTitle}`;

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
        public_program_title: baseProgramTitle,
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
        can_create_child: false,
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
      console.error("[safePrepareDashboardShareSubprogram] Create child failed:", createErr);
      return controlledError(
        "SERVER_ERROR",
        "Не удалось создать подпрограмму. Попробуйте ещё раз."
      );
    }

    // === Критическая цепочка после create: ProgramMembership + ActionLog обязательны.
    // При ошибке — rollback (удаляем child), возвращаем SERVER_ERROR.
    // Counter — некритичен, best-effort после успешной критической цепочки. ===

    try {
      // Шаг 7b: ProgramMembership — обязателен для валидного состояния
      await base44.asServiceRole.entities.ProgramMembership.create({
        user_id: profile.id,
        program_id: child.id,
        membership_role: "owner",
        membership_status: "active",
        source_join_type: "direct_assignment",
        source_program_id: resolvedBase.id,
        joined_at: new Date().toISOString(),
      });

      // Шаг 7c: ActionLog — обязателен для аудита
      await base44.asServiceRole.entities.ActionLog.create({
        actor_user_id: profile.id,
        actor_role: profile.role || "referrer",
        action_type: "DASHBOARD_SUBPROGRAM_CREATED",
        entity_type: "ReferralProgram",
        entity_id: child.id,
        action_payload: JSON.stringify({
          shareAction: shareAction || null,
          quota,
          parent_id: resolvedBase.id,
          link_code: linkCode,
          storageKey,
        }),
      });
    } catch (criticalErr) {
      // Rollback: удаляем только что созданный child, чтобы не оставить half-created subprogram
      console.error("[safePrepareDashboardShareSubprogram] Critical post-create step failed, rolling back child:", criticalErr);
      try {
        await base44.asServiceRole.entities.ReferralProgram.delete(child.id);
      } catch (rollbackErr) {
        console.error("[safePrepareDashboardShareSubprogram] Rollback failed — orphaned child:", child.id, rollbackErr);
      }
      return controlledError("SERVER_ERROR", "Не удалось завершить создание подпрограммы. Попробуйте ещё раз.");
    }

    // Counter — некритичен, не блокирует успех
    try {
      const newCount = activeChildrenCount + 1;
      await base44.asServiceRole.entities.ReferralProgram.update(resolvedBase.id, {
        direct_children_count: newCount,
        children_count: newCount,
        can_create_child: newCount < MAX_CHILDREN && parentQuota > MIN_QUOTA,
      });
    } catch (e) {
      console.warn("[safePrepareDashboardShareSubprogram] Parent counter update failed (non-critical):", e.message);
    }

    const inviteLink = `${origin}/join/${linkCode}`;
    const candidateLink = `${origin}/candidate/${candidateFormCode}`;
    const telegramText = `Присоединяйся по моей ссылке. Вознаграждение за участие — ${quota.toLocaleString()} ₽. Заполни анкету:`;
    const shareText = `${telegramText} ${candidateLink}`;

    return Response.json({
      ok: true,
      wasReused: false,
      wasCreated: true,
      fromCache: false,
      baseProgram: { id: resolvedBase.id, title: resolvedBase.base_program_title || resolvedBase.title, reward_quota: parentQuota },
      shareSubprogram: child,
      inviteLink,
      candidateLink,
      telegramText,
      shareText,
      rewardAmount: quota,
      storageKey,
    });

  } catch (error) {
    console.error("[safePrepareDashboardShareSubprogram] Fatal:", error);
    return controlledError("SERVER_ERROR", "Внутренняя ошибка сервера: " + error.message);
  }
});
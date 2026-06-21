/**
 * useDashboardShareSubprogram — ЕДИНСТВЕННЫЙ источник истины для dashboard share-flow.
 *
 * ПРАВИЛА:
 * 1. НЕ выбирает «первую попавшуюся» child-программу автоматически.
 * 2. Sharable subprogram — только та, которую backend подтвердил через safePrepareDashboardShareSubprogram.
 * 3. Персистируется в sessionStorage по ключу `dashboard_share_sub_<profileId>`.
 * 4. При загрузке — валидирует из БД (активна, не заархивирована, program_kind=child).
 * 5. Если ничего нет → empty state (null), dashboard показывает «не выбрана».
 *
 * prepareShareSubprogram — единственный метод для create/reuse через backend orchestration.
 * НЕ ИСПОЛЬЗУЕТ createDefaultInviteSubprogram.
 * НЕ ИСПОЛЬЗУЕТ useActiveInviteProgram.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { base44 } from "@/api/base44Client";

const STORAGE_KEY_PREFIX = "dashboard_share_sub_";

function getStorageKey(profileId) {
  return STORAGE_KEY_PREFIX + profileId;
}

function loadCachedId(profileId) {
  try {
    return sessionStorage.getItem(getStorageKey(profileId)) || null;
  } catch {
    return null;
  }
}

function saveCachedId(profileId, programId) {
  try {
    if (programId) {
      sessionStorage.setItem(getStorageKey(profileId), programId);
    } else {
      sessionStorage.removeItem(getStorageKey(profileId));
    }
  } catch {}
}

export function useDashboardShareSubprogram(profileId) {
  const [shareSubprogram, setShareSubprogramState] = useState(null);
  const [loading, setLoading] = useState(false);
  // Производные данные из backend payload — берём приоритетно из последнего ответа
  const [backendPayload, setBackendPayload] = useState(null);
  // Ref для защиты от двойного клика (race protection)
  const preparingRef = useRef(false);

  // Загрузить и валидировать закешированную подпрограмму при монтировании
  const loadFromCache = useCallback(async () => {
    if (!profileId) return;
    const cachedId = loadCachedId(profileId);
    if (!cachedId) {
      setShareSubprogramState(null);
      return;
    }

    setLoading(true);
    try {
      const programs = await base44.entities.ReferralProgram.filter({ id: cachedId });
      const prog = programs[0];

      // Строгая валидация: должна быть child, активная, не архивная, принадлежать этому владельцу
      if (
        prog &&
        prog.program_kind === "child" &&
        prog.is_active &&
        !prog.is_archived &&
        prog.program_status === "active" &&
        prog.owner_user_id === profileId &&
        prog.link_code &&
        prog.candidate_form_code
      ) {
        setShareSubprogramState(prog);
      } else {
        // Кеш протух — сбросить
        saveCachedId(profileId, null);
        setShareSubprogramState(null);
      }
    } catch (e) {
      console.error("[useDashboardShareSubprogram] load error:", e);
      setShareSubprogramState(null);
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    loadFromCache();
  }, [loadFromCache]);

  /**
   * prepareShareSubprogram — вызывает backend orchestration.
   * Единственный путь для create/reuse sharable subprogram.
   *
   * @param {object} opts
   * @param {string} opts.shareAction — "copy" | "telegram" | "changeReward"
   * @param {number} opts.requestedQuota — явная квота, обязательная
   * @param {boolean} [opts.forcePrepare] — опционально принудить пересоздание
   * @returns {object} — { ok, payload?, errorCode?, error? }
   */
  const prepareShareSubprogram = useCallback(async ({ shareAction, requestedQuota, forcePrepare } = {}) => {
    if (!profileId) return { ok: false, errorCode: "UNAUTHORIZED", error: "Профиль не найден" };

    // Double-click protection
    if (preparingRef.current) return { ok: false, errorCode: "IN_PROGRESS", error: "Уже выполняется" };
    preparingRef.current = true;
    setLoading(true);

    try {
      const cachedSubprogramId = forcePrepare ? null : loadCachedId(profileId);

      const res = await base44.functions.invoke("safePrepareDashboardShareSubprogram", {
        shareAction: shareAction || null,
        requestedQuota: Number(requestedQuota),
        cachedSubprogramId: cachedSubprogramId || null,
      });

      const data = res.data;

      if (!data?.ok) {
        // Controlled error — НЕ сбрасываем рабочий state
        return { ok: false, errorCode: data?.errorCode || "SERVER_ERROR", error: data?.error || "Ошибка сервера" };
      }

      // Успех: сохранить id в sessionStorage и обновить state
      const sub = data.shareSubprogram;
      if (sub?.id) {
        saveCachedId(profileId, sub.id);
        setShareSubprogramState(sub);
        setBackendPayload(data);
      }

      return { ok: true, payload: data };
    } catch (e) {
      console.error("[useDashboardShareSubprogram] prepareShareSubprogram error:", e);
      return { ok: false, errorCode: "SERVER_ERROR", error: "Ошибка сети. Попробуйте ещё раз." };
    } finally {
      setLoading(false);
      preparingRef.current = false;
    }
  }, [profileId]);

  // Ручная установка (после внешнего вызова, например SetRewardModal)
  const setSubprogram = useCallback((program) => {
    if (!program?.id || !profileId) return;
    saveCachedId(profileId, program.id);
    setShareSubprogramState(program);
    setBackendPayload(null); // сброс payload при ручной установке
  }, [profileId]);

  // Сброс
  const clearSubprogram = useCallback(() => {
    saveCachedId(profileId, null);
    setShareSubprogramState(null);
    setBackendPayload(null);
  }, [profileId]);

  // Reload из БД
  const reload = useCallback(() => loadFromCache(), [loadFromCache]);

  // Производные данные: приоритет — backend payload (точные ссылки от сервера), fallback — локальный расчёт
  const inviteLink = backendPayload?.inviteLink ||
    (shareSubprogram?.link_code ? `${window.location.origin}/join/${shareSubprogram.link_code}` : "");

  const candidateLink = backendPayload?.candidateLink ||
    (shareSubprogram?.candidate_form_code ? `${window.location.origin}/candidate/${shareSubprogram.candidate_form_code}` : "");

  const rewardAmount = backendPayload?.rewardAmount || shareSubprogram?.reward_quota || 0;

  const rewardText = rewardAmount > 0 ? `${rewardAmount.toLocaleString()} ₽` : "";

  const telegramText = backendPayload?.telegramText ||
    (shareSubprogram ? `Присоединяйся по моей ссылке. Вознаграждение за участие — ${rewardText}. Заполни анкету:` : "");

  const shareText = backendPayload?.shareText || (telegramText && candidateLink ? `${telegramText} ${candidateLink}` : "");

  const programTitle =
    shareSubprogram?.child_prefix_title ||
    shareSubprogram?.internal_display_title ||
    shareSubprogram?.public_program_title ||
    shareSubprogram?.base_program_title ||
    shareSubprogram?.title ||
    "";

  return {
    shareSubprogram,
    inviteLink,
    candidateLink,
    rewardAmount,
    rewardText,
    telegramText,
    shareText,
    programTitle,
    loading,
    prepareShareSubprogram,  // новый метод — backend orchestration
    setSubprogram,           // ручная установка (legacy/SetRewardModal compat)
    clearSubprogram,
    reload,
  };
}
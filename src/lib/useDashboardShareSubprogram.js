/**
 * useDashboardShareSubprogram — ЕДИНСТВЕННЫЙ источник истины для dashboard share-flow.
 *
 * ПРАВИЛА:
 * 1. НЕ выбирает «первую попавшуюся» child-программу автоматически.
 * 2. Sharable subprogram — только та, которую пользователь явно создал/выбрал через SetRewardModal
 *    (результат safePrepareReferralSubprogram).
 * 3. Персистируется в localStorage по ключу `dashboard_share_sub_<profileId>`.
 * 4. При загрузке — валидирует из БД (активна, не заархивирована, program_kind=child).
 * 5. Если ничего нет → empty state (null), dashboard показывает «не выбрана».
 *
 * НЕ ИСПОЛЬЗУЕТ createDefaultInviteSubprogram.
 * НЕ ИСПОЛЬЗУЕТ useActiveInviteProgram.
 */
import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";

const STORAGE_KEY_PREFIX = "dashboard_share_sub_";

function getStorageKey(profileId) {
  return STORAGE_KEY_PREFIX + profileId;
}

function loadCachedId(profileId) {
  try {
    return localStorage.getItem(getStorageKey(profileId)) || null;
  } catch {
    return null;
  }
}

function saveCachedId(profileId, programId) {
  try {
    if (programId) {
      localStorage.setItem(getStorageKey(profileId), programId);
    } else {
      localStorage.removeItem(getStorageKey(profileId));
    }
  } catch {}
}

export function useDashboardShareSubprogram(profileId) {
  const [shareSubprogram, setShareSubprogram] = useState(null);
  const [loading, setLoading] = useState(false);

  // Загрузить и валидировать закешированную подпрограмму
  const loadFromCache = useCallback(async () => {
    if (!profileId) return;
    const cachedId = loadCachedId(profileId);
    if (!cachedId) {
      setShareSubprogram(null);
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
        setShareSubprogram(prog);
      } else {
        // Кеш протух — сбросить
        saveCachedId(profileId, null);
        setShareSubprogram(null);
      }
    } catch (e) {
      console.error("[useDashboardShareSubprogram] load error:", e);
      setShareSubprogram(null);
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    loadFromCache();
  }, [loadFromCache]);

  // Вызывается после успешного safePrepareReferralSubprogram
  const setSubprogram = useCallback((program) => {
    if (!program?.id || !profileId) return;
    saveCachedId(profileId, program.id);
    setShareSubprogram(program);
  }, [profileId]);

  // Сброс (например, если пользователь меняет базовую программу)
  const clearSubprogram = useCallback(() => {
    saveCachedId(profileId, null);
    setShareSubprogram(null);
  }, [profileId]);

  // Reload из БД (после обновлений)
  const reload = useCallback(() => loadFromCache(), [loadFromCache]);

  // Производные данные для share
  const inviteLink = shareSubprogram?.link_code
    ? `${window.location.origin}/join/${shareSubprogram.link_code}`
    : "";

  const candidateLink = shareSubprogram?.candidate_form_code
    ? `${window.location.origin}/candidate/${shareSubprogram.candidate_form_code}`
    : "";

  const rewardAmount = shareSubprogram?.reward_quota || 0;
  const rewardText = rewardAmount > 0
    ? `${rewardAmount.toLocaleString()} ₽`
    : "";

  const telegramText = shareSubprogram
    ? `Присоединяйся по моей ссылке. Вознаграждение за участие — ${rewardText}. Заполни анкету:`
    : "";

  const programTitle =
    shareSubprogram?.child_prefix_title ||
    shareSubprogram?.internal_display_title ||
    shareSubprogram?.public_program_title ||
    shareSubprogram?.base_program_title ||
    shareSubprogram?.title ||
    "";

  return {
    shareSubprogram,      // текущая dashboard sharable subprogram (null если не выбрана)
    inviteLink,           // /join/:link_code
    candidateLink,        // /candidate/:form_code
    rewardAmount,         // число
    rewardText,           // "100 000 ₽"
    telegramText,         // текст для Telegram
    programTitle,         // человеческое название
    loading,
    setSubprogram,        // после create/reuse
    clearSubprogram,      // сброс
    reload,               // перечитать из БД
  };
}
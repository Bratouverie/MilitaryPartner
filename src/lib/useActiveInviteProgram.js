/**
 * Единый хук для получения активной программы приглашения.
 * Используется в ReferralDashboard, MyLink, Overview — один источник истины.
 * Активная пригласительная программа — child-программа владельца профиля с is_active=true.
 */
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { createDefaultInviteSubprogram } from "./programUtils";

export function useActiveInviteProgram(profileId) {
  const [inviteProgram, setInviteProgram] = useState(null);
  const [inviteLink, setInviteLink] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!profileId) return;
    loadProgram();
  }, [profileId]);

  const loadProgram = async () => {
    setLoading(true);
    try {
      const all = await base44.entities.ReferralProgram.filter({
        owner_user_id: profileId,
        is_archived: false,
      });
      // Активная пригласительная: kind=child, is_active=true
      const active = all.find(p => p.program_kind === "child" && p.is_active && p.link_code);
      if (active) {
        setInviteProgram(active);
        setInviteLink(`${window.location.origin}/join/${active.link_code}`);
      } else {
        setInviteProgram(null);
        setInviteLink("");
      }
    } catch (e) {
      console.error("[useActiveInviteProgram] error:", e);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Создаёт первую подпрограмму, если она отсутствует.
   * parentProgram — родительская программа пользователя.
   */
  const createInviteProgram = async (parentProgram) => {
    const { program, error } = await createDefaultInviteSubprogram(parentProgram, profileId);
    if (program) {
      setInviteProgram(program);
      setInviteLink(`${window.location.origin}/join/${program.link_code}`);
    }
    return { program, error };
  };

  /**
   * Установить другую программу как активную для приглашения.
   */
  const setActiveProgram = (program) => {
    if (!program?.link_code) return;
    setInviteProgram(program);
    setInviteLink(`${window.location.origin}/join/${program.link_code}`);
  };

  /**
   * Формирует строку для Telegram share.
   */
  const getTelegramShareUrl = () => {
    if (!inviteLink || !inviteProgram) return null;
    const programTitle = inviteProgram.public_program_title || inviteProgram.base_program_title || "МилитариПартнер";
    const text = `Присоединяйся к программе «${programTitle}»! За каждый контракт платят от 50 000 до 200 000 ₽.`;
    return `https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${encodeURIComponent(text)}`;
  };

  return { inviteProgram, inviteLink, loading, reload: loadProgram, createInviteProgram, setActiveProgram, getTelegramShareUrl };
}
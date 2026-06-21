/**
 * Единый хук для получения активной программы приглашения.
 * Используется в ReferralDashboard, MyLink, Overview — один источник истины.
 * Активная пригласительная программа — child-программа владельца профиля с is_active=true.
 */
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { generateTelegramShareText, formatRewardAmount } from "./payoutHelpers";

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

  const setActiveProgram = (program) => {
    if (!program?.link_code) return;
    setInviteProgram(program);
    setInviteLink(`${window.location.origin}/join/${program.link_code}`);
  };

  const getTelegramShareUrl = () => {
    if (!inviteLink || !inviteProgram) return null;
    const text = generateTelegramShareText(inviteProgram);
    return `https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${encodeURIComponent(text)}`;
  };

  const getRewardAmount = () => formatRewardAmount(inviteProgram?.reward_quota || 0);

  const getCandidateLink = () => {
    if (!inviteProgram?.candidate_form_code) return "";
    return `${window.location.origin}/candidate/${inviteProgram.candidate_form_code}`;
  };

  return { 
    inviteProgram, inviteLink, loading, 
    reload: loadProgram, setActiveProgram,
    getTelegramShareUrl, getRewardAmount, getCandidateLink 
  };
}
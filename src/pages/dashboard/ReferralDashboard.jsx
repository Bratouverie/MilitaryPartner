import React, { useState, useEffect } from "react";
import { useProfile } from "@/lib/useProfile";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Copy, Share2, Send, Eye, EyeOff, AlertTriangle, Loader2, FileText, Link as LinkIcon } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { useActiveInviteProgram } from "@/lib/useActiveInviteProgram";
import { isPayoutProfileComplete } from "@/lib/payoutHelpers";

export default function ReferralDashboard() {
  const { profile, loading } = useProfile();
  const { inviteProgram, inviteLink, loading: inviteLoading, createInviteProgram, getTelegramShareUrl, getRewardAmount, getCandidateLink } = useActiveInviteProgram(profile?.id);
  const [showSecret, setShowSecret] = useState(false);
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [paymentProfile, setPaymentProfile] = useState(null);
  const [stats, setStats] = useState({ referrals: 0, contracts: 0, earned: 0, pending: 0 });
  const referralLink = inviteLink;
  const candidateLink = getCandidateLink();
  const payoutComplete = isPayoutProfileComplete(paymentProfile);

  useEffect(() => {
    if (profile?.id) {
      loadStats();
      loadPaymentProfile();
    }
  }, [profile?.id]);

  const loadPaymentProfile = async () => {
    try {
      const pp = await base44.entities.PaymentProfile.filter({ user_id: profile?.id });
      if (pp[0]) setPaymentProfile(pp[0]);
    } catch (e) {
      console.error("Ошибка загрузки PaymentProfile:", e);
    }
  };

  const handleCreateInvite = async () => {
    setCreatingInvite(true);
    try {
      const owned = await base44.entities.ReferralProgram.filter({ owner_user_id: profile?.id });
      const parent = owned.find(p => !p.parent_program_id || p.program_kind !== "child");
      if (!parent) { toast({ title: "Нет родительской программы", variant: "destructive" }); return; }
      const { program, error } = await createInviteProgram(parent);
      if (program) toast({ title: "✓ Программа приглашения создана!" });
      else toast({ title: error || "Ошибка создания программы", variant: "destructive" });
    } finally { setCreatingInvite(false); }
  };

  const loadStats = async () => {
    try {
      // Загружаем статистику рефералов
      const referrals = await base44.entities.ReferralProgram.filter({
        parent_program_id: profile?.id,
      });
      
      const candidates = await base44.entities.CandidateApplication.filter({
        source_referrer_user_id: profile?.id,
      });

      const rewards = await base44.entities.Reward.filter({
        beneficiary_user_id: profile?.id,
      });

      const earned = rewards
        .filter((r) => r.status === "paid")
        .reduce((sum, r) => sum + (r.amount || 0), 0);

      const pending = rewards
        .filter((r) => ["pending", "approved", "processing"].includes(r.status))
        .reduce((sum, r) => sum + (r.amount || 0), 0);

      setStats({
        referrals: referrals.length,
        contracts: candidates.filter((c) => c.current_status === "CONTRACT_SIGNED").length,
        earned,
        pending,
      });
    } catch (e) {
      console.error("Ошибка загрузки статистики:", e);
    }
  };

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(referralLink);
    toast({ title: "✓ Ссылка скопирована!" });
  };

  const handleShare = () => {
    if (navigator.share && referralLink) {
      const rewardText = getRewardAmount();
      navigator.share({
        title: "МилитариПартнер",
        text: `Присоединяйся к программе! За каждого кандидата платят ${rewardText}. ${referralLink}`,
        url: referralLink,
      });
    }
  };

  const handleTelegram = () => {
    const shareUrl = getTelegramShareUrl();
    if (!shareUrl) { toast({ title: "Ссылка приглашения не готова", variant: "destructive" }); return; }
    window.open(shareUrl);
  };

  if (loading || inviteLoading) {
    return <div className="p-8 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-4 md:p-8">
        {/* GREETING SECTION */}
        <div className="mb-8">
          <h1 className="font-heading text-3xl md:text-4xl font-bold mb-2">
            Привет, {profile?.full_name || "Боец"}! 🛡️
          </h1>
          <p className="text-lg text-muted-foreground">
            Твой заработок этого месяца:{" "}
            <span className="font-bold text-primary text-2xl">
              {(stats.earned + stats.pending).toLocaleString()} ₽
            </span>
          </p>
        </div>

        {/* THREE MAIN BUTTONS */}
        <div className="space-y-4 mb-12">
          {/* BUTTON 1: ПРИГЛАСИТЬ РЕФЕРАЛОВ */}
          <div className="rounded-xl bg-gradient-to-br from-primary to-primary/80 border-2 border-accent p-6 shadow-lg hover:shadow-xl transition-all min-h-24 md:min-h-28">
            <div className="flex flex-col justify-between h-full">
              <div>
                <h2 className="font-black text-2xl md:text-3xl text-primary-foreground mb-2">
                  🔗 ПРИГЛАСИТЬ РЕФЕРАЛОВ
                </h2>
                {referralLink ? (
                  <p className="text-xs md:text-sm text-primary-foreground/90 font-mono bg-black/20 px-2 py-1 rounded break-all">
                    {referralLink}
                  </p>
                ) : (
                  <div className="flex items-center gap-2 text-amber-300 text-sm">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    Ссылка приглашения не создана — нажмите кнопку ниже
                  </div>
                )}
              </div>
              <div className="flex gap-2 flex-wrap mt-3">
                {referralLink ? (
                  <>
                    <Button onClick={handleCopyLink} size="sm" className="bg-white/20 hover:bg-white/30 text-primary-foreground text-xs">
                      <Copy className="w-3 h-3 mr-1" />Скопировать
                    </Button>
                    <Button onClick={handleShare} size="sm" className="bg-white/20 hover:bg-white/30 text-primary-foreground text-xs">
                      <Share2 className="w-3 h-3 mr-1" />Поделиться
                    </Button>
                  </>
                ) : (
                  <Button onClick={handleCreateInvite} disabled={creatingInvite} size="sm" className="bg-accent text-accent-foreground font-bold text-xs">
                    {creatingInvite ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                    Создать ссылку приглашения
                  </Button>
                )}
              </div>
              <div className="mt-2 text-sm text-primary-foreground/80">
                Ваш реферал получит {getRewardAmount()}
              </div>
            </div>
          </div>

          {/* BUTTON 2: ЗАПОЛНИТЬ ДАННЫЕ / АНКЕТА КАНДИДАТА */}
          {payoutComplete ? (
            <div className="rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 border-2 border-amber-700 p-6 shadow-lg hover:shadow-xl transition-all min-h-24 md:min-h-28">
              <div className="flex flex-col justify-between h-full">
                <div>
                  <h2 className="font-black text-2xl md:text-3xl text-white mb-2">
                    📋 АНКЕТА КАНДИДАТА
                  </h2>
                  <p className="text-sm md:text-base text-white/90">
                    Отправляй кандидатов по этой ссылке
                  </p>
                </div>
                <div className="flex gap-2 flex-wrap mt-3">
                  <Button
                    onClick={() => navigator.clipboard.writeText(candidateLink).then(() => toast({ title: "✓ Ссылка скопирована!" }))}
                    size="sm"
                    disabled={!candidateLink}
                    className="bg-white text-amber-600 hover:bg-white/90 text-xs md:text-sm font-bold"
                  >
                    <Copy className="w-3 h-3 mr-1" />Скопировать
                  </Button>
                  <Button
                    onClick={() => window.open(candidateLink)}
                    size="sm"
                    disabled={!candidateLink}
                    className="bg-white text-amber-600 hover:bg-white/90 text-xs md:text-sm font-bold"
                  >
                    <LinkIcon className="w-3 h-3 mr-1" />Открыть
                  </Button>
                  {navigator.share && (
                    <Button
                      onClick={() => navigator.share({ title: "Анкета кандидата", url: candidateLink })}
                      size="sm"
                      className="bg-white text-amber-600 hover:bg-white/90 text-xs md:text-sm font-bold"
                    >
                      <Share2 className="w-3 h-3 mr-1" />Поделиться
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 border-2 border-amber-700 p-6 shadow-lg hover:shadow-xl transition-all min-h-24 md:min-h-28 animate-pulse">
              <div className="flex flex-col justify-between h-full">
                <div>
                  <h2 className="font-black text-2xl md:text-3xl text-white mb-2">
                    ⚠️ ЗАПОЛНИТЬ ДАННЫЕ ДЛЯ ВЫПЛАТЫ
                  </h2>
                  <p className="text-sm md:text-base text-white/90">
                    Без этого мы не сможем тебе заплатить!
                  </p>
                </div>
                <div className="mt-3">
                  <Button
                    onClick={() => window.location.href = "/dashboard/payouts"}
                    size="sm"
                    className="bg-white text-amber-600 hover:bg-white/90 text-xs md:text-sm font-bold"
                  >
                    <FileText className="w-3 h-3 mr-1" />Заполнить сейчас
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* BUTTON 3: ПОДЕЛИТЬСЯ В TELEGRAM */}
          <div className="rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 border-2 border-blue-700 p-6 shadow-lg hover:shadow-xl transition-all min-h-24 md:min-h-28">
            <div className="flex flex-col justify-between h-full">
              <div>
                <h2 className="font-black text-2xl md:text-3xl text-white mb-2">
                  🚀 ПОДЕЛИТЬСЯ В TELEGRAM
                </h2>
                <p className="text-sm md:text-base text-white/90">
                  Самый быстрый способ • Друзья сразу видят, что это серьёз
                </p>
              </div>
              <div className="mt-3">
                <Button
                  onClick={handleTelegram}
                  size="sm"
                  className="bg-white text-blue-600 hover:bg-white/90 text-xs md:text-sm font-bold"
                >
                  <Send className="w-3 h-3 md:w-4 md:h-4 mr-1" />
                  Открыть Telegram
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* MICRO STATS */}
        <div className="bg-muted rounded-lg p-4 mb-8 text-center text-sm text-muted-foreground">
          <span className="font-medium">Рефералов: {stats.referrals}</span> •{" "}
          <span className="font-medium">Контрактов: {stats.contracts}</span> •{" "}
          <span className="font-medium">Доход: {(stats.earned + stats.pending).toLocaleString()} ₽</span>
        </div>

        {/* SECRET CODE SECTION */}
        <div className="bg-card border border-border rounded-xl p-6 mb-8">
          <h3 className="font-bold text-sm uppercase tracking-widest text-muted-foreground mb-4">
            Твой код доступа
          </h3>
          <div className="bg-muted rounded-lg p-4 font-mono text-center text-sm mb-3 break-all">
            {showSecret ? profile?.secret_code : profile?.masked_secret_code}
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              onClick={() => setShowSecret(!showSecret)}
              variant="outline"
              size="sm"
              className="text-xs"
            >
              {showSecret ? (
                <>
                  <EyeOff className="w-3 h-3 mr-1" />
                  Скрыть
                </>
              ) : (
                <>
                  <Eye className="w-3 h-3 mr-1" />
                  Показать
                </>
              )}
            </Button>
            <Button
              onClick={async () => {
                await navigator.clipboard.writeText(profile?.secret_code || "");
                toast({ title: "✓ Код скопирован!" });
              }}
              variant="outline"
              size="sm"
              className="text-xs"
            >
              <Copy className="w-3 h-3 mr-1" />
              Копировать
            </Button>
          </div>
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded mt-3 p-2">
            ⚠️ Никому не давай этот код! Это пароль к твоему кабинету.
          </p>
        </div>

        {/* REFERRAL STATS CARDS */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="text-sm text-muted-foreground mb-2">Выплачено</div>
            <div className="text-3xl font-black text-green-600">
              {stats.earned.toLocaleString()} ₽
            </div>
            <div className="text-xs text-muted-foreground mt-2">На счету ✓</div>
          </div>
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="text-sm text-muted-foreground mb-2">В ожидании</div>
            <div className="text-3xl font-black text-amber-600">
              {stats.pending.toLocaleString()} ₽
            </div>
            <div className="text-xs text-muted-foreground mt-2">Будет через 7-14 дней</div>
          </div>
        </div>
      </div>
    </div>
  );
}
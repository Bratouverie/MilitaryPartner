import React, { useState, useEffect } from "react";
import { useProfile } from "@/lib/useProfile";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Copy, Share2, Send, Eye, EyeOff, AlertTriangle, Loader2, FileText, Link as LinkIcon, CheckCircle, CreditCard } from "lucide-react";
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
        text: `Присоединяйся к программе! За каждого кандидата платят ${rewardText}.`,
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

        {/* MAIN CTA BLOCK — состояние зависит от payout profile */}
        <div className="mb-6">
          {payoutComplete ? (
            /* Состояние B: payout заполнен — главный CTA = анкета */
            <div className="rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 border-2 border-amber-700 p-6 shadow-lg">
              <div className="flex items-start gap-3 mb-4">
                <CheckCircle className="w-6 h-6 text-white shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-semibold text-white/70 uppercase tracking-widest mb-1">Выплаты подключены</div>
                  <h2 className="font-heading font-black text-2xl md:text-3xl text-white leading-tight">
                    Анкета готова к отправке
                  </h2>
                  <p className="text-sm text-white/90 mt-1">
                    Кандидаты заполняют анкету, а выплаты начисляются вам
                  </p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  onClick={() => window.open(candidateLink)}
                  disabled={!candidateLink}
                  className="flex-1 bg-white text-amber-700 hover:bg-amber-50 font-bold h-11 text-sm"
                >
                  <LinkIcon className="w-4 h-4 mr-2" />Открыть анкету
                </Button>
                <Button
                  onClick={() => navigator.clipboard.writeText(candidateLink).then(() => toast({ title: "✓ Ссылка скопирована!" }))}
                  disabled={!candidateLink}
                  variant="outline"
                  className="flex-1 sm:flex-none border-white/40 text-white hover:bg-white/10 h-11 text-sm"
                >
                  <Copy className="w-4 h-4 mr-2" />Скопировать ссылку
                </Button>
              </div>
              <div className="mt-3 pt-3 border-t border-white/20">
                <button
                  onClick={() => window.location.href = "/dashboard/payouts"}
                  className="text-xs text-white/70 hover:text-white underline underline-offset-2 transition-colors"
                >
                  Проверить данные для выплат
                </button>
              </div>
            </div>
          ) : (
            /* Состояние A: payout НЕ заполнен — главный CTA = выплаты */
            <div className="rounded-2xl bg-gradient-to-br from-primary to-primary/80 border-2 border-accent p-6 shadow-lg">
              <div className="flex items-start gap-3 mb-4">
                <CreditCard className="w-6 h-6 text-accent shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-semibold text-accent uppercase tracking-widest mb-1">Важно</div>
                  <h2 className="font-heading font-black text-2xl md:text-3xl text-primary-foreground leading-tight">
                    Заполните данные для выплат
                  </h2>
                  <p className="text-sm text-primary-foreground/80 mt-1">
                    Чтобы получать вознаграждение за кандидатов
                  </p>
                </div>
              </div>
              <Button
                onClick={() => window.location.href = "/dashboard/payouts"}
                className="w-full bg-accent text-accent-foreground hover:bg-accent/90 font-bold h-11 text-sm"
              >
                <FileText className="w-4 h-4 mr-2" />Заполнить данные для выплат
              </Button>
              {/* Анкета доступна сразу, без блокировки */}
              <div className="mt-4 pt-4 border-t border-white/10">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <p className="text-xs text-primary-foreground/60 leading-relaxed">
                    Анкету можно использовать уже сейчас.<br className="hidden sm:block" />
                    Чтобы получать выплаты — заполните данные для договора.
                  </p>
                  <Button
                    onClick={() => window.open(candidateLink)}
                    disabled={!candidateLink}
                    variant="ghost"
                    size="sm"
                    className="shrink-0 text-primary-foreground/80 hover:text-primary-foreground hover:bg-white/10 text-xs h-8"
                  >
                    <LinkIcon className="w-3 h-3 mr-1" />Открыть анкету
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 3 БЫСТРЫХ ДЕЙСТВИЯ */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-12">
          {/* Открыть анкету */}
          <button
            onClick={() => candidateLink ? window.open(candidateLink) : null}
            disabled={!candidateLink}
            className="flex items-center gap-3 bg-card border border-border rounded-xl p-4 text-left hover:bg-muted/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <div className="font-semibold text-sm">Открыть анкету</div>
              <div className="text-xs text-muted-foreground">Для кандидатов</div>
            </div>
          </button>

          {/* Скопировать ссылку */}
          <button
            onClick={() => candidateLink && navigator.clipboard.writeText(candidateLink).then(() => toast({ title: "✓ Ссылка скопирована!" }))}
            disabled={!candidateLink}
            className="flex items-center gap-3 bg-card border border-border rounded-xl p-4 text-left hover:bg-muted/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Copy className="w-4 h-4 text-primary" />
            </div>
            <div>
              <div className="font-semibold text-sm">Скопировать ссылку</div>
              <div className="text-xs text-muted-foreground">Анкеты кандидата</div>
            </div>
          </button>

          {/* Отправить в Telegram */}
          <button
            onClick={handleTelegram}
            className="flex items-center gap-3 bg-card border border-border rounded-xl p-4 text-left hover:bg-muted/50 transition-colors"
          >
            <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
              <Send className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <div className="font-semibold text-sm">Отправить в Telegram</div>
              <div className="text-xs text-muted-foreground">Поделиться ссылкой</div>
            </div>
          </button>
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
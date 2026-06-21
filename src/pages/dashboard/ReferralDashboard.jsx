import React, { useState, useEffect } from "react";
import { useProfile } from "@/lib/useProfile";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Copy, Share2, Send, Eye, EyeOff, Loader2, Link as LinkIcon } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { useActiveInviteProgram } from "@/lib/useActiveInviteProgram";


export default function ReferralDashboard() {
  const { profile, loading } = useProfile();
  const { inviteProgram, inviteLink, loading: inviteLoading, createInviteProgram, getTelegramShareUrl, getRewardAmount, getCandidateLink } = useActiveInviteProgram(profile?.id);
  const [showSecret, setShowSecret] = useState(false);
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [stats, setStats] = useState({ referrals: 0, contracts: 0, earned: 0, pending: 0 });
  const referralLink = inviteLink;
  const candidateLink = getCandidateLink();

  useEffect(() => {
    if (profile?.id) {
      loadStats();
    }
  }, [profile?.id]);

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

        {/* ГЛАВНЫЙ HERO-БЛОК — АНКЕТА ВСЕГДА В ЦЕНТРЕ */}
        <div className="rounded-2xl bg-gradient-to-br from-primary to-primary/80 border-2 border-accent p-6 shadow-lg mb-4">
          <div className="text-xs font-semibold text-accent uppercase tracking-widest mb-2">Главный инструмент</div>
          <h2 className="font-heading font-black text-2xl md:text-3xl text-primary-foreground leading-tight mb-1">
            Анкета для кандидатов
          </h2>
          <p className="text-sm text-primary-foreground/75 mb-5">
            Отправьте ссылку — кандидат заполнит анкету, вы получите вознаграждение
          </p>

          {/* Primary CTA */}
          {candidateLink ? (
            <Button
              onClick={() => {
                if (navigator.share) {
                  navigator.share({ title: "Анкета кандидата — МилитариПартнер", url: candidateLink });
                } else {
                  navigator.clipboard.writeText(candidateLink).then(() => toast({ title: "✓ Ссылка скопирована для отправки!" }));
                }
              }}
              className="w-full bg-accent text-accent-foreground hover:bg-accent/90 font-bold h-12 text-base rounded-xl mb-2"
            >
              <Share2 className="w-5 h-5 mr-2" />Отправить анкету кандидату
            </Button>
          ) : (
            <Button disabled className="w-full bg-accent/50 text-accent-foreground font-bold h-12 text-base rounded-xl mb-2">
              <Loader2 className="w-4 h-4 animate-spin mr-2" />Загрузка ссылки…
            </Button>
          )}

          {/* Secondary CTA */}
          <Button
            onClick={() => candidateLink && window.open(candidateLink)}
            disabled={!candidateLink}
            variant="ghost"
            className="w-full text-primary-foreground/80 hover:text-primary-foreground hover:bg-white/10 h-9 text-sm font-medium"
          >
            <LinkIcon className="w-4 h-4 mr-2" />Открыть анкету для самостоятельного заполнения
          </Button>
        </div>

        {/* БЛОК РАСПРОСТРАНЕНИЯ / МАСШТАБИРОВАНИЯ СЕТИ */}
        <div className="bg-card border border-border rounded-2xl p-4 mb-8">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
            Масштабируй сеть
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              onClick={() => candidateLink && navigator.clipboard.writeText(candidateLink).then(() => toast({ title: "✓ Ссылка скопирована!" }))}
              disabled={!candidateLink}
              className="flex items-center gap-3 rounded-xl border border-border p-3.5 text-left hover:bg-muted/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Copy className="w-4 h-4 text-primary" />
              </div>
              <div>
                <div className="font-semibold text-sm">Скопировать ссылку</div>
                <div className="text-xs text-muted-foreground">Отправить в любом канале</div>
              </div>
            </button>

            <button
              onClick={handleTelegram}
              className="flex items-center gap-3 rounded-xl border border-border p-3.5 text-left hover:bg-muted/60 transition-colors"
            >
              <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                <Send className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <div className="font-semibold text-sm">Отправить в Telegram</div>
                <div className="text-xs text-muted-foreground">Быстрый share-канал роста</div>
              </div>
            </button>
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
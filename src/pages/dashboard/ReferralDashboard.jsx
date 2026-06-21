/**
 * ReferralDashboard — главная страница партнёра.
 *
 * DATA FLOW:
 * - baseProgram: активная базовая программа (depth=0, active) — только читается, не меняется с dashboard.
 * - shareSubprogram: dashboard sharable subprogram — создаётся/переиспользуется через SetRewardModal
 *   → safePrepareReferralSubprogram → useDashboardShareSubprogram.
 *
 * ЗАПРЕЩЕНО С ЭТОЙ СТРАНИЦЫ:
 * - создавать root-программы
 * - менять активную базовую программу
 * - использовать createDefaultInviteSubprogram
 * - silently выбирать любую child-программу как sharable
 */
import React, { useState, useEffect, useCallback } from "react";
import { useProfile } from "@/lib/useProfile";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Share2, Eye, EyeOff, Loader2, Link as LinkIcon, Copy } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { useDashboardShareSubprogram } from "@/lib/useDashboardShareSubprogram";
import NetworkGrowthBlock from "@/components/dashboard/NetworkGrowthBlock";

export default function ReferralDashboard() {
  const { profile, loading } = useProfile();
  const [showSecret, setShowSecret] = useState(false);
  const [stats, setStats] = useState({ referrals: 0, contracts: 0, earned: 0, pending: 0 });
  const [baseProgram, setBaseProgram] = useState(null);
  const [baseProgramLoading, setBaseProgramLoading] = useState(false);

  // Новый источник истины для share-flow
  const {
    shareSubprogram,
    setSubprogram,
    clearSubprogram,
    loading: shareLoading,
  } = useDashboardShareSubprogram(profile?.id);

  // Ссылка на анкету — берём из shareSubprogram если есть, иначе из baseProgram
  const candidateFormCode = shareSubprogram?.candidate_form_code || baseProgram?.candidate_form_code;
  const candidateLink = candidateFormCode
    ? `${window.location.origin}/candidate/${candidateFormCode}`
    : "";

  /**
   * Загружает активную базовую программу.
   * 1. Читает mp_selected_program_id из sessionStorage (выбор из MyPrograms).
   * 2. Ищет эту программу среди программ пользователя и валидирует.
   * 3. Fallback на первую валидную root если selected не подходит.
   * 4. Если shareSubprogram принадлежит другой базовой — clearSubprogram.
   */
  const loadBaseProgram = React.useCallback(async () => {
    if (!profile?.id) return;
    setBaseProgramLoading(true);
    try {
      const all = await base44.entities.ReferralProgram.filter({
        owner_user_id: profile.id,
        is_archived: false,
      });

      const isValidBase = (p) =>
        p.is_active &&
        !p.is_archived &&
        p.program_status === "active" &&
        (p.depth || 0) === 0 &&
        p.program_kind !== "child";

      // 1. Попробовать сохранённый selected
      const savedId = sessionStorage.getItem("mp_selected_program_id");
      const saved = savedId ? all.find(p => p.id === savedId) : null;

      let resolved = null;
      if (saved && isValidBase(saved)) {
        resolved = saved;
      } else {
        // 2. Fallback: первая валидная по дате создания
        const fallback = all
          .filter(isValidBase)
          .sort((a, b) => new Date(a.created_date) - new Date(b.created_date))[0];
        if (fallback) {
          resolved = fallback;
          sessionStorage.setItem("mp_selected_program_id", fallback.id);
        }
      }

      setBaseProgram(resolved || null);

      // Если shareSubprogram принадлежит другой базовой — сбросить (используем ref-snapshot)
      // Читаем из localStorage напрямую, чтобы не зависеть от stale closure
      if (resolved) {
        try {
          const cachedShareId = localStorage.getItem(`dashboard_share_sub_${profile.id}`);
          if (cachedShareId) {
            const shareProgs = await base44.entities.ReferralProgram.filter({ id: cachedShareId });
            const shareProg = shareProgs[0];
            if (shareProg && shareProg.parent_program_id !== resolved.id) {
              clearSubprogram();
            }
          }
        } catch {}
      }
    } catch (e) {
      console.error("[ReferralDashboard] loadBaseProgram error:", e);
    } finally {
      setBaseProgramLoading(false);
    }
  }, [profile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (profile?.id) {
      loadStats();
      loadBaseProgram();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  const loadStats = async () => {
    try {
      const [referrals, candidates, rewards] = await Promise.all([
        base44.entities.ReferralProgram.filter({ parent_program_id: profile.id }),
        base44.entities.CandidateApplication.filter({ source_referrer_user_id: profile.id }),
        base44.entities.Reward.filter({ beneficiary_user_id: profile.id }),
      ]);

      const earned = rewards
        .filter(r => r.status === "paid")
        .reduce((sum, r) => sum + (r.amount || 0), 0);

      const pending = rewards
        .filter(r => ["pending", "approved", "processing"].includes(r.status))
        .reduce((sum, r) => sum + (r.amount || 0), 0);

      setStats({
        referrals: referrals.length,
        contracts: candidates.filter(c => c.current_status === "CONTRACT_SIGNED").length,
        earned,
        pending,
      });
    } catch (e) {
      console.error("[ReferralDashboard] loadStats error:", e);
    }
  };

  // Колбэк от NetworkGrowthBlock после create/reuse через modal
  const handleSubprogramReady = (data) => {
    if (data?.program) {
      setSubprogram(data.program);
    }
  };

  const isLoading = loading || shareLoading || baseProgramLoading;

  if (isLoading) {
    return (
      <div className="p-8 text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-4 md:p-8">

        {/* GREETING */}
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

        {/* ГЛАВНЫЙ HERO — АНКЕТА */}
        <div className="rounded-2xl bg-gradient-to-br from-primary to-primary/80 border-2 border-accent p-6 shadow-lg mb-4">
          <div className="text-xs font-semibold text-accent uppercase tracking-widest mb-2">Главный инструмент</div>
          <h2 className="font-heading font-black text-2xl md:text-3xl text-primary-foreground leading-tight mb-1">
            Анкета для кандидатов
          </h2>
          <p className="text-sm text-primary-foreground/75 mb-5">
            Отправьте ссылку — кандидат заполнит анкету, вы получите вознаграждение
          </p>

          {candidateLink ? (
            <Button
              onClick={() => {
                if (navigator.share) {
                  navigator.share({ title: "Анкета кандидата — МилитариПартнер", url: candidateLink });
                } else {
                  navigator.clipboard.writeText(candidateLink)
                    .then(() => toast({ title: "✓ Ссылка на анкету скопирована!" }));
                }
              }}
              className="w-full bg-accent text-accent-foreground hover:bg-accent/90 font-bold h-12 text-base rounded-xl mb-2"
            >
              <Share2 className="w-5 h-5 mr-2" />Отправить анкету кандидату
            </Button>
          ) : baseProgramLoading ? (
            <Button disabled className="w-full bg-accent/50 text-accent-foreground font-bold h-12 text-base rounded-xl mb-2">
              <Loader2 className="w-4 h-4 animate-spin mr-2" />Загрузка…
            </Button>
          ) : (
            /* Загрузка завершена, но baseProgram не найдена */
            <Button
              onClick={() => window.location.href = "/dashboard/programs"}
              className="w-full bg-accent/80 text-accent-foreground font-bold h-12 text-base rounded-xl mb-2"
            >
              Нет активной программы — Открыть Мои программы →
            </Button>
          )}

          <Button
            onClick={() => candidateLink && window.open(candidateLink)}
            disabled={!candidateLink}
            variant="ghost"
            className="w-full text-primary-foreground/80 hover:text-primary-foreground hover:bg-white/10 h-9 text-sm font-medium"
          >
            <LinkIcon className="w-4 h-4 mr-2" />Открыть анкету для самостоятельного заполнения
          </Button>
        </div>

        {/* БЛОК МАСШТАБИРОВАНИЯ СЕТИ — использует новый share-flow */}
        <NetworkGrowthBlock
          shareSubprogram={shareSubprogram}
          baseProgram={baseProgram}
          onSubprogramReady={handleSubprogramReady}
        />

        {/* MICRO STATS */}
        <div className="bg-muted rounded-lg p-4 mb-8 text-center text-sm text-muted-foreground">
          <span className="font-medium">Рефералов: {stats.referrals}</span> •{" "}
          <span className="font-medium">Контрактов: {stats.contracts}</span> •{" "}
          <span className="font-medium">Доход: {(stats.earned + stats.pending).toLocaleString()} ₽</span>
        </div>

        {/* SECRET CODE */}
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
              {showSecret ? <><EyeOff className="w-3 h-3 mr-1" />Скрыть</> : <><Eye className="w-3 h-3 mr-1" />Показать</>}
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
              <Copy className="w-3 h-3 mr-1" />Копировать
            </Button>
          </div>
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded mt-3 p-2">
            ⚠️ Никому не давай этот код! Это пароль к твоему кабинету.
          </p>
        </div>

        {/* STATS CARDS */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="text-sm text-muted-foreground mb-2">Выплачено</div>
            <div className="text-3xl font-black text-green-600">{stats.earned.toLocaleString()} ₽</div>
            <div className="text-xs text-muted-foreground mt-2">На счету ✓</div>
          </div>
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="text-sm text-muted-foreground mb-2">В ожидании</div>
            <div className="text-3xl font-black text-amber-600">{stats.pending.toLocaleString()} ₽</div>
            <div className="text-xs text-muted-foreground mt-2">Будет через 7-14 дней</div>
          </div>
        </div>

      </div>
    </div>
  );
}
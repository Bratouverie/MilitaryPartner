/**
 * NetworkGrowthBlock — Growth-модуль «Масштабируй свою сеть».
 * 
 * Логика:
 * - если у пользователя уже есть активная подпрограмма (inviteProgram) — сразу copy/share;
 * - если нет — при клике copy/telegram сначала открывает SetRewardModal;
 * - modal вызывает safePrepareReferralSubprogram, который find-or-create подпрограмму;
 * - после готовности — обновляет локальный state и выполняет изначальное действие.
 */
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Copy, Send, Network, TrendingUp, BadgeCheck, AlertCircle, ChevronRight, Zap } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";
import { formatRewardAmount } from "@/lib/payoutHelpers";
import SetRewardModal from "@/components/dashboard/SetRewardModal";

export default function NetworkGrowthBlock({ inviteProgram, inviteLink, baseProgram, onSubprogramReady }) {
  const [showModal, setShowModal] = useState(false);
  const [pendingAction, setPendingAction] = useState(null); // "copy" | "telegram"

  const programTitle =
    inviteProgram?.child_prefix_title ||
    inviteProgram?.internal_display_title ||
    inviteProgram?.public_program_title ||
    inviteProgram?.base_program_title ||
    inviteProgram?.title ||
    "";

  const reward = inviteProgram?.reward_quota || 0;
  const rewardText = formatRewardAmount(reward);

  // --- Вычисляем тексты для share ---
  const candidateLink = inviteProgram?.candidate_form_code
    ? `${window.location.origin}/candidate/${inviteProgram.candidate_form_code}`
    : "";

  const telegramText = inviteProgram
    ? `Присоединяйся по моей ссылке. Вознаграждение за участие — ${rewardText}. Заполни анкету:`
    : "";

  // --- Helpers для выполнения действий после готовности подпрограммы ---
  const doShare = (link, cLink, rText) => {
    // Telegram
    if (!link) { toast({ title: "Ссылка не готова", variant: "destructive" }); return; }
    const tgText = rText || telegramText;
    const tgUrl = `https://t.me/share/url?url=${encodeURIComponent(cLink || link)}&text=${encodeURIComponent(tgText)}`;
    window.open(tgUrl);
  };

  const doCopy = (link) => {
    if (!link) { toast({ title: "Ссылка не готова", variant: "destructive" }); return; }
    navigator.clipboard.writeText(link).then(() =>
      toast({ title: "✓ Ссылка скопирована!", description: programTitle ? `Ссылка на «${programTitle.length > 30 ? programTitle.slice(0, 30) + "…" : programTitle}»` : undefined })
    );
  };

  // --- Обработка клика: если программа готова — действуем, иначе — модал ---
  const handleAction = (action) => {
    if (inviteProgram && inviteLink) {
      if (action === "copy") doCopy(inviteLink);
      if (action === "telegram") doShare(inviteLink, candidateLink, telegramText);
    } else if (baseProgram) {
      // нужна подпрограмма
      setPendingAction(action);
      setShowModal(true);
    } else {
      toast({ title: "Нет активной программы", description: "Перейди в «Мои программы»", variant: "destructive" });
    }
  };

  // --- Колбэк от модала: подпрограмма готова ---
  const handleReady = (data) => {
    setShowModal(false);
    // Уведомить родителя чтобы обновить inviteProgram
    if (onSubprogramReady) onSubprogramReady(data);

    // Показать мягкое уведомление
    if (data.wasReused) {
      toast({ title: "✓ Используем уже созданную подпрограмму", description: `Вознаграждение реферала: ${data.rewardAmount?.toLocaleString()} ₽` });
    } else {
      toast({ title: "✓ Подпрограмма создана!", description: `Вознаграждение реферала: ${data.rewardAmount?.toLocaleString()} ₽` });
    }

    // Выполнить изначальное действие с новыми данными
    if (pendingAction === "copy") doCopy(data.inviteLink);
    if (pendingAction === "telegram") doShare(data.inviteLink, data.candidateLink, data.telegramText);
    setPendingAction(null);
  };

  const hasProgram = !!(inviteProgram && inviteLink);
  const canAct = hasProgram || !!baseProgram;

  return (
    <>
      <div className="bg-card border border-border rounded-2xl overflow-hidden mb-8">
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-border/60">
          <div className="flex items-center gap-2 mb-1">
            <Network className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold text-primary uppercase tracking-widest">Масштабируй свою сеть</span>
          </div>
          <p className="text-sm text-muted-foreground leading-snug">
            Отправляй ссылки рефералам, делись частью своей квоты и строй личное дерево участников
          </p>
        </div>

        <div className="p-5 space-y-4">
          {/* Active program card */}
          {hasProgram ? (
            <div className="rounded-xl bg-primary/5 border border-primary/15 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <BadgeCheck className="w-4 h-4 text-green-600 shrink-0" />
                    <span className="text-xs font-semibold text-green-700">Активна сейчас</span>
                  </div>
                  <div className="font-semibold text-sm text-foreground truncate">{programTitle}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">На эту программу ведут ваши ссылки</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-lg font-black text-primary leading-none">{rewardText}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">вознаграждение</div>
                </div>
              </div>
            </div>
          ) : baseProgram ? (
            /* Есть базовая программа, но нет подпрограммы — предлагаем настроить */
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
              <div className="flex items-start gap-3">
                <Zap className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-semibold text-amber-800">Настрой размер выплаты рефералу</div>
                  <div className="text-xs text-amber-700 mt-0.5">
                    При нажатии «Скопировать» или «Telegram» система спросит, сколько платить новому рефералу — и создаст ссылку автоматически
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl bg-muted/60 border border-border p-4 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
              <div>
                <div className="text-sm font-semibold">Нет активной программы</div>
                <div className="text-xs text-muted-foreground">Перейди в «Мои программы», чтобы активировать программу</div>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              onClick={() => handleAction("copy")}
              disabled={!canAct}
              className="flex items-center gap-3 rounded-xl border border-border p-3.5 text-left hover:bg-muted/60 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Copy className="w-4 h-4 text-primary" />
              </div>
              <div>
                <div className="font-semibold text-sm">Скопировать ссылку</div>
                <div className="text-xs text-muted-foreground">
                  {hasProgram
                    ? `Ссылка на «${programTitle.length > 20 ? programTitle.slice(0, 20) + "…" : programTitle}»`
                    : baseProgram ? "Настроим размер выплаты" : "Нет активной программы"}
                </div>
              </div>
            </button>

            <button
              onClick={() => handleAction("telegram")}
              disabled={!canAct}
              className="flex items-center gap-3 rounded-xl border border-border p-3.5 text-left hover:bg-muted/60 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                <Send className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <div className="font-semibold text-sm">Отправить в Telegram</div>
                <div className="text-xs text-muted-foreground">
                  {hasProgram ? `С вознаграждением ${rewardText}` : baseProgram ? "Настроим размер выплаты" : "Нет активной программы"}
                </div>
              </div>
            </button>
          </div>

          {/* Change reward / manage */}
          <div className="pt-1 border-t border-border/50 space-y-0.5">
            {baseProgram && (
              <button
                onClick={() => setShowModal(true)}
                className="flex items-center justify-between text-sm text-muted-foreground hover:text-foreground transition-colors group py-1.5 w-full"
              >
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  <span>Изменить размер выплаты рефералу</span>
                </div>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </button>
            )}
            <Link
              to="/dashboard/link"
              className="flex items-center justify-between text-sm text-muted-foreground hover:text-foreground transition-colors group py-1.5"
            >
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                <span>Все программы и подпрограммы</span>
              </div>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </div>
      </div>

      {showModal && baseProgram && (
        <SetRewardModal
          baseProgram={baseProgram}
          onClose={() => { setShowModal(false); setPendingAction(null); }}
          onReady={handleReady}
        />
      )}
    </>
  );
}
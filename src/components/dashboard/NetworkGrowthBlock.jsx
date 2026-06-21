/**
 * NetworkGrowthBlock — share-flow с управлением sharable subprogram.
 *
 * Правила:
 * - "Скопировать" и "Telegram": если sharable subprogram уже выбрана — сразу действуют;
 *   если нет — открывают SetRewardModal.
 * - "Изменить размер выплаты рефералу": всегда открывает SetRewardModal (смена квоты).
 * - Карточка "Активна сейчас" показывает именно текущую sharable subprogram.
 * - Share-text строится от subprogram.reward_quota, не от базовой программы.
 * - Нет прямой ссылки "Все программы" — управление в MyPrograms через отдельный nav.
 */
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Copy, Send, Network, BadgeCheck, AlertCircle, ChevronRight, Zap, Settings2 } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { formatRewardAmount } from "@/lib/payoutHelpers";
import SetRewardModal from "@/components/dashboard/SetRewardModal";

export default function NetworkGrowthBlock({ inviteProgram, inviteLink, baseProgram, onSubprogramReady }) {
  const [showModal, setShowModal] = useState(false);
  const [pendingAction, setPendingAction] = useState(null); // "copy" | "telegram" | null

  // Данные текущей sharable subprogram
  const reward = inviteProgram?.reward_quota || 0;
  const rewardText = formatRewardAmount(reward);
  const programTitle =
    inviteProgram?.child_prefix_title ||
    inviteProgram?.internal_display_title ||
    inviteProgram?.public_program_title ||
    inviteProgram?.base_program_title ||
    inviteProgram?.title ||
    "";

  // Ссылки строго от subprogram
  const subCandidateLink = inviteProgram?.candidate_form_code
    ? `${window.location.origin}/candidate/${inviteProgram.candidate_form_code}`
    : "";
  const subTelegramText = inviteProgram
    ? `Присоединяйся по моей ссылке. Вознаграждение за участие — ${rewardText}. Заполни анкету:`
    : "";

  const hasSubprogram = !!(inviteProgram && inviteLink);
  const canAct = hasSubprogram || !!baseProgram;

  // --- Выполнить действие с готовыми данными ---
  const execCopy = (link) => {
    if (!link) return;
    navigator.clipboard.writeText(link).then(() =>
      toast({ title: "✓ Ссылка скопирована!", description: rewardText ? `Вознаграждение: ${rewardText}` : undefined })
    );
  };

  const execTelegram = (link, cLink, tgText) => {
    if (!link) return;
    const url = `https://t.me/share/url?url=${encodeURIComponent(cLink || link)}&text=${encodeURIComponent(tgText)}`;
    window.open(url);
  };

  // --- Обработка кнопок copy/telegram ---
  const handleShareAction = (action) => {
    if (hasSubprogram) {
      // Подпрограмма уже выбрана — действуем сразу
      if (action === "copy") execCopy(inviteLink);
      if (action === "telegram") execTelegram(inviteLink, subCandidateLink, subTelegramText);
    } else if (baseProgram) {
      // Нет подпрограммы — нужно выбрать квоту
      setPendingAction(action);
      setShowModal(true);
    } else {
      toast({ title: "Нет активной программы", description: "Перейди в «Мои программы»", variant: "destructive" });
    }
  };

  // --- Открыть модал смены квоты ---
  const handleChangeReward = () => {
    if (!baseProgram) {
      toast({ title: "Нет активной программы", description: "Перейди в «Мои программы»", variant: "destructive" });
      return;
    }
    setPendingAction(null);
    setShowModal(true);
  };

  // --- Колбэк от SetRewardModal ---
  const handleReady = (data) => {
    setShowModal(false);
    if (onSubprogramReady) onSubprogramReady(data);

    if (data.wasReused) {
      toast({ title: "✓ Используем уже созданную подпрограмму", description: `Вознаграждение: ${data.rewardAmount?.toLocaleString()} ₽` });
    } else {
      toast({ title: "✓ Подпрограмма создана", description: `Вознаграждение: ${data.rewardAmount?.toLocaleString()} ₽` });
    }

    // Выполнить отложенное действие с новыми данными от сервера
    if (pendingAction === "copy") execCopy(data.inviteLink);
    if (pendingAction === "telegram") execTelegram(data.inviteLink, data.candidateLink, data.telegramText);
    setPendingAction(null);
  };

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

          {/* Карточка активной sharable subprogram */}
          {hasSubprogram ? (
            <div className="rounded-xl bg-primary/5 border border-primary/15 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <BadgeCheck className="w-4 h-4 text-green-600 shrink-0" />
                    <span className="text-xs font-semibold text-green-700">Активна сейчас</span>
                  </div>
                  <div className="font-semibold text-sm text-foreground truncate">{programTitle}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">На эту подпрограмму ведут ваши ссылки</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-lg font-black text-primary leading-none">{rewardText}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">реферал получит</div>
                </div>
              </div>
            </div>
          ) : baseProgram ? (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
              <div className="flex items-start gap-3">
                <Zap className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-semibold text-amber-800">Укажи размер выплаты рефералу</div>
                  <div className="text-xs text-amber-700 mt-0.5">
                    При нажатии «Скопировать» или «Telegram» система спросит сумму и создаст ссылку автоматически
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

          {/* Copy + Telegram */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              onClick={() => handleShareAction("copy")}
              disabled={!canAct}
              className="flex items-center gap-3 rounded-xl border border-border p-3.5 text-left hover:bg-muted/60 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Copy className="w-4 h-4 text-primary" />
              </div>
              <div>
                <div className="font-semibold text-sm">Скопировать ссылку</div>
                <div className="text-xs text-muted-foreground">
                  {hasSubprogram
                    ? `Вознаграждение реферала: ${rewardText}`
                    : baseProgram ? "Сначала выберем размер выплаты" : "Нет активной программы"}
                </div>
              </div>
            </button>

            <button
              onClick={() => handleShareAction("telegram")}
              disabled={!canAct}
              className="flex items-center gap-3 rounded-xl border border-border p-3.5 text-left hover:bg-muted/60 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                <Send className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <div className="font-semibold text-sm">Отправить в Telegram</div>
                <div className="text-xs text-muted-foreground">
                  {hasSubprogram ? `С вознаграждением ${rewardText}` : baseProgram ? "Сначала выберем размер выплаты" : "Нет активной программы"}
                </div>
              </div>
            </button>
          </div>

          {/* Изменить размер выплаты — основной CTA этого блока */}
          <div className="pt-1 border-t border-border/50">
            <button
              onClick={handleChangeReward}
              disabled={!baseProgram}
              className="flex items-center justify-between text-sm text-muted-foreground hover:text-foreground transition-colors group py-1.5 w-full disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <div className="flex items-center gap-2">
                <Settings2 className="w-4 h-4" />
                <span>Изменить размер выплаты рефералу</span>
              </div>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </button>
            <Link
              to="/dashboard/link"
              className="flex items-center justify-between text-sm text-muted-foreground hover:text-foreground transition-colors group py-1.5"
            >
              <div className="flex items-center gap-2">
                <ChevronRight className="w-3.5 h-3.5 opacity-50" />
                <span>Управлять всеми подпрограммами</span>
              </div>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </div>
      </div>

      {showModal && baseProgram && (
        <SetRewardModal
          baseProgram={baseProgram}
          currentSubprogram={inviteProgram}
          onClose={() => { setShowModal(false); setPendingAction(null); }}
          onReady={handleReady}
        />
      )}
    </>
  );
}
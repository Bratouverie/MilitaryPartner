import React from "react";
import { Link } from "react-router-dom";
import { Copy, Send, Network, TrendingUp, BadgeCheck, AlertCircle, ChevronRight } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { formatRewardAmount, generateTelegramShareText } from "@/lib/payoutHelpers";

/**
 * Growth-блок «Масштабируй свою сеть».
 * Показывает активную программу, вознаграждение и actions для роста сети.
 */
export default function NetworkGrowthBlock({ inviteProgram, inviteLink, onTelegram }) {
  const programTitle =
    inviteProgram?.child_prefix_title ||
    inviteProgram?.internal_display_title ||
    inviteProgram?.public_program_title ||
    inviteProgram?.base_program_title ||
    inviteProgram?.title ||
    "Программа";

  const reward = inviteProgram?.reward_quota || 0;
  const rewardText = formatRewardAmount(reward);

  const shareText = inviteProgram
    ? `Присоединяйся к программе «${inviteProgram.public_program_title || inviteProgram.base_program_title || programTitle}». Вознаграждение за вступление — ${rewardText}. Заполни анкету: ${inviteLink}`
    : "";

  const handleCopy = () => {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink).then(() =>
      toast({ title: "✓ Ссылка скопирована!", description: inviteProgram ? `Ссылка на программу «${programTitle}»` : undefined })
    );
  };

  const handleTelegram = () => {
    if (!inviteProgram || !inviteLink) {
      toast({ title: "Нет активной программы", variant: "destructive" });
      return;
    }
    const text = generateTelegramShareText(inviteProgram);
    window.open(`https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${encodeURIComponent(text)}`);
  };

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden mb-8">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-border/60">
        <div className="flex items-center gap-2 mb-1">
          <Network className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold text-primary uppercase tracking-widest">Масштабируй свою сеть</span>
        </div>
        <p className="text-sm text-muted-foreground leading-snug">
          Отправляй ссылки рефералам, создавай подпрограммы в пределах своей квоты и строй личное дерево участников
        </p>
      </div>

      <div className="p-5 space-y-4">
        {/* Active program card */}
        {inviteProgram ? (
          <div className="rounded-xl bg-primary/5 border border-primary/15 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <BadgeCheck className="w-4 h-4 text-green-600 shrink-0" />
                  <span className="text-xs font-semibold text-green-700">Активна сейчас</span>
                </div>
                <div className="font-semibold text-sm text-foreground truncate">{programTitle}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Именно на эту программу ведут ваши ссылки</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-lg font-black text-primary leading-none">{rewardText}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">вознаграждение</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl bg-muted/60 border border-border p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
            <div>
              <div className="text-sm font-semibold">Нет активной программы</div>
              <div className="text-xs text-muted-foreground">Перейди в «Мои программы», чтобы активировать или создать подпрограмму</div>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            onClick={handleCopy}
            disabled={!inviteLink}
            className="flex items-center gap-3 rounded-xl border border-border p-3.5 text-left hover:bg-muted/60 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Copy className="w-4 h-4 text-primary" />
            </div>
            <div>
              <div className="font-semibold text-sm">Скопировать ссылку</div>
              <div className="text-xs text-muted-foreground">
                {inviteProgram ? `Ссылка на «${programTitle.length > 18 ? programTitle.slice(0, 18) + "…" : programTitle}»` : "Нет активной программы"}
              </div>
            </div>
          </button>

          <button
            onClick={handleTelegram}
            disabled={!inviteProgram || !inviteLink}
            className="flex items-center gap-3 rounded-xl border border-border p-3.5 text-left hover:bg-muted/60 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
              <Send className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <div className="font-semibold text-sm">Отправить в Telegram</div>
              <div className="text-xs text-muted-foreground">
                {inviteProgram ? `С текстом о программе и ${rewardText}` : "Нет активной программы"}
              </div>
            </div>
          </button>
        </div>

        {/* Secondary entry to programs */}
        <div className="pt-1 border-t border-border/50">
          <Link
            to="/dashboard/link"
            className="flex items-center justify-between text-sm text-muted-foreground hover:text-foreground transition-colors group py-1"
          >
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              <span>Управлять программами и подпрограммами</span>
            </div>
            <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      </div>
    </div>
  );
}
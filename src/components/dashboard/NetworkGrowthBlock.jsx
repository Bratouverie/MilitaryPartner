/**
 * NetworkGrowthBlock — share-flow блок на главной партнёра.
 * Упрощённая версия — отправляет ссылку из активной базовой программы напрямую.
 */
import React from "react";
import { Link } from "react-router-dom";
import { Copy, Send, Network, BadgeCheck, AlertCircle, ChevronRight, Settings2 } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

export default function NetworkGrowthBlock({ baseProgram }) {
  // Используем ссылку из базовой программы напрямую
  const programTitle = baseProgram?.public_program_title || baseProgram?.base_program_title || baseProgram?.title || "Программа";
  const rewardAmount = baseProgram?.reward_quota || 0;
  const rewardText = rewardAmount > 0 ? `${rewardAmount.toLocaleString()} ₽` : "";

  const inviteLink = baseProgram?.link_code
    ? `${window.location.origin}/join/${baseProgram.link_code}`
    : "";

  const candidateLink = baseProgram?.candidate_form_code
    ? `${window.location.origin}/candidate/${baseProgram.candidate_form_code}`
    : "";

  const hasLink = !!inviteLink;

  const telegramText = baseProgram
    ? `Присоединяйся по моей ссылке. Вознаграждение за участие — ${rewardText}. Заполни анкету:`
    : "";

  const execCopy = () => {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink).then(() =>
      toast({ title: "✓ Ссылка скопирована!", description: `Вознаграждение реферала: ${rewardText}` })
    );
  };

  const execTelegram = () => {
    if (!inviteLink) return;
    const url = `https://t.me/share/url?url=${encodeURIComponent(candidateLink || inviteLink)}&text=${encodeURIComponent(telegramText)}`;
    window.open(url);
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

          {/* Карточка активной программы */}
          {baseProgram ? (
            <div className="rounded-xl bg-primary/5 border border-primary/15 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <BadgeCheck className="w-4 h-4 text-green-600 shrink-0" />
                    <span className="text-xs font-semibold text-green-700">Активна сейчас</span>
                  </div>
                  <div className="font-semibold text-sm text-foreground truncate">{programTitle}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Используется для приглашения рефералов</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-lg font-black text-primary leading-none">{rewardText}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">реферал получит</div>
                </div>
              </div>
            </div>
          ) : (
            /* Нет базовой программы — recovery CTA */
            <div className="rounded-xl bg-muted/60 border border-border p-4">
              <div className="flex items-start gap-3 mb-3">
                <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-semibold">Нет активной программы</div>
                  <div className="text-xs text-muted-foreground">Выбери программу в разделе «Мои программы», чтобы начать приглашать рефералов</div>
                </div>
              </div>
              <Link
                to="/dashboard/programs"
                className="flex items-center justify-center gap-2 w-full bg-primary text-primary-foreground rounded-lg h-9 text-sm font-semibold hover:bg-primary/90 transition-colors"
              >
                Открыть Мои программы →
              </Link>
            </div>
          )}

          {/* Action кнопки — только если есть ссылка */}
          {hasLink && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                onClick={execCopy}
                className="flex items-center gap-3 rounded-xl border border-border p-3.5 text-left hover:bg-muted/60 active:scale-[0.98] transition-all"
              >
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Copy className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <div className="font-semibold text-sm">Скопировать ссылку</div>
                  <div className="text-xs text-muted-foreground">Вознаграждение реферала: {rewardText}</div>
                </div>
              </button>

              <button
                onClick={execTelegram}
                className="flex items-center gap-3 rounded-xl border border-border p-3.5 text-left hover:bg-muted/60 active:scale-[0.98] transition-all"
              >
                <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                  <Send className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <div className="font-semibold text-sm">Отправить в Telegram</div>
                  <div className="text-xs text-muted-foreground">С вознаграждением {rewardText}</div>
                </div>
              </button>
            </div>
          )}

          {/* Управление подпрограммой */}
          <div className="pt-3 border-t border-border/50">
            {/* Навигация в /dashboard/link — всегда доступна */}
            <Link
              to="/dashboard/link"
              className="flex items-center justify-between text-sm text-muted-foreground hover:text-foreground transition-colors group py-2"
            >
              <div className="flex items-center gap-2">
                <Settings2 className="w-4 h-4" />
                <span>Управление подпрограммами</span>
              </div>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>

        </div>
      </div>
    </>
  );
}
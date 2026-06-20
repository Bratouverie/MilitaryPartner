import React from "react";
import { Shield, CheckCircle } from "lucide-react";

export default function GuaranteesSection() {
  const guarantees = [
    {
      title: "Если кандидат отказался",
      detail: "→ Ты не теряешь ничего (никакой штраф)",
    },
    {
      title: "Если медкомиссия не прошла",
      detail: "→ Мы возмещаем твои потери за кандидата",
    },
    {
      title: "Если контракт расторгнут",
      detail: "→ Выплата фиксирована на момент подписи",
    },
    {
      title: "Если платёж задержался на банке",
      detail: "→ Мы покрываем комиссию и процент",
    },
    {
      title: "Если что-то непонятно",
      detail: "→ Служба поддержки 24/7 (Telegram, Email)",
    },
  ];

  return (
    <section className="py-20 bg-card border-t border-border px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Shield className="w-8 h-8 text-primary" />
          <h2 className="font-heading text-3xl font-bold">ГАРАНТИИ</h2>
        </div>

        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-8">
          <p className="text-sm font-bold uppercase tracking-widest text-primary mb-6">
            ТЫ ЗАЩИЩЁН В ЛЮБОМ СЛУЧАЕ
          </p>

          <div className="space-y-4">
            {guarantees.map((g, i) => (
              <div key={i} className="flex gap-4 items-start">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <div className="font-medium">{g.title}</div>
                  <div className="text-sm text-muted-foreground">{g.detail}</div>
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs text-muted-foreground mt-6 pt-6 border-t border-border">
            Дочитай FAQ если хочешь больше деталей
          </p>
        </div>
      </div>
    </section>
  );
}
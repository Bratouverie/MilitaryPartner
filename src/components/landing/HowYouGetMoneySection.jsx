import React, { useState } from "react";
import { ChevronDown } from "lucide-react";

export default function HowYouGetMoneySection() {
  const [expandedStep, setExpandedStep] = useState(null);

  const steps = [
    {
      num: 1,
      title: "ТЫ ОТПРАВЛЯЕШЬ ССЫЛКУ (5 минут)",
      icon: "🔗",
      items: [
        "Скопировал/поделился своей реф-ссылкой → готово",
        "Человек перешёл по ней → он видит выгоду",
      ],
    },
    {
      num: 2,
      title: "КАНДИДАТ ЗАПОЛНЯЕТ АНКЕТУ (15 мин)",
      icon: "👤",
      items: [
        "Видит описание программы",
        "Заполняет 3 поля (имя, телефон, согласие)",
        "Система регистрирует его ЗА ТОБОЙ",
      ],
    },
    {
      num: 3,
      title: "МЕДКОМИССИЯ + КОНТРАКТ (7-14 дней)",
      icon: "🏥",
      items: [
        "Наш куратор звонит кандидату",
        "Объясняет условия, сроки, требования",
        "Кандидат подписывает контракт",
      ],
    },
    {
      num: 4,
      title: "ДЕНЬГИ НА СЧЁТ (7 дней)",
      icon: "💰",
      items: [
        "Контракт подписан → система считает сумму",
        "Проверяет: условия соблюдены? ✓",
        "Инициирует платёж через банк",
        "ТЫ ВИДИШЬ В ЛИЧНОМ КАБИНЕТЕ: 'Выплачено' + сумма + дата",
      ],
    },
    {
      num: 5,
      title: "КАНДИДАТ ЕДЕТ СЛУЖИТЬ",
      icon: "🎖️",
      items: ["Ты уже заработал, остальное его путь"],
    },
  ];

  return (
    <section className="py-20 bg-background px-4">
      <div className="max-w-4xl mx-auto">
        <h2 className="font-heading text-3xl md:text-4xl font-bold text-center mb-12">
          КАК ТЫ ПОЛУЧАЕШЬ ДЕНЬГИ? (Всё ПРОЗРАЧНО)
        </h2>

        <div className="space-y-3">
          {steps.map((step) => (
            <div
              key={step.num}
              className="border border-border rounded-xl overflow-hidden"
            >
              <button
                onClick={() =>
                  setExpandedStep(expandedStep === step.num ? null : step.num)
                }
                className="w-full bg-card hover:bg-muted/50 transition-colors p-5 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-4 flex-1 text-left">
                  <div className="text-4xl">{step.icon}</div>
                  <div>
                    <div className="font-heading font-bold text-lg">ЭТАП {step.num}</div>
                    <div className="text-sm text-muted-foreground">{step.title}</div>
                  </div>
                </div>
                <ChevronDown
                  className={`w-5 h-5 transition-transform shrink-0 ${
                    expandedStep === step.num ? "rotate-180" : ""
                  }`}
                />
              </button>

              {expandedStep === step.num && (
                <div className="bg-muted/30 p-5 border-t border-border space-y-2">
                  {step.items.map((item, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="text-primary font-bold mt-0.5">└</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
import React from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Send, FileCheck, ShieldCheck, Banknote } from "lucide-react";

const steps = [
  { icon: Send, title: "Ты отправляешь ссылку", desc: "Получи персональную реферальную ссылку и поделись ею с потенциальными кандидатами через мессенджеры, соцсети или лично." },
  { icon: FileCheck, title: "Кандидат заполняет анкету", desc: "Кандидат переходит по ссылке, заполняет короткую анкету с контактными данными и мотивацией. Куратор свяжется с ним в течение 4 часов." },
  { icon: ShieldCheck, title: "Система проверяет и подтверждает", desc: "Куратор сопровождает кандидата на всех этапах: звонок, документы, медкомиссия, подписание контракта. Каждый шаг отслеживается в системе." },
  { icon: Banknote, title: "Деньги на счёт (7 дней)", desc: "После подтверждённого прибытия кандидата награда переходит в статус обработки и выплачивается на ваш счёт в течение 7 рабочих дней." },
];

export default function HowWePaySection() {
  return (
    <section className="py-20 bg-card">
      <div className="max-w-4xl mx-auto px-4">
        <h2 className="font-heading text-3xl md:text-4xl font-bold text-center mb-3">Как мы платим</h2>
        <p className="text-muted-foreground text-center mb-12 text-lg">Прозрачный процесс от ссылки до выплаты</p>
        <Accordion type="single" collapsible className="space-y-3">
          {steps.map((step, i) => (
            <AccordionItem key={i} value={`step-${i}`} className="border border-border rounded-xl px-6 bg-background">
              <AccordionTrigger className="hover:no-underline py-5">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <step.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="text-left">
                    <span className="text-xs text-muted-foreground font-medium">Этап {i + 1}</span>
                    <div className="font-heading font-semibold text-base">{step.title}</div>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pl-14 pb-5 text-muted-foreground leading-relaxed">
                {step.desc}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
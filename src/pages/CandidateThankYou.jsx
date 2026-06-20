/**
 * /candidate/thank-you — Страница следующего шага после отправки анкеты.
 * Полноценная web page с описанием этапов, иконками, CTA.
 * Принимает ?program=<title>&region=<region> из URL params.
 */
import React from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Shield, CheckCircle, Phone, Calendar, MapPin, FileText, Users, Star, ArrowRight, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

const STEPS = [
  {
    icon: Phone,
    title: "Звонок куратора",
    description: "В течение 1–2 рабочих дней с вами свяжется куратор для уточнения деталей и ответов на вопросы.",
    time: "1–2 рабочих дня",
    color: "bg-blue-50 text-blue-600",
  },
  {
    icon: MapPin,
    title: "Согласование региона",
    description: "Совместно определим место прохождения службы с учётом ваших предпочтений и доступных вакансий.",
    time: "2–5 дней",
    color: "bg-purple-50 text-purple-600",
  },
  {
    icon: Calendar,
    title: "Организация выезда",
    description: "Куратор помогает организовать логистику: транспорт, проживание, документы для поездки.",
    time: "3–7 дней",
    color: "bg-cyan-50 text-cyan-600",
  },
  {
    icon: FileText,
    title: "Медкомиссия",
    description: "Прохождение военно-врачебной комиссии по месту службы. Всё необходимое предоставляется.",
    time: "1–2 дня",
    color: "bg-teal-50 text-teal-600",
  },
  {
    icon: Star,
    title: "Подписание контракта",
    description: "Официальное оформление и начало службы. Выплаты рефералу производятся после этого этапа.",
    time: "После медкомиссии",
    color: "bg-green-50 text-green-600",
  },
];

export default function CandidateThankYou() {
  const [searchParams] = useSearchParams();
  const programTitle = searchParams.get("program") || "";
  const region = searchParams.get("region") || "";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-primary py-4 px-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-accent" />
            <span className="font-display font-bold text-xl text-primary-foreground">МилитариПартнер</span>
          </div>
          <Link to="/" className="text-xs text-primary-foreground/70 hover:text-primary-foreground transition-colors">
            На главную
          </Link>
        </div>
      </header>

      <div className="flex-1 max-w-3xl mx-auto px-4 py-12 w-full">
        {/* Success banner */}
        <div className="text-center mb-10">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="font-heading text-3xl font-black mb-2">Анкета принята!</h1>
          {programTitle ? (
            <p className="text-muted-foreground text-base">
              Вы подали анкету на участие в программе <strong>«{programTitle}»</strong>
              {region ? ` (${region})` : ""}
            </p>
          ) : (
            <p className="text-muted-foreground text-base">Ваша анкета успешно отправлена и принята в работу</p>
          )}
        </div>

        {/* Important info */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-8">
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <div className="font-medium text-amber-900 mb-1">Что важно знать прямо сейчас</div>
              <ul className="text-sm text-amber-800 space-y-1">
                <li>• Куратор свяжется с вами в рабочее время (пн–пт, 9:00–18:00)</li>
                <li>• Будьте готовы ответить на звонок — это ускорит процесс</li>
                <li>• Подготовьте паспорт и СНИЛС для дальнейших этапов</li>
                <li>• Если вопросы возникнут раньше — свяжитесь через реферала, который вас пригласил</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Steps */}
        <div className="mb-8">
          <h2 className="font-heading font-bold text-xl mb-4">Что будет дальше</h2>
          <div className="space-y-4">
            {STEPS.map((step, i) => (
              <div key={i} className="flex items-start gap-4 p-4 bg-card border border-border rounded-2xl">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${step.color}`}>
                  <step.icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="font-medium">{i + 1}. {step.title}</div>
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full shrink-0">{step.time}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ block */}
        <div className="bg-card border border-border rounded-2xl p-6 mb-8">
          <h2 className="font-heading font-bold mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />Часто задаваемые вопросы
          </h2>
          <div className="space-y-4">
            {[
              { q: "Когда мне перезвонят?", a: "Куратор свяжется в течение 1–2 рабочих дней. Звонок будет с незнакомого номера — не пропустите." },
              { q: "Можно ли выбрать место службы?", a: "Да, регион обсуждается с куратором на втором этапе с учётом ваших предпочтений и доступных позиций." },
              { q: "Что нужно подготовить?", a: "Паспорт РФ, СНИЛС. Дополнительные документы уточнит куратор." },
              { q: "Можно ли отказаться на любом этапе?", a: "Да, до подписания контракта вы можете отказаться в любой момент без каких-либо последствий." },
            ].map((item, i) => (
              <div key={i}>
                <div className="font-medium text-sm mb-1">{item.q}</div>
                <div className="text-sm text-muted-foreground">{item.a}</div>
                {i < 3 && <div className="border-t border-border mt-3" />}
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <Link to="/">
            <Button variant="outline" className="gap-2">
              На главную
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
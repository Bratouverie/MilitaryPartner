import React from "react";
import PublicHeader from "@/components/landing/PublicHeader";
import HeroSection from "@/components/landing/HeroSection";
import HowWePaySection from "@/components/landing/HowWePaySection";
import FAQSection from "@/components/landing/FAQSection";
import Footer from "@/components/landing/Footer";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight, Users, Share2, CheckCircle, Banknote, TrendingUp } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen">
      <PublicHeader />
      <HeroSection />
      <HowWePaySection />
      
      {/* Воронка работы платформы */}
      <section className="py-20 bg-card border-t border-border">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="font-heading text-3xl md:text-4xl font-bold mb-3">Как это работает: от партнёра до выплаты</h2>
            <p className="text-muted-foreground text-lg">Полный цикл привлечения кандидатов и получения вознаграждения</p>
          </div>
          
          <div className="grid md:grid-cols-5 gap-4 mb-8">
            {[
              { icon: Users, num: "01", title: "Партнёр", desc: "Получает кабинет и личную ссылку" },
              { icon: Share2, num: "02", title: "Делится", desc: "Отправляет ссылку знакомым" },
              { icon: CheckCircle, num: "03", title: "Кандидат", desc: "Заполняет анкету по ссылке" },
              { icon: TrendingUp, num: "04", title: "Прогресс", desc: "Проходит этапы отбора" },
              { icon: Banknote, num: "05", title: "Выплата", desc: "Получает вознаграждение" },
            ].map((step, i) => (
              <div key={i} className="relative">
                <div className="bg-background border border-border rounded-xl p-5 text-center hover:shadow-lg hover:border-primary/50 transition-all">
                  <div className="inline-block w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                    <step.icon className="w-6 h-6 text-primary" />
                  </div>
                  <div className="text-xs font-bold text-primary mb-2">{step.num}</div>
                  <h3 className="font-heading font-bold text-sm mb-1">{step.title}</h3>
                  <p className="text-xs text-muted-foreground">{step.desc}</p>
                </div>
                {i < 4 && <div className="absolute -right-2 top-1/2 -translate-y-1/2 hidden md:flex"><ArrowRight className="w-4 h-4 text-muted-foreground" /></div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Роли платформы */}
      <section className="py-20 bg-background">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="font-heading text-3xl md:text-4xl font-bold mb-3">Четыре роли одной платформы</h2>
            <p className="text-muted-foreground text-lg">От инвестора до боевого кандидата</p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { role: "👨‍💼 Администратор", color: "bg-blue-50 border-blue-200", points: ["Управляет программами", "Назначает модераторов", "Отслеживает выплаты", "Видит полную аналитику"] },
              { role: "📊 Модератор", color: "bg-indigo-50 border-indigo-200", points: ["Управляет ветвями дерева", "Следит за кандидатами", "Помогает рефералам расти", "Анализирует конверсию"] },
              { role: "🔗 Реферал/Партнёр", color: "bg-teal-50 border-teal-200", points: ["Получает партнёрскую ссылку", "Приводит кандидатов", "Смотрит свои выплаты", "Создаёт подпрограммы"] },
              { role: "🎯 Кандидат", color: "bg-emerald-50 border-emerald-200", points: ["Заполняет анкету", "Проходит отбор", "Получает контракт", "Видит свой статус"] },
            ].map((item, i) => (
              <div key={i} className={`border rounded-xl p-5 ${item.color}`}>
                <h3 className="font-heading font-bold text-sm mb-3">{item.role}</h3>
                <ul className="space-y-2">
                  {item.points.map((point, j) => (
                    <li key={j} className="flex items-start gap-2 text-xs text-foreground">
                      <span className="text-primary font-bold">✓</span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-card border-t border-border">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="font-heading text-3xl md:text-4xl font-bold mb-4">Уже участвуете в программе?</h2>
          <p className="text-muted-foreground text-lg mb-8">Войдите в кабинет по секретному коду, который вы получили при регистрации.</p>
          <Link to="/secret-login">
            <Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 font-bold text-lg px-8 h-14 rounded-xl">
              Войти в кабинет <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
          <p className="text-sm text-muted-foreground mt-4">Для вступления в программу нужна реферальная ссылка от действующего участника или приглашение администратора.</p>
        </div>
      </section>
      <FAQSection />
      <Footer />
    </div>
  );
}
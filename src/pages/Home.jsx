import React from "react";
import PublicHeader from "@/components/landing/PublicHeader";
import ReferralHeroSection from "@/components/landing/ReferralHeroSection";
import HowYouGetMoneySection from "@/components/landing/HowYouGetMoneySection";
import GuaranteesSection from "@/components/landing/GuaranteesSection";
import FAQSection from "@/components/landing/FAQSection";
import Footer from "@/components/landing/Footer";
import AIConsultant from "@/components/landing/AIConsultant";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen">
      <PublicHeader />
      <ReferralHeroSection />
      <HowYouGetMoneySection />
      <GuaranteesSection />

      {/* Примеры заработка */}
      <section className="py-20 bg-background px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-center mb-12">
            РЕАЛЬНЫЕ ПРИМЕРЫ ЗАРАБОТКА
          </h2>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                role: "НОВИЧОК",
                name: "Иван, 28 лет, Москва",
                stats: ["Привёл 5 кандидатов", "3 подписали контракт"],
                calc: "3 × 150 000",
                total: "450 000 ₽ в месяц",
                quote: "Это как моя зарплата, только за поделиться в Telegram!",
                color: "bg-blue-50 border-blue-200",
              },
              {
                role: "АКТИВНЫЙ",
                name: "Петр, 35 лет, Питер",
                stats: ["Привёл 20 кандидатов", "12 подписали контракт"],
                calc: "12 × 180 000",
                total: "2 160 000 ₽ в месяц",
                quote: "Я делаю это как второй доход. Рекомендую друзьям.",
                color: "bg-indigo-50 border-indigo-200",
                best: true,
              },
              {
                role: "ТОП-РЕФЕРАЛ",
                name: "Сергей, 42 года, Екатеринбург",
                stats: ["Привёл 60 кандидатов", "35 подписали контракт"],
                calc: "35 × 200 000",
                total: "7 000 000 ₽ в месяц",
                quote: "Это стало моим основным доходом. Помогаю стране и зарабатываю.",
                color: "bg-emerald-50 border-emerald-200",
              },
            ].map((example, i) => (
              <div key={i} className={`border rounded-2xl p-6 ${example.color} ${example.best ? "ring-2 ring-primary" : ""}`}>
                <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
                  {example.role}
                </div>
                <h3 className="font-heading font-bold text-lg mb-2">{example.name}</h3>
                <ul className="text-sm text-muted-foreground space-y-1 mb-4">
                  {example.stats.map((stat, j) => (
                    <li key={j}>├─ {stat}</li>
                  ))}
                </ul>
                <div className="bg-white/50 rounded-lg p-3 mb-4 font-mono text-sm">
                  <div className="text-muted-foreground">{example.calc}</div>
                  <div className="font-bold text-primary text-lg">{example.total}</div>
                </div>
                <p className="text-sm italic text-muted-foreground">
                  "{example.quote}"
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Почему верить */}
      <section className="py-20 bg-card border-t border-border px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-center mb-12">
            3 ПРИЧИНЫ ВЕРИТЬ НАМ (антиинцидент)
          </h2>

          <div className="space-y-6">
            {[
              {
                title: "ПРИЧИНА 1: Деньги идут из бюджета МО",
                items: [
                  "Это не наши деньги. Это государственные деньги за рекрутинг.",
                  "Мы просто администрируем систему.",
                ],
              },
              {
                title: "ПРИЧИНА 2: Полная прозрачность в личном кабинете",
                items: [
                  "Видишь каждого кандидата",
                  "Видишь статус (медком → контракт → выплата)",
                  "Видишь трек-номер платежа",
                  "Видишь историю всех выплат (вниз по цепи)",
                ],
              },
              {
                title: "ПРИЧИНА 3: Мы платим даже если кандидат передумал",
                items: [
                  "(Честный ответ: если контракт не подписан, нет выплаты)",
                  "НО: мы помогаем ускорить процесс, чтобы он подписал",
                  "Куратор звонит, объясняет, отвечает на вопросы",
                ],
              },
            ].map((section, i) => (
              <div key={i} className="border border-border rounded-xl p-6 bg-background">
                <h3 className="font-heading font-bold text-lg mb-4">{section.title}</h3>
                <ul className="space-y-2">
                  {section.items.map((item, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="text-primary mt-0.5">└</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Потенциал сети */}
      <section className="py-20 bg-primary text-primary-foreground px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="font-heading text-3xl md:text-4xl font-bold mb-8">
            ПОТЕНЦИАЛ ТВОЕЙ СЕТИ
          </h2>

          <div className="bg-white/10 backdrop-blur border border-primary-foreground/20 rounded-2xl p-8 mb-8">
            <div className="text-sm font-bold uppercase tracking-widest opacity-90 mb-6">
              Если привлечешь 10 рефералов...
            </div>
            <div className="space-y-3 text-lg font-medium mb-6">
              <div>Каждый привлечёт 5 кандидатов</div>
              <div>50% подпишут контракты</div>
              <div>× 150 000 ₽ за контракт</div>
            </div>
            <div className="text-5xl font-black text-accent mb-4">
              37 500 000 ₽ / год
            </div>
            <Button
              variant="outline"
              className="bg-white text-primary hover:bg-white/90 font-bold text-base"
            >
              РАССЧИТАТЬ ДЛЯ СЕБЯ
            </Button>
          </div>
        </div>
      </section>

      <section className="py-20 bg-card border-t border-border px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-heading text-3xl md:text-4xl font-bold mb-4">
            Уже участвуете в программе?
          </h2>
          <p className="text-muted-foreground text-lg mb-8">
            Войдите в кабинет по секретному коду, который вы получили при регистрации.
          </p>
          <Link to="/secret-login">
            <Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 font-bold text-lg px-8 h-14 rounded-xl">
              Войти в кабинет <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
          <p className="text-sm text-muted-foreground mt-4">
            Для вступления в программу нужна реферальная ссылка от действующего участника или приглашение администратора.
          </p>
        </div>
      </section>

      <FAQSection />
      <Footer />
      <AIConsultant />
    </div>
  );
}
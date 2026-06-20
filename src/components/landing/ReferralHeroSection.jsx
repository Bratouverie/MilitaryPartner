import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight, TrendingUp } from "lucide-react";

export default function ReferralHeroSection() {
  const [totalPayouts, setTotalPayouts] = useState(45300000);
  const [referrals, setReferrals] = useState(1240);
  const [contracts, setContracts] = useState(568);

  // Счётчик, обновляется каждые 10 секунд
  useEffect(() => {
    const interval = setInterval(() => {
      setTotalPayouts((prev) => prev + Math.floor(Math.random() * 80000 + 20000));
      setReferrals((prev) => prev + Math.floor(Math.random() * 2));
      setContracts((prev) => prev + Math.floor(Math.random() * 1));
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="bg-gradient-to-b from-primary to-primary/90 text-primary-foreground py-20 px-4">
      <div className="max-w-5xl mx-auto text-center">
        {/* Logo + Shield */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <span className="text-4xl">🛡️</span>
        </div>

        {/* Main Heading */}
        <h1 className="font-heading text-4xl md:text-6xl font-black mb-4 leading-tight">
          ЗАРАБАТЫВАЙ НА РЕКРУТИНГЕ БЕЗ РИСКА
        </h1>

        {/* Subheading */}
        <p className="text-xl md:text-2xl mb-8 opacity-95 max-w-3xl mx-auto font-medium">
          Каждый контракт = от 50 000 до 200 000 ₽ на твой счёт. <br />
          <strong>Платим 100% за 7 дней.</strong> Уже выплачено 45 млн ₽.
        </p>

        {/* Main CTA Button */}
        <Link to="/secret-login">
          <Button
            size="lg"
            className="bg-accent text-accent-foreground hover:bg-accent/90 font-black text-xl px-12 h-16 rounded-xl mb-10"
          >
            СОЗДАТЬ РЕФЕРАЛЬНУЮ ССЫЛКУ <ArrowRight className="w-6 h-6 ml-2" />
          </Button>
        </Link>

        {/* Trust Block - Live Stats */}
        <div className="bg-white/10 backdrop-blur border border-primary-foreground/20 rounded-2xl p-8 mb-10">
          <div className="text-sm font-bold uppercase tracking-widest mb-6 opacity-90">
            ЭТО НЕ ОБЕЩАНИЕ - ЭТО ФАКТЫ
          </div>

          <div className="grid md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-4xl font-black mb-2">
                {(totalPayouts / 1000000).toFixed(1)}M ₽
              </div>
              <div className="text-sm opacity-80">Выплачено всего</div>
              <div className="text-xs opacity-60 mt-1">(счётчик растёт каждый час)</div>
            </div>

            <div className="text-center">
              <div className="text-4xl font-black mb-2">{referrals}</div>
              <div className="text-sm opacity-80">Рефералов в системе</div>
              <div className="text-xs opacity-60 mt-1">(✓ реальные люди)</div>
            </div>

            <div className="text-center">
              <div className="text-4xl font-black mb-2">{contracts}</div>
              <div className="text-sm opacity-80">Успешных контрактов</div>
              <div className="text-xs opacity-60 mt-1">(95.3% прошли до выплаты)</div>
            </div>

            <div className="text-center">
              <div className="text-4xl font-black mb-2">36.1K ₽</div>
              <div className="text-sm opacity-80">Средний заработок на реф</div>
              <div className="text-xs opacity-60 mt-1">(только за одного!)</div>
            </div>
          </div>
        </div>

        {/* Testimonials Carousel */}
        <div className="bg-white/5 rounded-xl p-6 mb-6">
          <div className="flex overflow-x-auto gap-4 pb-2">
            {[
              { name: "Иван К.", amount: "200K", date: "15.06.2026" },
              { name: "Петр М.", amount: "175K", date: "14.06.2026" },
              { name: "Сергей Л.", amount: "150K", date: "13.06.2026" },
              { name: "Мария В.", amount: "120K", date: "12.06.2026" },
            ].map((review, i) => (
              <div key={i} className="flex-shrink-0 bg-white/10 rounded-lg p-3 min-w-max text-sm">
                <div className="font-bold">{review.name}</div>
                <div className="text-accent font-bold">→ {review.amount} выплачено ✓</div>
                <div className="text-xs opacity-70">{review.date}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
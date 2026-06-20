import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Shield, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";

export default function HeroSection() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [referrers, candidates, rewards] = await Promise.all([
          base44.entities.ReferralProfile.filter({ role: "referrer" }),
          base44.entities.CandidateApplication.list(),
          base44.entities.Reward.filter({ status: "paid" }),
        ]);
        const totalPaid = rewards.reduce((s, r) => s + (r.amount || 0), 0);
        if (referrers.length > 0 || candidates.length > 0) {
          setStats({ referrers: referrers.length, candidates: candidates.length, totalPaid });
        }
      } catch {}
    };
    load();
  }, []);

  return (
    <section className="relative overflow-hidden bg-primary py-20 md:py-32">
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 left-0 w-96 h-96 bg-accent rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-accent rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
      </div>
      <div className="relative max-w-6xl mx-auto px-4 text-center">
        <div className="inline-flex items-center gap-2 bg-accent/20 text-accent px-4 py-1.5 rounded-full text-sm font-medium mb-6">
          <Shield className="w-4 h-4" />
          Реферальная платформа
        </div>
        <h1 className="font-display text-4xl md:text-6xl font-black text-primary-foreground tracking-tight leading-tight mb-6">
          Зарабатывай на <br className="hidden md:block" />
          <span className="text-accent">рекрутинге</span>
        </h1>
        <p className="text-primary-foreground/70 text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
          Участвуй в партнёрской программе по реферальной ссылке, привлекай кандидатов и получай вознаграждение за каждого подтверждённого контракта.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
          <Link to="/secret-login">
            <Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 font-bold text-lg px-8 h-14 rounded-xl">
              Войти в кабинет <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
          <Link to="/how-it-works">
            <Button size="lg" variant="outline" className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10 font-medium text-lg px-8 h-14 rounded-xl">
              Как это работает
            </Button>
          </Link>
        </div>

        {/* Only show stats if we have real data */}
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
            {[
              { label: "Рефералов в сети", value: stats.referrers > 0 ? `${stats.referrers}+` : null },
              { label: "Выплачено рефералам", value: stats.totalPaid > 0 ? `${(stats.totalPaid).toLocaleString()} ₽` : null },
              { label: "Кандидатов привлечено", value: stats.candidates > 0 ? `${stats.candidates}+` : null },
            ].filter(s => s.value).map((s) => (
              <div key={s.label} className="bg-primary-foreground/5 backdrop-blur-sm rounded-xl p-5 border border-primary-foreground/10">
                <div className="text-2xl font-bold text-primary-foreground">{s.value}</div>
                <div className="text-sm text-primary-foreground/60">{s.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
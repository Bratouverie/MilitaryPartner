import React from "react";
import { Button } from "@/components/ui/button";
import { Shield, TrendingUp, Users } from "lucide-react";
import { Link } from "react-router-dom";

export default function HeroSection() {
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
          Делись персональной ссылкой, привлекай кандидатов на контракт и получай вознаграждение до 200 000 ₽ за каждого подтверждённого.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
          <Link to="/register-referrer">
            <Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 font-bold text-lg px-8 h-14 rounded-xl">
              Создать мою реферальную ссылку
            </Button>
          </Link>
          <Link to="/how-it-works">
            <Button size="lg" variant="outline" className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10 font-medium text-lg px-8 h-14 rounded-xl">
              Как это работает
            </Button>
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
          {[
            { icon: Users, label: "Рефералов в сети", value: "340+" },
            { icon: TrendingUp, label: "Выплачено всего", value: "2.3 млн ₽" },
            { icon: Shield, label: "Средняя за контракт", value: "165 000 ₽" },
          ].map((s) => (
            <div key={s.label} className="bg-primary-foreground/5 backdrop-blur-sm rounded-xl p-5 border border-primary-foreground/10">
              <s.icon className="w-6 h-6 text-accent mx-auto mb-2" />
              <div className="text-2xl font-bold text-primary-foreground">{s.value}</div>
              <div className="text-sm text-primary-foreground/60">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
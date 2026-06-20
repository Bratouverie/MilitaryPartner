import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import PublicHeader from "@/components/landing/PublicHeader";
import Footer from "@/components/landing/Footer";
import { Eye, Clock, CheckCircle, Lock, ArrowRight } from "lucide-react";

const guarantees = [
  { icon: Eye, title: "Полная прозрачность", desc: "Каждый статус вашего кандидата и каждая выплата видны в личном кабинете в реальном времени." },
  { icon: Clock, title: "Выплата в 7 дней", desc: "После подтверждения прибытия кандидата деньги поступают на ваш счёт в течение 7 рабочих дней." },
  { icon: CheckCircle, title: "Ручная верификация", desc: "Каждая награда проходит проверку администратором. Это гарантирует точность и исключает ошибки." },
  { icon: Lock, title: "Безопасность данных", desc: "Все данные передаются по защищённому каналу. Секретный код используется вместо пароля." },
];

export default function Guarantees() {
  return (
    <div className="min-h-screen">
      <PublicHeader />
      <section className="py-20 bg-background">
        <div className="max-w-4xl mx-auto px-4">
          <h1 className="font-heading text-4xl md:text-5xl font-bold text-center mb-4">Гарантии и выплаты</h1>
          <p className="text-muted-foreground text-center text-lg mb-16">Мы создали систему, в которой доверие — не слово, а механизм</p>
          <div className="grid md:grid-cols-2 gap-6">
            {guarantees.map((g, i) => (
              <div key={i} className="bg-card border border-border rounded-2xl p-6">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <g.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-heading font-bold text-lg mb-2">{g.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{g.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-16 text-center">
            <Link to="/register-referrer">
              <Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 font-bold text-lg px-8 h-14 rounded-xl">
                Стать рефералом <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
}
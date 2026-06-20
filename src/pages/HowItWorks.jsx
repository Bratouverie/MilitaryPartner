import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import Footer from "@/components/landing/Footer";
import { UserPlus, LinkIcon, FileText, Banknote, ArrowRight, Shield } from "lucide-react";

const steps = [
  { icon: UserPlus, title: "Зарегистрируйся", desc: "Заполни короткую форму, укажи контакты и выбери сумму вознаграждения за каждого кандидата. Получи персональный секретный код для входа." },
  { icon: LinkIcon, title: "Получи персональную ссылку", desc: "После регистрации тебе будет присвоена уникальная реферальная ссылка. Делись ей в мессенджерах, соцсетях и лично." },
  { icon: FileText, title: "Кандидат заполняет анкету", desc: "Кандидат переходит по ссылке, видит информацию о контракте и заполняет короткую анкету. Куратор связывается в течение 4 часов." },
  { icon: Banknote, title: "Получи выплату", desc: "После подтверждённого прибытия кандидата награда начисляется на твой счёт. Вся история выплат видна в личном кабинете." },
];

export default function HowItWorks() {
  return (
    <div className="min-h-screen">
      <header className="bg-primary py-4 px-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-accent" />
            <span className="font-display font-bold text-xl text-primary-foreground">МилитариПартнер</span>
          </Link>
          <Link to="/login"><Button variant="outline" size="sm" className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10">Вход</Button></Link>
        </div>
      </header>

      <section className="py-20 bg-background">
        <div className="max-w-4xl mx-auto px-4">
          <h1 className="font-heading text-4xl md:text-5xl font-bold text-center mb-4">Как это работает</h1>
          <p className="text-muted-foreground text-center text-lg mb-16">4 простых шага от регистрации до выплаты</p>

          <div className="space-y-8">
            {steps.map((step, i) => (
              <div key={i} className="flex gap-6 items-start">
                <div className="shrink-0 w-14 h-14 rounded-2xl bg-primary flex items-center justify-center">
                  <step.icon className="w-6 h-6 text-accent" />
                </div>
                <div className="pt-1">
                  <div className="text-xs font-medium text-muted-foreground mb-1">Шаг {i + 1}</div>
                  <h3 className="font-heading font-bold text-xl mb-2">{step.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-16 text-center">
            <Link to="/register-referrer">
              <Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 font-bold text-lg px-8 h-14 rounded-xl">
                Начать сейчас <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
}
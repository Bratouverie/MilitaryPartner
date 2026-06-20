/**
 * /register-referrer — публичная регистрация ОТКЛЮЧЕНА.
 * Попасть в систему можно только по реферальной/мастер-ссылке.
 * Эта страница теперь является информационной.
 */
import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Shield, Lock, ArrowRight } from "lucide-react";

export default function RegisterReferrer() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-primary py-4 px-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-accent" />
            <span className="font-display font-bold text-xl text-primary-foreground">МилитариПартнер</span>
          </Link>
          <Link to="/secret-login">
            <Button variant="outline" size="sm" className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10">
              Войти
            </Button>
          </Link>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md text-center">
          <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-6">
            <Lock className="w-10 h-10 text-muted-foreground" />
          </div>
          <h1 className="font-heading text-2xl font-bold mb-3">Вход только по приглашению</h1>
          <p className="text-muted-foreground mb-6 leading-relaxed">
            Стать партнёром программы МилитариПартнер можно только по реферальной ссылке от действующего участника или по мастер-ссылке модератора.
          </p>

          <div className="bg-card border border-border rounded-2xl p-5 mb-6 text-left space-y-3 text-sm">
            <div className="font-medium text-foreground mb-2">Как попасть в программу:</div>
            <div className="flex items-start gap-2">
              <span className="text-primary font-bold mt-0.5">1.</span>
              <span>Получите реферальную ссылку от действующего партнёра</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-primary font-bold mt-0.5">2.</span>
              <span>Перейдите по ссылке — кабинет создаётся мгновенно</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-primary font-bold mt-0.5">3.</span>
              <span>Сохраните секретный код — это ваш единственный ключ входа</span>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <Link to="/secret-login">
              <Button className="w-full bg-primary font-bold h-12 rounded-xl">
                Войти по секретному коду <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <Link to="/faq">
              <Button variant="outline" className="w-full h-12 rounded-xl">
                Узнать подробнее о программе
              </Button>
            </Link>
          </div>

          <p className="text-xs text-muted-foreground mt-6">
            Если вы потеряли код — обратитесь к куратору программы, который выдал вам приглашение.
          </p>
        </div>
      </div>
    </div>
  );
}
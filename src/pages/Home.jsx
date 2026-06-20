import React from "react";
import PublicHeader from "@/components/landing/PublicHeader";
import HeroSection from "@/components/landing/HeroSection";
import HowWePaySection from "@/components/landing/HowWePaySection";
import FAQSection from "@/components/landing/FAQSection";
import Footer from "@/components/landing/Footer";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen">
      <PublicHeader />
      <HeroSection />
      <HowWePaySection />
      <section className="py-20 bg-background">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="font-heading text-3xl md:text-4xl font-bold mb-4">Уже участвуете в программе?</h2>
          <p className="text-muted-foreground text-lg mb-8">Войдите в кабинет по секретному коду, который вы получили при регистрации.</p>
          <Link to="/secret-login">
            <Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 font-bold text-lg px-8 h-14 rounded-xl">
              Войти в кабинет <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
          <p className="text-sm text-muted-foreground mt-4">Для вступления в программу нужна реферальная ссылка от действующего участника.</p>
        </div>
      </section>
      <FAQSection />
      <Footer />
    </div>
  );
}
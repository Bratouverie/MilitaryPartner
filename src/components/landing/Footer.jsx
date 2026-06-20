import React from "react";
import { Shield } from "lucide-react";
import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="bg-primary py-12">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-accent" />
            <span className="font-display font-bold text-xl text-primary-foreground">МилитариПартнер</span>
          </div>
          <div className="flex flex-wrap gap-6 text-sm text-primary-foreground/60">
            <Link to="/how-it-works" className="hover:text-primary-foreground transition-colors">Как это работает</Link>
            <Link to="/guarantees" className="hover:text-primary-foreground transition-colors">Гарантии</Link>
            <Link to="/faq" className="hover:text-primary-foreground transition-colors">FAQ</Link>
            <Link to="/login" className="hover:text-primary-foreground transition-colors">Вход</Link>
          </div>
        </div>
        <div className="mt-8 pt-8 border-t border-primary-foreground/10 text-center text-sm text-primary-foreground/40">
          © {new Date().getFullYear()} МилитариПартнер. Все права защищены.
        </div>
      </div>
    </footer>
  );
}
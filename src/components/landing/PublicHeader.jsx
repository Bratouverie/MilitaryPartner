import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Shield, Menu, X } from "lucide-react";
import { getStoredProfileId, getStoredRole } from "@/lib/profileSession";

export default function PublicHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);

  // Read from sessionStorage synchronously — no async delay, no flicker
  const profileId = getStoredProfileId();
  const role = getStoredRole();
  const isLoggedIn = !!profileId;

  const ctaDest = () => {
    if (!isLoggedIn) return "/secret-login";
    if (role === "referrer") return "/dashboard";
    if (role === "moderator") return "/moderator";
    return "/admin";
  };

  const ctaLabel = () => {
    if (!isLoggedIn) return "Войти";
    if (role === "referrer") return "Личный кабинет";
    return "Управлять";
  };

  return (
    <header className="bg-primary border-b border-primary-foreground/10">
      <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <Shield className="w-6 h-6 text-accent" />
          <span className="font-display font-bold text-xl text-primary-foreground">МилитариПартнер</span>
        </Link>

        <nav className="hidden md:flex items-center gap-6">
          <Link to="/how-it-works" className="text-sm text-primary-foreground/70 hover:text-primary-foreground transition-colors">Как это работает</Link>
          <Link to="/guarantees" className="text-sm text-primary-foreground/70 hover:text-primary-foreground transition-colors">Гарантии</Link>
          <Link to="/faq" className="text-sm text-primary-foreground/70 hover:text-primary-foreground transition-colors">FAQ</Link>
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <Link to="/register-referrer">
            <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90 font-medium">Получить ссылку</Button>
          </Link>
          <Link to={ctaDest()}>
            <Button size="sm" variant="outline" className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10">
              {ctaLabel()}
            </Button>
          </Link>
        </div>

        <button className="md:hidden text-primary-foreground p-1" onClick={() => setMobileOpen(o => !o)}>
          {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden bg-primary border-t border-primary-foreground/10 px-4 py-4 space-y-3">
          <Link to="/how-it-works" onClick={() => setMobileOpen(false)} className="block text-sm text-primary-foreground/80 py-1">Как это работает</Link>
          <Link to="/guarantees" onClick={() => setMobileOpen(false)} className="block text-sm text-primary-foreground/80 py-1">Гарантии</Link>
          <Link to="/faq" onClick={() => setMobileOpen(false)} className="block text-sm text-primary-foreground/80 py-1">FAQ</Link>
          <div className="flex gap-3 pt-2">
            <Link to="/register-referrer" onClick={() => setMobileOpen(false)} className="flex-1">
              <Button size="sm" className="w-full bg-accent text-accent-foreground">Получить ссылку</Button>
            </Link>
            <Link to={ctaDest()} onClick={() => setMobileOpen(false)} className="flex-1">
              <Button size="sm" variant="outline" className="w-full border-primary-foreground/30 text-primary-foreground">{ctaLabel()}</Button>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
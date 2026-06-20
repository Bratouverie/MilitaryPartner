import React from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Shield, LayoutDashboard, LinkIcon, Users, Banknote, CreditCard, Trophy, LogOut, Key } from "lucide-react";

const navItems = [
  { path: "/dashboard", icon: LayoutDashboard, label: "Обзор" },
  { path: "/dashboard/link", icon: LinkIcon, label: "Моя ссылка" },
  { path: "/dashboard/candidates", icon: Users, label: "Кандидаты" },
  { path: "/dashboard/rewards", icon: Banknote, label: "Начисления" },
  { path: "/dashboard/payouts", icon: CreditCard, label: "Выплаты" },
  { path: "/dashboard/leaderboard", icon: Trophy, label: "Рейтинг" },
  { path: "/dashboard/security", icon: Key, label: "Безопасность" },
];

export default function DashboardLayout() {
  const location = useLocation();

  const handleLogout = () => {
    base44.auth.logout("/");
  };

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="hidden lg:flex flex-col w-64 bg-sidebar border-r border-sidebar-border shrink-0">
        <div className="p-5 flex items-center gap-2">
          <Shield className="w-6 h-6 text-sidebar-primary" />
          <span className="font-display font-bold text-lg text-sidebar-foreground">МилитариПартнер</span>
        </div>
        <nav className="flex-1 px-3 space-y-1 mt-4">
          {navItems.map(item => {
            const active = location.pathname === item.path;
            return (
              <Link key={item.path} to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${active ? "bg-sidebar-accent text-sidebar-primary" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"}`}>
                <item.icon className="w-5 h-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 mt-auto">
          <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 w-full transition-colors">
            <LogOut className="w-5 h-5" />
            Выход
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-h-screen">
        <header className="lg:hidden bg-primary py-3 px-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-accent" />
            <span className="font-display font-bold text-primary-foreground">МилитариПартнер</span>
          </div>
          <button onClick={handleLogout} className="text-primary-foreground/60">
            <LogOut className="w-5 h-5" />
          </button>
        </header>

        <nav className="lg:hidden flex overflow-x-auto border-b border-border bg-card px-2 py-1.5 gap-1">
          {navItems.map(item => {
            const active = location.pathname === item.path;
            return (
              <Link key={item.path} to={item.path}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
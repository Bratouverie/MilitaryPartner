import React from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import {
  Shield, LayoutDashboard, Link2, Users, UserCheck,
  Banknote, FileText, BarChart2, ClipboardList, LogOut, Settings
} from "lucide-react";

const navItems = [
  { path: "/admin", icon: LayoutDashboard, label: "Обзор" },
  { path: "/admin/master-links", icon: Link2, label: "Мастер-ссылки" },
  { path: "/admin/users", icon: Users, label: "Пользователи" },
  { path: "/admin/candidates", icon: UserCheck, label: "Кандидаты" },
  { path: "/admin/rewards", icon: Banknote, label: "Награды" },
  { path: "/admin/payouts", icon: FileText, label: "Выплаты" },
  { path: "/admin/analytics", icon: BarChart2, label: "Аналитика" },
  { path: "/admin/logs", icon: ClipboardList, label: "Логи" },
];

export default function AdminLayout() {
  const location = useLocation();
  return (
    <div className="min-h-screen flex bg-background">
      <aside className="hidden lg:flex flex-col w-64 bg-sidebar border-r border-sidebar-border shrink-0">
        <div className="p-5 flex items-center gap-2 border-b border-sidebar-border">
          <Shield className="w-6 h-6 text-sidebar-primary" />
          <div>
            <div className="font-display font-bold text-sm text-sidebar-foreground">МилитариПартнер</div>
            <div className="text-xs text-sidebar-foreground/50">Панель управления</div>
          </div>
        </div>
        <nav className="flex-1 px-3 space-y-0.5 mt-4">
          {navItems.map(item => {
            const active = location.pathname === item.path;
            return (
              <Link key={item.path} to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${active ? "bg-sidebar-primary text-sidebar-primary-foreground" : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"}`}>
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <button onClick={() => base44.auth.logout("/")}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent w-full transition-colors">
            <LogOut className="w-4 h-4" /> Выход
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        <header className="lg:hidden bg-primary py-3 px-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-accent" />
            <span className="font-display font-bold text-primary-foreground">Админ</span>
          </div>
          <button onClick={() => base44.auth.logout("/")} className="text-primary-foreground/60"><LogOut className="w-5 h-5" /></button>
        </header>
        <nav className="lg:hidden flex overflow-x-auto border-b border-border bg-card px-2 py-1.5 gap-1">
          {navItems.map(item => {
            const active = location.pathname === item.path;
            return (
              <Link key={item.path} to={item.path}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
                <item.icon className="w-3.5 h-3.5" />{item.label}
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
import React, { useState } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { Shield, LayoutDashboard, Briefcase, LinkIcon, Users, Banknote, CreditCard, Trophy, LogOut, Key, Menu, X } from "lucide-react";
import { clearStoredProfile } from "@/lib/profileSession";
import { ProfileProvider } from "@/lib/useProfile.jsx";

const navItems = [
  { path: "/dashboard", icon: LayoutDashboard, label: "Обзор" },
  { path: "/dashboard/programs", icon: Briefcase, label: "Мои программы" },
  { path: "/dashboard/link", icon: LinkIcon, label: "Ссылки" },
  { path: "/dashboard/candidates", icon: Users, label: "Кандидаты" },
  { path: "/dashboard/rewards", icon: Banknote, label: "Начисления" },
  { path: "/dashboard/payouts", icon: CreditCard, label: "Выплаты" },
  { path: "/dashboard/leaderboard", icon: Trophy, label: "Рейтинг" },
  { path: "/dashboard/security", icon: Key, label: "Безопасность" },
];

function NavLink({ item, onClick }) {
  const location = useLocation();
  const active = location.pathname === item.path;
  return (
    <Link
      to={item.path}
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
        active ? "bg-sidebar-accent text-sidebar-primary" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
      }`}
    >
      <item.icon className="w-5 h-5" />
      {item.label}
    </Link>
  );
}

export default function DashboardLayout() {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    clearStoredProfile();
    navigate("/secret-login", { replace: true });
  };

  return (
    <ProfileProvider>
      <div className="min-h-screen flex bg-background">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex flex-col w-64 bg-sidebar border-r border-sidebar-border shrink-0">
          <div className="p-5 flex items-center gap-2">
            <Shield className="w-6 h-6 text-sidebar-primary" />
            <span className="font-display font-bold text-lg text-sidebar-foreground">МилитариПартнер</span>
          </div>
          <nav className="flex-1 px-3 space-y-1 mt-4">
            {navItems.map(item => <NavLink key={item.path} item={item} />)}
          </nav>
          <div className="p-3 mt-auto">
            <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 w-full transition-colors">
              <LogOut className="w-5 h-5" /> Выход
            </button>
          </div>
        </aside>

        <div className="flex-1 flex flex-col min-h-screen">
          {/* Mobile header */}
          <header className="lg:hidden bg-primary py-3 px-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-accent" />
              <span className="font-display font-bold text-primary-foreground">МилитариПартнер</span>
            </div>
            <button onClick={() => setMobileOpen(o => !o)} className="text-primary-foreground p-1">
              {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </header>

          {/* Mobile drawer overlay */}
          {mobileOpen && (
            <div className="lg:hidden fixed inset-0 z-40" onClick={() => setMobileOpen(false)}>
              <div className="absolute inset-0 bg-black/50" />
              <div className="absolute top-0 left-0 w-72 h-full bg-sidebar flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="p-5 flex items-center gap-2 border-b border-sidebar-border">
                  <Shield className="w-6 h-6 text-sidebar-primary" />
                  <span className="font-display font-bold text-lg text-sidebar-foreground">МилитариПартнер</span>
                </div>
                <nav className="flex-1 px-3 space-y-1 mt-4">
                  {navItems.map(item => <NavLink key={item.path} item={item} onClick={() => setMobileOpen(false)} />)}
                </nav>
                <div className="p-3 border-t border-sidebar-border">
                  <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 w-full transition-colors">
                    <LogOut className="w-5 h-5" /> Выход
                  </button>
                </div>
              </div>
            </div>
          )}

          <main className="flex-1 p-4 md:p-8 overflow-y-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </ProfileProvider>
  );
}
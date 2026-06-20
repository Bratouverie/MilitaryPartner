import React, { useState } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { clearStoredProfile } from "@/lib/profileSession";
import { ProfileProvider } from "@/lib/useProfile.jsx";
import { Shield, LayoutDashboard, Link2, Users, UserCheck, Banknote, FileText, BarChart2, ClipboardList, LogOut, Menu, X } from "lucide-react";

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

function NavLink({ item, onClick }) {
  const location = useLocation();
  const active = location.pathname === item.path;
  return (
    <Link
      to={item.path}
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
        active ? "bg-sidebar-primary text-sidebar-primary-foreground" : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
      }`}
    >
      <item.icon className="w-4 h-4" />
      {item.label}
    </Link>
  );
}

export default function AdminLayout() {
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
          <div className="p-5 flex items-center gap-2 border-b border-sidebar-border">
            <Shield className="w-6 h-6 text-sidebar-primary" />
            <div>
              <div className="font-display font-bold text-sm text-sidebar-foreground">МилитариПартнер</div>
              <div className="text-xs text-sidebar-foreground/50">Панель управления</div>
            </div>
          </div>
          <nav className="flex-1 px-3 space-y-0.5 mt-4">
            {navItems.map(item => <NavLink key={item.path} item={item} />)}
          </nav>
          <div className="p-3 border-t border-sidebar-border">
            <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent w-full transition-colors">
              <LogOut className="w-4 h-4" /> Выход
            </button>
          </div>
        </aside>

        <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
          {/* Mobile header */}
          <header className="lg:hidden bg-primary py-3 px-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-accent" />
              <span className="font-display font-bold text-primary-foreground">Администратор</span>
            </div>
            <button onClick={() => setMobileOpen(o => !o)} className="text-primary-foreground p-1">
              {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </header>

          {/* Mobile drawer */}
          {mobileOpen && (
            <div className="lg:hidden fixed inset-0 z-40" onClick={() => setMobileOpen(false)}>
              <div className="absolute inset-0 bg-black/50" />
              <div className="absolute top-0 left-0 w-72 h-full bg-sidebar flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="p-5 flex items-center gap-2 border-b border-sidebar-border">
                  <Shield className="w-6 h-6 text-sidebar-primary" />
                  <div>
                    <div className="font-display font-bold text-sm text-sidebar-foreground">МилитариПартнер</div>
                    <div className="text-xs text-sidebar-foreground/50">Панель управления</div>
                  </div>
                </div>
                <nav className="flex-1 px-3 space-y-0.5 mt-4">
                  {navItems.map(item => <NavLink key={item.path} item={item} onClick={() => setMobileOpen(false)} />)}
                </nav>
                <div className="p-3 border-t border-sidebar-border">
                  <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent w-full transition-colors">
                    <LogOut className="w-4 h-4" /> Выход
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
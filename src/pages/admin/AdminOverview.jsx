import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, Link2, Users, UserCheck, Banknote, TrendingUp, Clock, ShieldCheck, GitBranch, AlertCircle, CheckCircle, Eye, Target } from "lucide-react";
import { getStoredRole } from "@/lib/profileSession";
import moment from "moment";
import { Link } from "react-router-dom";

const STATUS_LABELS = {
  NEW: "Новый", QUESTIONNAIRE_FILLED: "Анкета заполнена", CONTRACT_SIGNED: "Контракт подписан",
  UNIT_ASSIGNED: "В части", RETURNED_HEALTHY: "Вернулся", REJECTED: "Отклонён",
  MEDICAL_EXAM_DONE: "Медкомиссия", CURATOR_CALL_SCHEDULED: "Звонок запланирован",
  CURATOR_CALL_DONE: "Звонок проведён",
};
const STATUS_COLOR = {
  NEW: "bg-gray-100 text-gray-700", QUESTIONNAIRE_FILLED: "bg-blue-100 text-blue-700",
  CONTRACT_SIGNED: "bg-green-100 text-green-700", UNIT_ASSIGNED: "bg-green-200 text-green-800",
  REJECTED: "bg-red-100 text-red-700", MEDICAL_EXAM_DONE: "bg-teal-100 text-teal-700",
};

export default function AdminOverview() {
  const [stats, setStats] = useState(null);
  const [recentCandidates, setRecentCandidates] = useState([]);
  const [topReferrers, setTopReferrers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      // Единый источник истины: root ReferralProgram (не MasterLink)
      const [rootPrograms, allPrograms, referrers, candidates, rewards] = await Promise.all([
        base44.entities.ReferralProgram.filter({ is_root: true }),
        base44.entities.ReferralProgram.list(),
        base44.entities.ReferralProfile.filter({ role: "referrer" }),
        base44.entities.CandidateApplication.list("-created_date", 50),
        base44.entities.Reward.list(),
      ]);

      const childPrograms = allPrograms.filter(p => !p.is_root);
      const pending = rewards.filter(r => r.status === "pending");
      const paid = rewards.filter(r => r.status === "paid");

      setStats({
        rootPrograms: rootPrograms.length,       // Единый источник: ReferralProgram is_root
        childPrograms: childPrograms.length,
        totalPrograms: allPrograms.length,
        referrers: referrers.length,
        candidates: candidates.length,
        contractSigned: candidates.filter(c => c.current_status === "CONTRACT_SIGNED").length,
        pendingRewards: pending.length,
        pendingAmount: pending.reduce((s, r) => s + (r.amount || 0), 0),
        paidAmount: paid.reduce((s, r) => s + (r.amount || 0), 0),
      });
      setRecentCandidates(candidates.slice(0, 6));
      setTopReferrers(referrers.sort((a, b) => (b.total_earned || 0) - (a.total_earned || 0)).slice(0, 5));
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  const role = getStoredRole();
  const roleLabel = role === "super_admin" ? "Супер-администратор" : "Администратор";
  const roleBadge = role === "super_admin" ? "bg-amber-100 text-amber-800 border-amber-200" : "bg-blue-100 text-blue-800 border-blue-200";

  const kpiMetrics = [
    { 
      icon: Link2, 
      label: "Корневые программы", 
      value: stats.rootPrograms, 
      sub: `из ${stats.totalPrograms} всего`, 
      color: "bg-blue-50 text-blue-700 border-blue-200",
      path: "/admin/master-links"
    },
    { 
      icon: GitBranch, 
      label: "Веток в дереве", 
      value: stats.childPrograms, 
      color: "bg-indigo-50 text-indigo-700 border-indigo-200",
      path: "/admin/master-links"
    },
    { 
      icon: Users, 
      label: "Активных рефералов", 
      value: stats.referrers, 
      color: "bg-teal-50 text-teal-700 border-teal-200",
      path: "/admin/users"
    },
    { 
      icon: UserCheck, 
      label: "Кандидатов всего", 
      value: stats.candidates, 
      sub: `${stats.contractSigned} контрактов`, 
      color: "bg-emerald-50 text-emerald-700 border-emerald-200",
      path: "/admin/candidates"
    },
    { 
      icon: Clock, 
      label: "На выплату (₽)", 
      value: `${(stats.pendingAmount / 1000).toFixed(0)}К`, 
      sub: `${stats.pendingRewards} записей`, 
      color: "bg-amber-50 text-amber-700 border-amber-200",
      path: "/admin/payouts"
    },
    { 
      icon: Banknote, 
      label: "Выплачено (₽)", 
      value: `${(stats.paidAmount / 1000).toFixed(0)}К`, 
      color: "bg-green-50 text-green-700 border-green-200",
      path: "/admin/payouts"
    },
  ];

  // Статусы для быстрого определения узких мест
  const bottlenecks = [
    { 
      status: "NEW", 
      label: "Новых анкет", 
      count: recentCandidates.filter(c => c.current_status === "NEW").length,
      icon: AlertCircle,
      hint: "Требуют звонка куратора"
    },
    { 
      status: "CONTRACT_SIGNED", 
      label: "Подписано контрактов", 
      count: stats.contractSigned,
      icon: CheckCircle,
      hint: "Отличный прогресс"
    },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold">Панель управления</h1>
          <p className="text-sm text-muted-foreground mt-1">Быстрый обзор ключевых метрик платформы</p>
        </div>
        <div className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-full border ${roleBadge}`}>
          <ShieldCheck className="w-4 h-4" /> {roleLabel}
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {kpiMetrics.map((m, i) => (
          <Link key={i} to={m.path} className="group">
            <div className={`${m.color} border rounded-xl p-5 cursor-pointer transition-all hover:shadow-lg hover:scale-105 hover:border-current`}>
              <div className="flex items-center justify-between mb-2">
                <m.icon className="w-5 h-5" />
                <Eye className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="text-xs font-medium opacity-80 mb-1">{m.label}</div>
              <div className="font-heading text-2xl font-bold">{m.value}</div>
              {m.sub && <div className="text-xs opacity-70 mt-1">{m.sub}</div>}
            </div>
          </Link>
        ))}
      </div>

      {/* Bottleneck Alerts */}
      <div className="grid lg:grid-cols-2 gap-4 mb-8">
        {bottlenecks.map((b, i) => (
          <div key={i} className={`border rounded-xl p-4 ${b.count > 0 ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${b.count > 0 ? 'bg-amber-100' : 'bg-green-100'}`}>
                <b.icon className={`w-5 h-5 ${b.count > 0 ? 'text-amber-700' : 'text-green-700'}`} />
              </div>
              <div className="flex-1">
                <div className={`font-medium ${b.count > 0 ? 'text-amber-900' : 'text-green-900'}`}>{b.label}</div>
                <div className={`text-xs ${b.count > 0 ? 'text-amber-700' : 'text-green-700'}`}>{b.hint}</div>
              </div>
              <div className="font-heading text-xl font-bold">{b.count}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Link to="/admin/candidates" className="group">
          <div className="bg-card border border-border rounded-2xl p-6 cursor-pointer hover:shadow-lg hover:border-primary/50 transition-all h-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading font-bold">Последние кандидаты</h2>
              <Eye className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <div className="space-y-3">
              {recentCandidates.length === 0 && <p className="text-muted-foreground text-sm">Кандидатов нет</p>}
              {recentCandidates.map(c => (
                <div key={c.id} className="flex items-center justify-between gap-2 hover:bg-muted/30 p-2 rounded transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{c.full_name || "—"}</div>
                    <div className="text-xs text-muted-foreground">{c.phone} · {moment(c.created_date).format("DD.MM.YYYY")}</div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${STATUS_COLOR[c.current_status] || "bg-gray-100 text-gray-600"}`}>
                    {STATUS_LABELS[c.current_status] || c.current_status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Link>
        <Link to="/admin/users" className="group">
          <div className="bg-card border border-border rounded-2xl p-6 cursor-pointer hover:shadow-lg hover:border-primary/50 transition-all h-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading font-bold">🏆 Топ рефералов</h2>
              <Eye className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <div className="space-y-3">
              {topReferrers.length === 0 && <p className="text-muted-foreground text-sm">Нет данных</p>}
              {topReferrers.map((r, i) => (
                <div key={r.id} className="flex items-center gap-3 hover:bg-muted/30 p-2 rounded transition-colors">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-gray-200 text-gray-700' : 'bg-orange-100 text-orange-700'}`}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{r.full_name || "—"}</div>
                    <div className="text-xs text-muted-foreground">{r.total_candidates_count || 0} кандидатов · уровень {r.level?.replace(/_/g, " ") || "—"}</div>
                  </div>
                  <div className="font-bold text-sm whitespace-nowrap">{(r.total_earned || 0).toLocaleString()} ₽</div>
                </div>
              ))}
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
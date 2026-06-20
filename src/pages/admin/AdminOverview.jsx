import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, Link2, Users, UserCheck, Banknote, TrendingUp, Clock, ShieldCheck } from "lucide-react";
import { getStoredRole } from "@/lib/profileSession";

export default function AdminOverview() {
  const [stats, setStats] = useState(null);
  const [recentCandidates, setRecentCandidates] = useState([]);
  const [topReferrers, setTopReferrers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [masterLinks, referrers, candidates, rewards] = await Promise.all([
        base44.entities.MasterLink.list(),
        base44.entities.ReferralProfile.filter({ role: "referrer" }),
        base44.entities.CandidateApplication.list(),
        base44.entities.Reward.list(),
      ]);
      const pending = rewards.filter(r => r.status === "pending");
      const paid = rewards.filter(r => r.status === "paid");
      setStats({
        masterLinks: masterLinks.length,
        referrers: referrers.length,
        candidates: candidates.length,
        pendingRewards: pending.length,
        pendingAmount: pending.reduce((s, r) => s + (r.amount || 0), 0),
        paidAmount: paid.reduce((s, r) => s + (r.amount || 0), 0),
      });
      setRecentCandidates(candidates.slice(0, 5));
      setTopReferrers(referrers.sort((a, b) => (b.total_earned || 0) - (a.total_earned || 0)).slice(0, 5));
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  const cards = [
    { icon: Link2, label: "Мастер-ссылки", value: stats.masterLinks, color: "text-blue-600" },
    { icon: Users, label: "Рефераlov", value: stats.referrers, color: "text-indigo-600" },
    { icon: UserCheck, label: "Кандидаты", value: stats.candidates, color: "text-emerald-600" },
    { icon: Clock, label: "Ожидают выплаты", value: stats.pendingRewards, color: "text-amber-600" },
    { icon: TrendingUp, label: "Ожидаемая сумма", value: `${stats.pendingAmount.toLocaleString()} ₽`, color: "text-orange-600" },
    { icon: Banknote, label: "Выплачено", value: `${stats.paidAmount.toLocaleString()} ₽`, color: "text-green-600" },
  ];

  const statusColor = {
    NEW: "bg-gray-100 text-gray-700", QUESTIONNAIRE_FILLED: "bg-blue-100 text-blue-700",
    CONTRACT_SIGNED: "bg-green-100 text-green-700", REJECTED: "bg-red-100 text-red-700",
    MEDICAL_EXAM_DONE: "bg-teal-100 text-teal-700", UNIT_ASSIGNED: "bg-green-200 text-green-800",
  };

  const role = getStoredRole();
  const roleLabel = role === "super_admin" ? "Супер-администратор" : "Администратор";
  const roleBadge = role === "super_admin"
    ? "bg-amber-100 text-amber-800 border-amber-200"
    : "bg-blue-100 text-blue-800 border-blue-200";

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="font-heading text-2xl font-bold">Панель управления</h1>
        <div className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-full border ${roleBadge}`}>
          <ShieldCheck className="w-4 h-4" />
          Вы вошли как: <strong>{roleLabel}</strong>
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {cards.map((c, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <c.icon className={`w-5 h-5 ${c.color}`} />
              <span className="text-sm text-muted-foreground">{c.label}</span>
            </div>
            <div className="font-heading text-2xl font-bold">{c.value}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-2xl p-6">
          <h2 className="font-heading font-bold mb-4">Последние кандидаты</h2>
          <div className="space-y-3">
            {recentCandidates.map(c => (
              <div key={c.id} className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-sm">{c.full_name}</div>
                  <div className="text-xs text-muted-foreground">{c.phone}</div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor[c.current_status] || "bg-gray-100 text-gray-600"}`}>
                  {c.current_status?.replace(/_/g, " ")}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-card border border-border rounded-2xl p-6">
          <h2 className="font-heading font-bold mb-4">Топ рефералов</h2>
          <div className="space-y-3">
            {topReferrers.map((r, i) => (
              <div key={r.id} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">{i + 1}</div>
                <div className="flex-1">
                  <div className="font-medium text-sm">{r.full_name}</div>
                  <div className="text-xs text-muted-foreground">{r.total_candidates_count || 0} кандидатов</div>
                </div>
                <div className="font-bold text-sm">{(r.total_earned || 0).toLocaleString()} ₽</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
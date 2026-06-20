import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, Link2, Users, UserCheck, Banknote, TrendingUp, Clock, ShieldCheck, GitBranch } from "lucide-react";
import { getStoredRole } from "@/lib/profileSession";
import moment from "moment";

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

  const cards = [
    { icon: Link2, label: "Корневых программ", value: stats.rootPrograms, sub: `из ${stats.totalPrograms} всего`, color: "text-blue-600" },
    { icon: GitBranch, label: "Подпрограмм", value: stats.childPrograms, color: "text-indigo-600" },
    { icon: Users, label: "Рефералов", value: stats.referrers, color: "text-teal-600" },
    { icon: UserCheck, label: "Кандидатов", value: stats.candidates, sub: `${stats.contractSigned} контрактов`, color: "text-emerald-600" },
    { icon: Clock, label: "Ожидают выплаты", value: `${stats.pendingAmount.toLocaleString()} ₽`, sub: `${stats.pendingRewards} записей`, color: "text-amber-600" },
    { icon: Banknote, label: "Выплачено", value: `${stats.paidAmount.toLocaleString()} ₽`, color: "text-green-600" },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="font-heading text-2xl font-bold">Панель управления</h1>
        <div className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-full border ${roleBadge}`}>
          <ShieldCheck className="w-4 h-4" /> Вы: <strong>{roleLabel}</strong>
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
            {c.sub && <div className="text-xs text-muted-foreground mt-1">{c.sub}</div>}
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-2xl p-6">
          <h2 className="font-heading font-bold mb-4">Последние кандидаты</h2>
          <div className="space-y-3">
            {recentCandidates.length === 0 && <p className="text-muted-foreground text-sm">Кандидатов нет</p>}
            {recentCandidates.map(c => (
              <div key={c.id} className="flex items-center justify-between gap-2">
                <div>
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
        <div className="bg-card border border-border rounded-2xl p-6">
          <h2 className="font-heading font-bold mb-4">Топ рефералов по выплатам</h2>
          <div className="space-y-3">
            {topReferrers.length === 0 && <p className="text-muted-foreground text-sm">Нет данных</p>}
            {topReferrers.map((r, i) => (
              <div key={r.id} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">{i + 1}</div>
                <div className="flex-1">
                  <div className="font-medium text-sm">{r.full_name || "—"}</div>
                  <div className="text-xs text-muted-foreground">{r.total_candidates_count || 0} кандидатов · ранг {r.level?.replace("_", " ") || "—"}</div>
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
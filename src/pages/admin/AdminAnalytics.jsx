import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

const COLORS = ["#1a5c3a","#d4af37","#3b82f6","#ef4444","#8b5cf6","#14b8a6","#f97316","#6b7280"];

const STATUS_RU = {
  NEW: "Новые", QUESTIONNAIRE_FILLED: "Анкеты заполнены", CURATOR_CALL_SCHEDULED: "Звонок запланирован",
  CURATOR_CALL_DONE: "Звонок проведён", REGION_AGREED: "Регион согласован",
  TRAVEL_ARRANGED: "Поездка организована", ARRIVED: "Прибыл", MEDICAL_EXAM_DONE: "Медкомиссия",
  CONTRACT_SIGNED: "Контракт подписан", UNIT_ASSIGNED: "В части", RETURNED_HEALTHY: "Вернулся здоров",
  REJECTED: "Отклонён", DROPPED: "Отказался",
};
const REWARD_STATUS_RU = {
  pending: "Ожидает", approved: "Одобрено", processing: "В обработке", paid: "Выплачено", rejected: "Отклонено",
};

export default function AdminAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [candidates, rewards, referrers, allPrograms, moderators] = await Promise.all([
        base44.entities.CandidateApplication.list(),
        base44.entities.Reward.list(),
        base44.entities.ReferralProfile.filter({ role: "referrer" }),
        base44.entities.ReferralProgram.list(),
        base44.entities.ReferralProfile.filter({ role: "moderator" }),
      ]);

      const rootPrograms = allPrograms.filter(p => p.is_root);
      const childPrograms = allPrograms.filter(p => !p.is_root);

      // Кандидаты по статусам
      const byStatus = {};
      candidates.forEach(c => { byStatus[c.current_status] = (byStatus[c.current_status] || 0) + 1; });
      const statusChart = Object.entries(byStatus).map(([k, v]) => ({ name: STATUS_RU[k] || k, value: v })).sort((a, b) => b.value - a.value);

      // Выплаты по статусам
      const byRewardStatus = {};
      rewards.forEach(r => { byRewardStatus[r.status] = (byRewardStatus[r.status] || 0) + (r.amount || 0); });
      const rewardChart = Object.entries(byRewardStatus).map(([k, v]) => ({ name: REWARD_STATUS_RU[k] || k, value: v }));

      // Топ программ по кандидатам
      const topPrograms = [...allPrograms].sort((a, b) => (b.candidates_count || 0) - (a.candidates_count || 0)).slice(0, 8)
        .map(p => ({ name: p.title.slice(0, 20), value: p.candidates_count || 0 }));

      // Распределение по глубине веток
      const byDepth = {};
      allPrograms.forEach(p => { const d = p.depth || 0; byDepth[d] = (byDepth[d] || 0) + 1; });
      const depthChart = Object.entries(byDepth).map(([k, v]) => ({ name: `Глубина ${k}`, value: v }));

      // Топ рефералов по выплатам
      const topReferrers = [...referrers].sort((a, b) => (b.total_earned || 0) - (a.total_earned || 0)).slice(0, 8)
        .map(r => ({ name: (r.full_name || "—").slice(0, 16), value: r.total_earned || 0 }));

      // Топ модераторов по количеству программ
      const modPrograms = {};
      allPrograms.forEach(p => { if (p.assigned_moderator_id) modPrograms[p.assigned_moderator_id] = (modPrograms[p.assigned_moderator_id] || 0) + 1; });
      const topModerators = moderators.map(m => ({
        name: (m.full_name || "—").slice(0, 16),
        value: modPrograms[m.id] || 0,
        candidates: candidates.filter(c => c.assigned_moderator_id === m.id).length,
      })).sort((a, b) => b.value - a.value).slice(0, 8);

      // Средняя глубина
      const avgDepth = allPrograms.length > 0
        ? (allPrograms.reduce((s, p) => s + (p.depth || 0), 0) / allPrograms.length).toFixed(1)
        : 0;
      const avgChildren = rootPrograms.length > 0
        ? (childPrograms.length / rootPrograms.length).toFixed(1)
        : 0;

      // Конверсия
      const totalCandidates = candidates.length;
      const contracted = candidates.filter(c => c.current_status === "CONTRACT_SIGNED" || c.current_status === "UNIT_ASSIGNED").length;
      const conversionRate = totalCandidates > 0 ? ((contracted / totalCandidates) * 100).toFixed(1) : 0;

      const totalPaid = rewards.filter(r => r.status === "paid").reduce((s, r) => s + (r.amount || 0), 0);
      const totalPending = rewards.filter(r => r.status === "pending").reduce((s, r) => s + (r.amount || 0), 0);

      setData({ statusChart, rewardChart, topPrograms, depthChart, topReferrers, topModerators,
        rootCount: rootPrograms.length, childCount: childPrograms.length, totalPrograms: allPrograms.length,
        avgDepth, avgChildren, totalCandidates, contracted, conversionRate, totalPaid, totalPending,
        totalReferrers: referrers.length });
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  const summaryCards = [
    { label: "Корневых программ", value: data.rootCount },
    { label: "Подпрограмм", value: data.childCount },
    { label: "Средняя глубина дерева", value: data.avgDepth },
    { label: "Среднее подпрограмм на корень", value: data.avgChildren },
    { label: "Всего кандидатов", value: data.totalCandidates },
    { label: "С контрактом", value: data.contracted },
    { label: "Конверсия в контракт", value: `${data.conversionRate}%` },
    { label: "Рефералов", value: data.totalReferrers },
  ];

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold mb-6">Аналитика</h1>

      {/* Сводные карточки */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {summaryCards.map((c, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-4 text-center">
            <div className="text-xs text-muted-foreground mb-1">{c.label}</div>
            <div className="font-heading text-2xl font-bold">{c.value}</div>
          </div>
        ))}
      </div>

      {/* Выплаты */}
      <div className="grid sm:grid-cols-2 gap-4 mb-8">
        <div className="bg-card border border-border rounded-2xl p-5 flex flex-col items-center justify-center">
          <div className="text-sm text-muted-foreground mb-1">Ожидают выплаты</div>
          <div className="font-heading text-3xl font-black text-amber-600">{data.totalPending.toLocaleString()} ₽</div>
        </div>
        <div className="bg-card border border-border rounded-2xl p-5 flex flex-col items-center justify-center">
          <div className="text-sm text-muted-foreground mb-1">Итого выплачено</div>
          <div className="font-heading text-3xl font-black text-primary">{data.totalPaid.toLocaleString()} ₽</div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        {/* Кандидаты по статусам */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <h2 className="font-heading font-semibold mb-4">Кандидаты по статусам</h2>
          {data.statusChart.length === 0 ? <p className="text-muted-foreground text-sm">Нет данных</p> : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.statusChart} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={150} />
                <Tooltip />
                <Bar dataKey="value" fill="#1a5c3a" radius={4} name="Кандидатов" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Выплаты по статусам */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <h2 className="font-heading font-semibold mb-4">Выплаты по статусам (₽)</h2>
          {data.rewardChart.length === 0 ? <p className="text-muted-foreground text-sm">Нет данных</p> : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={data.rewardChart} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100}>
                  {data.rewardChart.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={v => `${Number(v).toLocaleString()} ₽`} />
                <Legend formatter={v => v} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Топ программ по кандидатам */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <h2 className="font-heading font-semibold mb-4">Топ программ по кандидатам</h2>
          {data.topPrograms.length === 0 ? <p className="text-muted-foreground text-sm">Нет данных</p> : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.topPrograms} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={130} />
                <Tooltip />
                <Bar dataKey="value" fill="#d4af37" radius={4} name="Кандидатов" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Распределение по глубине */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <h2 className="font-heading font-semibold mb-4">Программы по глубине ветки</h2>
          {data.depthChart.length === 0 ? <p className="text-muted-foreground text-sm">Нет данных</p> : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.depthChart}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" fill="#8b5cf6" radius={4} name="Программ" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Топ рефералов */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <h2 className="font-heading font-semibold mb-4">Топ рефералов по выплатам (₽)</h2>
          {data.topReferrers.length === 0 ? <p className="text-muted-foreground text-sm">Нет данных</p> : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.topReferrers} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `${(v/1000).toFixed(0)}к`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={110} />
                <Tooltip formatter={v => `${Number(v).toLocaleString()} ₽`} />
                <Bar dataKey="value" fill="#14b8a6" radius={4} name="Выплачено" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Топ модераторов */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <h2 className="font-heading font-semibold mb-4">Модераторы по активным веткам</h2>
          {data.topModerators.length === 0 ? <p className="text-muted-foreground text-sm">Нет данных</p> : (
            <div className="space-y-3">
              {data.topModerators.map((m, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">{i + 1}</div>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{m.name}</div>
                    <div className="text-xs text-muted-foreground">{m.candidates} кандидатов</div>
                  </div>
                  <div className="text-sm font-bold">{m.value} программ</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
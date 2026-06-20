import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

const COLORS = ["#1a5c3a","#d4af37","#3b82f6","#ef4444","#8b5cf6","#14b8a6","#f97316","#6b7280"];

export default function AdminAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [candidates, rewards, referrers] = await Promise.all([
        base44.entities.CandidateApplication.list(),
        base44.entities.Reward.list(),
        base44.entities.ReferralProfile.filter({ role: "referrer" }),
      ]);

      const byStatus = {};
      candidates.forEach(c => { byStatus[c.current_status] = (byStatus[c.current_status] || 0) + 1; });
      const statusChart = Object.entries(byStatus).map(([name, value]) => ({ name: name.replace(/_/g," "), value }));

      const byRewardStatus = {};
      rewards.forEach(r => { byRewardStatus[r.status] = (byRewardStatus[r.status] || 0) + (r.amount || 0); });
      const rewardChart = Object.entries(byRewardStatus).map(([name, value]) => ({ name, value }));

      const byLevel = {};
      referrers.forEach(r => { byLevel[r.level || "L0_novice"] = (byLevel[r.level || "L0_novice"] || 0) + 1; });
      const levelChart = Object.entries(byLevel).map(([name, value]) => ({ name: name.replace("_", " "), value }));

      setData({ statusChart, rewardChart, levelChart, totalPaid: rewards.filter(r => r.status === "paid").reduce((s, r) => s + (r.amount || 0), 0) });
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold mb-6">Аналитика</h1>
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-2xl p-6">
          <h2 className="font-heading font-semibold mb-4">Кандидаты по статусам</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.statusChart} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={130} />
              <Tooltip />
              <Bar dataKey="value" fill="#1a5c3a" radius={4} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-card border border-border rounded-2xl p-6">
          <h2 className="font-heading font-semibold mb-4">Награды по статусам (₽)</h2>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={data.rewardChart} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, value }) => `${name}: ${value.toLocaleString()}`} labelLine={false}>
                {data.rewardChart.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={v => `${v.toLocaleString()} ₽`} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-card border border-border rounded-2xl p-6">
          <h2 className="font-heading font-semibold mb-4">Рефералы по уровням</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.levelChart}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" fill="#d4af37" radius={4} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-card border border-border rounded-2xl p-6 flex flex-col items-center justify-center">
          <div className="text-muted-foreground mb-2 text-sm">Итого выплачено</div>
          <div className="font-heading text-4xl font-black text-primary">{data.totalPaid.toLocaleString()} ₽</div>
        </div>
      </div>
    </div>
  );
}
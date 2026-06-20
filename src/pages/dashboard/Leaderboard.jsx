import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, Trophy } from "lucide-react";

const levelLabels = {
  L0_novice: "Новичок", L1_fighter: "Боец", L2_sergeant: "Сержант",
  L3_officer: "Офицер", L4_general: "Генерал", L5_marshal: "Маршал",
};

export default function Leaderboard() {
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.ReferralProfile.filter({ role: "referrer", status: "active" }, "-total_earned", 20)
      .then(data => { setLeaders(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold mb-6">Рейтинг рефералов</h1>
      {leaders.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-2xl">
          <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Рейтинг пока пуст</p>
        </div>
      ) : (
        <div className="space-y-2">
          {leaders.map((l, i) => (
            <div key={l.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${i === 0 ? "bg-amber-400 text-white" : i === 1 ? "bg-gray-300 text-gray-700" : i === 2 ? "bg-amber-700 text-white" : "bg-muted text-muted-foreground"}`}>
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{l.full_name || l.email}</div>
                <div className="text-xs text-muted-foreground">{levelLabels[l.level] || l.level}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-bold">{(l.total_earned || 0).toLocaleString()} ₽</div>
                <div className="text-xs text-muted-foreground">{l.total_candidates_count || 0} канд.</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
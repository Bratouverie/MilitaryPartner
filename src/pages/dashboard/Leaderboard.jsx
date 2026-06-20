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
    base44.entities.ReferralProfile.filter({ role: "referrer" }, "-total_earned", 20).then(profiles => {
      setLeaders(profiles.filter(p => (p.total_earned || 0) > 0));
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold mb-6">Рейтинг рефералов</h1>
      {leaders.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-2xl">
          <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Рейтинг формируется после первых выплат</p>
        </div>
      ) : (
        <div className="space-y-3">
          {leaders.map((l, i) => {
            const name = l.full_name || "Участник";
            const initials = name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();
            return (
              <div key={l.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${i < 3 ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"}`}>
                  {i + 1}
                </div>
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-sm text-primary shrink-0">{initials}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{name}</div>
                  <div className="text-xs text-muted-foreground">{levelLabels[l.level] || "Новичок"}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-heading font-bold">{(l.total_earned || 0).toLocaleString()} ₽</div>
                  <div className="text-xs text-muted-foreground">{l.active_referrals_count || 0} рефералов</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, Banknote } from "lucide-react";
import moment from "moment";
import { useProfile } from "@/lib/useProfile.jsx";

const statusLabels = {
  pending: { label: "Ожидание", color: "bg-amber-100 text-amber-700" },
  approved: { label: "Одобрено", color: "bg-blue-100 text-blue-700" },
  processing: { label: "Обработка", color: "bg-indigo-100 text-indigo-700" },
  paid: { label: "Выплачено", color: "bg-green-100 text-green-700" },
  rejected: { label: "Отклонено", color: "bg-red-100 text-red-700" },
};

const rewardTypeLabels = {
  contract_signed: "Контракт подписан",
  unit_assigned: "Назначен в часть",
  returned_healthy: "Вернулся здоровым",
  moderator_bonus: "Бонус куратора",
  manual_adjustment: "Ручная корректировка",
};

export default function MyRewards() {
  const { profile, loading: profileLoading } = useProfile();
  const [rewards, setRewards] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setLoading(true);
    base44.entities.Reward.filter({ beneficiary_user_id: profile.id })
      .then(r => { setRewards(r); setLoading(false); });
  }, [profile?.id]);

  if (profileLoading || loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold mb-6">Мои начисления</h1>
      {rewards.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-2xl">
          <Banknote className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Пока нет начислений</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rewards.map(r => {
            const st = statusLabels[r.status] || statusLabels.pending;
            return (
              <div key={r.id} className="bg-card border border-border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="font-heading font-bold text-lg">{(r.amount || 0).toLocaleString()} ₽</div>
                  <div className="text-sm text-muted-foreground">{rewardTypeLabels[r.reward_type] || r.reward_type} · {moment(r.created_date).format("DD.MM.YYYY")}</div>
                </div>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${st.color} self-start`}>{st.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
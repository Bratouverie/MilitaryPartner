import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, TrendingUp, Users, Clock, CheckCircle } from "lucide-react";

const levelLabels = {
  L0_novice: { name: "Новичок", color: "bg-blue-100 text-blue-700" },
  L1_fighter: { name: "Боец", color: "bg-orange-100 text-orange-700" },
  L2_sergeant: { name: "Сержант", color: "bg-slate-100 text-slate-700" },
  L3_officer: { name: "Офицер", color: "bg-yellow-100 text-yellow-700" },
  L4_general: { name: "Генерал", color: "bg-purple-100 text-purple-700" },
  L5_marshal: { name: "Маршал", color: "bg-amber-100 text-amber-700" },
};

export default function Overview() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const user = await base44.auth.me();
      const profiles = await base44.entities.ReferralProfile.filter({ linked_user_id: user.id });
      if (profiles.length === 0) {
        const byEmail = await base44.entities.ReferralProfile.filter({ email: user.email });
        if (byEmail.length > 0) {
          await base44.entities.ReferralProfile.update(byEmail[0].id, { linked_user_id: user.id });
          setProfile(byEmail[0]);
        }
      } else {
        setProfile(profiles[0]);
      }
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!profile) return (
    <div className="text-center py-16">
      <h2 className="font-heading text-2xl font-bold mb-2">Профиль не найден</h2>
      <p className="text-muted-foreground">Зарегистрируйтесь как реферал, чтобы получить доступ к кабинету.</p>
    </div>
  );

  const lvl = levelLabels[profile.level] || levelLabels.L0_novice;

  const stats = [
    { icon: TrendingUp, label: "Всего заработано", value: `${(profile.total_earned || 0).toLocaleString()} ₽`, color: "text-primary" },
    { icon: CheckCircle, label: "Выплачено", value: `${(profile.total_paid || 0).toLocaleString()} ₽`, color: "text-green-600" },
    { icon: Clock, label: "Ожидание", value: `${(profile.total_pending || 0).toLocaleString()} ₽`, color: "text-amber-600" },
    { icon: Users, label: "Кандидатов", value: profile.total_candidates_count || 0, color: "text-blue-600" },
  ];

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-heading text-2xl font-bold">{profile.full_name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${lvl.color}`}>{lvl.name}</span>
            <span className="text-sm text-muted-foreground">Награда: {(profile.referral_reward || 0).toLocaleString()} ₽</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((s, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <s.icon className={`w-5 h-5 ${s.color}`} />
              <span className="text-sm text-muted-foreground">{s.label}</span>
            </div>
            <div className="font-heading text-2xl font-bold">{s.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, User } from "lucide-react";
import moment from "moment";

const statusLabels = {
  NEW: { label: "Новый", color: "bg-gray-100 text-gray-700" },
  QUESTIONNAIRE_FILLED: { label: "Анкета заполнена", color: "bg-blue-100 text-blue-700" },
  CURATOR_CALL_SCHEDULED: { label: "Звонок запланирован", color: "bg-indigo-100 text-indigo-700" },
  CURATOR_CALL_DONE: { label: "Звонок проведён", color: "bg-violet-100 text-violet-700" },
  REGION_AGREED: { label: "Регион согласован", color: "bg-purple-100 text-purple-700" },
  TRAVEL_ARRANGED: { label: "Поездка организована", color: "bg-cyan-100 text-cyan-700" },
  ARRIVED: { label: "Прибыл", color: "bg-teal-100 text-teal-700" },
  MEDICAL_EXAM_DONE: { label: "Медкомиссия", color: "bg-emerald-100 text-emerald-700" },
  CONTRACT_SIGNED: { label: "Контракт подписан", color: "bg-green-100 text-green-700" },
  UNIT_ASSIGNED: { label: "В части", color: "bg-green-200 text-green-800" },
  RETURNED_HEALTHY: { label: "Вернулся здоров", color: "bg-lime-100 text-lime-700" },
  REJECTED: { label: "Отказал", color: "bg-red-100 text-red-700" },
  DROPPED: { label: "Отвалился", color: "bg-orange-100 text-orange-700" },
};

export default function MyCandidates() {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const user = await base44.auth.me();
      const profiles = await base44.entities.ReferralProfile.filter({ linked_user_id: user.id });
      if (profiles.length === 0) {
        const byEmail = await base44.entities.ReferralProfile.filter({ email: user.email });
        if (byEmail[0]) {
          const c = await base44.entities.CandidateApplication.filter({ source_referrer_id: byEmail[0].id });
          setCandidates(c);
        }
      } else {
        const c = await base44.entities.CandidateApplication.filter({ source_referrer_id: profiles[0].id });
        setCandidates(c);
      }
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold mb-6">Мои кандидаты ({candidates.length})</h1>
      {candidates.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-2xl">
          <User className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Пока нет кандидатов. Поделитесь своей ссылкой!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {candidates.map(c => {
            const st = statusLabels[c.current_status] || { label: c.current_status, color: "bg-gray-100 text-gray-700" };
            return (
              <div key={c.id} className="bg-card border border-border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="font-medium">{c.full_name}</div>
                  <div className="text-sm text-muted-foreground">{c.phone} · {moment(c.created_date).format("DD.MM.YYYY")}</div>
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
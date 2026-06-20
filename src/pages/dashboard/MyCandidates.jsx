import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, User, Filter } from "lucide-react";
import moment from "moment";
import { useProfile } from "@/lib/useProfile.jsx";

const SELECTED_KEY = "mp_selected_program_id";

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
  const { profile, loading: profileLoading } = useProfile();
  const [candidates, setCandidates] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterProgram, setFilterProgram] = useState("all");

  useEffect(() => {
    if (!profile) return;
    setLoading(true);
    const savedProg = sessionStorage.getItem(SELECTED_KEY);
    if (savedProg) setFilterProgram(savedProg);
    Promise.all([
      base44.entities.CandidateApplication.filter({ source_referrer_id: profile.id }),
      base44.entities.ReferralProgram.filter({ owner_user_id: profile.id }),
    ]).then(([c, p]) => {
      setCandidates(c);
      setPrograms(p.sort((a, b) => new Date(a.created_date) - new Date(b.created_date)));
      setLoading(false);
    });
  }, [profile?.id]);

  if (profileLoading || loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  const displayed = filterProgram === "all"
    ? candidates
    : candidates.filter(c => c.source_program_id === filterProgram);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <h1 className="font-heading text-2xl font-bold">Мои кандидаты ({displayed.length}{filterProgram !== "all" ? ` / всего ${candidates.length}` : ""})</h1>
        {programs.length > 1 && (
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <select className="h-8 px-2 border border-input rounded-md bg-background text-sm"
              value={filterProgram} onChange={e => { setFilterProgram(e.target.value); if (e.target.value !== "all") sessionStorage.setItem(SELECTED_KEY, e.target.value); }}>
              <option value="all">Все программы</option>
              {programs.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </div>
        )}
      </div>
      {displayed.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-2xl">
          <User className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">{candidates.length === 0 ? "Пока нет кандидатов. Поделитесь ссылкой анкеты!" : "Нет кандидатов по выбранной программе."}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayed.map(c => {
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
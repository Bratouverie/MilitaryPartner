import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, AlertCircle, Clock, Users, CheckSquare } from "lucide-react";
import { useProfile } from "@/lib/useProfile.jsx";

export default function ModeratorOverview() {
  const { profile, loading: profileLoading } = useProfile();
  const [candidates, setCandidates] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setLoading(true);
    Promise.all([
      base44.entities.CandidateApplication.filter({ assigned_moderator_id: profile.id }),
      base44.entities.ModeratorTask.filter({ moderator_id: profile.id, status: "open" }),
    ]).then(([c, t]) => { setCandidates(c); setTasks(t); setLoading(false); });
  }, [profile?.id]);

  if (profileLoading || loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  const newCandidates = candidates.filter(c => c.current_status === "NEW" || c.current_status === "QUESTIONNAIRE_FILLED");
  const urgent = tasks.filter(t => t.priority === "urgent");
  const overdue = tasks.filter(t => t.due_at && new Date(t.due_at) < new Date());

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold mb-6">Панель куратора</h1>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { icon: Users, label: "Новые кандидаты", value: newCandidates.length, color: "text-blue-600" },
          { icon: AlertCircle, label: "Срочные задачи", value: urgent.length, color: "text-red-600" },
          { icon: Clock, label: "Просроченные", value: overdue.length, color: "text-amber-600" },
          { icon: CheckSquare, label: "Открытые задачи", value: tasks.length, color: "text-emerald-600" },
        ].map((s, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2"><s.icon className={`w-5 h-5 ${s.color}`} /><span className="text-sm text-muted-foreground">{s.label}</span></div>
            <div className="font-heading text-3xl font-bold">{s.value}</div>
          </div>
        ))}
      </div>

      {newCandidates.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-6">
          <h2 className="font-heading font-bold mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-500" /> Требуют внимания
          </h2>
          <div className="space-y-3">
            {newCandidates.slice(0, 8).map(c => (
              <div key={c.id} className="flex items-center justify-between border-b border-border pb-3 last:border-0 last:pb-0">
                <div>
                  <div className="font-medium">{c.full_name}</div>
                  <div className="text-sm text-muted-foreground">{c.phone}</div>
                </div>
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{c.current_status?.replace(/_/g, " ")}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {newCandidates.length === 0 && tasks.length === 0 && (
        <div className="text-center py-16 bg-card border border-border rounded-2xl text-muted-foreground">
          Нет активных задач — всё под контролем!
        </div>
      )}
    </div>
  );
}
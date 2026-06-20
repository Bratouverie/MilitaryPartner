import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, AlertCircle, Clock, Users, CheckSquare, GitBranch, TrendingUp, FileText, Phone } from "lucide-react";
import { useProfile } from "@/lib/useProfile.jsx";
import { Link } from "react-router-dom";
import moment from "moment";

const STATUS_LABELS = {
  NEW: "Новый", QUESTIONNAIRE_FILLED: "Анкета заполнена", CURATOR_CALL_SCHEDULED: "Звонок запланирован",
  CURATOR_CALL_DONE: "Звонок проведён", CONTRACT_SIGNED: "Контракт подписан",
  MEDICAL_EXAM_DONE: "Медкомиссия", UNIT_ASSIGNED: "В части", REJECTED: "Отклонён", DROPPED: "Отказался",
};
const STATUS_COLOR = {
  NEW: "bg-gray-100 text-gray-700", QUESTIONNAIRE_FILLED: "bg-blue-100 text-blue-700",
  CURATOR_CALL_SCHEDULED: "bg-indigo-100 text-indigo-700", CONTRACT_SIGNED: "bg-green-100 text-green-700",
  MEDICAL_EXAM_DONE: "bg-teal-100 text-teal-700", REJECTED: "bg-red-100 text-red-700",
};
const QUICK_FILTERS = [
  { key: "all", label: "Все" },
  { key: "new", label: "Новые", statuses: ["NEW", "QUESTIONNAIRE_FILLED"] },
  { key: "call", label: "Требуют звонка", statuses: ["CURATOR_CALL_SCHEDULED"] },
  { key: "medical", label: "Медкомиссия", statuses: ["MEDICAL_EXAM_DONE"] },
  { key: "contract", label: "Контракт", statuses: ["CONTRACT_SIGNED", "UNIT_ASSIGNED"] },
  { key: "rejected", label: "Отклонены", statuses: ["REJECTED", "DROPPED"] },
];

export default function ModeratorOverview() {
  const { profile, loading: profileLoading } = useProfile();
  const [myPrograms, setMyPrograms] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [rewards, setRewards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    if (!profile) return;
    setLoading(true);
    Promise.all([
      base44.entities.ReferralProgram.filter({ assigned_moderator_id: profile.id }),
      base44.entities.CandidateApplication.filter({ assigned_moderator_id: profile.id }),
      base44.entities.ModeratorTask.filter({ moderator_id: profile.id, status: "open" }),
      base44.entities.Reward.filter({ status: "pending" }),
    ]).then(([progs, cands, t, rews]) => {
      setMyPrograms(progs);
      setCandidates(cands);
      setTasks(t);
      // Фильтруем награды только по программам этого модератора
      const programIds = new Set(progs.map(p => p.id));
      setRewards(rews.filter(r => programIds.has(r.source_program_id)));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [profile?.id]);

  if (profileLoading || loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  const rootPrograms = myPrograms.filter(p => p.is_root);
  const childPrograms = myPrograms.filter(p => !p.is_root);
  const urgent = tasks.filter(t => t.priority === "urgent");
  const overdue = tasks.filter(t => t.due_at && new Date(t.due_at) < new Date());
  const contracted = candidates.filter(c => c.current_status === "CONTRACT_SIGNED" || c.current_status === "UNIT_ASSIGNED");
  const pendingRewardSum = rewards.reduce((s, r) => s + (r.amount || 0), 0);

  // Фильтрация кандидатов
  const filteredCandidates = filter === "all"
    ? candidates
    : candidates.filter(c => (QUICK_FILTERS.find(f => f.key === filter)?.statuses || []).includes(c.current_status));

  const statCards = [
    { icon: GitBranch, label: "Программ", value: myPrograms.length, sub: `${rootPrograms.length} корневых`, color: "text-primary" },
    { icon: Users, label: "Кандидатов", value: candidates.length, sub: "в работе", color: "text-blue-600" },
    { icon: CheckSquare, label: "Контрактов", value: contracted.length, color: "text-green-600" },
    { icon: AlertCircle, label: "Срочных задач", value: urgent.length, color: "text-red-600" },
    { icon: Clock, label: "Просроченных", value: overdue.length, color: "text-amber-600" },
    { icon: TrendingUp, label: "Ожидаемые выплаты", value: `${pendingRewardSum.toLocaleString()} ₽`, color: "text-emerald-600" },
  ];

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold mb-6">Панель куратора</h1>

      {/* Статистика */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {statCards.map((s, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-1.5 mb-1"><s.icon className={`w-4 h-4 ${s.color}`} /><span className="text-xs text-muted-foreground">{s.label}</span></div>
            <div className="font-heading text-xl font-bold">{s.value}</div>
            {s.sub && <div className="text-xs text-muted-foreground">{s.sub}</div>}
          </div>
        ))}
      </div>

      {/* Мои программы — дерево */}
      <div className="bg-card border border-border rounded-2xl p-5 mb-6">
        <h2 className="font-heading font-bold mb-3 flex items-center gap-2">
          <GitBranch className="w-5 h-5 text-primary" />Мои программы
        </h2>
        {myPrograms.length === 0 && (
          <p className="text-muted-foreground text-sm">Программ под вашим управлением пока нет</p>
        )}
        <div className="space-y-2">
          {rootPrograms.map(prog => (
            <div key={prog.id} className="border border-border rounded-xl p-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="font-medium text-sm flex items-center gap-2">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">Root</span>
                    {prog.title}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Квота: <strong className="text-accent">{(prog.reward_quota || 0).toLocaleString()} ₽</strong> · {prog.direct_children_count || 0} подпрограмм · {prog.candidates_count || 0} кандидатов
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${prog.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                  {prog.is_active ? "Активна" : "Отключена"}
                </span>
              </div>
              {/* Дочерние */}
              {childPrograms.filter(c => c.root_program_id === prog.id).map(child => (
                <div key={child.id} className="ml-4 mt-2 pl-3 border-l-2 border-primary/20">
                  <div className="text-sm font-medium">{child.title}</div>
                  <div className="text-xs text-muted-foreground">{(child.reward_quota || 0).toLocaleString()} ₽ · глубина {child.depth} · {child.candidates_count || 0} кандидатов</div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Кандидаты с быстрыми фильтрами */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <h2 className="font-heading font-bold flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />Кандидаты ({filteredCandidates.length})
          </h2>
          <Link to="/moderator/candidates">
            <button className="text-sm text-primary hover:underline">Открыть все →</button>
          </Link>
        </div>

        {/* Быстрые фильтры */}
        <div className="flex flex-wrap gap-2 mb-4">
          {QUICK_FILTERS.map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`px-3 py-1 text-xs rounded-full border transition-colors ${filter === f.key ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}>
              {f.label}
              {f.statuses && <span className="ml-1.5 opacity-70">{candidates.filter(c => f.statuses.includes(c.current_status)).length}</span>}
            </button>
          ))}
        </div>

        {/* Карточки кандидатов */}
        {filteredCandidates.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">Нет кандидатов по выбранному фильтру</div>
        )}
        <div className="space-y-3">
          {filteredCandidates.slice(0, 10).map(c => {
            // Ищем программу кандидата
            const prog = myPrograms.find(p => p.id === c.source_program_id);
            return (
              <div key={c.id} className="border border-border rounded-xl p-4 hover:bg-muted/30 transition-colors">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{c.full_name || "—"}</div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                      <Phone className="w-3 h-3" />{c.phone}
                    </div>
                    {prog && <div className="text-xs text-muted-foreground mt-0.5">Программа: <span className="font-medium">{prog.title}</span></div>}
                    {c.source_referrer_id && <div className="text-xs text-muted-foreground">Пригласил: ID {c.source_referrer_id.slice(0, 8)}…</div>}
                    <div className="text-xs text-muted-foreground mt-0.5">{moment(c.created_date).format("DD.MM.YYYY HH:mm")}</div>
                    {c.next_action_at && (
                      <div className={`flex items-center gap-1 text-xs mt-0.5 ${new Date(c.next_action_at) < new Date() ? "text-red-600" : "text-amber-600"}`}>
                        <Clock className="w-3 h-3" />До: {moment(c.next_action_at).format("DD.MM.YYYY")}
                      </div>
                    )}
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full shrink-0 font-medium ${STATUS_COLOR[c.current_status] || "bg-gray-100 text-gray-600"}`}>
                    {STATUS_LABELS[c.current_status] || c.current_status}
                  </span>
                </div>
              </div>
            );
          })}
          {filteredCandidates.length > 10 && (
            <Link to="/moderator/candidates">
              <button className="w-full py-2 text-sm text-primary hover:underline text-center">
                Показать все {filteredCandidates.length} →
              </button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
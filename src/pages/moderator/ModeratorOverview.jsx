/**
 * ModeratorOverview — оптимизированная загрузка.
 * 1. Summary cards грузятся быстро (только programs + кол-во кандидатов).
 * 2. Детальный список кандидатов грузится лениво.
 * 3. Pending rewards НЕ грузятся глобально — убрана тяжёлая операция.
 */
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, AlertCircle, Clock, Users, CheckSquare, GitBranch, TrendingUp, FileText, Phone, Copy, Share2, QrCode } from "lucide-react";
import { useProfile } from "@/lib/useProfile.jsx";
import { Link } from "react-router-dom";
import moment from "moment";
import { STATUS_LABELS_RU, STATUS_COLORS_RU, statusLabel, statusColor } from "@/lib/statusLabels";
import { getInternalTitle } from "@/lib/programUtils";

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

  // Summary — грузится сразу и быстро
  const [myPrograms, setMyPrograms] = useState([]);
  const [summaryLoading, setSummaryLoading] = useState(true);

  // Кандидаты — грузятся отдельно (лениво)
  const [candidates, setCandidates] = useState([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [candidatesLoaded, setCandidatesLoaded] = useState(false);

  // Задачи — грузятся отдельно
  const [urgentTaskCount, setUrgentTaskCount] = useState(0);

  const [filter, setFilter] = useState("all");
  const [showLinks, setShowLinks] = useState(false);

  // Быстрая загрузка: только программы
  useEffect(() => {
    if (!profile) return;
    setSummaryLoading(true);
    Promise.all([
      base44.entities.ReferralProgram.filter({ assigned_moderator_id: profile.id }),
      // Задачи — только count, без полной выгрузки
      base44.entities.ModeratorTask.filter({ moderator_id: profile.id, status: "open" }),
    ]).then(([progs, tasks]) => {
      setMyPrograms(progs);
      setUrgentTaskCount(tasks.filter(t => t.priority === "urgent" || (t.due_at && new Date(t.due_at) < new Date())).length);
      setSummaryLoading(false);
    }).catch(() => setSummaryLoading(false));
  }, [profile?.id]);

  // Ленивая загрузка кандидатов — только при запросе
  const loadCandidates = () => {
    if (candidatesLoaded || candidatesLoading || !profile) return;
    setCandidatesLoading(true);
    base44.entities.CandidateApplication.filter({ assigned_moderator_id: profile.id }, "-created_date", 50)
      .then(c => { setCandidates(c); setCandidatesLoaded(true); })
      .catch(() => {})
      .finally(() => setCandidatesLoading(false));
  };

  if (profileLoading || summaryLoading) return (
    <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
  );

  const rootPrograms = myPrograms.filter(p => p.is_root);
  const childPrograms = myPrograms.filter(p => !p.is_root);
  const totalCandidates = myPrograms.reduce((s, p) => s + (p.candidates_count || 0), 0);
  const totalContracts = myPrograms.reduce((s, p) => s + (p.contracts_count || 0), 0);

  const filteredCandidates = filter === "all"
    ? candidates
    : candidates.filter(c => (QUICK_FILTERS.find(f => f.key === filter)?.statuses || []).includes(c.current_status));

  const statCards = [
    { icon: GitBranch, label: "Программ", value: myPrograms.length, sub: `${rootPrograms.length} корневых`, color: "text-primary" },
    { icon: Users, label: "Кандидатов", value: totalCandidates, sub: "по программам", color: "text-blue-600" },
    { icon: CheckSquare, label: "Контрактов", value: totalContracts, color: "text-green-600" },
    { icon: AlertCircle, label: "Срочных задач", value: urgentTaskCount, color: "text-red-600" },
  ];

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold mb-6">Панель куратора</h1>

      {/* Статистика (быстрая) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {statCards.map((s, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-1.5 mb-1"><s.icon className={`w-4 h-4 ${s.color}`} /><span className="text-xs text-muted-foreground">{s.label}</span></div>
            <div className="font-heading text-xl font-bold">{s.value}</div>
            {s.sub && <div className="text-xs text-muted-foreground">{s.sub}</div>}
          </div>
        ))}
      </div>

      {/* Мои ссылки */}
      <div className="bg-card border border-border rounded-2xl p-5 mb-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="font-heading font-bold flex items-center gap-2">
            <Share2 className="w-5 h-5 text-primary" />Мои ссылки
          </h2>
          <button onClick={() => setShowLinks(!showLinks)} className="text-sm text-primary hover:underline">
            {showLinks ? "Скрыть" : "Показать"}
          </button>
        </div>
        {showLinks && (
          <div className="mt-4 space-y-3">
            {rootPrograms.map(prog => {
              const baseUrl = window.location.origin;
              const joinLink = `${baseUrl}/join/${prog.link_code}`;
              const candidateLink = `${baseUrl}/candidate/${prog.candidate_form_code}`;
              return (
                <div key={prog.id} className="border border-border rounded-xl p-3">
                  <div className="font-medium text-sm mb-2">{getInternalTitle(prog)}</div>
                  <div className="grid sm:grid-cols-2 gap-2">
                    <div className="bg-muted rounded-lg p-2">
                      <div className="text-xs text-muted-foreground mb-1">🔗 Партнёрская ссылка</div>
                      <div className="text-xs font-mono break-all mb-1">{joinLink}</div>
                      <button onClick={() => { navigator.clipboard.writeText(joinLink); }} className="text-xs text-primary hover:underline">
                        <Copy className="w-3 h-3 inline mr-1" />Копировать
                      </button>
                    </div>
                    <div className="bg-muted rounded-lg p-2">
                      <div className="text-xs text-muted-foreground mb-1">📋 Анкета кандидата</div>
                      <div className="text-xs font-mono break-all mb-1">{candidateLink}</div>
                      <button onClick={() => { navigator.clipboard.writeText(candidateLink); }} className="text-xs text-primary hover:underline">
                        <Copy className="w-3 h-3 inline mr-1" />Копировать
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Мои программы */}
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
                    {getInternalTitle(prog)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Квота: <strong className="text-accent">{(prog.reward_quota || 0).toLocaleString()} ₽</strong>
                    {" · "}{prog.direct_children_count || 0} подпрограмм{" · "}{prog.candidates_count || 0} кандидатов
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${prog.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                  {prog.is_active ? "Активна" : "Отключена"}
                </span>
              </div>
              {childPrograms.filter(c => c.root_program_id === prog.id).map(child => (
                <div key={child.id} className="ml-4 mt-2 pl-3 border-l-2 border-primary/20">
                  <div className="text-sm font-medium">{getInternalTitle(child)}</div>
                  <div className="text-xs text-muted-foreground">{(child.reward_quota || 0).toLocaleString()} ₽ · глубина {child.depth} · {child.candidates_count || 0} кандидатов</div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Кандидаты — ленивая загрузка */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <h2 className="font-heading font-bold flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />Кандидаты
            {candidatesLoaded && <span className="text-muted-foreground font-normal text-sm">({filteredCandidates.length})</span>}
          </h2>
          <div className="flex items-center gap-3">
            {!candidatesLoaded && !candidatesLoading && (
              <button onClick={loadCandidates} className="text-sm text-primary hover:underline">Загрузить список</button>
            )}
            <Link to="/moderator/candidates">
              <button className="text-sm text-primary hover:underline">Открыть все →</button>
            </Link>
          </div>
        </div>

        {candidatesLoading && (
          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />Загрузка кандидатов…
          </div>
        )}

        {!candidatesLoaded && !candidatesLoading && (
          <div className="text-center py-8 text-sm text-muted-foreground">
            Нажмите «Загрузить список» для просмотра кандидатов
          </div>
        )}

        {candidatesLoaded && (
          <>
            <div className="flex flex-wrap gap-2 mb-4">
              {QUICK_FILTERS.map(f => (
                <button key={f.key} onClick={() => setFilter(f.key)}
                  className={`px-3 py-1 text-xs rounded-full border transition-colors ${filter === f.key ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}>
                  {f.label}
                  {f.statuses && <span className="ml-1.5 opacity-70">{candidates.filter(c => f.statuses.includes(c.current_status)).length}</span>}
                </button>
              ))}
            </div>

            {filteredCandidates.length === 0 && (
              <div className="text-center py-6 text-muted-foreground text-sm">Нет кандидатов по выбранному фильтру</div>
            )}
            <div className="space-y-2">
              {filteredCandidates.slice(0, 8).map(c => {
                const prog = myPrograms.find(p => p.id === c.source_program_id);
                return (
                  <div key={c.id} className="border border-border rounded-xl p-3 hover:bg-muted/30 transition-colors">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{c.full_name || "—"}</div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                          <Phone className="w-3 h-3" />{c.phone}
                        </div>
                        {prog && <div className="text-xs text-muted-foreground mt-0.5">{getInternalTitle(prog)}</div>}
                        <div className="text-xs text-muted-foreground mt-0.5">{moment(c.created_date).format("DD.MM.YYYY")}</div>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full shrink-0 font-medium ${statusColor(c.current_status)}`}>
                        {statusLabel(c.current_status)}
                      </span>
                    </div>
                  </div>
                );
              })}
              {filteredCandidates.length > 8 && (
                <Link to="/moderator/candidates">
                  <button className="w-full py-2 text-sm text-primary hover:underline text-center">
                    Показать все {filteredCandidates.length} →
                  </button>
                </Link>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
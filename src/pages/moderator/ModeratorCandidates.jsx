import React, { useState, useEffect } from "react";
import { createRewardChain, MIN_QUOTA } from "@/lib/programUtils";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import { useProfile } from "@/lib/useProfile.jsx";
import { Loader2, Search, Plus, X, MessageSquare, Clock } from "lucide-react";
import moment from "moment";

const STATUSES = ["NEW","QUESTIONNAIRE_FILLED","CURATOR_CALL_SCHEDULED","CURATOR_CALL_DONE","REGION_AGREED","TRAVEL_ARRANGED","ARRIVED","MEDICAL_EXAM_DONE","CONTRACT_SIGNED","UNIT_ASSIGNED","RETURNED_HEALTHY","REJECTED","DROPPED"];
const STATUS_LABELS = {
  NEW:"Новый", QUESTIONNAIRE_FILLED:"Анкета заполнена", CURATOR_CALL_SCHEDULED:"Звонок запланирован",
  CURATOR_CALL_DONE:"Звонок проведён", REGION_AGREED:"Регион согласован", TRAVEL_ARRANGED:"Поездка организована",
  ARRIVED:"Прибыл", MEDICAL_EXAM_DONE:"Медкомиссия", CONTRACT_SIGNED:"Контракт подписан",
  UNIT_ASSIGNED:"В части", RETURNED_HEALTHY:"Вернулся здоров", REJECTED:"Отказал", DROPPED:"Отвалился",
};
const STATUS_COLORS = {
  NEW:"bg-gray-100 text-gray-700", QUESTIONNAIRE_FILLED:"bg-blue-100 text-blue-700",
  CONTRACT_SIGNED:"bg-green-100 text-green-700", UNIT_ASSIGNED:"bg-green-200 text-green-800",
  REJECTED:"bg-red-100 text-red-700", CURATOR_CALL_SCHEDULED:"bg-indigo-100 text-indigo-700",
  ARRIVED:"bg-teal-100 text-teal-700", MEDICAL_EXAM_DONE:"bg-emerald-100 text-emerald-700",
};
const NOTE_TYPE_LABELS = { call:"Звонок", logistics:"Логистика", medical:"Медицина", agreement:"Договор", internal:"Внутренняя", public:"Публичная" };

export default function ModeratorCandidates() {
  const { profile } = useProfile();
  const moderatorProfileId = profile?.id;
  const [candidates, setCandidates] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [statusHistory, setStatusHistory] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [newStatus, setNewStatus] = useState("");
  const [noteForm, setNoteForm] = useState({ content: "", note_type: "call" });
  const [taskForm, setTaskForm] = useState({ task_title: "", priority: "medium", due_at: "" });
  const [nextAction, setNextAction] = useState("");
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("status");

  const load = async () => {
    if (!moderatorProfileId) return;
    const data = await base44.entities.CandidateApplication.filter({ assigned_moderator_id: moderatorProfileId }, "-created_date");
    setCandidates(data); setFiltered(data);
    setLoading(false);
  };

  useEffect(() => { if (moderatorProfileId) { load(); } else { setLoading(false); } }, [moderatorProfileId]);
  useEffect(() => {
    setFiltered(search ? candidates.filter(c => c.full_name?.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search)) : candidates);
  }, [search, candidates]);

  const openCandidate = async (c) => {
    setSelected(c); setNewStatus(c.current_status || ""); setActiveTab("status");
    setNextAction(c.next_action_at ? c.next_action_at.slice(0,10) : "");
    const [history, t] = await Promise.all([
      base44.entities.CandidateStatusHistory.filter({ candidate_id: c.id }),
      base44.entities.ModeratorTask.filter({ candidate_id: c.id }),
    ]);
    setStatusHistory(history.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)));
    setTasks(t.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)));
  };

  const saveStatus = async () => {
    if (!selected || !newStatus || newStatus === selected.current_status) return;
    setSaving(true);
    try {
      const old = selected.current_status;
      const updates = { current_status: newStatus, last_contact_at: new Date().toISOString() };
      if (nextAction) updates.next_action_at = nextAction;
      await base44.entities.CandidateApplication.update(selected.id, updates);
      await base44.entities.CandidateStatusHistory.create({ candidate_id: selected.id, old_status: old, new_status: newStatus, changed_by_user_id: moderatorProfileId });
      await base44.entities.ActionLog.create({ actor_role: "moderator", action_type: "CANDIDATE_STATUS_CHANGED", entity_type: "CandidateApplication", entity_id: selected.id, action_payload: JSON.stringify({ old, new: newStatus }) });

      // Каскадное создание reward по всей цепочке программ
      if (["CONTRACT_SIGNED","UNIT_ASSIGNED","RETURNED_HEALTHY"].includes(newStatus) && selected.source_program_id) {
        await createRewardChain({
          candidateId: selected.id,
          programId: selected.source_program_id,
          rewardType: newStatus.toLowerCase(),
          actorUserId: moderatorProfileId,
        });

        // ВАРИАНТ C — повышение уровня внутри программы: первый прямой контракт → owner_program_level = 1
        // Срабатывает один раз на программу. Старая ветка, ancestry, snapshot НЕ меняются.
        if (newStatus === "CONTRACT_SIGNED") {
          try {
            const allProgs = await base44.entities.ReferralProgram.filter({ owner_user_id: selected.source_referrer_id });
            const prog = allProgs.find(p => p.id === selected.source_program_id);
            if (prog && (prog.owner_program_level || 0) < 1) {
              const now = new Date().toISOString();
              await base44.entities.ReferralProgram.update(prog.id, {
                owner_program_level: 1,
                owner_level_achieved_at: now,
                contracts_count: (prog.contracts_count || 0) + 1,
              });
              await base44.entities.ActionLog.create({
                actor_user_id: moderatorProfileId,
                action_type: "PROGRAM_OWNER_PROMOTED_TO_LEVEL_1",
                entity_type: "ReferralProgram",
                entity_id: prog.id,
                action_payload: JSON.stringify({
                  owner_user_id: prog.owner_user_id,
                  candidate_id: selected.id,
                  new_level: 1,
                  achieved_at: now,
                  note: "ВАРИАНТ_C: старая_ветка_не_изменена, для_нового_роста_создаётся_отдельный_контур",
                }),
              }).catch(() => {});
            } else if (prog) {
              // Просто обновляем счётчик контрактов
              await base44.entities.ReferralProgram.update(prog.id, {
                contracts_count: (prog.contracts_count || 0) + 1,
              }).catch(() => {});
            }
          } catch {}
        }
      } else if (["CONTRACT_SIGNED","UNIT_ASSIGNED","RETURNED_HEALTHY"].includes(newStatus) && selected.source_referrer_id) {
        // Legacy fallback: если нет source_program_id
        const existing = await base44.entities.Reward.filter({ candidate_id: selected.id, reward_type: newStatus.toLowerCase() });
        if (existing.length === 0) {
          const refProfiles = await base44.entities.ReferralProfile.filter({ id: selected.source_referrer_id });
          const amount = refProfiles[0]?.referral_reward || 50000;
          await base44.entities.Reward.create({ candidate_id: selected.id, beneficiary_user_id: selected.source_referrer_id, source_referrer_id: selected.source_referrer_id, amount, reward_type: newStatus.toLowerCase(), status: "pending" });
        }
      }

      toast({ title: "Статус обновлён" });
      setSelected(s => ({...s, current_status: newStatus}));
      load();
      const history = await base44.entities.CandidateStatusHistory.filter({ candidate_id: selected.id });
      setStatusHistory(history.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)));
    } catch { toast({ title: "Ошибка", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const addNote = async () => {
    if (!noteForm.content.trim()) return;
    setSaving(true);
    try {
      await base44.entities.ActionLog.create({ actor_role: "moderator", action_type: "NOTE_ADDED", entity_type: "CandidateApplication", entity_id: selected.id, action_payload: JSON.stringify(noteForm) });
      toast({ title: "Заметка добавлена" }); setNoteForm({ content: "", note_type: "call" });
    } catch { toast({ title: "Ошибка", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const addTask = async () => {
    if (!taskForm.task_title.trim()) return;
    setSaving(true);
    try {
      const t = await base44.entities.ModeratorTask.create({ ...taskForm, candidate_id: selected.id, moderator_id: moderatorProfileId, status: "open" });
      toast({ title: "Задача создана" });
      setTasks(prev => [t, ...prev]);
      setTaskForm({ task_title: "", priority: "medium", due_at: "" });
    } catch { toast({ title: "Ошибка", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const completeTask = async (taskId) => {
    await base44.entities.ModeratorTask.update(taskId, { status: "done" });
    setTasks(prev => prev.map(t => t.id === taskId ? {...t, status: "done"} : t));
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold mb-6">Мои кандидаты ({filtered.length})</h1>
      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Поиск по имени или телефону…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {candidates.length === 0 && !loading && (
        <div className="text-center py-16 bg-card border border-border rounded-2xl text-muted-foreground">
          Назначенных кандидатов нет. Администратор назначит вам кандидатов.
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-end">
          <div className="bg-card border-l border-border w-full max-w-lg h-full overflow-y-auto">
            <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="font-heading font-bold text-lg">{selected.full_name || "Кандидат"}</h2>
                <div className="text-sm text-muted-foreground">{selected.phone}</div>
              </div>
              <button onClick={() => setSelected(null)}><X className="w-6 h-6 text-muted-foreground" /></button>
            </div>

            <div className="flex border-b border-border">
              {[["status","Статус"],["history","История"],["tasks","Задачи"],["note","Заметка"]].map(([t,l]) => (
                <button key={t} onClick={() => setActiveTab(t)}
                  className={`flex-1 py-3 text-xs font-medium transition-colors ${activeTab === t ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}>
                  {l}
                </button>
              ))}
            </div>

            <div className="p-6">
              {activeTab === "status" && (
                <div className="space-y-4">
                  <div className="text-xs text-muted-foreground">Текущий: <span className="font-medium text-foreground">{STATUS_LABELS[selected.current_status] || selected.current_status}</span></div>
                  <div>
                    <label className="text-sm font-medium block mb-1">Новый статус</label>
                    <select className="w-full h-10 px-2 border border-input rounded-md bg-background text-sm"
                      value={newStatus} onChange={e => setNewStatus(e.target.value)}>
                      {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1">Следующее действие</label>
                    <Input type="date" value={nextAction} onChange={e => setNextAction(e.target.value)} className="h-9 text-sm" />
                  </div>
                  <Button onClick={saveStatus} disabled={saving || newStatus === selected.current_status} className="w-full bg-primary">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Сохранить"}
                  </Button>
                </div>
              )}

              {activeTab === "history" && (
                <div className="space-y-3">
                  {statusHistory.length === 0 && <p className="text-muted-foreground text-sm">История статусов пуста</p>}
                  {statusHistory.map(h => (
                    <div key={h.id} className="border border-border rounded-lg p-3 text-sm">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-muted-foreground line-through">{STATUS_LABELS[h.old_status] || h.old_status}</span>
                        <span>→</span>
                        <span className="font-medium">{STATUS_LABELS[h.new_status] || h.new_status}</span>
                      </div>
                      {h.change_comment && <p className="text-muted-foreground mt-1">{h.change_comment}</p>}
                      <div className="text-xs text-muted-foreground mt-1">{moment(h.created_date).format("DD.MM.YYYY HH:mm")}</div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === "tasks" && (
                <div className="space-y-4">
                  <div className="bg-muted/50 rounded-xl p-4">
                    <div className="text-sm font-medium mb-2">Новая задача</div>
                    <Input className="mb-2 h-9 text-sm" placeholder="Название задачи" value={taskForm.task_title} onChange={e => setTaskForm(f => ({...f, task_title: e.target.value}))} />
                    <div className="flex gap-2 mb-2">
                      <select className="flex-1 h-9 px-2 border border-input rounded-md bg-background text-sm"
                        value={taskForm.priority} onChange={e => setTaskForm(f => ({...f, priority: e.target.value}))}>
                        <option value="low">Низкий</option><option value="medium">Средний</option><option value="high">Высокий</option><option value="urgent">Срочно</option>
                      </select>
                      <Input type="date" className="flex-1 h-9 text-sm" value={taskForm.due_at} onChange={e => setTaskForm(f => ({...f, due_at: e.target.value}))} />
                    </div>
                    <Button size="sm" onClick={addTask} className="bg-primary w-full" disabled={saving}><Plus className="w-4 h-4 mr-1" />Создать</Button>
                  </div>
                  <div className="space-y-2">
                    {tasks.length === 0 && <p className="text-muted-foreground text-sm">Задач нет</p>}
                    {tasks.map(t => (
                      <div key={t.id} className={`border rounded-lg p-3 text-sm ${t.status === "done" ? "opacity-60 border-border" : "border-border"}`}>
                        <div className="flex items-center justify-between gap-2">
                          <span className={t.status === "done" ? "line-through" : "font-medium"}>{t.task_title}</span>
                          {t.status !== "done" && (
                            <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={() => completeTask(t.id)}>✓</Button>
                          )}
                        </div>
                        {t.due_at && <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1"><Clock className="w-3 h-3" />{moment(t.due_at).format("DD.MM.YYYY")}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === "note" && (
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium block mb-1">Тип заметки</label>
                    <select className="w-full h-9 px-2 border border-input rounded-md bg-background text-sm"
                      value={noteForm.note_type} onChange={e => setNoteForm(f => ({...f, note_type: e.target.value}))}>
                      {Object.entries(NOTE_TYPE_LABELS).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                  <textarea className="w-full border border-input rounded-md p-2 text-sm bg-background min-h-[100px] resize-none"
                    placeholder="Текст заметки…" value={noteForm.content} onChange={e => setNoteForm(f => ({...f, content: e.target.value}))} />
                  <Button onClick={addNote} className="bg-primary w-full" disabled={saving || !noteForm.content.trim()}>
                    <MessageSquare className="w-4 h-4 mr-1" />Сохранить заметку
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {filtered.map(c => (
          <div key={c.id} onClick={() => openCandidate(c)}
            className="bg-card border border-border rounded-xl p-4 flex items-center justify-between cursor-pointer hover:shadow-sm transition-shadow">
            <div>
              <div className="font-medium">{c.full_name || "Неизвестный"}</div>
              <div className="text-sm text-muted-foreground">{c.phone} · {moment(c.created_date).format("DD.MM.YYYY")}</div>
              {c.next_action_at && (
                <div className="flex items-center gap-1 text-xs text-amber-600 mt-0.5">
                  <Clock className="w-3 h-3" /> до {moment(c.next_action_at).format("DD.MM")}
                </div>
              )}
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${STATUS_COLORS[c.current_status] || "bg-gray-100 text-gray-600"}`}>
              {STATUS_LABELS[c.current_status] || c.current_status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
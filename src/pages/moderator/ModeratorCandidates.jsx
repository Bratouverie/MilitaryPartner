import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Search, Plus, X, MessageSquare, ChevronDown } from "lucide-react";
import moment from "moment";

const STATUSES = ["NEW","QUESTIONNAIRE_FILLED","CURATOR_CALL_SCHEDULED","CURATOR_CALL_DONE","REGION_AGREED","TRAVEL_ARRANGED","ARRIVED","MEDICAL_EXAM_DONE","CONTRACT_SIGNED","UNIT_ASSIGNED","RETURNED_HEALTHY","REJECTED","DROPPED"];
const STATUS_COLORS = {
  NEW:"bg-gray-100 text-gray-700", QUESTIONNAIRE_FILLED:"bg-blue-100 text-blue-700",
  CONTRACT_SIGNED:"bg-green-100 text-green-700", UNIT_ASSIGNED:"bg-green-200 text-green-800",
  REJECTED:"bg-red-100 text-red-700", CURATOR_CALL_SCHEDULED:"bg-indigo-100 text-indigo-700",
  ARRIVED:"bg-teal-100 text-teal-700", MEDICAL_EXAM_DONE:"bg-emerald-100 text-emerald-700",
};

const NOTE_TYPES = ["call","logistics","medical","agreement","internal","public"];

export default function ModeratorCandidates() {
  const { toast } = useToast();
  const [candidates, setCandidates] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [notes, setNotes] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [noteForm, setNoteForm] = useState({ content: "", note_type: "call" });
  const [taskForm, setTaskForm] = useState({ task_title: "", priority: "medium", due_at: "" });
  const [newStatus, setNewStatus] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const data = await base44.entities.CandidateApplication.list("-created_date");
    setCandidates(data); setFiltered(data); setLoading(false);
  };
  useEffect(() => { load(); }, []);
  useEffect(() => {
    setFiltered(search ? candidates.filter(c => c.full_name?.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search)) : candidates);
  }, [search, candidates]);

  const openCandidate = async (c) => {
    setSelected(c); setNewStatus(c.current_status || "");
    const [n, t] = await Promise.all([
      base44.entities.CandidateApplication.list().then(() => []),
    ]);
  };

  const saveStatus = async () => {
    if (!selected || !newStatus) return;
    setSaving(true);
    try {
      const old = selected.current_status;
      await base44.entities.CandidateApplication.update(selected.id, { current_status: newStatus, last_contact_at: new Date().toISOString() });
      await base44.entities.CandidateStatusHistory.create({ candidate_id: selected.id, old_status: old, new_status: newStatus });
      toast({ title: "Статус обновлён" }); load();
      setSelected(s => ({...s, current_status: newStatus}));
    } catch { toast({ title: "Ошибка", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const addNote = async () => {
    if (!noteForm.content.trim()) return;
    setSaving(true);
    try {
      await base44.entities.ActionLog.create({ action_type: "NOTE_ADDED", entity_type: "candidate", entity_id: selected.id, action_payload: JSON.stringify(noteForm) });
      toast({ title: "Заметка добавлена" }); setNoteForm({ content: "", note_type: "call" });
    } catch { toast({ title: "Ошибка", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const addTask = async () => {
    if (!taskForm.task_title.trim()) return;
    setSaving(true);
    try {
      await base44.entities.ModeratorTask.create({ ...taskForm, candidate_id: selected.id, status: "open" });
      toast({ title: "Задача создана" }); setTaskForm({ task_title: "", priority: "medium", due_at: "" });
    } catch { toast({ title: "Ошибка", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold mb-6">Кандидаты ({filtered.length})</h1>
      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Поиск…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-end">
          <div className="bg-card border-l border-border w-full max-w-lg h-full overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-heading font-bold text-xl">{selected.full_name}</h2>
              <button onClick={() => setSelected(null)}><X className="w-6 h-6 text-muted-foreground" /></button>
            </div>
            <div className="space-y-1 text-sm text-muted-foreground mb-5">
              <div>{selected.phone}</div>
              {selected.city && <div>{selected.city}{selected.region ? `, ${selected.region}` : ""}</div>}
              <div>Создан: {moment(selected.created_date).format("DD.MM.YYYY HH:mm")}</div>
            </div>

            <div className="bg-muted/50 rounded-xl p-4 mb-5">
              <div className="text-sm font-medium mb-2">Изменить статус</div>
              <div className="flex gap-2">
                <select className="flex-1 h-9 px-2 border border-input rounded-md bg-background text-sm"
                  value={newStatus} onChange={e => setNewStatus(e.target.value)}>
                  {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g," ")}</option>)}
                </select>
                <Button size="sm" onClick={saveStatus} disabled={saving || newStatus === selected.current_status} className="bg-primary">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "OK"}
                </Button>
              </div>
            </div>

            <div className="bg-muted/50 rounded-xl p-4 mb-5">
              <div className="text-sm font-medium mb-2">Добавить заметку</div>
              <select className="w-full h-9 px-2 border border-input rounded-md bg-background text-sm mb-2"
                value={noteForm.note_type} onChange={e => setNoteForm(f => ({...f, note_type: e.target.value}))}>
                {NOTE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <textarea className="w-full border border-input rounded-md p-2 text-sm bg-background min-h-[60px] resize-none"
                placeholder="Текст заметки…" value={noteForm.content} onChange={e => setNoteForm(f => ({...f, content: e.target.value}))} />
              <Button size="sm" onClick={addNote} className="mt-2 bg-primary w-full" disabled={saving}><MessageSquare className="w-4 h-4 mr-1" />Сохранить</Button>
            </div>

            <div className="bg-muted/50 rounded-xl p-4">
              <div className="text-sm font-medium mb-2">Создать задачу</div>
              <Input className="mb-2 h-9 text-sm" placeholder="Название задачи" value={taskForm.task_title} onChange={e => setTaskForm(f => ({...f, task_title: e.target.value}))} />
              <div className="flex gap-2 mb-2">
                <select className="flex-1 h-9 px-2 border border-input rounded-md bg-background text-sm"
                  value={taskForm.priority} onChange={e => setTaskForm(f => ({...f, priority: e.target.value}))}>
                  <option value="low">Низкий</option><option value="medium">Средний</option><option value="high">Высокий</option><option value="urgent">Срочно</option>
                </select>
                <Input type="date" className="flex-1 h-9 text-sm" value={taskForm.due_at} onChange={e => setTaskForm(f => ({...f, due_at: e.target.value}))} />
              </div>
              <Button size="sm" onClick={addTask} className="bg-primary w-full" disabled={saving}><Plus className="w-4 h-4 mr-1" />Создать задачу</Button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {filtered.map(c => (
          <div key={c.id} onClick={() => openCandidate(c)}
            className="bg-card border border-border rounded-xl p-4 flex items-center justify-between cursor-pointer hover:shadow-sm transition-shadow">
            <div>
              <div className="font-medium">{c.full_name}</div>
              <div className="text-sm text-muted-foreground">{c.phone} · {moment(c.created_date).format("DD.MM.YYYY")}</div>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[c.current_status] || "bg-gray-100 text-gray-600"}`}>
              {c.current_status?.replace(/_/g," ")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
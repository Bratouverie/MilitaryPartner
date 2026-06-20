import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Search, ChevronDown, X } from "lucide-react";
import moment from "moment";

const STATUSES = ["NEW","QUESTIONNAIRE_FILLED","CURATOR_CALL_SCHEDULED","CURATOR_CALL_DONE","REGION_AGREED","TRAVEL_ARRANGED","ARRIVED","MEDICAL_EXAM_DONE","CONTRACT_SIGNED","UNIT_ASSIGNED","RETURNED_HEALTHY","INJURED_LIGHT","INJURED_HEAVY","KIA","REJECTED","DROPPED"];
const STATUS_COLORS = {
  NEW:"bg-gray-100 text-gray-700", QUESTIONNAIRE_FILLED:"bg-blue-100 text-blue-700",
  CONTRACT_SIGNED:"bg-green-100 text-green-700", UNIT_ASSIGNED:"bg-green-200 text-green-800",
  RETURNED_HEALTHY:"bg-lime-100 text-lime-700", REJECTED:"bg-red-100 text-red-700",
  DROPPED:"bg-orange-100 text-orange-700", MEDICAL_EXAM_DONE:"bg-teal-100 text-teal-700",
  KIA:"bg-gray-800 text-white",
};

export default function AdminCandidates() {
  const { toast } = useToast();
  const [candidates, setCandidates] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState(null);
  const [newStatus, setNewStatus] = useState("");
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const data = await base44.entities.CandidateApplication.list("-created_date");
    setCandidates(data); setFiltered(data); setLoading(false);
  };
  useEffect(() => { load(); }, []);
  useEffect(() => {
    let f = candidates;
    if (search) f = f.filter(c => c.full_name?.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search));
    if (statusFilter !== "all") f = f.filter(c => c.current_status === statusFilter);
    setFiltered(f);
  }, [search, statusFilter, candidates]);

  const handleStatusChange = async () => {
    if (!newStatus || !selected) return;
    setSaving(true);
    try {
      const old = selected.current_status;
      await base44.entities.CandidateApplication.update(selected.id, { current_status: newStatus });
      await base44.entities.CandidateStatusHistory.create({ candidate_id: selected.id, old_status: old, new_status: newStatus, change_comment: comment });
      toast({ title: "Статус обновлён!" });
      setSelected(null); setComment(""); setNewStatus("");
      load();
    } catch { toast({ title: "Ошибка", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold mb-6">Кандидаты ({filtered.length})</h1>
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Имя или телефон…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="h-10 px-3 border border-input rounded-md bg-background text-sm"
          value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="all">Все статусы</option>
          {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g," ")}</option>)}
        </select>
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md">
            <div className="flex justify-between mb-4">
              <h2 className="font-heading font-bold">{selected.full_name}</h2>
              <button onClick={() => setSelected(null)}><X className="w-5 h-5 text-muted-foreground" /></button>
            </div>
            <div className="mb-4 text-sm text-muted-foreground">Текущий статус: <strong>{selected.current_status?.replace(/_/g," ")}</strong></div>
            <div className="mb-3">
              <label className="text-sm font-medium mb-1 block">Новый статус</label>
              <select className="w-full h-10 px-3 border border-input rounded-md bg-background text-sm"
                value={newStatus} onChange={e => setNewStatus(e.target.value)}>
                <option value="">Выберите…</option>
                {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g," ")}</option>)}
              </select>
            </div>
            <div className="mb-4">
              <label className="text-sm font-medium mb-1 block">Комментарий</label>
              <Input value={comment} onChange={e => setComment(e.target.value)} placeholder="Причина изменения…" />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setSelected(null)}>Отмена</Button>
              <Button className="flex-1 bg-primary" onClick={handleStatusChange} disabled={saving || !newStatus}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Сохранить"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>{["Имя","Телефон","Статус","Дата",""].map(h => <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map(c => (
              <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 font-medium">{c.full_name}</td>
                <td className="px-4 py-3 text-muted-foreground">{c.phone}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[c.current_status] || "bg-gray-100 text-gray-600"}`}>
                    {c.current_status?.replace(/_/g," ")}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{moment(c.created_date).format("DD.MM.YYYY")}</td>
                <td className="px-4 py-3">
                  <Button size="sm" variant="outline" onClick={() => { setSelected(c); setNewStatus(""); setComment(""); }}>
                    <ChevronDown className="w-3.5 h-3.5 mr-1" />Статус
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
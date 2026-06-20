import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Check, X } from "lucide-react";
import moment from "moment";

const STATUS_COLORS = {
  pending: "bg-amber-100 text-amber-700", approved: "bg-blue-100 text-blue-700",
  processing: "bg-indigo-100 text-indigo-700", paid: "bg-green-100 text-green-700", rejected: "bg-red-100 text-red-700",
};
const STATUS_LABELS = { pending: "Ожидание", approved: "Одобрено", processing: "Обработка", paid: "Выплачено", rejected: "Отклонено" };

export default function AdminRewards() {
  const { toast } = useToast();
  const [rewards, setRewards] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [comment, setComment] = useState({});
  const [saving, setSaving] = useState({});

  const load = async () => {
    const data = await base44.entities.Reward.list("-created_date");
    setRewards(data); setLoading(false);
  };
  useEffect(() => { load(); }, []);
  useEffect(() => {
    setFiltered(statusFilter === "all" ? rewards : rewards.filter(r => r.status === statusFilter));
  }, [statusFilter, rewards]);

  const updateStatus = async (id, status) => {
    setSaving(s => ({...s, [id]: true}));
    try {
      await base44.entities.Reward.update(id, { status, admin_comment: comment[id] || "", ...(status === "paid" ? { paid_at: new Date().toISOString() } : {}) });
      toast({ title: `Статус: ${STATUS_LABELS[status]}` });
      load();
    } catch { toast({ title: "Ошибка", variant: "destructive" }); }
    finally { setSaving(s => ({...s, [id]: false})); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold mb-6">Управление наградами</h1>
      <div className="flex gap-2 mb-6 flex-wrap">
        {["all","pending","approved","processing","paid","rejected"].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${statusFilter === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
            {s === "all" ? "Все" : STATUS_LABELS[s]} {s !== "all" && `(${rewards.filter(r => r.status === s).length})`}
          </button>
        ))}
      </div>
      <div className="space-y-3">
        {filtered.map(r => (
          <div key={r.id} className="bg-card border border-border rounded-xl p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div>
                <div className="font-heading font-bold text-xl">{(r.amount || 0).toLocaleString()} ₽</div>
                <div className="text-sm text-muted-foreground">{r.reward_type?.replace(/_/g," ")} · {moment(r.created_date).format("DD.MM.YYYY")}</div>
              </div>
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium self-start ${STATUS_COLORS[r.status]}`}>{STATUS_LABELS[r.status]}</span>
            </div>
            {r.admin_comment && <p className="text-sm text-muted-foreground mb-3 italic">«{r.admin_comment}»</p>}
            {(r.status === "pending" || r.status === "approved") && (
              <div className="flex flex-col sm:flex-row gap-2 mt-3">
                <Input placeholder="Комментарий (необязательно)" value={comment[r.id] || ""} onChange={e => setComment(c => ({...c, [r.id]: e.target.value}))} className="flex-1 h-9 text-sm" />
                {r.status === "pending" && <>
                  <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => updateStatus(r.id, "approved")} disabled={saving[r.id]}>
                    {saving[r.id] ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4 mr-1" />Одобрить</>}
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => updateStatus(r.id, "rejected")} disabled={saving[r.id]}><X className="w-4 h-4 mr-1" />Отклонить</Button>
                </>}
                {r.status === "approved" && (
                  <Button size="sm" className="bg-primary" onClick={() => updateStatus(r.id, "paid")} disabled={saving[r.id]}>
                    {saving[r.id] ? <Loader2 className="w-4 h-4 animate-spin" /> : "Отметить выплаченным"}
                  </Button>
                )}
              </div>
            )}
          </div>
        ))}
        {filtered.length === 0 && <div className="text-center py-12 text-muted-foreground">Нет наград в этом статусе</div>}
      </div>
    </div>
  );
}
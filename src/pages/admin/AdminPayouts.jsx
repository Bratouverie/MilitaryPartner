import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, CheckCircle, XCircle, DollarSign, Users } from "lucide-react";
import moment from "moment";

const VS_COLORS = { not_filled: "bg-gray-100 text-gray-600", pending_review: "bg-amber-100 text-amber-700", approved: "bg-green-100 text-green-700", rejected: "bg-red-100 text-red-700" };
const VS_LABELS = { not_filled: "Не заполнено", pending_review: "На проверке", approved: "Верифицировано", rejected: "Отклонено" };
const REWARD_STATUS_COLORS = {
  pending: "bg-gray-100 text-gray-700",
  approved: "bg-blue-100 text-blue-700",
  processing: "bg-cyan-100 text-cyan-700",
  paid: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};
const REWARD_STATUS_LABELS = {
  pending: "Ожидание одобрения",
  approved: "Одобрено",
  processing: "В обработке",
  paid: "Выплачено",
  rejected: "Отклонено",
};

export default function AdminPayouts() {
  const { toast } = useToast();
  const [tab, setTab] = useState("rewards"); // rewards | profiles
  const [rewards, setRewards] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);

  useEffect(() => {
    Promise.all([
      base44.entities.Reward.list("-created_date"),
      base44.entities.PaymentProfile.list(),
    ]).then(([r, p]) => {
      setRewards(r);
      setProfiles(p);
    }).finally(() => setLoading(false));
  }, []);

  const updateRewardStatus = async (id, newStatus) => {
    setUpdating(id);
    try {
      const updates = { status: newStatus };
      if (newStatus === "paid") updates.paid_at = new Date().toISOString();
      await base44.entities.Reward.update(id, updates);
      toast({ title: "Статус выплаты обновлён!" });
      setRewards(r => r.map(x => x.id === id ? { ...x, status: newStatus, paid_at: newStatus === "paid" ? new Date().toISOString() : x.paid_at } : x));
    } catch { toast({ title: "Ошибка", variant: "destructive" }); }
    finally { setUpdating(null); }
  };

  const updateVerification = async (id, status) => {
    await base44.entities.PaymentProfile.update(id, { verification_status: status });
    toast({ title: `Статус: ${VS_LABELS[status]}` });
    setProfiles(p => p.map(x => x.id === id ? { ...x, verification_status: status } : x));
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  const totalPending = rewards.filter(r => r.status === "pending").reduce((s, r) => s + (r.amount || 0), 0);
  const totalPaid = rewards.filter(r => r.status === "paid").reduce((s, r) => s + (r.amount || 0), 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading text-2xl font-bold">Выплаты и платежи</h1>
        <div className="flex gap-2">
          <button onClick={() => setTab("rewards")}
            className={`px-3 py-2 text-sm rounded-lg border transition-colors ${tab === "rewards" ? "border-primary bg-primary/10 text-primary font-medium" : "border-border text-muted-foreground"}`}>
            <DollarSign className="w-4 h-4 inline mr-1" />Награды
          </button>
          <button onClick={() => setTab("profiles")}
            className={`px-3 py-2 text-sm rounded-lg border transition-colors ${tab === "profiles" ? "border-primary bg-primary/10 text-primary font-medium" : "border-border text-muted-foreground"}`}>
            <Users className="w-4 h-4 inline mr-1" />Профили платежей
          </button>
        </div>
      </div>

      {tab === "rewards" && (
        <div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="text-xs text-muted-foreground mb-1">Всего выплат</div>
              <div className="font-heading text-xl font-bold">{rewards.length}</div>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="text-xs text-muted-foreground mb-1">Ожидают одобрения</div>
              <div className="font-heading text-xl font-bold text-amber-600">{totalPending.toLocaleString()} ₽</div>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="text-xs text-muted-foreground mb-1">Выплачено</div>
              <div className="font-heading text-xl font-bold text-green-600">{totalPaid.toLocaleString()} ₽</div>
            </div>
          </div>

          <div className="space-y-2 overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>{["Кандидат","Бенефициар","Сумма","Статус","Действие"].map(h => <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rewards.map(r => (
                  <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium truncate" title={r.candidate_id}>{r.candidate_id?.slice(0,6)}…</td>
                    <td className="px-4 py-3 text-sm truncate" title={r.beneficiary_user_id}>{r.beneficiary_user_id?.slice(0,6)}…</td>
                    <td className="px-4 py-3 text-sm font-bold text-accent">{(r.amount || 0).toLocaleString()} ₽</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${REWARD_STATUS_COLORS[r.status]}`}>
                        {REWARD_STATUS_LABELS[r.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {r.status === "pending" && (
                        <select className="h-7 px-2 text-xs border border-input rounded" onChange={e => updateRewardStatus(r.id, e.target.value)} disabled={updating === r.id}>
                          <option value="">Действие…</option>
                          <option value="approved">Одобрить</option>
                          <option value="rejected">Отклонить</option>
                        </select>
                      )}
                      {r.status === "approved" && (
                        <Button size="sm" variant="outline" onClick={() => updateRewardStatus(r.id, "processing")} disabled={updating === r.id} className="h-7 text-xs">
                          В обработку
                        </Button>
                      )}
                      {r.status === "processing" && (
                        <Button size="sm" variant="outline" onClick={() => updateRewardStatus(r.id, "paid")} disabled={updating === r.id} className="h-7 text-xs bg-green-50">
                          ✓ Выплачено
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "profiles" && (
        <div>
          <div className="text-sm text-muted-foreground mb-4">Всего профилей: {profiles.length}</div>
          {profiles.length === 0 && <div className="text-center py-12 text-muted-foreground">Нет платёжных профилей</div>}
          <div className="space-y-3">
            {profiles.map(p => (
              <div key={p.id} className="bg-card border border-border rounded-xl p-5">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="font-medium">{p.recipient_name}</div>
                    <div className="text-sm text-muted-foreground">{p.payment_method === "bank_transfer" ? "Банковский перевод" : "Карта"}</div>
                    {p.bank_name && <div className="text-sm text-muted-foreground">{p.bank_name} · {p.account_number ? `****${p.account_number.slice(-4)}` : "—"}</div>}
                    {p.bik && <div className="text-xs text-muted-foreground">БИК: {p.bik}</div>}
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${VS_COLORS[p.verification_status]}`}>{VS_LABELS[p.verification_status]}</span>
                </div>
                {p.verification_status === "pending_review" && (
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => updateVerification(p.id, "approved")}>
                      <CheckCircle className="w-4 h-4 mr-1" />Верифицировать
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => updateVerification(p.id, "rejected")}>
                      <XCircle className="w-4 h-4 mr-1" />Отклонить
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
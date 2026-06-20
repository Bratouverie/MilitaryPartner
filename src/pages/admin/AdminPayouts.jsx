import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, CheckCircle, XCircle } from "lucide-react";

const VS_COLORS = { not_filled: "bg-gray-100 text-gray-600", pending_review: "bg-amber-100 text-amber-700", approved: "bg-green-100 text-green-700", rejected: "bg-red-100 text-red-700" };
const VS_LABELS = { not_filled: "Не заполнено", pending_review: "На проверке", approved: "Верифицировано", rejected: "Отклонено" };

export default function AdminPayouts() {
  const { toast } = useToast();
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => base44.entities.PaymentProfile.list().then(setProfiles).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const updateVerification = async (id, status) => {
    await base44.entities.PaymentProfile.update(id, { verification_status: status });
    toast({ title: `Статус: ${VS_LABELS[status]}` });
    load();
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold mb-6">Платёжные профили ({profiles.length})</h1>
      {profiles.length === 0 && <div className="text-center py-12 text-muted-foreground">Нет платёжных профилей</div>}
      <div className="space-y-3">
        {profiles.map(p => (
          <div key={p.id} className="bg-card border border-border rounded-xl p-5">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3">
              <div>
                <div className="font-medium">{p.recipient_name}</div>
                <div className="text-sm text-muted-foreground">{p.bank_name} · {p.account_number ? `****${p.account_number.slice(-4)}` : "—"}</div>
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
  );
}
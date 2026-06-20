import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { Loader2, CreditCard, CheckCircle } from "lucide-react";
import { useProfile } from "@/lib/useProfile.jsx";

export default function Payouts() {
  const { profile, loading: profileLoading } = useProfile();
  const [paymentProfile, setPaymentProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ recipient_name: "", bank_name: "", bik: "", account_number: "", card_number: "" });

  useEffect(() => {
    if (!profile) return;
    setLoading(true);
    base44.entities.PaymentProfile.filter({ user_id: profile.id }).then(pp => {
      if (pp[0]) {
        setPaymentProfile(pp[0]);
        setForm({ recipient_name: pp[0].recipient_name || "", bank_name: pp[0].bank_name || "", bik: pp[0].bik || "", account_number: pp[0].account_number || "", card_number: pp[0].card_number || "" });
      }
      setLoading(false);
    });
  }, [profile?.id]);

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      if (paymentProfile) {
        await base44.entities.PaymentProfile.update(paymentProfile.id, { ...form, verification_status: "pending_review" });
      } else {
        const pp = await base44.entities.PaymentProfile.create({ user_id: profile.id, ...form, verification_status: "pending_review", payment_method: "bank_transfer" });
        setPaymentProfile(pp);
      }
      toast({ title: "Данные сохранены!" });
    } catch { toast({ title: "Ошибка сохранения", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  if (profileLoading || loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  const verified = paymentProfile?.verification_status === "approved";

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold mb-6">Данные для выплат</h1>
      {verified && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl p-3 mb-6 text-green-700 text-sm">
          <CheckCircle className="w-5 h-5" /> Данные верифицированы
        </div>
      )}
      <div className="bg-card border border-border rounded-2xl p-6 max-w-xl space-y-5">
        <div><Label>ФИО получателя</Label><Input value={form.recipient_name} onChange={e => setForm(f => ({ ...f, recipient_name: e.target.value }))} placeholder="Иванов Иван Иванович" /></div>
        <div><Label>Банк</Label><Input value={form.bank_name} onChange={e => setForm(f => ({ ...f, bank_name: e.target.value }))} placeholder="Сбербанк" /></div>
        <div><Label>БИК</Label><Input value={form.bik} onChange={e => setForm(f => ({ ...f, bik: e.target.value }))} placeholder="044525225" /></div>
        <div><Label>Номер счёта</Label><Input value={form.account_number} onChange={e => setForm(f => ({ ...f, account_number: e.target.value }))} placeholder="40817810..." /></div>
        <div><Label>Номер карты (альтернатива)</Label><Input value={form.card_number} onChange={e => setForm(f => ({ ...f, card_number: e.target.value }))} placeholder="2200 **** **** ****" /></div>
        <Button onClick={handleSave} disabled={saving} className="w-full bg-primary font-bold h-12 rounded-xl">
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <><CreditCard className="w-5 h-5 mr-2" />Сохранить</>}
        </Button>
      </div>
    </div>
  );
}
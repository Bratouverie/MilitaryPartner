import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { Loader2, CreditCard, CheckCircle, Clock, AlertCircle, XCircle, Info } from "lucide-react";
import { useProfile } from "@/lib/useProfile.jsx";
import moment from "moment";

const VERIFICATION_CONFIG = {
  not_filled: { icon: AlertCircle, label: "Не заполнен", color: "text-gray-500", bg: "bg-gray-50 border-gray-200" },
  pending_review: { icon: Clock, label: "На проверке у администратора", color: "text-amber-600", bg: "bg-amber-50 border-amber-200" },
  approved: { icon: CheckCircle, label: "Подтверждён — выплаты возможны", color: "text-green-600", bg: "bg-green-50 border-green-200" },
  rejected: { icon: XCircle, label: "Отклонён — исправьте данные", color: "text-red-600", bg: "bg-red-50 border-red-200" },
};

const PAYMENT_METHODS = [
  { value: "bank_transfer", label: "Банковский перевод" },
  { value: "card", label: "Банковская карта" },
  { value: "sbp", label: "СБП (по номеру телефона)" },
];

export default function Payouts() {
  const { profile, loading: profileLoading } = useProfile();
  const [paymentProfile, setPaymentProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    recipient_name: "", payment_method: "bank_transfer",
    bank_name: "", bik: "", account_number: "", card_number: "", phone_for_sbp: ""
  });

  useEffect(() => {
    if (!profile) return;
    setLoading(true);
    base44.entities.PaymentProfile.filter({ user_id: profile.id }).then(pp => {
      if (pp[0]) {
        const p = pp[0];
        setPaymentProfile(p);
        setForm({
          recipient_name: p.recipient_name || "",
          payment_method: p.payment_method || "bank_transfer",
          bank_name: p.bank_name || "",
          bik: p.bik || "",
          account_number: p.account_number || "",
          card_number: p.card_number || "",
          phone_for_sbp: p.phone_for_sbp || "",
        });
      }
      setLoading(false);
    });
  }, [profile?.id]);

  const handleSave = async () => {
    if (!form.recipient_name.trim()) { toast({ title: "Заполните ФИО получателя", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const data = { ...form, verification_status: "pending_review" };
      if (paymentProfile) {
        await base44.entities.PaymentProfile.update(paymentProfile.id, data);
        setPaymentProfile(p => ({ ...p, ...data }));
      } else {
        const pp = await base44.entities.PaymentProfile.create({ user_id: profile.id, ...data });
        setPaymentProfile(pp);
      }
      toast({ title: "Реквизиты сохранены. Ожидайте подтверждения администратором." });
    } catch { toast({ title: "Ошибка сохранения", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  if (profileLoading || loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  const verStatus = paymentProfile?.verification_status || "not_filled";
  const conf = VERIFICATION_CONFIG[verStatus] || VERIFICATION_CONFIG.not_filled;
  const isApproved = verStatus === "approved";

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-bold">Платёжный профиль</h1>
        <p className="text-sm text-muted-foreground mt-1">Реквизиты для получения вознаграждений за успешные рекруты</p>
      </div>

      {/* Статус платёжного профиля */}
      <div className={`flex items-start gap-3 border rounded-xl p-4 mb-6 ${conf.bg}`}>
        <conf.icon className={`w-5 h-5 mt-0.5 shrink-0 ${conf.color}`} />
        <div>
          <div className={`font-medium text-sm ${conf.color}`}>{conf.label}</div>
          {paymentProfile?.admin_comment && (
            <div className="text-xs text-muted-foreground mt-1">Комментарий администратора: {paymentProfile.admin_comment}</div>
          )}
          {paymentProfile?.reviewed_at && (
            <div className="text-xs text-muted-foreground mt-0.5">Дата проверки: {moment(paymentProfile.reviewed_at).format("DD.MM.YYYY")}</div>
          )}
          {verStatus === "not_filled" && (
            <div className="text-xs text-muted-foreground mt-1">Заполните реквизиты ниже, чтобы получать выплаты</div>
          )}
        </div>
      </div>

      {/* Назначение */}
      <div className="bg-muted rounded-xl p-4 mb-6 flex items-start gap-2">
        <Info className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-sm text-muted-foreground">
          <strong>Платёжный профиль</strong> — это ваши реквизиты для получения вознаграждений.
          После заполнения данные проходят проверку администратором. Только подтверждённый профиль позволяет получать выплаты.
        </p>
      </div>

      <div className="bg-card border border-border rounded-2xl p-6 max-w-xl space-y-5">
        <div>
          <Label>ФИО получателя *</Label>
          <Input value={form.recipient_name} onChange={e => setForm(f => ({ ...f, recipient_name: e.target.value }))} placeholder="Иванов Иван Иванович" disabled={isApproved} className="mt-1" />
        </div>

        <div>
          <Label>Способ выплаты *</Label>
          <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm mt-1"
            value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))} disabled={isApproved}>
            {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>

        {form.payment_method === "bank_transfer" && (
          <>
            <div><Label>Банк</Label><Input value={form.bank_name} onChange={e => setForm(f => ({ ...f, bank_name: e.target.value }))} placeholder="Сбербанк" disabled={isApproved} className="mt-1" /></div>
            <div><Label>БИК</Label><Input value={form.bik} onChange={e => setForm(f => ({ ...f, bik: e.target.value }))} placeholder="044525225" maxLength={9} disabled={isApproved} className="mt-1" /></div>
            <div><Label>Номер расчётного счёта</Label><Input value={form.account_number} onChange={e => setForm(f => ({ ...f, account_number: e.target.value }))} placeholder="40817810…" maxLength={20} disabled={isApproved} className="mt-1" /></div>
          </>
        )}

        {form.payment_method === "card" && (
          <div><Label>Номер карты</Label><Input value={form.card_number} onChange={e => setForm(f => ({ ...f, card_number: e.target.value }))} placeholder="2200 **** **** ****" maxLength={19} disabled={isApproved} className="mt-1" /></div>
        )}

        {form.payment_method === "sbp" && (
          <div><Label>Телефон для СБП</Label><Input type="tel" value={form.phone_for_sbp} onChange={e => setForm(f => ({ ...f, phone_for_sbp: e.target.value }))} placeholder="+7 900 123 45 67" disabled={isApproved} className="mt-1" /></div>
        )}

        {isApproved ? (
          <div className="flex items-center gap-2 text-green-600 text-sm font-medium">
            <CheckCircle className="w-4 h-4" />Профиль подтверждён — реквизиты заблокированы для редактирования
          </div>
        ) : (
          <Button onClick={handleSave} disabled={saving} className="w-full bg-primary font-bold h-12 rounded-xl">
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <><CreditCard className="w-5 h-5 mr-2" />Сохранить реквизиты</>}
          </Button>
        )}
      </div>
    </div>
  );
}
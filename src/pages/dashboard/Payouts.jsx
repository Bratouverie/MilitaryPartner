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
    recipient_name: "", date_of_birth: "", passport_series: "", passport_number: "", 
    passport_issued_by: "", passport_issued_date: "", passport_subdivision_code: "", 
    registration_address: "", inn: "", snils: "",
    payment_method: "bank_transfer",
    bank_name: "", bik: "", account_number: "", card_number: "", phone_for_sbp: ""
  });

  useEffect(() => {
    if (!profile) return;
    setLoading(true);
    base44.entities.PaymentProfile.filter({ user_id: profile.id })
      .then(pp => {
        if (pp[0]) {
          const p = pp[0];
          setPaymentProfile(p);
          setForm({
            recipient_name: p.recipient_name || "",
            date_of_birth: p.date_of_birth || "",
            passport_series: p.passport_series || "",
            passport_number: p.passport_number || "",
            passport_issued_by: p.passport_issued_by || "",
            passport_issued_date: p.passport_issued_date || "",
            passport_subdivision_code: p.passport_subdivision_code || "",
            registration_address: p.registration_address || "",
            inn: p.inn || "",
            snils: p.snils || "",
            payment_method: p.payment_method || "bank_transfer",
            bank_name: p.bank_name || "",
            bik: p.bik || "",
            account_number: p.account_number || "",
            card_number: p.card_number || "",
            phone_for_sbp: p.phone_for_sbp || "",
          });
        }
      })
      .catch(e => {
        console.error("[Payouts] Load failed:", e);
      })
      .finally(() => setLoading(false));
  }, [profile?.id]);

  const handleSave = async () => {
     if (!form.recipient_name.trim()) { toast({ title: "Заполните ФИО получателя", variant: "destructive" }); return; }
     if (!form.date_of_birth) { toast({ title: "Заполните дату рождения", variant: "destructive" }); return; }
     if (!form.passport_series || !form.passport_number) { toast({ title: "Заполните номер паспорта", variant: "destructive" }); return; }
     if (!form.registration_address.trim()) { toast({ title: "Заполните адрес регистрации", variant: "destructive" }); return; }

     // Validate formats
     if (!/^\d{4}$/.test(form.passport_series)) { toast({ title: "Серия паспорта должна быть 4 цифры", variant: "destructive" }); return; }
     if (!/^\d{6}$/.test(form.passport_number)) { toast({ title: "Номер паспорта должен быть 6 цифр", variant: "destructive" }); return; }
     if (form.inn && !/^\d{10,12}$/.test(form.inn)) { toast({ title: "ИНН должен быть 10 или 12 цифр", variant: "destructive" }); return; }
     if (form.snils && !/^\d{3}-\d{3}-\d{3}-\d{2}$/.test(form.snils)) { toast({ title: "СНИЛС: формат ХХХ-ХХХ-ХХХ-ХХ", variant: "destructive" }); return; }
     if (form.bik && !/^\d{9}$/.test(form.bik)) { toast({ title: "БИК должен быть 9 цифр", variant: "destructive" }); return; }

     setSaving(true);
     try {
       const newStatus = paymentProfile?.verification_status === "rejected" ? "pending_review" : "pending_review";
       const data = { ...form, verification_status: newStatus };
       if (paymentProfile) {
         await base44.entities.PaymentProfile.update(paymentProfile.id, data);
         setPaymentProfile(p => ({ ...p, ...data }));
       } else {
         const pp = await base44.entities.PaymentProfile.create({ user_id: profile.id, ...data });
         setPaymentProfile(pp);
       }
       toast({ title: "✓ Реквизиты сохранены! Ожидайте подтверждения администратором." });
     } catch (e) {
       console.error("[Payouts] Save failed:", e);
       toast({ title: "Ошибка сохранения", description: e.message, variant: "destructive" });
     }
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

      <div className="bg-card border border-border rounded-2xl p-6 max-w-2xl space-y-5">
         <div className="border-b pb-4 mb-4">
           <h3 className="font-bold text-base mb-3">Паспортные данные</h3>
           <div className="grid md:grid-cols-2 gap-4">
             <div>
               <Label>ФИО получателя *</Label>
               <Input value={form.recipient_name} onChange={e => setForm(f => ({ ...f, recipient_name: e.target.value }))} placeholder="Иванов Иван Иванович" disabled={isApproved} className="mt-1 text-sm" />
             </div>
             <div>
               <Label>Дата рождения *</Label>
               <Input type="date" value={form.date_of_birth} onChange={e => setForm(f => ({ ...f, date_of_birth: e.target.value }))} disabled={isApproved} className="mt-1 text-sm" />
             </div>
             <div>
               <Label>Серия паспорта *</Label>
               <Input value={form.passport_series} onChange={e => setForm(f => ({ ...f, passport_series: e.target.value }))} placeholder="1234" maxLength="4" disabled={isApproved} className="mt-1 text-sm" />
             </div>
             <div>
               <Label>Номер паспорта *</Label>
               <Input value={form.passport_number} onChange={e => setForm(f => ({ ...f, passport_number: e.target.value }))} placeholder="567890" maxLength="6" disabled={isApproved} className="mt-1 text-sm" />
             </div>
             <div>
               <Label>Кем выдан</Label>
               <Input value={form.passport_issued_by} onChange={e => setForm(f => ({ ...f, passport_issued_by: e.target.value }))} placeholder="УФМС по Москве" disabled={isApproved} className="mt-1 text-sm" />
             </div>
             <div>
               <Label>Дата выдачи</Label>
               <Input type="date" value={form.passport_issued_date} onChange={e => setForm(f => ({ ...f, passport_issued_date: e.target.value }))} disabled={isApproved} className="mt-1 text-sm" />
             </div>
             <div>
               <Label>Код подразделения</Label>
               <Input value={form.passport_subdivision_code} onChange={e => setForm(f => ({ ...f, passport_subdivision_code: e.target.value }))} placeholder="770-001" disabled={isApproved} className="mt-1 text-sm" />
             </div>
             <div>
               <Label>Адрес регистрации *</Label>
               <Input value={form.registration_address} onChange={e => setForm(f => ({ ...f, registration_address: e.target.value }))} placeholder="г. Москва, ул. Примерная, дом 1" disabled={isApproved} className="mt-1 text-sm" />
             </div>
             <div>
               <Label>ИНН</Label>
               <Input value={form.inn} onChange={e => setForm(f => ({ ...f, inn: e.target.value }))} placeholder="773123456789" maxLength="12" disabled={isApproved} className="mt-1 text-sm" />
             </div>
             <div>
               <Label>СНИЛС</Label>
               <Input value={form.snils} onChange={e => setForm(f => ({ ...f, snils: e.target.value }))} placeholder="123-456-789-01" disabled={isApproved} className="mt-1 text-sm" />
             </div>
           </div>
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
           ) : verStatus === "rejected" ? (
             <div className="space-y-3">
               <div className="text-sm text-red-600 font-medium">Профиль был отклонен. Исправьте данные и повторите попытку.</div>
               <Button onClick={handleSave} disabled={saving} className="w-full bg-primary font-bold h-12 rounded-xl">
                 {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <><CreditCard className="w-5 h-5 mr-2" />Повторить отправку</>}
               </Button>
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
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/components/ui/use-toast";
import { Shield, Loader2, CheckCircle, User } from "lucide-react";

export default function RefLanding() {
  const { code } = useParams();
  const { toast } = useToast();
  const [referrer, setReferrer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    full_name: "", phone: "", motivation: "want_to_serve", consent: false
  });

  useEffect(() => {
    base44.entities.ReferralProfile.filter({ referral_code: code }).then(profiles => {
      setReferrer(profiles[0] || null);
      setLoading(false);
    });
  }, [code]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.consent) { toast({ title: "Необходимо согласие", variant: "destructive" }); return; }
    setSubmitting(true);
    try {
      await base44.entities.CandidateApplication.create({
        full_name: form.full_name, phone: form.phone,
        motivation: form.motivation, risk_disclaimer_accepted: form.consent,
        current_status: "QUESTIONNAIRE_FILLED",
        source_referrer_id: referrer?.id, source_master_link_id: referrer?.master_link_id,
        source_channel: "referral_link",
      });
      setSubmitted(true);
    } catch {
      toast({ title: "Ошибка", description: "Попробуйте ещё раз", variant: "destructive" });
    } finally { setSubmitting(false); }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!referrer) return (
    <div className="min-h-screen flex items-center justify-center flex-col gap-4 p-4 text-center">
      <Shield className="w-16 h-16 text-muted-foreground" />
      <h1 className="font-heading text-2xl font-bold">Ссылка не найдена</h1>
      <p className="text-muted-foreground">Проверьте правильность реферальной ссылки</p>
      <Link to="/"><Button>На главную</Button></Link>
    </div>
  );

  if (submitted) return (
    <div className="min-h-screen flex items-center justify-center flex-col gap-4 p-4 text-center">
      <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
        <CheckCircle className="w-10 h-10 text-primary" />
      </div>
      <h1 className="font-heading text-2xl font-bold">Заявка принята!</h1>
      <p className="text-muted-foreground max-w-md">Спасибо! Куратор свяжется с вами в течение 4 часов. Проверьте телефон.</p>
      <Link to="/"><Button variant="outline">На главную</Button></Link>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary py-4 px-4">
        <div className="max-w-6xl mx-auto flex items-center gap-2">
          <Shield className="w-6 h-6 text-accent" />
          <span className="font-display font-bold text-xl text-primary-foreground">МилитариПартнер</span>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-12">
        <div className="flex items-center gap-3 mb-8 bg-card border border-border rounded-xl p-4">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="w-5 h-5 text-primary" />
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Вас пригласил</div>
            <div className="font-medium">{referrer.full_name}</div>
          </div>
        </div>

        <h1 className="font-heading text-3xl font-bold mb-2">Заполните анкету</h1>
        <p className="text-muted-foreground mb-8">Короткая форма — куратор свяжется с вами в течение 4 часов</p>

        <form onSubmit={handleSubmit} className="space-y-5 bg-card border border-border rounded-2xl p-6">
          {step === 1 && (
            <>
              <div className="text-xs font-medium text-muted-foreground">Шаг 1 из 2 — Контакты</div>
              <div>
                <Label>Имя *</Label>
                <Input value={form.full_name} onChange={e => setForm(f => ({...f, full_name: e.target.value}))} required placeholder="Ваше имя" />
              </div>
              <div>
                <Label>Телефон *</Label>
                <Input value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))} required placeholder="+7 900 123 45 67" />
              </div>
              <Button type="button" onClick={() => { if (form.full_name && form.phone) setStep(2); }}
                className="w-full bg-primary font-bold h-12 rounded-xl">Далее</Button>
            </>
          )}
          {step === 2 && (
            <>
              <div className="text-xs font-medium text-muted-foreground">Шаг 2 из 2 — Мотивация</div>
              <RadioGroup value={form.motivation} onValueChange={v => setForm(f => ({...f, motivation: v}))} className="space-y-3">
                {[
                  { value: "want_to_serve", label: "Хочу служить, зарабатывать" },
                  { value: "interested_in_pay", label: "Только интересно, сколько платят" },
                  { value: "friend_recommended", label: "Друг рекомендовал, посмотрю" },
                ].map(opt => (
                  <div key={opt.value} className="flex items-center gap-3 border border-border rounded-xl p-4 cursor-pointer hover:bg-muted/50">
                    <RadioGroupItem value={opt.value} id={opt.value} />
                    <label htmlFor={opt.value} className="cursor-pointer font-medium text-sm">{opt.label}</label>
                  </div>
                ))}
              </RadioGroup>
              <div className="flex items-start gap-2 pt-2">
                <Checkbox checked={form.consent} onCheckedChange={v => setForm(f => ({...f, consent: v}))} id="consent2" />
                <label htmlFor="consent2" className="text-sm text-muted-foreground leading-tight">Согласен на обработку персональных данных</label>
              </div>
              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={() => setStep(1)} className="flex-1 h-12 rounded-xl">Назад</Button>
                <Button type="submit" disabled={submitting} className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90 font-bold h-12 rounded-xl">
                  {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Отправить"}
                </Button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
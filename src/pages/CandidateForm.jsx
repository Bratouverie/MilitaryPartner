import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Shield, Loader2, AlertTriangle, RefreshCw, CheckCircle } from "lucide-react";

const MOTIVATIONS = [
  { value: "want_to_serve", label: "Хочу служить и зарабатывать", icon: "🎖️" },
  { value: "interested_in_pay", label: "Интересно, сколько платят", icon: "💰" },
  { value: "friend_recommended", label: "Друг рекомендовал — посмотрю", icon: "👥" },
];

/**
 * Публичная страница анкеты кандидата.
 * Route: /candidate/:formCode
 * Только создаёт CandidateApplication, НЕ создаёт referrer-профиль.
 */
export default function CandidateForm() {
  const { formCode } = useParams();
  const [program, setProgram] = useState(null);
  const [loadState, setLoadState] = useState("loading");
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ full_name: "", phone: "", email: "", telegram_contact: "", motivation: "", consent: false });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const loadProgram = useCallback(async () => {
    setLoadState("loading");
    try {
      const programs = await base44.entities.ReferralProgram.filter({ candidate_form_code: formCode, is_active: true });
      if (programs.length === 0) { setLoadState("not_found"); return; }
      setProgram(programs[0]);
      setLoadState("ready");
    } catch {
      setLoadState("error");
    }
  }, [formCode]);

  useEffect(() => { loadProgram(); }, [loadProgram]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.motivation) { setError("Выберите мотивацию"); return; }
    if (!form.consent) { setError("Необходимо согласие на обработку данных"); return; }
    setSubmitting(true);
    try {
      const candidate = await base44.entities.CandidateApplication.create({
        full_name: form.full_name,
        phone: form.phone,
        email: form.email || undefined,
        telegram_contact: form.telegram_contact || undefined,
        motivation: form.motivation,
        risk_disclaimer_accepted: true,
        current_status: "QUESTIONNAIRE_FILLED",
        source_channel: "candidate_form",
        source_referrer_id: program.owner_user_id,
        source_program_id: program.id,
        root_program_id: program.root_program_id || program.id,
        source_master_link_id: program.root_master_link_id || undefined,
        referral_chain_json: JSON.stringify([program.id]),
        assigned_moderator_id: program.assigned_moderator_id || undefined,
      });

      await base44.entities.CandidateStatusHistory.create({
        candidate_id: candidate.id,
        old_status: "NEW",
        new_status: "QUESTIONNAIRE_FILLED",
        changed_by_user_id: "system",
        change_comment: "Анкета кандидата заполнена",
      }).catch(() => {});

      await base44.entities.ActionLog.create({
        action_type: "CANDIDATE_APPLICATION_CREATED",
        entity_type: "CandidateApplication",
        entity_id: candidate.id,
        action_payload: JSON.stringify({ program_id: program.id, form_code: formCode }),
      }).catch(() => {});

      await base44.entities.ReferralProgram.update(program.id, {
        candidates_count: (program.candidates_count || 0) + 1,
      }).catch(() => {});

      setDone(true);
    } catch {
      setError("Ошибка при отправке анкеты. Попробуйте ещё раз.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadState === "loading") return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
  if (loadState === "not_found") return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-4 text-center">
      <Shield className="w-16 h-16 text-muted-foreground" />
      <h1 className="font-heading text-2xl font-bold">Анкета не найдена</h1>
      <p className="text-muted-foreground">Ссылка недействительна или программа приостановлена.</p>
      <Link to="/"><Button>На главную</Button></Link>
    </div>
  );
  if (loadState === "error") return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-4 text-center">
      <AlertTriangle className="w-16 h-16 text-destructive" />
      <h1 className="font-heading text-2xl font-bold">Ошибка загрузки</h1>
      <Button onClick={loadProgram} className="gap-2"><RefreshCw className="w-4 h-4" />Повторить</Button>
    </div>
  );

  if (done) return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-primary py-4 px-4">
        <div className="max-w-6xl mx-auto flex items-center gap-2">
          <Shield className="w-6 h-6 text-accent" />
          <span className="font-display font-bold text-xl text-primary-foreground">МилитариПартнер</span>
        </div>
      </header>
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-primary" />
          </div>
          <h1 className="font-heading text-2xl font-bold mb-3">Анкета отправлена!</h1>
          <p className="text-muted-foreground mb-2">Куратор свяжется с вами для уточнения деталей.</p>
          <p className="text-sm text-muted-foreground">Программа: <strong>{program?.title}</strong></p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary py-4 px-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-accent" />
            <span className="font-display font-bold text-xl text-primary-foreground">МилитариПартнер</span>
          </div>
          <div className="text-sm text-primary-foreground/70">Анкета кандидата</div>
        </div>
      </header>
      <div className="max-w-lg mx-auto px-4 py-12">
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-6">
          <div className="text-sm font-medium text-primary mb-1">{program.title}</div>
          <div className="text-xs text-muted-foreground">Заполните анкету — куратор свяжется для уточнения деталей</div>
        </div>
        <h1 className="font-heading text-2xl font-bold mb-2">Анкета кандидата</h1>
        <p className="text-muted-foreground text-sm mb-6">Мы свяжемся с вами после проверки данных</p>
        <form onSubmit={handleSubmit} className="space-y-5 bg-card border border-border rounded-2xl p-6">
          {step === 1 && (
            <>
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Шаг 1 из 2 — Контакты</div>
              <div><Label>Имя и фамилия *</Label><Input required value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Иванов Иван" autoFocus /></div>
              <div><Label>Телефон *</Label><Input required type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+7 900 123 45 67" /></div>
              <div><Label>Email (необязательно)</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="ваш@email.com" /></div>
              <div><Label>Telegram (необязательно)</Label><Input value={form.telegram_contact} onChange={e => setForm(f => ({ ...f, telegram_contact: e.target.value }))} placeholder="@username" /></div>
              <Button type="button" onClick={() => form.full_name && form.phone && setStep(2)} className="w-full bg-primary font-bold h-12 rounded-xl">Далее →</Button>
            </>
          )}
          {step === 2 && (
            <>
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Шаг 2 из 2 — Мотивация</div>
              <div className="space-y-3">
                {MOTIVATIONS.map(opt => (
                  <button key={opt.value} type="button" onClick={() => setForm(f => ({ ...f, motivation: opt.value }))}
                    className={`w-full text-left flex items-center gap-4 border-2 rounded-xl p-4 transition-all ${form.motivation === opt.value ? "border-primary bg-primary/8" : "border-border hover:border-primary/40"}`}>
                    <span className="text-2xl">{opt.icon}</span>
                    <span className="font-medium text-sm flex-1">{opt.label}</span>
                    <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${form.motivation === opt.value ? "border-primary bg-primary" : "border-muted-foreground/30"}`}>
                      {form.motivation === opt.value && <span className="w-2 h-2 rounded-full bg-white block" />}
                    </span>
                  </button>
                ))}
              </div>
              <div className="flex items-start gap-3">
                <Checkbox checked={form.consent} onCheckedChange={v => setForm(f => ({ ...f, consent: v }))} id="consent" />
                <label htmlFor="consent" className="text-sm text-muted-foreground leading-tight cursor-pointer">
                  Согласен на обработку персональных данных
                </label>
              </div>
              {error && <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-sm text-destructive">{error}</div>}
              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={() => setStep(1)} className="flex-1 h-12 rounded-xl">Назад</Button>
                <Button type="submit" disabled={submitting} className="flex-1 bg-accent text-accent-foreground font-bold h-12 rounded-xl">
                  {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Отправить анкету"}
                </Button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
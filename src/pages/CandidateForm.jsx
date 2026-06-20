/**
 * /candidate/:formCode — Анкета кандидата.
 * Живёт отдельно от партнёрской страницы.
 * Создаёт CandidateApplication + CandidateStatusHistory + ActionLog.
 */
import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Shield, Loader2, AlertTriangle, RefreshCw, CheckCircle } from "lucide-react";

const MOTIVATIONS = [
  { value: "want_to_serve", label: "Хочу служить Родине", icon: "🎖️" },
  { value: "interested_in_pay", label: "Интересует уровень вознаграждения", icon: "💰" },
  { value: "friend_recommended", label: "Порекомендовали знакомые", icon: "👥" },
];

const STATUS_LABELS = {
  NEW: "Новый", QUESTIONNAIRE_FILLED: "Анкета заполнена", CONTRACT_SIGNED: "Контракт подписан",
};

export default function CandidateForm() {
  const { formCode } = useParams();
  const [program, setProgram] = useState(null);
  const [loadState, setLoadState] = useState("loading");
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ full_name: "", phone: "", email: "", telegram_contact: "", motivation: "", consent: false });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const load = useCallback(async () => {
    setLoadState("loading");
    try {
      const programs = await base44.entities.ReferralProgram.filter({ candidate_form_code: formCode, is_active: true });
      if (programs.length === 0) { setLoadState("not_found"); return; }
      setProgram(programs[0]);
      setLoadState("ready");
    } catch { setLoadState("error"); }
  }, [formCode]);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.motivation) { setError("Пожалуйста, выберите мотивацию"); return; }
    if (!form.consent) { setError("Необходимо согласие на обработку персональных данных"); return; }
    setSubmitting(true);
    try {
      // Снимок цепочки программ
      let chainSnapshot = "[]";
      try {
        const ancestryIds = JSON.parse(program.ancestry_path_ids || "[]");
        ancestryIds.push(program.id);
        chainSnapshot = JSON.stringify(ancestryIds);
      } catch {}

      // Снимок root-программы
      let rootProgramSnapshot = "{}";
      try {
        const rootProgs = await base44.entities.ReferralProgram.filter({ id: program.root_program_id || program.id });
        if (rootProgs[0]) rootProgramSnapshot = JSON.stringify({ id: rootProgs[0].id, title: rootProgs[0].title, reward_quota: rootProgs[0].reward_quota });
      } catch {}

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
        source_referrer_user_id: program.owner_user_id,
        source_program_id: program.id,
        root_program_id: program.root_program_id || program.id,
        source_candidate_form_code: formCode,
        program_region_code: program.region_code || undefined,
        reward_chain_snapshot_json: chainSnapshot,
        root_program_snapshot_json: rootProgramSnapshot,
        reward_formula_version: "v1",
        source_master_link_id: program.root_master_link_id || undefined,
        assigned_moderator_id: program.assigned_moderator_id || undefined,
        preferred_contact_method: "phone",
      });

      await base44.entities.CandidateStatusHistory.create({
        candidate_id: candidate.id,
        old_status: "NEW",
        new_status: "QUESTIONNAIRE_FILLED",
        changed_by_user_id: "system",
        change_comment: "Анкета кандидата заполнена через форму",
      }).catch(() => {});

      await base44.entities.ActionLog.create({
        action_type: "CANDIDATE_APPLICATION_CREATED",
        entity_type: "CandidateApplication",
        entity_id: candidate.id,
        action_payload: JSON.stringify({ program_id: program.id, form_code: formCode, chain: chainSnapshot }),
      }).catch(() => {});

      await base44.entities.ReferralProgram.update(program.id, {
        candidates_count: (program.candidates_count || 0) + 1,
      }).catch(() => {});

      setDone(true);
    } catch { setError("Ошибка при отправке анкеты. Попробуйте ещё раз."); }
    finally { setSubmitting(false); }
  };

  if (loadState === "loading") return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
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
      <Button onClick={load}><RefreshCw className="w-4 h-4 mr-1" />Повторить</Button>
    </div>
  );

  const Header = () => (
    <header className="bg-primary py-4 px-4">
      <div className="max-w-lg mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-6 h-6 text-accent" />
          <span className="font-display font-bold text-xl text-primary-foreground">МилитариПартнер</span>
        </div>
        <div className="text-sm text-primary-foreground/70">Анкета кандидата</div>
      </div>
    </header>
  );

  if (done) return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-primary" />
          </div>
          <h1 className="font-heading text-2xl font-bold mb-3">Анкета отправлена!</h1>
          <p className="text-muted-foreground mb-2">Куратор свяжется с вами в ближайшее время для уточнения деталей.</p>
          <p className="text-sm text-muted-foreground">Программа: <strong>{program?.title}</strong></p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <div className="flex-1 max-w-lg mx-auto w-full px-4 py-10">
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-6">
          <div className="text-sm font-medium text-primary">{program.title}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Заполните анкету — куратор свяжется для уточнения деталей</div>
        </div>

        {/* Индикатор шагов */}
        <div className="flex items-center gap-2 mb-6">
          {[1, 2].map(s => (
            <React.Fragment key={s}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${step >= s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{s}</div>
              {s < 2 && <div className={`flex-1 h-0.5 ${step > s ? "bg-primary" : "bg-muted"}`} />}
            </React.Fragment>
          ))}
          <span className="text-xs text-muted-foreground ml-2">{step === 1 ? "Контакты" : "Мотивация"}</span>
        </div>

        <form onSubmit={handleSubmit} className="bg-card border border-border rounded-2xl p-6 space-y-4">
          {step === 1 && (
            <>
              <div><Label>Фамилия, имя, отчество *</Label><Input required value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Иванов Иван Иванович" autoFocus /></div>
              <div><Label>Телефон *</Label><Input required type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+7 900 123 45 67" /></div>
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="ваш@email.com" /></div>
              <div><Label>Telegram</Label><Input value={form.telegram_contact} onChange={e => setForm(f => ({ ...f, telegram_contact: e.target.value }))} placeholder="@username" /></div>
              <Button type="button" onClick={() => { if (form.full_name && form.phone) setStep(2); else setError("Заполните обязательные поля"); }} className="w-full bg-primary font-bold h-12 rounded-xl">
                Далее →
              </Button>
              {error && <div className="text-sm text-destructive">{error}</div>}
            </>
          )}
          {step === 2 && (
            <>
              <div className="text-sm font-medium mb-2">Почему вас интересует военная служба по контракту?</div>
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
              <div className="flex items-start gap-3 pt-2">
                <Checkbox id="consent" checked={form.consent} onCheckedChange={v => setForm(f => ({ ...f, consent: v }))} />
                <label htmlFor="consent" className="text-sm text-muted-foreground leading-tight cursor-pointer">
                  Согласен на обработку персональных данных в соответствии с законодательством РФ. Я понимаю риски военной службы.
                </label>
              </div>
              {error && <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-sm text-destructive">{error}</div>}
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setStep(1)} className="flex-1 h-12 rounded-xl">← Назад</Button>
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
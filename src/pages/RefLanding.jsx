import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Shield, Loader2, User, AlertTriangle, RefreshCw, Key, Eye, EyeOff, Copy } from "lucide-react";
import { setStoredProfile } from "@/lib/profileSession";
import { toast } from "@/components/ui/use-toast";

const MOTIVATIONS = [
  { value: "want_to_serve", label: "Хочу служить и зарабатывать", icon: "🎖️" },
  { value: "interested_in_pay", label: "Интересно, сколько платят", icon: "💰" },
  { value: "friend_recommended", label: "Друг рекомендовал — посмотрю", icon: "👥" },
];

const genRefCode = () => {
  const c = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: 8 }, () => c[Math.floor(Math.random() * c.length)]).join("");
};
const genSecretCode = () => {
  const c = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: 28 }, () => c[Math.floor(Math.random() * c.length)]).join("");
};
const maskCode = (code) => code.slice(0, 4) + "••••••••••••••••••••" + code.slice(-4);

export default function RefLanding() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [referrer, setReferrer] = useState(null);
  const [loadState, setLoadState] = useState("loading"); // loading | ready | not_found | error
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ full_name: "", phone: "", email: "", motivation: "", consent: false });
  const [formError, setFormError] = useState("");

  // После создания профиля — показ кода
  const [newProfile, setNewProfile] = useState(null);
  const [showCode, setShowCode] = useState(false);

  const fetchReferrer = useCallback(async () => {
    setLoadState("loading");
    try {
      const profiles = await base44.entities.ReferralProfile.filter({ referral_code: code });
      if (profiles.length === 0) {
        setLoadState("not_found");
      } else {
        setReferrer(profiles[0]);
        setLoadState("ready");
      }
    } catch {
      setLoadState("error");
    }
  }, [code]);

  useEffect(() => { fetchReferrer(); }, [fetchReferrer]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");

    if (!form.motivation) { setFormError("Пожалуйста, выберите мотивацию"); return; }
    if (!form.consent) { setFormError("Необходимо согласие на обработку персональных данных"); return; }
    if (submitting) return;

    setSubmitting(true);
    try {
      const emailLower = form.email.trim().toLowerCase();

      // Проверяем дубль по email если указан
      if (emailLower) {
        const existing = await base44.entities.ReferralProfile.filter({ email: emailLower });
        if (existing.length > 0) {
          setFormError("Пользователь с таким email уже зарегистрирован. Войдите по вашему секретному коду.");
          setSubmitting(false);
          return;
        }
      }

      // Выбираем мастер-ссылку нового участника — наследуем от пригласившего
      const masterLinkId = referrer?.master_link_id || undefined;

      // Генерируем уникальный secret_code
      let secretCode;
      let attempts = 0;
      while (attempts < 5) {
        secretCode = genSecretCode();
        const conflict = await base44.entities.ReferralProfile.filter({ secret_code: secretCode });
        if (conflict.length === 0) break;
        attempts++;
      }

      const referralCode = genRefCode();
      const maskedCode = maskCode(secretCode);
      const now = new Date().toISOString();

      // Создаём новый referrer-профиль для пришедшего по ссылке
      const profile = await base44.entities.ReferralProfile.create({
        ...(emailLower ? { email: emailLower } : {}),
        full_name: form.full_name || undefined,
        phone: form.phone || undefined,
        role: "referrer",
        status: "active",
        referral_code: referralCode,
        secret_code: secretCode,
        masked_secret_code: maskedCode,
        secret_code_last_sent_at: now,
        master_link_id: masterLinkId,
        parent_user_id: referrer?.id,
        level: "L0_novice",
        total_earned: 0, total_paid: 0, total_pending: 0,
        active_referrals_count: 0, total_candidates_count: 0,
      });

      // Дополнительно — создаём CandidateApplication (мотивация/контакты)
      const candidate = await base44.entities.CandidateApplication.create({
        full_name: form.full_name,
        phone: form.phone,
        email: emailLower || undefined,
        motivation: form.motivation,
        risk_disclaimer_accepted: form.consent,
        current_status: "QUESTIONNAIRE_FILLED",
        source_referrer_id: referrer?.id,
        source_master_link_id: masterLinkId,
        source_channel: "referral_link",
      });

      await base44.entities.CandidateStatusHistory.create({
        candidate_id: candidate.id,
        old_status: "NEW",
        new_status: "QUESTIONNAIRE_FILLED",
        changed_by_user_id: "system",
        change_comment: "Анкета отправлена по реферальной ссылке",
      }).catch(() => {});

      await base44.entities.ActionLog.create({
        action_type: "PROFILE_CREATED_FROM_REFERRAL",
        entity_type: "ReferralProfile",
        entity_id: profile.id,
        action_payload: JSON.stringify({
          referral_code: code,
          parent_referrer_id: referrer?.id,
          candidate_application_id: candidate.id,
        }),
      }).catch(() => {});

      // Если email указан — шлём код дополнительно
      if (emailLower) {
        await base44.integrations.Core.SendEmail({
          to: emailLower,
          subject: "Вы зарегистрированы в МилитариПартнер — ваш код входа",
          body: `<h2>Добро пожаловать!</h2><p><strong>Ваш секретный код для входа:</strong></p>
<p style="font-size:20px;font-family:monospace;background:#f4f4f4;padding:12px;border-radius:6px">${secretCode}</p>
<p>Используйте его для входа на сайте — email при входе не нужен.</p>
<p><a href="${window.location.origin}/secret-login">Войти в кабинет →</a></p>`,
        }).catch(() => {});
      }

      // Сразу авторизуем
      setStoredProfile({ ...profile, secret_code: secretCode, masked_secret_code: maskedCode });
      setNewProfile({ ...profile, secret_code: secretCode, masked_secret_code: maskedCode, email: emailLower });

    } catch (err) {
      setFormError("Произошла ошибка при регистрации. Попробуйте ещё раз.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = async () => {
    if (newProfile?.secret_code) {
      await navigator.clipboard.writeText(newProfile.secret_code);
      toast({ title: "Код скопирован!" });
    }
  };

  const handleGoToDashboard = () => {
    navigate("/dashboard", { replace: true });
  };

  // --- Loading states ---
  if (loadState === "loading") return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );

  if (loadState === "not_found") return (
    <div className="min-h-screen flex items-center justify-center flex-col gap-4 p-4 text-center">
      <Shield className="w-16 h-16 text-muted-foreground" />
      <h1 className="font-heading text-2xl font-bold">Ссылка не найдена</h1>
      <p className="text-muted-foreground max-w-sm">Реферальная ссылка недействительна или устарела.</p>
      <Link to="/"><Button>На главную</Button></Link>
    </div>
  );

  if (loadState === "error") return (
    <div className="min-h-screen flex items-center justify-center flex-col gap-4 p-4 text-center">
      <AlertTriangle className="w-16 h-16 text-destructive" />
      <h1 className="font-heading text-2xl font-bold">Не удалось загрузить страницу</h1>
      <p className="text-muted-foreground max-w-sm">Проверьте подключение и попробуйте ещё раз.</p>
      <Button onClick={fetchReferrer} className="gap-2">
        <RefreshCw className="w-4 h-4" /> Попробовать ещё раз
      </Button>
    </div>
  );

  // --- Success: show secret code and go to dashboard ---
  if (newProfile) return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-primary py-4 px-4">
        <div className="max-w-6xl mx-auto flex items-center gap-2">
          <Shield className="w-6 h-6 text-accent" />
          <span className="font-display font-bold text-xl text-primary-foreground">МилитариПартнер</span>
        </div>
      </header>
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Key className="w-8 h-8 text-primary" />
            </div>
            <h1 className="font-heading text-2xl font-bold mb-2">Вы зарегистрированы!</h1>
            <p className="text-muted-foreground text-sm">
              Сохраните секретный код — он нужен для входа вместо пароля
            </p>
          </div>

          <div className="bg-card border border-border rounded-2xl p-6">
            <div className="bg-muted rounded-xl p-4 font-mono text-center text-base mb-3 min-h-[56px] flex items-center justify-center break-all">
              {showCode ? newProfile.secret_code : newProfile.masked_secret_code}
            </div>

            {newProfile.email ? (
              <p className="text-xs text-muted-foreground text-center mb-4">Код также отправлен на <strong>{newProfile.email}</strong></p>
            ) : (
              <p className="text-xs text-amber-600 text-center mb-4 bg-amber-50 rounded-lg p-2">
                ⚠️ Email не указан — сохраните код сейчас, это единственный способ входа
              </p>
            )}

            <div className="grid grid-cols-2 gap-2 mb-5">
              <Button variant="outline" size="sm" onClick={() => setShowCode(v => !v)} className="h-10 text-xs">
                {showCode ? <EyeOff className="w-3.5 h-3.5 mr-1" /> : <Eye className="w-3.5 h-3.5 mr-1" />}
                {showCode ? "Скрыть" : "Показать"}
              </Button>
              <Button variant="outline" size="sm" onClick={handleCopy} className="h-10 text-xs">
                <Copy className="w-3.5 h-3.5 mr-1" /> Копировать
              </Button>
            </div>

            <Button onClick={handleGoToDashboard} className="w-full bg-primary font-bold h-12 rounded-xl">
              Я сохранил код — перейти в кабинет →
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  // --- Registration form ---
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
            <div className="font-medium">{referrer.full_name || "Партнёр"}</div>
          </div>
        </div>

        <h1 className="font-heading text-3xl font-bold mb-2">Присоединиться к команде</h1>
        <p className="text-muted-foreground mb-8">Заполните форму — получите свой аккаунт и реферальную ссылку</p>

        <form onSubmit={handleSubmit} className="space-y-5 bg-card border border-border rounded-2xl p-6">
          {step === 1 && (
            <>
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Шаг 1 из 2 — Контакты</div>
              <div>
                <Label>Имя *</Label>
                <Input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} required placeholder="Ваше имя" />
              </div>
              <div>
                <Label>Телефон *</Label>
                <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} required placeholder="+7 900 123 45 67" type="tel" />
              </div>
              <div>
                <Label>Email (необязательно)</Label>
                <Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="ваш@email.com" type="email" />
                <p className="text-xs text-muted-foreground mt-1">Если укажете — пришлём код на email дополнительно</p>
              </div>
              <Button
                type="button"
                onClick={() => { if (form.full_name && form.phone) setStep(2); }}
                className="w-full bg-primary font-bold h-12 rounded-xl"
              >
                Далее
              </Button>
            </>
          )}

          {step === 2 && (
            <>
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Шаг 2 из 2 — Мотивация</div>
              <div className="space-y-3">
                {MOTIVATIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, motivation: opt.value }))}
                    className={`w-full text-left flex items-center gap-4 border-2 rounded-xl p-4 transition-all cursor-pointer
                      ${form.motivation === opt.value
                        ? "border-primary bg-primary/8 shadow-sm"
                        : "border-border bg-background hover:border-primary/40 hover:bg-muted/30"
                      }`}
                  >
                    <span className="text-2xl shrink-0">{opt.icon}</span>
                    <span className="font-medium text-sm flex-1">{opt.label}</span>
                    <span className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-all
                      ${form.motivation === opt.value ? "border-primary bg-primary" : "border-muted-foreground/30"}`}>
                      {form.motivation === opt.value && <span className="w-2 h-2 rounded-full bg-white block" />}
                    </span>
                  </button>
                ))}
              </div>

              <div className="flex items-start gap-3 pt-2">
                <Checkbox checked={form.consent} onCheckedChange={v => setForm(f => ({ ...f, consent: v }))} id="consent2" className="mt-0.5" />
                <label htmlFor="consent2" className="text-sm text-muted-foreground leading-tight cursor-pointer">
                  Согласен на обработку персональных данных в соответствии с требованиями законодательства РФ
                </label>
              </div>

              {formError && (
                <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-sm text-destructive">{formError}</div>
              )}

              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={() => setStep(1)} className="flex-1 h-12 rounded-xl">Назад</Button>
                <Button type="submit" disabled={submitting} className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90 font-bold h-12 rounded-xl">
                  {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Зарегистрироваться"}
                </Button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
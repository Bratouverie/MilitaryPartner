import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Link, useNavigate } from "react-router-dom";
import { Shield, ArrowRight, Loader2, Eye, EyeOff, Copy, Mail, Key } from "lucide-react";
import { setStoredProfile } from "@/lib/profileSession";
import { toast } from "@/components/ui/use-toast";

const genRefCode = () => {
  const c = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: 8 }, () => c[Math.floor(Math.random() * c.length)]).join("");
};
const genSecretCode = () => {
  const c = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: 28 }, () => c[Math.floor(Math.random() * c.length)]).join("");
};
const maskCode = (code) => {
  if (!code || code.length < 8) return "****";
  return code.slice(0, 4) + "••••••••••••••••••••" + code.slice(-4);
};

export default function RegisterReferrer() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [createdProfile, setCreatedProfile] = useState(null);
  const [showCode, setShowCode] = useState(false);
  const [resending, setResending] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!consent) {
      setError("Необходимо согласие на обработку персональных данных.");
      return;
    }

    const emailLower = email.trim().toLowerCase();
    setLoading(true);

    try {
      // Check duplicate
      const existing = await base44.entities.ReferralProfile.filter({ email: emailLower });
      if (existing.length > 0) {
        setError("Пользователь с таким email уже зарегистрирован. Войдите по вашему секретному коду.");
        setLoading(false);
        return;
      }

      // Auto-select master link
      const allLinks = await base44.entities.MasterLink.filter({ is_active: true });
      let masterLink = allLinks.find(l => l.is_default_public) || null;
      if (!masterLink && allLinks.length === 1) masterLink = allLinks[0];
      if (!masterLink && allLinks.length > 1) {
        await base44.entities.ActionLog.create({
          action_type: "REGISTRATION_CONFIG_ERROR",
          entity_type: "MasterLink",
          action_payload: JSON.stringify({ reason: "multiple_active_no_default_public", email: emailLower }),
        }).catch(() => {});
        setError("Регистрация временно недоступна: не настроена публичная программа. Обратитесь к администратору.");
        setLoading(false);
        return;
      }

      const referralCode = genRefCode();
      const secretCode = genSecretCode();
      const maskedCode = maskCode(secretCode);
      const now = new Date().toISOString();

      // Create ReferralProfile — only email is required
      const profile = await base44.entities.ReferralProfile.create({
        email: emailLower,
        role: "referrer",
        status: "active",
        referral_code: referralCode,
        secret_code: secretCode,
        masked_secret_code: maskedCode,
        secret_code_last_sent_at: now,
        master_link_id: masterLink?.id || undefined,
        personal_max_reward_snapshot: masterLink?.max_reward || 200000,
        referral_reward: Math.min(50000, masterLink?.max_reward || 200000),
        level: "L0_novice",
        total_earned: 0,
        total_paid: 0,
        total_pending: 0,
        active_referrals_count: 0,
        total_candidates_count: 0,
      });

      // Send welcome email
      await base44.integrations.Core.SendEmail({
        to: emailLower,
        subject: "Добро пожаловать в МилитариПартнер! Ваш секретный код",
        body: `<h2>Вы успешно зарегистрированы!</h2>
<p>Для входа в личный кабинет используйте:</p>
<p><strong>Email:</strong> ${emailLower}</p>
<p><strong>Секретный код:</strong></p>
<p style="font-size:20px;font-family:monospace;background:#f4f4f4;padding:12px;border-radius:6px;letter-spacing:2px">${secretCode}</p>
<p>⚠️ Сохраните этот код в надёжном месте — он используется вместо пароля.</p>
<p><a href="${window.location.origin}/secret-login" style="background:#2d6a4f;color:white;padding:10px 20px;border-radius:6px;text-decoration:none">Войти в кабинет</a></p>`,
      }).catch(() => {}); // Don't fail registration if email fails

      // Action log
      await base44.entities.ActionLog.create({
        actor_role: "referrer",
        action_type: "REFERRER_REGISTERED",
        entity_type: "ReferralProfile",
        entity_id: profile.id,
        action_payload: JSON.stringify({ email: emailLower, master_link_id: masterLink?.id }),
      }).catch(() => {});

      // Store session
      setStoredProfile({ ...profile, secret_code: secretCode, masked_secret_code: maskedCode });

      // Show secret code modal
      setCreatedProfile({ ...profile, secret_code: secretCode, masked_secret_code: maskedCode });
      setShowModal(true);

    } catch (err) {
      console.error("Registration error:", err);
      const msg = err?.response?.data?.message || err?.message || "";
      if (msg.toLowerCase().includes("unique") || msg.toLowerCase().includes("duplicate")) {
        setError("Пользователь с таким email уже зарегистрирован.");
      } else {
        setError("Ошибка при создании профиля: " + (msg || "попробуйте ещё раз"));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleShowCode = () => {
    setShowCode(true);
    setTimeout(() => setShowCode(false), 3000);
  };

  const handleCopy = async () => {
    if (createdProfile?.secret_code) {
      await navigator.clipboard.writeText(createdProfile.secret_code);
      toast({ title: "Код скопирован в буфер обмена!" });
    }
  };

  const handleResend = async () => {
    if (!createdProfile) return;
    setResending(true);
    try {
      await base44.integrations.Core.SendEmail({
        to: createdProfile.email,
        subject: "Ваш секретный код — МилитариПартнер",
        body: `<h2>Секретный код для входа</h2><p style="font-size:20px;font-family:monospace;background:#f4f4f4;padding:12px;border-radius:6px">${createdProfile.secret_code}</p><p><a href="${window.location.origin}/secret-login">Войти в кабинет</a></p>`,
      });
      await base44.entities.ReferralProfile.update(createdProfile.id, { secret_code_last_sent_at: new Date().toISOString() });
      await base44.entities.ActionLog.create({ actor_role: "referrer", action_type: "SECRET_CODE_RESENT", entity_type: "ReferralProfile", entity_id: createdProfile.id }).catch(() => {});
      toast({ title: "Код повторно отправлен на email!" });
    } catch {
      toast({ title: "Ошибка отправки", variant: "destructive" });
    } finally {
      setResending(false);
    }
  };

  const handleDismiss = () => {
    setShowModal(false);
    navigate("/dashboard", { replace: true });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-primary py-4 px-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-accent" />
            <span className="font-display font-bold text-xl text-primary-foreground">МилитариПартнер</span>
          </Link>
          <Link to="/secret-login">
            <Button variant="outline" size="sm" className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10">
              Войти
            </Button>
          </Link>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <h1 className="font-heading text-3xl font-bold text-center mb-2">Получить реферальную ссылку</h1>
          <p className="text-muted-foreground text-center mb-8">
            Укажите только email — ссылка будет готова сразу, без пароля
          </p>

          <form onSubmit={handleSubmit} className="space-y-5 bg-card border border-border rounded-2xl p-6">
            <div>
              <Label>Email *</Label>
              <Input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="ваш@email.com"
                autoFocus
              />
            </div>
            <div className="flex items-start gap-2">
              <Checkbox checked={consent} onCheckedChange={setConsent} id="consent" />
              <label htmlFor="consent" className="text-sm text-muted-foreground leading-tight cursor-pointer">
                Я согласен на обработку персональных данных
              </label>
            </div>

            {error && (
              <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <Button type="submit" disabled={loading || !consent} className="w-full bg-accent text-accent-foreground hover:bg-accent/90 font-bold h-12 rounded-xl">
              {loading
                ? <Loader2 className="w-5 h-5 animate-spin" />
                : <>Получить ссылку <ArrowRight className="w-5 h-5 ml-2" /></>
              }
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-4">
            Уже есть аккаунт?{" "}
            <Link to="/secret-login" className="text-primary font-medium hover:underline">Войти</Link>
          </p>
        </div>
      </div>

      {/* Secret Code Modal */}
      {showModal && createdProfile && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="text-center mb-2">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <Key className="w-6 h-6 text-primary" />
              </div>
              <h2 className="font-heading font-bold text-xl">Ваш Secret Code</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Сохраните этот код — он нужен для входа вместо пароля
              </p>
            </div>

            <div className="bg-muted rounded-xl p-4 font-mono text-center text-base mb-2 min-h-[56px] flex items-center justify-center break-all mt-4">
              {showCode ? createdProfile.secret_code : createdProfile.masked_secret_code}
            </div>
            <p className="text-xs text-muted-foreground text-center mb-5">
              Код также отправлен на <strong>{createdProfile.email}</strong>
            </p>

            <div className="grid grid-cols-3 gap-2 mb-5">
              <Button variant="outline" size="sm" onClick={handleShowCode} className="h-10 text-xs">
                {showCode ? <EyeOff className="w-3.5 h-3.5 mr-1" /> : <Eye className="w-3.5 h-3.5 mr-1" />}
                {showCode ? "Скрыть" : "Показать"}
              </Button>
              <Button variant="outline" size="sm" onClick={handleCopy} className="h-10 text-xs">
                <Copy className="w-3.5 h-3.5 mr-1" /> Копировать
              </Button>
              <Button variant="outline" size="sm" onClick={handleResend} disabled={resending} className="h-10 text-xs">
                {resending
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <><Mail className="w-3.5 h-3.5 mr-1" />На email</>
                }
              </Button>
            </div>

            <Button onClick={handleDismiss} className="w-full bg-primary font-bold h-12 rounded-xl">
              Я сохранил код — перейти в кабинет →
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
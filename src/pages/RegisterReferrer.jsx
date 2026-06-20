import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import { Link, useNavigate } from "react-router-dom";
import { Shield, ArrowRight, Loader2, Eye, EyeOff, Copy, Mail } from "lucide-react";

const genRefCode = () => {
  const c = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: 8 }, () => c[Math.floor(Math.random() * c.length)]).join("");
};
const genSecretCode = () => {
  const c = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: 28 }, () => c[Math.floor(Math.random() * c.length)]).join("");
};
const maskCode = (code) => {
  if (!code || code.length < 12) return "****";
  return code.slice(0, 4) + "****" + code.slice(8, 12) + "****";
};

export default function RegisterReferrer() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");

  // Secret code modal state
  const [showModal, setShowModal] = useState(false);
  const [createdProfile, setCreatedProfile] = useState(null);
  const [showCode, setShowCode] = useState(false);
  const [resending, setResending] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!consent) { setError("Необходимо согласие на обработку данных."); return; }

    setLoading(true);
    try {
      // Check duplicate
      const existing = await base44.entities.ReferralProfile.filter({ email: email.trim().toLowerCase() });
      if (existing.length > 0) {
        setError("Пользователь с таким email уже зарегистрирован. Войдите по секретному коду.");
        setLoading(false);
        return;
      }

      // Find default public master link
      const allLinks = await base44.entities.MasterLink.filter({ is_active: true });
      let masterLink = allLinks.find(l => l.is_default_public) || allLinks[0] || null;

      const referralCode = genRefCode();
      const secretCode = genSecretCode();
      const maskedCode = maskCode(secretCode);

      const profile = await base44.entities.ReferralProfile.create({
        email: email.trim().toLowerCase(),
        role: "referrer",
        status: "active",
        referral_code: referralCode,
        secret_code: secretCode,
        masked_secret_code: maskedCode,
        secret_code_last_sent_at: new Date().toISOString(),
        master_link_id: masterLink?.id || undefined,
        personal_max_reward_snapshot: masterLink?.max_reward || 200000,
        referral_reward: Math.min(50000, masterLink?.max_reward || 200000),
        level: "L0_novice",
      });

      // Send welcome email
      await base44.integrations.Core.SendEmail({
        to: email.trim().toLowerCase(),
        subject: "Добро пожаловать в МилитариПартнер! Ваш секретный код",
        body: `<h2>Добро пожаловать!</h2><p>Ваш аккаунт создан. Для входа в личный кабинет используйте:</p><p><strong>Email:</strong> ${email}</p><p><strong>Секретный код:</strong> <code style="font-size:18px;background:#f0f0f0;padding:4px 8px">${secretCode}</code></p><p>Сохраните этот код — он используется для входа вместо пароля.</p><p><a href="${window.location.origin}/secret-login">Войти в кабинет</a></p>`,
      });

      // Action log
      await base44.entities.ActionLog.create({
        actor_role: "referrer",
        action_type: "REFERRER_REGISTERED",
        entity_type: "ReferralProfile",
        entity_id: profile.id,
        action_payload: JSON.stringify({ email }),
      });

      // Store session
      sessionStorage.setItem("mp_profile_id", profile.id);
      sessionStorage.setItem("mp_profile_role", "referrer");
      sessionStorage.setItem("mp_profile_email", email.trim().toLowerCase());

      setCreatedProfile({ ...profile, secret_code: secretCode, masked_secret_code: maskedCode });
      setShowModal(true);
    } catch (err) {
      setError("Произошла ошибка при регистрации. Попробуйте ещё раз.");
    } finally {
      setLoading(false);
    }
  };

  const handleShowCode = () => {
    setShowCode(true);
    setTimeout(() => setShowCode(false), 3000);
  };

  const handleCopy = () => {
    if (createdProfile?.secret_code) {
      navigator.clipboard.writeText(createdProfile.secret_code);
      toast({ title: "Код скопирован!" });
    }
  };

  const handleResend = async () => {
    if (!createdProfile) return;
    setResending(true);
    try {
      await base44.integrations.Core.SendEmail({
        to: createdProfile.email,
        subject: "Ваш секретный код — МилитариПартнер",
        body: `<h2>Ваш секретный код</h2><p>Код: <strong style="font-size:18px">${createdProfile.secret_code}</strong></p><p><a href="${window.location.origin}/secret-login">Войти</a></p>`,
      });
      await base44.entities.ReferralProfile.update(createdProfile.id, { secret_code_last_sent_at: new Date().toISOString() });
      toast({ title: "Код повторно отправлен на email!" });
    } catch {
      toast({ title: "Ошибка отправки", variant: "destructive" });
    } finally {
      setResending(false);
    }
  };

  const handleDismiss = () => {
    setShowModal(false);
    navigate("/dashboard");
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
            <Button variant="outline" size="sm" className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10">Войти</Button>
          </Link>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <h1 className="font-heading text-3xl font-bold text-center mb-2">Получить реферальную ссылку</h1>
          <p className="text-muted-foreground text-center mb-8">Укажите только email — ссылка будет готова сразу</p>

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
              <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-sm text-destructive">{error}</div>
            )}
            <Button type="submit" disabled={loading} className="w-full bg-accent text-accent-foreground hover:bg-accent/90 font-bold h-12 rounded-xl">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Получить ссылку <ArrowRight className="w-5 h-5 ml-2" /></>}
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
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md">
            <h2 className="font-heading font-bold text-xl mb-1">Ваш Secret Code</h2>
            <p className="text-sm text-muted-foreground mb-5">Сохраните этот код — он используется для входа вместо пароля</p>

            <div className="bg-muted rounded-xl p-4 font-mono text-center text-lg mb-5 tracking-wider min-h-[56px] flex items-center justify-center">
              {showCode ? createdProfile.secret_code : createdProfile.masked_secret_code}
            </div>

            <div className="grid grid-cols-3 gap-2 mb-5">
              <Button variant="outline" size="sm" onClick={handleShowCode} className="h-10 text-xs">
                {showCode ? <EyeOff className="w-3.5 h-3.5 mr-1" /> : <Eye className="w-3.5 h-3.5 mr-1" />}
                {showCode ? "Скрыть" : "Показать"}
              </Button>
              <Button variant="outline" size="sm" onClick={handleCopy} className="h-10 text-xs">
                <Copy className="w-3.5 h-3.5 mr-1" /> Копировать
              </Button>
              <Button variant="outline" size="sm" onClick={handleResend} disabled={resending} className="h-10 text-xs">
                {resending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Mail className="w-3.5 h-3.5 mr-1" />На email</>}
              </Button>
            </div>

            <Button onClick={handleDismiss} className="w-full bg-primary font-bold h-12 rounded-xl">
              Я сохранил код → Перейти в кабинет
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, useNavigate } from "react-router-dom";
import { Shield, Loader2, ShieldCheck, Lock } from "lucide-react";
import { setStoredProfile, getStoredProfileId, getStoredRole } from "@/lib/profileSession";

const genSecretCode = () => {
  const c = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: 28 }, () => c[Math.floor(Math.random() * c.length)]).join("");
};
const maskCode = (code) => code.slice(0, 4) + "••••••••••••••••••••" + code.slice(-4);

export default function AdminBootstrap() {
  const navigate = useNavigate();
  const [step, setStep] = useState("check"); // check | blocked | form | done
  const [form, setForm] = useState({ email: "", name: "" });
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  useEffect(() => {
    const autoCheck = async () => {
      try {
        // If already logged in as super_admin — allow recovery mode
        const currentRole = getStoredRole();
        const currentId = getStoredProfileId();

        if (currentRole === "super_admin" && currentId) {
          // Already super_admin — allow recovery/regeneration from here
          setStep("form");
          setChecking(false);
          return;
        }

        // Check if any super_admin exists — if yes, block public access
        const admins = await base44.entities.ReferralProfile.filter({ role: "super_admin", status: "active" });
        if (admins.length > 0) {
          // super_admin exists — block form, do NOT reveal email
          setStep("blocked");
          setChecking(false);
          return;
        }

        // No super_admin at all — first run, allow bootstrap
        // Try to pre-fill from BASE44 owner session
        try {
          const me = await base44.auth.me();
          if (me?.email) setForm(f => ({ ...f, email: me.email, name: me.full_name || "" }));
        } catch {}

        setStep("form");
      } catch {
        setStep("form"); // on error — allow bootstrap (worst case: first run with network issue)
      } finally {
        setChecking(false);
      }
    };
    autoCheck();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      // Double-check: only allow if no super_admin exists OR current user is already super_admin
      const currentRole = getStoredRole();
      const admins = await base44.entities.ReferralProfile.filter({ role: "super_admin", status: "active" });
      if (admins.length > 0 && currentRole !== "super_admin") {
        setError("Администратор уже существует. Используйте страницу входа.");
        return;
      }

      const emailLower = form.email.trim().toLowerCase();
      const existing = await base44.entities.ReferralProfile.filter({ email: emailLower });
      const secretCode = genSecretCode();
      const maskedCode = maskCode(secretCode);
      const now = new Date().toISOString();

      let profile;
      if (existing.length > 0) {
        await base44.entities.ReferralProfile.update(existing[0].id, {
          role: "super_admin", status: "active",
          full_name: form.name || existing[0].full_name || "Администратор",
          secret_code: secretCode, masked_secret_code: maskedCode, secret_code_last_sent_at: now,
        });
        profile = { ...existing[0], role: "super_admin", secret_code: secretCode, email: emailLower };
      } else {
        profile = await base44.entities.ReferralProfile.create({
          email: emailLower,
          full_name: form.name || "Администратор",
          role: "super_admin", status: "active",
          secret_code: secretCode, masked_secret_code: maskedCode,
          secret_code_last_sent_at: now,
          referral_code: "admin-" + Date.now().toString(36),
        });
      }

      await base44.integrations.Core.SendEmail({
        to: emailLower,
        subject: "Аккаунт администратора МилитариПартнер",
        body: `<h2>Аккаунт администратора создан</h2><p><strong>Email:</strong> ${emailLower}</p><p><strong>Секретный код:</strong></p><p style="font-size:20px;font-family:monospace;background:#f4f4f4;padding:12px;border-radius:6px">${secretCode}</p><p><a href="${window.location.origin}/secret-login">Войти в панель</a></p>`,
      }).catch(() => {});

      await base44.entities.ActionLog.create({
        actor_role: "super_admin", action_type: "ADMIN_BOOTSTRAP_CREATED",
        entity_type: "ReferralProfile", entity_id: profile.id,
        action_payload: JSON.stringify({ email: emailLower }),
      }).catch(() => {});

      setStoredProfile({ ...profile, email: emailLower });
      setResult({ email: emailLower, secretCode });
      setStep("done");
    } catch (err) {
      setError("Ошибка: " + (err?.message || "попробуйте ещё раз"));
    } finally {
      setLoading(false);
    }
  };

  if (checking) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-primary py-4 px-4">
        <Link to="/" className="flex items-center gap-2 max-w-6xl mx-auto">
          <Shield className="w-6 h-6 text-accent" />
          <span className="font-display font-bold text-xl text-primary-foreground">МилитариПартнер</span>
        </Link>
      </header>

      <div className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <ShieldCheck className="w-8 h-8 text-primary" />
            </div>
          </div>

          {/* BLOCKED: super_admin exists, anonymous user — show nothing sensitive */}
          {step === "blocked" && (
            <div className="bg-card border border-border rounded-2xl p-6 text-center">
              <Lock className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
              <h1 className="font-heading text-xl font-bold mb-2">Доступ ограничен</h1>
              <p className="text-sm text-muted-foreground mb-6">
                Система уже настроена. Войдите через секретный код.
              </p>
              <Button onClick={() => navigate("/secret-login")} className="w-full bg-primary font-bold">
                Перейти ко входу
              </Button>
            </div>
          )}

          {/* FORM: first run OR current super_admin recovery */}
          {step === "form" && (
            <>
              <h1 className="font-heading text-2xl font-bold text-center mb-2">
                {getStoredRole() === "super_admin" ? "Восстановление доступа" : "Первоначальная настройка"}
              </h1>
              <p className="text-muted-foreground text-center text-sm mb-8">
                Создание аккаунта главного администратора системы
              </p>
              <form onSubmit={handleSubmit} className="space-y-4 bg-card border border-border rounded-2xl p-6">
                <div>
                  <Label>Email администратора</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    required
                    placeholder="admin@example.com"
                  />
                </div>
                <div>
                  <Label>Имя (необязательно)</Label>
                  <Input
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Администратор"
                  />
                </div>
                {error && (
                  <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-sm text-destructive">
                    {error}
                  </div>
                )}
                <Button type="submit" disabled={loading} className="w-full bg-primary font-bold h-12 rounded-xl">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Создать аккаунт администратора"}
                </Button>
              </form>
              <p className="text-center text-sm text-muted-foreground mt-4">
                <Link to="/secret-login" className="text-primary hover:underline">← Назад ко входу</Link>
              </p>
            </>
          )}

          {/* DONE */}
          {step === "done" && result && (
            <div className="bg-card border border-border rounded-2xl p-6 text-center">
              <div className="text-green-600 font-heading font-bold text-lg mb-2">✓ Аккаунт создан!</div>
              <p className="text-sm text-muted-foreground mb-4">Email: <strong>{result.email}</strong></p>
              <div className="bg-muted rounded-xl p-4 font-mono text-sm mb-2 break-all">{result.secretCode}</div>
              <p className="text-xs text-muted-foreground mb-6">Код отправлен на email. Сохраните его — он нужен для входа.</p>
              <Button onClick={() => navigate("/secret-login")} className="w-full bg-primary font-bold">
                Войти в панель администратора
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
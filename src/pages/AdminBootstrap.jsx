import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, useNavigate } from "react-router-dom";
import { Shield, Loader2, ShieldCheck } from "lucide-react";
import { setStoredProfile } from "@/lib/profileSession";

const genSecretCode = () => {
  const c = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: 28 }, () => c[Math.floor(Math.random() * c.length)]).join("");
};
const maskCode = (code) => code.slice(0, 4) + "••••••••••••••••••••" + code.slice(-4);

export default function AdminBootstrap() {
  const navigate = useNavigate();
  const [step, setStep] = useState("form"); // form | done
  const [form, setForm] = useState({ email: "", name: "", adminKey: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const ADMIN_BOOTSTRAP_KEY = "militarypartner-admin-2024";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (form.adminKey !== ADMIN_BOOTSTRAP_KEY) {
      setError("Неверный ключ администратора.");
      return;
    }

    setLoading(true);
    try {
      const emailLower = form.email.trim().toLowerCase();

      // Check if admin already exists
      const existing = await base44.entities.ReferralProfile.filter({ email: emailLower });
      if (existing.length > 0 && (existing[0].role === "admin" || existing[0].role === "super_admin")) {
        setError("Администратор с таким email уже существует. Используйте вход по Secret Code.");
        setLoading(false);
        return;
      }

      const secretCode = genSecretCode();
      const maskedCode = maskCode(secretCode);
      const now = new Date().toISOString();

      let profile;
      if (existing.length > 0) {
        // Upgrade existing profile to super_admin
        await base44.entities.ReferralProfile.update(existing[0].id, {
          role: "super_admin",
          status: "active",
          full_name: form.name || existing[0].full_name,
          secret_code: secretCode,
          masked_secret_code: maskedCode,
          secret_code_last_sent_at: now,
        });
        profile = { ...existing[0], role: "super_admin", secret_code: secretCode, masked_secret_code: maskedCode };
      } else {
        profile = await base44.entities.ReferralProfile.create({
          email: emailLower,
          full_name: form.name || "Администратор",
          role: "super_admin",
          status: "active",
          secret_code: secretCode,
          masked_secret_code: maskedCode,
          secret_code_last_sent_at: now,
          referral_code: "admin-" + Date.now().toString(36),
        });
      }

      // Send email
      await base44.integrations.Core.SendEmail({
        to: emailLower,
        subject: "Аккаунт администратора МилитариПартнер",
        body: `<h2>Аккаунт администратора создан</h2><p><strong>Email:</strong> ${emailLower}</p><p><strong>Секретный код:</strong></p><p style="font-size:20px;font-family:monospace;background:#f4f4f4;padding:12px;border-radius:6px">${secretCode}</p><p><a href="${window.location.origin}/secret-login">Войти в панель</a></p>`,
      }).catch(() => {});

      await base44.entities.ActionLog.create({
        actor_role: "super_admin",
        action_type: "ADMIN_BOOTSTRAP",
        entity_type: "ReferralProfile",
        entity_id: profile.id,
        action_payload: JSON.stringify({ email: emailLower }),
      }).catch(() => {});

      setStoredProfile({ ...profile, secret_code: secretCode, email: emailLower });
      setResult({ profile: { ...profile, secret_code: secretCode, masked_secret_code: maskedCode }, email: emailLower, secretCode });
      setStep("done");

    } catch (err) {
      setError("Ошибка: " + (err?.message || "попробуйте ещё раз"));
    } finally {
      setLoading(false);
    }
  };

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

          {step === "form" && (
            <>
              <h1 className="font-heading text-2xl font-bold text-center mb-2">Bootstrap администратора</h1>
              <p className="text-muted-foreground text-center text-sm mb-8">
                Первоначальная настройка аккаунта администратора
              </p>
              <form onSubmit={handleSubmit} className="space-y-4 bg-card border border-border rounded-2xl p-6">
                <div>
                  <Label>Email администратора</Label>
                  <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required placeholder="admin@example.com" />
                </div>
                <div>
                  <Label>Имя (необязательно)</Label>
                  <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Администратор" />
                </div>
                <div>
                  <Label>Ключ активации</Label>
                  <Input type="password" value={form.adminKey} onChange={e => setForm(f => ({ ...f, adminKey: e.target.value }))} required placeholder="Ключ активации" />
                </div>
                {error && <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-sm text-destructive">{error}</div>}
                <Button type="submit" disabled={loading} className="w-full bg-primary font-bold h-12 rounded-xl">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Создать аккаунт администратора"}
                </Button>
              </form>
              <p className="text-center text-sm text-muted-foreground mt-4">
                <Link to="/secret-login" className="text-primary hover:underline">← Назад ко входу</Link>
              </p>
            </>
          )}

          {step === "done" && result && (
            <div className="bg-card border border-border rounded-2xl p-6 text-center">
              <div className="text-green-600 font-heading font-bold text-lg mb-2">✓ Аккаунт создан!</div>
              <p className="text-sm text-muted-foreground mb-4">Email: <strong>{result.email}</strong></p>
              <div className="bg-muted rounded-xl p-4 font-mono text-sm mb-4 break-all">{result.secretCode}</div>
              <p className="text-xs text-muted-foreground mb-6">Код отправлен на email. Сохраните его.</p>
              <Button onClick={() => navigate("/admin", { replace: true })} className="w-full bg-primary font-bold">
                Перейти в панель администратора
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, useNavigate } from "react-router-dom";
import { Shield, Loader2, ShieldCheck, Lock, Eye, EyeOff, Copy } from "lucide-react";
import { setStoredProfile, getStoredProfileId, getStoredRole } from "@/lib/profileSession";
import { toast } from "@/components/ui/use-toast";

const genSecretCode = () => {
  const c = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: 28 }, () => c[Math.floor(Math.random() * c.length)]).join("");
};
const maskCode = (code) => code.slice(0, 4) + "••••••••••••••••••••" + code.slice(-4);

/**
 * AdminBootstrap — механизм первого запуска / восстановления.
 * НЕ является частью публичного user journey.
 * Доступен только если:
 *   1. Нет ни одного super_admin (первый запуск системы), ИЛИ
 *   2. Текущий пользователь сам является super_admin (recovery).
 * Во всех остальных случаях показывает заглушку и редиректит.
 */
export default function AdminBootstrap() {
  const navigate = useNavigate();
  const [step, setStep] = useState("check"); // check | blocked | form | done
  const [form, setForm] = useState({ name: "", email: "" });
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [showCode, setShowCode] = useState(false);

  useEffect(() => {
    const autoCheck = async () => {
      try {
        const currentRole = getStoredRole();
        const currentId = getStoredProfileId();

        // Уже залогинен как super_admin — режим восстановления
        if (currentRole === "super_admin" && currentId) {
          setStep("form");
          setChecking(false);
          return;
        }

        // Проверяем: есть ли уже super_admin в системе?
        const admins = await base44.entities.ReferralProfile.filter({ role: "super_admin", status: "active" });
        if (admins.length > 0) {
          // Система настроена — анонимному доступ закрыт
          setStep("blocked");
          setChecking(false);
          return;
        }

        // Первый запуск — нет ни одного super_admin
        setStep("form");
      } catch {
        setStep("form"); // При ошибке сети — разрешаем (первый запуск)
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
      const currentRole = getStoredRole();
      const admins = await base44.entities.ReferralProfile.filter({ role: "super_admin", status: "active" });
      if (admins.length > 0 && currentRole !== "super_admin") {
        setError("Система уже настроена. Войдите через секретный код.");
        return;
      }

      // Гарантируем уникальность кода
      let secretCode;
      let attempts = 0;
      while (attempts < 5) {
        secretCode = genSecretCode();
        const conflict = await base44.entities.ReferralProfile.filter({ secret_code: secretCode });
        if (conflict.length === 0) break;
        attempts++;
      }
      const maskedCode = maskCode(secretCode);
      const now = new Date().toISOString();
      const emailLower = form.email.trim().toLowerCase();

      let profile;
      // Если email указан — проверяем существующий профиль
      if (emailLower) {
        const existing = await base44.entities.ReferralProfile.filter({ email: emailLower });
        if (existing.length > 0) {
          await base44.entities.ReferralProfile.update(existing[0].id, {
            role: "super_admin", status: "active",
            full_name: form.name || existing[0].full_name || "Администратор",
            secret_code: secretCode, masked_secret_code: maskedCode,
            secret_code_last_sent_at: now,
          });
          profile = { ...existing[0], role: "super_admin", secret_code: secretCode, email: emailLower };
        }
      }

      if (!profile) {
        profile = await base44.entities.ReferralProfile.create({
          ...(emailLower ? { email: emailLower } : {}),
          full_name: form.name || "Администратор",
          role: "super_admin", status: "active",
          secret_code: secretCode, masked_secret_code: maskedCode,
          secret_code_last_sent_at: now,
          referral_code: "sadmin-" + Date.now().toString(36),
        });
      }

      // Отправка на email — только если email указан
      if (emailLower) {
        await base44.integrations.Core.SendEmail({
          to: emailLower,
          subject: "Аккаунт администратора МилитариПартнер",
          body: `<h2>Аккаунт администратора создан</h2>
<p><strong>Секретный код для входа:</strong></p>
<p style="font-size:20px;font-family:monospace;background:#f4f4f4;padding:12px;border-radius:6px">${secretCode}</p>
<p>Используйте код для входа — email не нужен.</p>
<p><a href="${window.location.origin}/secret-login">Войти в панель</a></p>`,
        }).catch(() => {});
      }

      await base44.entities.ActionLog.create({
        actor_role: "super_admin", action_type: "ADMIN_BOOTSTRAP_CREATED",
        entity_type: "ReferralProfile", entity_id: profile.id,
        action_payload: JSON.stringify({ email: emailLower || null }),
      }).catch(() => {});

      setStoredProfile({ ...profile, secret_code: secretCode });
      setResult({ secretCode, name: form.name || "Администратор", email: emailLower });
      setStep("done");
    } catch (err) {
      setError("Ошибка: " + (err?.message || "попробуйте ещё раз"));
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (result?.secretCode) {
      await navigator.clipboard.writeText(result.secretCode);
      toast({ title: "Код скопирован!" });
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

          {/* BLOCKED: super_admin существует, анонимный пользователь */}
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

          {/* FORM: первый запуск или текущий super_admin — восстановление */}
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
                  <Label>Имя администратора</Label>
                  <Input
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Администратор"
                    autoFocus
                  />
                </div>
                <div>
                  <Label>Email (необязательно)</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="admin@example.com"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Если указать — код отправим на email. Для входа email не нужен.
                  </p>
                </div>
                {error && (
                  <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-sm text-destructive">{error}</div>
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

          {/* DONE: показываем код сразу */}
          {step === "done" && result && (
            <div className="bg-card border border-border rounded-2xl p-6">
              <div className="text-center mb-4">
                <div className="text-green-600 font-heading font-bold text-lg mb-1">✓ Аккаунт создан!</div>
                <p className="text-sm text-muted-foreground">Сохраните секретный код — он нужен для входа</p>
              </div>
              <div className="bg-muted rounded-xl p-4 font-mono text-sm mb-2 break-all text-center min-h-[52px] flex items-center justify-center">
                {showCode ? result.secretCode : maskCode(result.secretCode)}
              </div>
              {result.email ? (
                <p className="text-xs text-muted-foreground text-center mb-4">Код также отправлен на {result.email}</p>
              ) : (
                <p className="text-xs text-amber-600 text-center mb-4 bg-amber-50 rounded-lg p-2">
                  ⚠️ Email не указан — сохраните код, это единственный способ входа
                </p>
              )}
              <div className="grid grid-cols-2 gap-2 mb-4">
                <Button variant="outline" size="sm" onClick={() => setShowCode(v => !v)} className="h-10 text-xs">
                  {showCode ? <EyeOff className="w-3.5 h-3.5 mr-1" /> : <Eye className="w-3.5 h-3.5 mr-1" />}
                  {showCode ? "Скрыть" : "Показать"}
                </Button>
                <Button variant="outline" size="sm" onClick={handleCopy} className="h-10 text-xs">
                  <Copy className="w-3.5 h-3.5 mr-1" /> Копировать
                </Button>
              </div>
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
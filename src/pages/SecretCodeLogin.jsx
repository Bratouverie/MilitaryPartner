import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, useNavigate } from "react-router-dom";
import { Shield, Loader2, Key, ShieldCheck } from "lucide-react";
import { setStoredProfile, roleHomePath } from "@/lib/profileSession";

export default function SecretCodeLogin() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", secret_code: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const emailLower = form.email.trim().toLowerCase();
      const profiles = await base44.entities.ReferralProfile.filter({ email: emailLower });

      if (profiles.length === 0) {
        setError("Аккаунт с таким email не найден. Проверьте данные или зарегистрируйтесь.");
        return;
      }

      const profile = profiles.find(p => p.secret_code === form.secret_code.trim());

      if (!profile) {
        setError("Неверный секретный код. Проверьте код — он был отправлен на email при регистрации.");
        await base44.entities.ActionLog.create({
          actor_role: "unknown",
          action_type: "LOGIN_FAILED_WRONG_CODE",
          entity_type: "ReferralProfile",
          action_payload: JSON.stringify({ email: emailLower }),
        }).catch(() => {});
        return;
      }

      if (profile.status === "blocked") {
        setError("Ваш аккаунт заблокирован. Обратитесь к администратору.");
        return;
      }

      if (!profile.role) {
        setError("Роль пользователя не определена. Обратитесь к администратору.");
        return;
      }

      const now = new Date().toISOString();
      await base44.entities.ReferralProfile.update(profile.id, { last_login_at: now });

      await base44.entities.ActionLog.create({
        actor_role: profile.role,
        action_type: "LOGIN_SUCCESS",
        entity_type: "ReferralProfile",
        entity_id: profile.id,
        action_payload: JSON.stringify({ email: emailLower, role: profile.role }),
      }).catch(() => {});

      setStoredProfile({ ...profile, last_login_at: now });
      navigate(roleHomePath(profile.role), { replace: true });

    } catch {
      setError("Произошла ошибка при попытке входа. Попробуйте ещё раз.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-primary py-4 px-4">
        <div className="max-w-6xl mx-auto flex items-center gap-2">
          <Link to="/" className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-accent" />
            <span className="font-display font-bold text-xl text-primary-foreground">МилитариПартнер</span>
          </Link>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Key className="w-8 h-8 text-primary" />
            </div>
          </div>
          <h1 className="font-heading text-3xl font-bold text-center mb-2">Вход в систему</h1>
          <p className="text-muted-foreground text-center mb-8">
            Email + секретный код — пароль не нужен
          </p>

          <form onSubmit={handleSubmit} className="space-y-5 bg-card border border-border rounded-2xl p-6">
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                required
                placeholder="ваш@email.com"
                autoComplete="email"
              />
            </div>
            <div>
              <Label>Секретный код</Label>
              <Input
                type="text"
                value={form.secret_code}
                onChange={e => setForm(f => ({ ...f, secret_code: e.target.value }))}
                required
                placeholder="Код из вашего email"
                className="font-mono"
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Код отправляется на email при регистрации
              </p>
            </div>

            {error && (
              <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <Button type="submit" disabled={loading} className="w-full bg-primary font-bold h-12 rounded-xl">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Войти"}
            </Button>
          </form>

          <div className="text-center mt-6 space-y-2">
            <p className="text-sm text-muted-foreground">
              Нет аккаунта?{" "}
              <Link to="/register-referrer" className="text-primary font-medium hover:underline">
                Получить реферальную ссылку
              </Link>
            </p>
            <p className="text-sm text-muted-foreground">
              Потеряли код?{" "}
              <Link to="/resend-code" className="text-primary font-medium hover:underline">
                Получить код на email
              </Link>
            </p>
          </div>

          {/* Блок для администраторов / владельца сайта */}
          <div className="mt-8 bg-muted/50 border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Вход для администратора</span>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Если вы владелец сайта и впервые настраиваете систему — сначала создайте аккаунт администратора.
              После этого используйте email и секретный код для входа в <strong>/admin</strong>.
            </p>
            <Link to="/admin-bootstrap">
              <Button variant="outline" size="sm" className="w-full text-xs">
                Создать аккаунт администратора
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
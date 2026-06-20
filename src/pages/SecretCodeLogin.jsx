import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, useNavigate } from "react-router-dom";
import { Shield, Loader2, Key } from "lucide-react";
import { setStoredProfile, roleHomePath } from "@/lib/profileSession";

export default function SecretCodeLogin() {
  const navigate = useNavigate();
  const [secretCode, setSecretCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const code = secretCode.trim();
    try {
      // Ищем профиль напрямую по secret_code
      const profiles = await base44.entities.ReferralProfile.filter({ secret_code: code });

      if (profiles.length === 0) {
        setError("Секретный код не найден. Проверьте код и попробуйте ещё раз.");
        await base44.entities.ActionLog.create({
          actor_role: "unknown",
          action_type: "LOGIN_FAILED_WRONG_CODE",
          entity_type: "ReferralProfile",
          action_payload: JSON.stringify({ code_prefix: code.slice(0, 4) + "…" }),
        }).catch(() => {});
        return;
      }

      const profile = profiles[0];

      if (profile.status === "blocked") {
        setError("Ваш аккаунт заблокирован. Обратитесь к администратору.");
        return;
      }
      if (profile.status === "inactive") {
        setError("Ваш аккаунт неактивен. Обратитесь к администратору.");
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
        action_payload: JSON.stringify({ role: profile.role }),
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
            Введите секретный код — email и пароль не нужны
          </p>

          <form onSubmit={handleSubmit} className="space-y-5 bg-card border border-border rounded-2xl p-6">
            <div>
              <Label>Секретный код</Label>
              <Input
                type="text"
                value={secretCode}
                onChange={e => setSecretCode(e.target.value)}
                required
                placeholder="Введите ваш секретный код"
                className="font-mono text-base"
                autoComplete="off"
                autoFocus
              />
              <p className="text-xs text-muted-foreground mt-1">
                Код выдаётся при регистрации или через администратора
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
                Зарегистрироваться как реферал
              </Link>
            </p>
            <p className="text-sm text-muted-foreground">
              Потеряли код?{" "}
              <span className="text-muted-foreground">Обратитесь к своему администратору</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
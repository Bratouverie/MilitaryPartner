import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "react-router-dom";
import { Shield, Loader2, Mail, CheckCircle } from "lucide-react";

export default function ResendCode() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const profiles = await base44.entities.ReferralProfile.filter({ email: email.trim().toLowerCase() });
      if (profiles.length === 0) {
        // Don't reveal whether email exists
        setSent(true);
        setLoading(false);
        return;
      }
      const profile = profiles[0];
      await base44.integrations.Core.SendEmail({
        to: profile.email,
        subject: "Ваш секретный код — МилитариПартнер",
        body: `<h2>Секретный код для входа</h2><p>Ваш код: <strong style="font-size:18px;letter-spacing:2px">${profile.secret_code}</strong></p><p>Никому не передавайте этот код.</p><p><a href="${window.location.origin}/secret-login">Войти в кабинет</a></p>`,
      });
      await base44.entities.ReferralProfile.update(profile.id, { secret_code_last_sent_at: new Date().toISOString() });
      await base44.entities.ActionLog.create({
        actor_role: profile.role,
        action_type: "SECRET_CODE_RESENT",
        entity_type: "ReferralProfile",
        entity_id: profile.id,
      });
      setSent(true);
    } catch {
      setError("Произошла ошибка. Попробуйте позже.");
    } finally {
      setLoading(false); }
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

      <div className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md">
          {sent ? (
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-primary" />
              </div>
              <h1 className="font-heading text-2xl font-bold mb-2">Проверьте почту</h1>
              <p className="text-muted-foreground mb-6">Если аккаунт с таким email существует, мы отправили секретный код.</p>
              <Link to="/secret-login"><Button className="bg-primary">Войти</Button></Link>
            </div>
          ) : (
            <>
              <h1 className="font-heading text-3xl font-bold text-center mb-2">Получить код на email</h1>
              <p className="text-muted-foreground text-center mb-8">Укажите ваш email — мы отправим секретный код для входа</p>
              <form onSubmit={handleSubmit} className="space-y-5 bg-card border border-border rounded-2xl p-6">
                <div>
                  <Label>Email</Label>
                  <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="ваш@email.com" />
                </div>
                {error && <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-sm text-destructive">{error}</div>}
                <Button type="submit" disabled={loading} className="w-full bg-primary font-bold h-12 rounded-xl">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Mail className="w-4 h-4 mr-2" />Отправить код</>}
                </Button>
              </form>
              <p className="text-center text-sm text-muted-foreground mt-4">
                <Link to="/secret-login" className="text-primary hover:underline">← Назад к входу</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
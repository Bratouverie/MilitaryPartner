import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Eye, EyeOff, Copy, Mail, RefreshCw, Key, Clock } from "lucide-react";
import moment from "moment";

const genSecretCode = () => {
  const c = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: 28 }, () => c[Math.floor(Math.random() * c.length)]).join("");
};
const maskCode = (code) => {
  if (!code || code.length < 12) return "****";
  return code.slice(0, 4) + "****" + code.slice(8, 12) + "****";
};

export default function Security() {
  const { toast } = useToast();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCode, setShowCode] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [resending, setResending] = useState(false);

  const load = async () => {
    const storedId = sessionStorage.getItem("mp_profile_id");
    if (storedId) {
      const profiles = await base44.entities.ReferralProfile.filter({ id: storedId });
      if (profiles[0]) { setProfile(profiles[0]); setLoading(false); return; }
    }
    try {
      const user = await base44.auth.me();
      const byEmail = await base44.entities.ReferralProfile.filter({ email: user.email });
      setProfile(byEmail[0] || null);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleShow = () => {
    setShowCode(true);
    setTimeout(() => setShowCode(false), 3000);
  };

  const handleCopy = () => {
    if (profile?.secret_code) {
      navigator.clipboard.writeText(profile.secret_code);
      toast({ title: "Код скопирован!" });
    }
  };

  const handleResend = async () => {
    if (!profile) return;
    setResending(true);
    try {
      await base44.integrations.Core.SendEmail({
        to: profile.email,
        subject: "Ваш секретный код — МилитариПартнер",
        body: `<h2>Ваш секретный код</h2><p>Код для входа: <strong style="font-size:18px;letter-spacing:2px">${profile.secret_code}</strong></p><p>Никому не передавайте этот код.</p>`,
      });
      const now = new Date().toISOString();
      await base44.entities.ReferralProfile.update(profile.id, { secret_code_last_sent_at: now });
      await base44.entities.ActionLog.create({ actor_role: profile.role, action_type: "SECRET_CODE_RESENT", entity_type: "ReferralProfile", entity_id: profile.id });
      setProfile(p => ({...p, secret_code_last_sent_at: now}));
      toast({ title: "Код отправлен на email!" });
    } catch {
      toast({ title: "Ошибка отправки", variant: "destructive" });
    } finally { setResending(false); }
  };

  const handleRegenerate = async () => {
    if (!profile || !window.confirm("Сгенерировать новый код? Старый код перестанет работать.")) return;
    setRegenerating(true);
    try {
      const newCode = genSecretCode();
      const masked = maskCode(newCode);
      const now = new Date().toISOString();
      await base44.entities.ReferralProfile.update(profile.id, { secret_code: newCode, masked_secret_code: masked, secret_code_last_sent_at: now });
      await base44.integrations.Core.SendEmail({
        to: profile.email,
        subject: "Новый секретный код — МилитариПартнер",
        body: `<h2>Ваш новый секретный код</h2><p>Код: <strong style="font-size:18px">${newCode}</strong></p><p>Старый код больше не действует.</p>`,
      });
      await base44.entities.ActionLog.create({ actor_role: profile.role, action_type: "SECRET_CODE_REGENERATED", entity_type: "ReferralProfile", entity_id: profile.id });
      setProfile(p => ({...p, secret_code: newCode, masked_secret_code: masked, secret_code_last_sent_at: now}));
      toast({ title: "Новый код сгенерирован и отправлен на email!" });
    } catch {
      toast({ title: "Ошибка", variant: "destructive" });
    } finally { setRegenerating(false); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!profile) return <div className="text-center py-16 text-muted-foreground">Профиль не найден</div>;

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold mb-6">Безопасность</h1>
      <div className="bg-card border border-border rounded-2xl p-6 max-w-xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Key className="w-6 h-6 text-primary" />
          </div>
          <div>
            <div className="font-heading font-bold">Секретный код</div>
            <div className="text-sm text-muted-foreground">Используется для входа в систему</div>
          </div>
        </div>

        <div className="bg-muted rounded-xl p-4 font-mono text-lg text-center mb-2 tracking-wider min-h-[56px] flex items-center justify-center">
          {showCode ? profile.secret_code : (profile.masked_secret_code || maskCode(profile.secret_code))}
        </div>

        {profile.secret_code_last_sent_at && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-4 justify-center">
            <Clock className="w-3 h-3" />
            Последняя отправка: {moment(profile.secret_code_last_sent_at).format("DD.MM.YYYY HH:mm")}
          </div>
        )}
        {profile.last_login_at && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-4 justify-center">
            <Clock className="w-3 h-3" />
            Последний вход: {moment(profile.last_login_at).format("DD.MM.YYYY HH:mm")}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 mb-3">
          <Button variant="outline" onClick={handleShow} className="h-10 text-sm">
            {showCode ? <EyeOff className="w-4 h-4 mr-1.5" /> : <Eye className="w-4 h-4 mr-1.5" />}
            {showCode ? "Скрыть" : "Показать (3с)"}
          </Button>
          <Button variant="outline" onClick={handleCopy} className="h-10 text-sm">
            <Copy className="w-4 h-4 mr-1.5" /> Копировать
          </Button>
          <Button variant="outline" onClick={handleResend} disabled={resending} className="h-10 text-sm">
            {resending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Mail className="w-4 h-4 mr-1.5" />На email</>}
          </Button>
          <Button variant="outline" onClick={handleRegenerate} disabled={regenerating} className="h-10 text-sm text-amber-600 border-amber-200 hover:bg-amber-50">
            {regenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <><RefreshCw className="w-4 h-4 mr-1.5" />Новый код</>}
          </Button>
        </div>
      </div>
    </div>
  );
}
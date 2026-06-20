import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Eye, EyeOff, Copy, Mail, Key } from "lucide-react";

export default function Security() {
  const { toast } = useToast();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCode, setShowCode] = useState(false);

  useEffect(() => {
    const load = async () => {
      const user = await base44.auth.me();
      const profiles = await base44.entities.ReferralProfile.filter({ linked_user_id: user.id });
      if (profiles.length === 0) {
        const byEmail = await base44.entities.ReferralProfile.filter({ email: user.email });
        setProfile(byEmail[0] || null);
      } else setProfile(profiles[0]);
      setLoading(false);
    };
    load();
  }, []);

  const maskCode = (code) => {
    if (!code || code.length < 12) return "****";
    return code.slice(0, 4) + "****" + code.slice(8, 12) + "****";
  };

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
    try {
      await base44.integrations.Core.SendEmail({
        to: profile.email,
        subject: "Ваш секретный код — МилитариПартнер",
        body: `<h2>Ваш секретный код</h2><p>Код для входа: <strong>${profile.secret_code}</strong></p><p>Не делитесь этим кодом с другими.</p>`,
      });
      toast({ title: "Код отправлен на email!" });
    } catch {
      toast({ title: "Ошибка отправки", variant: "destructive" });
    }
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
            <div className="font-heading font-bold">Secret Code</div>
            <div className="text-sm text-muted-foreground">Код для входа в систему</div>
          </div>
        </div>

        <div className="bg-muted rounded-lg p-4 font-mono text-lg text-center mb-4 tracking-wider">
          {showCode ? profile.secret_code : maskCode(profile.secret_code)}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Button variant="outline" onClick={handleShow} className="h-10">
            {showCode ? <EyeOff className="w-4 h-4 mr-1.5" /> : <Eye className="w-4 h-4 mr-1.5" />}
            {showCode ? "Скрыть" : "Показать"}
          </Button>
          <Button variant="outline" onClick={handleCopy} className="h-10">
            <Copy className="w-4 h-4 mr-1.5" /> Копировать
          </Button>
          <Button variant="outline" onClick={handleResend} className="h-10">
            <Mail className="w-4 h-4 mr-1.5" /> На email
          </Button>
        </div>
      </div>
    </div>
  );
}
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Copy, Share2, Loader2 } from "lucide-react";

export default function MyLink() {
  const { toast } = useToast();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!profile) return <div className="text-center py-16 text-muted-foreground">Профиль не найден</div>;

  const refUrl = `${window.location.origin}/ref/${profile.referral_code}`;

  const copyLink = () => {
    navigator.clipboard.writeText(refUrl);
    toast({ title: "Ссылка скопирована!" });
  };

  const shareLink = () => {
    if (navigator.share) {
      navigator.share({ title: "МилитариПартнер", text: "Присоединяйся к реферальной программе!", url: refUrl });
    } else copyLink();
  };

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold mb-6">Моя реферальная ссылка</h1>
      <div className="bg-card border border-border rounded-2xl p-6 max-w-xl">
        <div className="mb-4">
          <div className="text-sm text-muted-foreground mb-1">Код</div>
          <div className="font-mono text-lg font-bold text-primary">{profile.referral_code}</div>
        </div>
        <div className="mb-6">
          <div className="text-sm text-muted-foreground mb-1">Ссылка</div>
          <div className="bg-muted rounded-lg p-3 font-mono text-sm break-all">{refUrl}</div>
        </div>
        <div className="flex gap-3">
          <Button onClick={copyLink} variant="outline" className="flex-1">
            <Copy className="w-4 h-4 mr-2" /> Скопировать
          </Button>
          <Button onClick={shareLink} className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90">
            <Share2 className="w-4 h-4 mr-2" /> Поделиться
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mt-4">Отправьте эту ссылку кандидатам. Каждый, кто заполнит анкету по ней, будет привязан к вашему аккаунту.</p>
      </div>
    </div>
  );
}
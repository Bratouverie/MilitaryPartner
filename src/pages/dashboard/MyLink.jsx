import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { Copy, Share2, Loader2, QrCode } from "lucide-react";
import { useProfile } from "@/lib/useProfile.jsx";

export default function MyLink() {
  const { profile, loading } = useProfile();
  const [qrUrl, setQrUrl] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);

  const refUrl = profile?.referral_code ? `${window.location.origin}/ref/${profile.referral_code}` : "";

  const loadQr = async () => {
    if (!refUrl || qrUrl) return;
    setQrLoading(true);
    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate a QR code as a base64 PNG data URL for this URL: ${refUrl}. Return ONLY a valid JSON object: {"qr_data_url": "data:image/png;base64,..."}`,
        response_json_schema: { type: "object", properties: { qr_data_url: { type: "string" } } },
      });
      if (res?.qr_data_url) setQrUrl(res.qr_data_url);
    } catch {}
    setQrLoading(false);
  };

  // Use Google Charts QR API instead — free, no credits
  const qrImageUrl = refUrl ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(refUrl)}` : null;

  const copyLink = () => {
    navigator.clipboard.writeText(refUrl);
    toast({ title: "Ссылка скопирована!" });
  };

  const copyCode = () => {
    navigator.clipboard.writeText(profile.referral_code);
    toast({ title: "Код скопирован!" });
  };

  const shareLink = () => {
    if (navigator.share) {
      navigator.share({ title: "МилитариПартнер", text: "Присоединяйся к реферальной программе!", url: refUrl });
    } else copyLink();
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!profile) return <div className="text-center py-16 text-muted-foreground">Профиль не найден</div>;

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold mb-6">Моя реферальная ссылка</h1>
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
          <div>
            <div className="text-sm text-muted-foreground mb-1">Реферальный код</div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xl font-bold text-primary">{profile.referral_code}</span>
              <button onClick={copyCode} className="text-muted-foreground hover:text-foreground transition-colors">
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div>
            <div className="text-sm text-muted-foreground mb-1">Реферальная ссылка</div>
            <div className="bg-muted rounded-lg p-3 font-mono text-xs break-all leading-relaxed">{refUrl}</div>
          </div>

          <div className="flex gap-3">
            <Button onClick={copyLink} variant="outline" className="flex-1">
              <Copy className="w-4 h-4 mr-2" /> Скопировать
            </Button>
            <Button onClick={shareLink} className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90">
              <Share2 className="w-4 h-4 mr-2" /> Поделиться
            </Button>
          </div>

          <p className="text-sm text-muted-foreground">
            Отправьте ссылку кандидатам — каждый, кто заполнит анкету, будет привязан к вашему аккаунту.
          </p>
        </div>

        {/* QR Code */}
        <div className="bg-card border border-border rounded-2xl p-6 flex flex-col items-center justify-center gap-4">
          <div className="flex items-center gap-2 mb-2">
            <QrCode className="w-5 h-5 text-primary" />
            <span className="font-heading font-bold">QR-код</span>
          </div>
          {qrImageUrl ? (
            <img
              src={qrImageUrl}
              alt="QR code"
              className="w-44 h-44 rounded-xl border border-border"
              onError={e => { e.target.style.display = "none"; }}
            />
          ) : (
            <div className="w-44 h-44 bg-muted rounded-xl flex items-center justify-center">
              <QrCode className="w-16 h-16 text-muted-foreground" />
            </div>
          )}
          <p className="text-xs text-muted-foreground text-center">
            Кандидат сканирует QR-код и попадает на вашу реферальную анкету
          </p>
        </div>
      </div>
    </div>
  );
}
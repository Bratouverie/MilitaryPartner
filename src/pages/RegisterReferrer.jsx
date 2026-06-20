import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import { Link, useNavigate } from "react-router-dom";
import { Shield, ArrowRight, Loader2 } from "lucide-react";

export default function RegisterReferrer() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [masterLinks, setMasterLinks] = useState([]);
  const [form, setForm] = useState({
    full_name: "", email: "", phone: "", telegram_username: "",
    referral_reward: 50000, consent: false, master_link_id: ""
  });

  useEffect(() => {
    base44.entities.MasterLink.filter({ is_active: true }).then(setMasterLinks);
  }, []);

  const selectedML = masterLinks.find(m => m.id === form.master_link_id);
  const maxReward = selectedML?.max_reward || 200000;

  const generateCode = () => {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let code = "";
    for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  };

  const generateSecretCode = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let code = "";
    for (let i = 0; i < 32; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.consent) { toast({ title: "Необходимо согласие", variant: "destructive" }); return; }
    if (form.referral_reward < 5000 || form.referral_reward > maxReward) {
      toast({ title: `Награда должна быть от 5 000 до ${maxReward.toLocaleString()} ₽`, variant: "destructive" }); return;
    }
    setLoading(true);
    const referralCode = generateCode();
    const secretCode = generateSecretCode();
    try {
      await base44.entities.ReferralProfile.create({
        full_name: form.full_name, email: form.email, phone: form.phone,
        telegram_username: form.telegram_username, role: "referrer", status: "active",
        master_link_id: form.master_link_id || undefined,
        referral_code: referralCode, secret_code: secretCode,
        referral_reward: Number(form.referral_reward),
        personal_max_reward_snapshot: maxReward, level: "L0_novice",
      });
      toast({ title: "Регистрация успешна!", description: `Ваш секретный код: ${secretCode}. Сохраните его!` });
      navigate("/login");
    } catch (err) {
      toast({ title: "Ошибка", description: "Попробуйте ещё раз", variant: "destructive" });
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary py-4 px-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-accent" />
            <span className="font-display font-bold text-xl text-primary-foreground">МилитариПартнер</span>
          </Link>
          <Link to="/login"><Button variant="outline" size="sm" className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10">Вход</Button></Link>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-16">
        <h1 className="font-heading text-3xl font-bold text-center mb-2">Стать рефералом</h1>
        <p className="text-muted-foreground text-center mb-8">Заполни форму и получи свою персональную ссылку</p>

        <form onSubmit={handleSubmit} className="space-y-5 bg-card border border-border rounded-2xl p-6">
          <div>
            <Label>Полное имя *</Label>
            <Input value={form.full_name} onChange={e => setForm(f => ({...f, full_name: e.target.value}))} required placeholder="Иван Петров" />
          </div>
          <div>
            <Label>Email *</Label>
            <Input type="email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} required placeholder="ivan@example.com" />
          </div>
          <div>
            <Label>Телефон *</Label>
            <Input value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))} required placeholder="+7 900 123 45 67" />
          </div>
          <div>
            <Label>Telegram</Label>
            <Input value={form.telegram_username} onChange={e => setForm(f => ({...f, telegram_username: e.target.value}))} placeholder="@username" />
          </div>
          {masterLinks.length > 0 && (
            <div>
              <Label>Программа</Label>
              <select className="w-full h-10 px-3 border border-input rounded-md bg-background text-sm"
                value={form.master_link_id} onChange={e => setForm(f => ({...f, master_link_id: e.target.value}))}>
                <option value="">Выберите программу</option>
                {masterLinks.map(ml => <option key={ml.id} value={ml.id}>{ml.title} (до {ml.max_reward?.toLocaleString()} ₽)</option>)}
              </select>
            </div>
          )}
          <div>
            <Label>Сумма награды за кандидата (₽) *</Label>
            <Input type="number" min={5000} max={maxReward} step={5000}
              value={form.referral_reward} onChange={e => setForm(f => ({...f, referral_reward: e.target.value}))} required />
            <p className="text-xs text-muted-foreground mt-1">От 5 000 до {maxReward.toLocaleString()} ₽, шаг 5 000</p>
          </div>
          <div className="flex items-start gap-2">
            <Checkbox checked={form.consent} onCheckedChange={v => setForm(f => ({...f, consent: v}))} id="consent" />
            <label htmlFor="consent" className="text-sm text-muted-foreground leading-tight">Я согласен на обработку персональных данных</label>
          </div>
          <Button type="submit" disabled={loading} className="w-full bg-accent text-accent-foreground hover:bg-accent/90 font-bold h-12 rounded-xl">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Зарегистрироваться <ArrowRight className="w-5 h-5 ml-2" /></>}
          </Button>
        </form>
      </div>
    </div>
  );
}
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, TrendingUp, Users, Clock, CheckCircle, AlertTriangle, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loadProfile, setStoredProfile } from "@/lib/profileSession";
import { Link } from "react-router-dom";

const levelLabels = {
  L0_novice: { name: "Новичок", color: "bg-blue-100 text-blue-700" },
  L1_fighter: { name: "Боец", color: "bg-orange-100 text-orange-700" },
  L2_sergeant: { name: "Сержант", color: "bg-slate-100 text-slate-700" },
  L3_officer: { name: "Офицер", color: "bg-yellow-100 text-yellow-700" },
  L4_general: { name: "Генерал", color: "bg-purple-100 text-purple-700" },
  L5_marshal: { name: "Маршал", color: "bg-amber-100 text-amber-700" },
};

export default function Overview() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ full_name: "", phone: "", telegram_username: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadProfile().then(p => {
      if (p) {
        setStoredProfile(p);
        setProfile(p);
        setProfileForm({ full_name: p.full_name || "", phone: p.phone || "", telegram_username: p.telegram_username || "" });
      }
      setLoading(false);
    });
  }, []);

  const saveProfile = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      await base44.entities.ReferralProfile.update(profile.id, profileForm);
      setProfile(p => ({ ...p, ...profileForm }));
      setStoredProfile({ ...profile, ...profileForm });
      setEditingProfile(false);
    } catch {}
    setSaving(false);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!profile) return (
    <div className="text-center py-16">
      <h2 className="font-heading text-2xl font-bold mb-2">Профиль не найден</h2>
      <p className="text-muted-foreground">Войдите через секретный код или зарегистрируйтесь.</p>
    </div>
  );

  const lvl = levelLabels[profile.level] || levelLabels.L0_novice;
  const isProfileIncomplete = !profile.full_name || !profile.phone;

  const stats = [
    { icon: TrendingUp, label: "Всего заработано", value: `${(profile.total_earned || 0).toLocaleString()} ₽`, color: "text-primary" },
    { icon: CheckCircle, label: "Выплачено", value: `${(profile.total_paid || 0).toLocaleString()} ₽`, color: "text-green-600" },
    { icon: Clock, label: "Ожидание", value: `${(profile.total_pending || 0).toLocaleString()} ₽`, color: "text-amber-600" },
    { icon: Users, label: "Кандидатов", value: profile.total_candidates_count || 0, color: "text-blue-600" },
  ];

  return (
    <div>
      {/* Onboarding banner if profile incomplete */}
      {isProfileIncomplete && !editingProfile && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <div className="font-medium text-amber-900">Заполните профиль</div>
              <div className="text-sm text-amber-700 mt-0.5">
                Добавьте ФИО и телефон для получения выплат. Ссылка уже работает!
              </div>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={() => setEditingProfile(true)} className="shrink-0 border-amber-300 text-amber-700 hover:bg-amber-100">
            Заполнить
          </Button>
        </div>
      )}

      {/* Inline profile editor */}
      {editingProfile && (
        <div className="mb-6 bg-card border border-border rounded-xl p-5">
          <h3 className="font-heading font-bold mb-4">Заполнить профиль</h3>
          <div className="space-y-3">
            <div>
              <Label>ФИО</Label>
              <Input value={profileForm.full_name} onChange={e => setProfileForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Иванов Иван Иванович" />
            </div>
            <div>
              <Label>Телефон</Label>
              <Input value={profileForm.phone} onChange={e => setProfileForm(f => ({ ...f, phone: e.target.value }))} placeholder="+7 900 123 45 67" />
            </div>
            <div>
              <Label>Telegram</Label>
              <Input value={profileForm.telegram_username} onChange={e => setProfileForm(f => ({ ...f, telegram_username: e.target.value }))} placeholder="@username" />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button onClick={saveProfile} disabled={saving} className="bg-primary">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Сохранить"}
            </Button>
            <Button variant="outline" onClick={() => setEditingProfile(false)}>Закрыть</Button>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-heading text-2xl font-bold">{profile.full_name || profile.email}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${lvl.color}`}>{lvl.name}</span>
            <span className="text-sm text-muted-foreground">Награда: {(profile.referral_reward || 0).toLocaleString()} ₽</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((s, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <s.icon className={`w-5 h-5 ${s.color}`} />
              <span className="text-sm text-muted-foreground">{s.label}</span>
            </div>
            <div className="font-heading text-2xl font-bold">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="font-heading font-bold mb-3">Быстрые действия</h3>
        <div className="space-y-2">
          <Link to="/dashboard/link" className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors">
            <span className="text-sm font-medium">Моя реферальная ссылка</span>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </Link>
          <Link to="/dashboard/candidates" className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors">
            <span className="text-sm font-medium">Мои кандидаты</span>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </Link>
          <Link to="/dashboard/security" className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors">
            <span className="text-sm font-medium">Безопасность / Secret Code</span>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </Link>
        </div>
      </div>
    </div>
  );
}
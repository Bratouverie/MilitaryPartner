import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, TrendingUp, Users, Clock, CheckCircle, AlertTriangle, ChevronRight, GitBranch, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "react-router-dom";
import { useProfile } from "@/lib/useProfile.jsx";
import { MIN_CHILD_QUOTA } from "@/lib/programUtils";

export default function Overview() {
  const { profile, loading, updateProfile } = useProfile();
  const [myProgram, setMyProgram] = useState(null);
  const [progLoading, setProgLoading] = useState(true);
  const [editingProfile, setEditingProfile] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile?.id) return;
    setProgLoading(true);
    base44.entities.ReferralProgram.filter({ owner_user_id: profile.id, is_active: true })
      .then(progs => setMyProgram(progs[0] || null))
      .catch(() => {})
      .finally(() => setProgLoading(false));
  }, [profile?.id]);

  const startEdit = () => {
    setForm({ full_name: profile?.full_name || "", phone: profile?.phone || "", telegram_username: profile?.telegram_username || "" });
    setEditingProfile(true);
  };

  const saveEdit = async () => {
    setSaving(true);
    await updateProfile(form);
    setEditingProfile(false);
    setSaving(false);
  };

  if (loading || progLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!profile) return <div className="text-center py-16 text-muted-foreground">Профиль не найден</div>;

  const isProfileIncomplete = !profile.full_name || !profile.phone;

  const stats = [
    { icon: TrendingUp, label: "Заработано", value: `${(profile.total_earned || 0).toLocaleString()} ₽`, color: "text-primary" },
    { icon: CheckCircle, label: "Выплачено", value: `${(profile.total_paid || 0).toLocaleString()} ₽`, color: "text-green-600" },
    { icon: Clock, label: "Ожидание", value: `${(profile.total_pending || 0).toLocaleString()} ₽`, color: "text-amber-600" },
    { icon: Users, label: "Кандидатов", value: profile.total_candidates_count || 0, color: "text-blue-600" },
  ];

  return (
    <div>
      {isProfileIncomplete && !editingProfile && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <div className="font-medium text-amber-900">Заполните профиль</div>
              <div className="text-sm text-amber-700 mt-0.5">Добавьте ФИО и телефон для получения выплат</div>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={startEdit} className="shrink-0 border-amber-300 text-amber-700 hover:bg-amber-100">Заполнить</Button>
        </div>
      )}

      {editingProfile && form && (
        <div className="mb-6 bg-card border border-border rounded-xl p-5">
          <h3 className="font-heading font-bold mb-4">Заполнить профиль</h3>
          <div className="space-y-3">
            <div><Label>ФИО</Label><Input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Иванов Иван Иванович" /></div>
            <div><Label>Телефон</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+7 900 123 45 67" /></div>
            <div><Label>Telegram</Label><Input value={form.telegram_username} onChange={e => setForm(f => ({ ...f, telegram_username: e.target.value }))} placeholder="@username" /></div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button onClick={saveEdit} disabled={saving} className="bg-primary">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Сохранить"}</Button>
            <Button variant="outline" onClick={() => setEditingProfile(false)}>Закрыть</Button>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-heading text-2xl font-bold">{profile.full_name || "Партнёр"}</h1>
          <div className="text-sm text-muted-foreground mt-1">Реферальная программа МилитариПартнер</div>
        </div>
      </div>

      {/* Текущая программа */}
      {myProgram && (
        <div className="mb-6 bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <GitBranch className="w-5 h-5 text-primary" />
            <span className="font-heading font-bold">Моя программа</span>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Программа</div>
              <div className="font-medium text-sm">{myProgram.title}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Моя квота</div>
              <div className="font-bold text-accent text-xl">{(myProgram.reward_quota || 0).toLocaleString()} ₽</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Уровень в дереве</div>
              <div className="font-medium">{myProgram.depth === 0 ? "Корневой" : `Уровень ${myProgram.depth}`}</div>
            </div>
          </div>
          {myProgram.parent_reward_quota && (
            <div className="mt-3 pt-3 border-t border-border">
              <div className="text-xs text-muted-foreground mb-2">Распределение по цепочке при контракте кандидата:</div>
              <div className="flex items-center gap-2 text-xs flex-wrap">
                <span className="bg-accent/20 text-accent-foreground px-2 py-0.5 rounded font-bold">{(myProgram.reward_quota).toLocaleString()} ₽ → вам</span>
                <span className="text-muted-foreground">+</span>
                <span className="bg-muted px-2 py-0.5 rounded">{(myProgram.parent_reward_quota - myProgram.reward_quota).toLocaleString()} ₽ → выше</span>
                <span className="text-muted-foreground">=</span>
                <span>{(myProgram.parent_reward_quota).toLocaleString()} ₽</span>
              </div>
            </div>
          )}
          {myProgram.reward_quota <= MIN_CHILD_QUOTA && (
            <div className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground flex items-center gap-1">
              <Target className="w-3.5 h-3.5" />
              Минимальная квота — создание подпрограмм недоступно
            </div>
          )}
        </div>
      )}

      {/* Статистика */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map((s, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2"><s.icon className={`w-5 h-5 ${s.color}`} /><span className="text-sm text-muted-foreground">{s.label}</span></div>
            <div className="font-heading text-2xl font-bold">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Быстрые действия */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="font-heading font-bold mb-3">Быстрые действия</h3>
        <div className="space-y-2">
          <Link to="/dashboard/link" className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors">
            <span className="text-sm font-medium">Мои ссылки и подпрограммы</span>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </Link>
          <Link to="/dashboard/candidates" className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors">
            <span className="text-sm font-medium">Мои кандидаты</span>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </Link>
          <Link to="/dashboard/rewards" className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors">
            <span className="text-sm font-medium">История вознаграждений</span>
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
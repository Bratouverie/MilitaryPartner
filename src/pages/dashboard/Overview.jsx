import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, TrendingUp, Users, Clock, CheckCircle, AlertTriangle, ChevronRight, GitBranch, Star, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "react-router-dom";
import { useProfile } from "@/lib/useProfile.jsx";

const RANK_LABELS = {
  L0_novice: "🪖 Новобранец",
  L1_fighter: "⚔️ Боец",
  L2_sergeant: "🎖️ Сержант",
  L3_officer: "🎗️ Офицер",
  L4_general: "⭐ Генерал",
  L5_marshal: "🌟 Маршал",
};

export default function Overview() {
  const { profile, loading, updateProfile } = useProfile();
  const [myPrograms, setMyPrograms] = useState([]);
  const [progLoading, setProgLoading] = useState(true);
  const [editingProfile, setEditingProfile] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile?.id) return;
    setProgLoading(true);
    base44.entities.ReferralProgram.filter({ owner_user_id: profile.id })
      .then(progs => setMyPrograms(progs.sort((a, b) => new Date(a.created_date) - new Date(b.created_date))))
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
  const rankLabel = RANK_LABELS[profile.level] || profile.level || "—";

  // Агрегированная статистика по всем программам пользователя
  const totalCandidates = myPrograms.reduce((s, p) => s + (p.candidates_count || 0), 0);
  const totalChildren = myPrograms.reduce((s, p) => s + (p.direct_children_count || 0), 0);

  const stats = [
    { icon: TrendingUp, label: "Заработано", value: `${(profile.total_earned || 0).toLocaleString()} ₽`, color: "text-primary" },
    { icon: CheckCircle, label: "Выплачено", value: `${(profile.total_paid || 0).toLocaleString()} ₽`, color: "text-green-600" },
    { icon: Clock, label: "Ожидание", value: `${(profile.total_pending || 0).toLocaleString()} ₽`, color: "text-amber-600" },
    { icon: Users, label: "Кандидатов", value: totalCandidates, color: "text-blue-600" },
    { icon: GitBranch, label: "Подпрограмм", value: totalChildren, color: "text-indigo-600" },
  ];

  return (
    <div>
      {/* Предупреждение о незаполненном профиле */}
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

      {/* Форма редактирования профиля */}
      {editingProfile && form && (
        <div className="mb-6 bg-card border border-border rounded-xl p-5">
          <h3 className="font-heading font-bold mb-4">Ваш профиль</h3>
          <div className="space-y-3">
            <div><Label>ФИО</Label><Input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Иванов Иван Иванович" className="mt-1" /></div>
            <div><Label>Телефон</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+7 900 123 45 67" className="mt-1" /></div>
            <div><Label>Telegram</Label><Input value={form.telegram_username} onChange={e => setForm(f => ({ ...f, telegram_username: e.target.value }))} placeholder="@username" className="mt-1" /></div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button onClick={saveEdit} disabled={saving} className="bg-primary">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Сохранить"}</Button>
            <Button variant="outline" onClick={() => setEditingProfile(false)}>Закрыть</Button>
          </div>
        </div>
      )}

      {/* Приветствие + ранг */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-heading text-2xl font-bold">{profile.full_name || "Партнёр"}</h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <div className="flex items-center gap-1 text-sm">
              <Award className="w-4 h-4 text-accent" />
              <span className="font-medium text-accent">Ранг партнёра: {rankLabel}</span>
            </div>
            <span className="text-muted-foreground text-sm">·</span>
            <span className="text-muted-foreground text-sm">Программ: {myPrograms.length}</span>
          </div>
        </div>
        {!editingProfile && (
          <Button size="sm" variant="outline" onClick={startEdit}>Редактировать</Button>
        )}
      </div>

      {/* Мои программы — краткий блок (НЕ используем progs[0], показываем все) */}
      {myPrograms.length > 0 && (
        <div className="mb-6 bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <GitBranch className="w-5 h-5 text-primary" />
              <span className="font-heading font-bold">Мои программы</span>
            </div>
            <Link to="/dashboard/link" className="text-sm text-primary hover:underline">Управление →</Link>
          </div>
          <div className="space-y-2">
            {myPrograms.map(prog => (
              <div key={prog.id} className="flex items-center justify-between gap-3 py-2 border-b border-border last:border-0">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{prog.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {/* Глубина ветки — техническое значение, НЕ ранг пользователя */}
                    Глубина ветки: {prog.depth} · {prog.candidates_count || 0} кандидатов · {prog.direct_children_count || 0} подпрограмм
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-bold text-accent text-sm">{(prog.reward_quota || 0).toLocaleString()} ₽</div>
                  <div className="text-xs text-muted-foreground">квота</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {myPrograms.length === 0 && !progLoading && (
        <div className="mb-6 bg-card border border-dashed border-border rounded-xl p-6 text-center text-muted-foreground">
          <GitBranch className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Программа пока не назначена. Обратитесь к пригласившему вас партнёру.</p>
        </div>
      )}

      {/* Статистика */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        {stats.map((s, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-1.5 mb-2"><s.icon className={`w-4 h-4 ${s.color}`} /><span className="text-xs text-muted-foreground">{s.label}</span></div>
            <div className="font-heading text-xl font-bold">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Быстрые действия */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="font-heading font-bold mb-3">Быстрые действия</h3>
        <div className="space-y-2">
          {[
            { to: "/dashboard/link", label: "Мои ссылки и подпрограммы" },
            { to: "/dashboard/candidates", label: "Мои кандидаты" },
            { to: "/dashboard/rewards", label: "История вознаграждений" },
            { to: "/dashboard/payouts", label: "Платёжный профиль" },
            { to: "/dashboard/security", label: "Безопасность / Секретный код" },
          ].map(item => (
            <Link key={item.to} to={item.to} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors">
              <span className="text-sm font-medium">{item.label}</span>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
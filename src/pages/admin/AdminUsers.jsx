import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Search, Power, Plus, RefreshCw, Mail, ShieldCheck, Edit2, X } from "lucide-react";
import moment from "moment";
import { getStoredRole, getStoredProfileId } from "@/lib/profileSession";

const genSecretCode = () => {
  const c = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: 28 }, () => c[Math.floor(Math.random() * c.length)]).join("");
};
const maskCode = (code) => code.slice(0, 4) + "••••••••••••••••••••" + code.slice(-4);

const ROLE_LABELS = {
  super_admin: { label: "Супер-админ", color: "bg-purple-100 text-purple-700" },
  admin: { label: "Админ", color: "bg-blue-100 text-blue-700" },
  moderator: { label: "Модератор", color: "bg-indigo-100 text-indigo-700" },
  referrer: { label: "Реферал", color: "bg-teal-100 text-teal-700" },
  candidate: { label: "Кандидат", color: "bg-gray-100 text-gray-700" },
};

// Роли, которые может создавать super_admin
const CREATABLE_ROLES = [
  { value: "admin", label: "Администратор" },
  { value: "moderator", label: "Модератор" },
];

function CreateStaffModal({ onClose, onCreated, masterLinks, currentRole }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ email: "", full_name: "", role: "moderator", master_link_id: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Only super_admin can create staff
    if (currentRole !== "super_admin") {
      setError("Недостаточно прав для создания staff-аккаунтов.");
      return;
    }

    setLoading(true);
    try {
      const emailLower = form.email.trim().toLowerCase();
      const existing = await base44.entities.ReferralProfile.filter({ email: emailLower });
      if (existing.length > 0) {
        setError("Пользователь с таким email уже существует.");
        return;
      }

      const secretCode = genSecretCode();
      const now = new Date().toISOString();

      const profile = await base44.entities.ReferralProfile.create({
        email: emailLower,
        full_name: form.full_name || (form.role === "admin" ? "Администратор" : "Модератор"),
        role: form.role,
        status: "active",
        secret_code: secretCode,
        masked_secret_code: maskCode(secretCode),
        secret_code_last_sent_at: now,
        referral_code: form.role + "-" + Date.now().toString(36),
        master_link_id: form.master_link_id || undefined,
      });

      await base44.integrations.Core.SendEmail({
        to: emailLower,
        subject: `Ваш аккаунт ${form.role === "admin" ? "администратора" : "модератора"} — МилитариПартнер`,
        body: `<h2>Аккаунт ${form.role === "admin" ? "администратора" : "модератора"} создан</h2>
               <p><strong>Email:</strong> ${emailLower}</p>
               <p><strong>Секретный код для входа:</strong></p>
               <p style="font-size:18px;font-family:monospace;background:#f4f4f4;padding:12px;border-radius:6px">${secretCode}</p>
               <p><a href="${window.location.origin}/secret-login">Войти в систему →</a></p>`,
      }).catch(() => {});

      await base44.entities.ActionLog.create({
        actor_user_id: getStoredProfileId(),
        actor_role: currentRole,
        action_type: "STAFF_USER_CREATED",
        entity_type: "ReferralProfile",
        entity_id: profile.id,
        action_payload: JSON.stringify({ email: emailLower, role: form.role }),
      }).catch(() => {});

      toast({ title: `✓ ${form.role === "admin" ? "Администратор" : "Модератор"} создан`, description: `Код отправлен на ${emailLower}` });
      onCreated();
      onClose();
    } catch (err) {
      setError("Ошибка создания: " + (err?.message || "попробуйте ещё раз"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="font-heading font-bold text-lg">Создать staff-аккаунт</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <Label>Email *</Label>
            <Input type="email" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="staff@example.com" />
          </div>
          <div>
            <Label>Имя</Label>
            <Input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Полное имя" />
          </div>
          <div>
            <Label>Роль *</Label>
            <select
              className="w-full h-10 px-3 border border-input rounded-md bg-background text-sm"
              value={form.role}
              onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
            >
              {CREATABLE_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          {masterLinks.length > 0 && (
            <div>
              <Label>Мастер-ссылка (необязательно)</Label>
              <select
                className="w-full h-10 px-3 border border-input rounded-md bg-background text-sm"
                value={form.master_link_id}
                onChange={e => setForm(f => ({ ...f, master_link_id: e.target.value }))}
              >
                <option value="">— не назначена —</option>
                {masterLinks.map(ml => <option key={ml.id} value={ml.id}>{ml.title}</option>)}
              </select>
            </div>
          )}
          {error && <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-sm text-destructive">{error}</div>}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">Отмена</Button>
            <Button type="submit" disabled={loading} className="flex-1 bg-primary font-bold">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Создать"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminUsers() {
  const { toast } = useToast();
  const currentRole = getStoredRole();
  const currentId = getStoredProfileId();
  const isSuperAdmin = currentRole === "super_admin";

  const [users, setUsers] = useState([]);
  const [masterLinks, setMasterLinks] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [actionLoading, setActionLoading] = useState({});

  const load = async () => {
    const [data, mls] = await Promise.all([
      base44.entities.ReferralProfile.list(),
      base44.entities.MasterLink.list(),
    ]);
    setUsers(data);
    setMasterLinks(mls);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    let f = users;
    if (search) f = f.filter(u => u.full_name?.toLowerCase().includes(search.toLowerCase()) || u.email?.includes(search));
    if (roleFilter !== "all") f = f.filter(u => u.role === roleFilter);
    setFiltered(f);
  }, [search, roleFilter, users]);

  const setLoaderFor = (id, val) => setActionLoading(prev => ({ ...prev, [id]: val }));

  // Toggle active/inactive — защита от блокировки последнего super_admin
  const toggleStatus = async (u) => {
    if (u.role === "super_admin" && u.status === "active") {
      const activeSuperAdmins = users.filter(x => x.role === "super_admin" && x.status === "active");
      if (activeSuperAdmins.length <= 1) {
        toast({ title: "Нельзя деактивировать последнего супер-администратора", variant: "destructive" });
        return;
      }
    }
    setLoaderFor(u.id, "status");
    const next = u.status === "active" ? "blocked" : "active";
    await base44.entities.ReferralProfile.update(u.id, { status: next });
    await base44.entities.ActionLog.create({
      actor_user_id: currentId, actor_role: currentRole,
      action_type: "STAFF_STATUS_CHANGED",
      entity_type: "ReferralProfile", entity_id: u.id,
      action_payload: JSON.stringify({ old: u.status, new: next }),
    }).catch(() => {});
    toast({ title: `Статус изменён: ${next === "active" ? "Активен" : "Заблокирован"}` });
    setLoaderFor(u.id, null);
    load();
  };

  // Resend secret code
  const resendCode = async (u) => {
    if (!isSuperAdmin) return;
    setLoaderFor(u.id, "resend");
    const now = new Date().toISOString();
    await base44.entities.ReferralProfile.update(u.id, { secret_code_last_sent_at: now });
    await base44.integrations.Core.SendEmail({
      to: u.email,
      subject: "Ваш секретный код — МилитариПартнер",
      body: `<p>Ваш секретный код для входа:</p><p style="font-size:18px;font-family:monospace;background:#f4f4f4;padding:12px;border-radius:6px">${u.secret_code}</p><p><a href="${window.location.origin}/secret-login">Войти →</a></p>`,
    }).catch(() => {});
    await base44.entities.ActionLog.create({
      actor_user_id: currentId, actor_role: currentRole,
      action_type: "SECRET_CODE_RESENT",
      entity_type: "ReferralProfile", entity_id: u.id,
      action_payload: JSON.stringify({ email: u.email }),
    }).catch(() => {});
    toast({ title: "Код повторно отправлен на email" });
    setLoaderFor(u.id, null);
  };

  // Regenerate secret code
  const regenCode = async (u) => {
    if (!isSuperAdmin) return;
    setLoaderFor(u.id, "regen");
    const secretCode = genSecretCode();
    const now = new Date().toISOString();
    await base44.entities.ReferralProfile.update(u.id, {
      secret_code: secretCode,
      masked_secret_code: maskCode(secretCode),
      secret_code_last_sent_at: now,
    });
    await base44.integrations.Core.SendEmail({
      to: u.email,
      subject: "Новый секретный код — МилитариПартнер",
      body: `<p>Ваш новый секретный код для входа:</p><p style="font-size:18px;font-family:monospace;background:#f4f4f4;padding:12px;border-radius:6px">${secretCode}</p><p><a href="${window.location.origin}/secret-login">Войти →</a></p>`,
    }).catch(() => {});
    await base44.entities.ActionLog.create({
      actor_user_id: currentId, actor_role: currentRole,
      action_type: "SECRET_CODE_REGENERATED",
      entity_type: "ReferralProfile", entity_id: u.id,
      action_payload: JSON.stringify({ email: u.email }),
    }).catch(() => {});
    toast({ title: "Новый код сгенерирован и отправлен на email" });
    setLoaderFor(u.id, null);
    load();
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  // Only show staff tabs for staff management section
  const staffRoles = ["super_admin", "admin", "moderator"];
  const staffUsers = filtered.filter(u => staffRoles.includes(u.role));
  const referrerUsers = filtered.filter(u => !staffRoles.includes(u.role));

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="font-heading text-2xl font-bold">Пользователи ({filtered.length})</h1>
        {isSuperAdmin && (
          <Button onClick={() => setShowCreate(true)} className="bg-primary font-bold gap-2">
            <Plus className="w-4 h-4" /> Создать staff
          </Button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Поиск по имени или email…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="h-10 px-3 border border-input rounded-md bg-background text-sm"
          value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
          <option value="all">Все роли</option>
          {Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l.label}</option>)}
        </select>
      </div>

      {/* Staff section */}
      {(roleFilter === "all" || staffRoles.includes(roleFilter)) && staffUsers.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <h2 className="font-heading font-bold text-sm uppercase tracking-wide text-muted-foreground">Управление командой</h2>
          </div>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  {["Имя", "Email", "Роль", "Статус", "Последний вход", "Код отправлен", ""].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {staffUsers.map(u => {
                  const rl = ROLE_LABELS[u.role] || ROLE_LABELS.referrer;
                  const isCurrentUser = u.id === currentId;
                  const isLastSuperAdmin = u.role === "super_admin" && users.filter(x => x.role === "super_admin" && x.status === "active").length <= 1;
                  return (
                    <tr key={u.id} className={`hover:bg-muted/30 transition-colors ${isCurrentUser ? "bg-primary/5" : ""}`}>
                      <td className="px-4 py-3 font-medium whitespace-nowrap">
                        {u.full_name || "—"}
                        {isCurrentUser && <span className="ml-2 text-xs text-primary">(вы)</span>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{u.email}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${rl.color}`}>{rl.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          u.status === "active" ? "bg-green-100 text-green-700" :
                          u.status === "blocked" ? "bg-red-100 text-red-700" :
                          "bg-gray-100 text-gray-600"}`}>
                          {u.status === "active" ? "Активен" : u.status === "blocked" ? "Заблокирован" : u.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {u.last_login_at ? moment(u.last_login_at).fromNow() : "Не входил"}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {u.secret_code_last_sent_at ? moment(u.secret_code_last_sent_at).fromNow() : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {isSuperAdmin && (
                          <div className="flex items-center gap-1">
                            {/* Resend code */}
                            <button
                              onClick={() => resendCode(u)}
                              disabled={!!actionLoading[u.id]}
                              title="Отправить код повторно"
                              className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            >
                              {actionLoading[u.id] === "resend" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                            </button>
                            {/* Regen code */}
                            <button
                              onClick={() => regenCode(u)}
                              disabled={!!actionLoading[u.id]}
                              title="Новый код"
                              className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            >
                              {actionLoading[u.id] === "regen" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                            </button>
                            {/* Toggle status — защита от удаления последнего super_admin */}
                            {!isLastSuperAdmin && (
                              <button
                                onClick={() => toggleStatus(u)}
                                disabled={!!actionLoading[u.id]}
                                title={u.status === "active" ? "Заблокировать" : "Активировать"}
                                className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                              >
                                {actionLoading[u.id] === "status" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Power className="w-3.5 h-3.5" />}
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Referrers & candidates section */}
      {(roleFilter === "all" || !staffRoles.includes(roleFilter)) && referrerUsers.length > 0 && (
        <div>
          <h2 className="font-heading font-bold text-sm uppercase tracking-wide text-muted-foreground mb-3">Рефералы и кандидаты</h2>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  {["Имя", "Email", "Роль", "Уровень", "Заработано", "Статус", ""].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {referrerUsers.map(u => {
                  const rl = ROLE_LABELS[u.role] || ROLE_LABELS.referrer;
                  return (
                    <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium">{u.full_name || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{u.email}</td>
                      <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${rl.color}`}>{rl.label}</span></td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{u.level?.replace("_", " ") || "—"}</td>
                      <td className="px-4 py-3 font-medium">{(u.total_earned || 0).toLocaleString()} ₽</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${u.status === "active" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                          {u.status === "active" ? "Активен" : "Неактивен"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Button size="sm" variant="ghost" onClick={() => toggleStatus(u)}>
                          <Power className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {filtered.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">Нет пользователей по заданным фильтрам</div>
      )}

      {showCreate && (
        <CreateStaffModal
          onClose={() => setShowCreate(false)}
          onCreated={load}
          masterLinks={masterLinks}
          currentRole={currentRole}
        />
      )}
    </div>
  );
}
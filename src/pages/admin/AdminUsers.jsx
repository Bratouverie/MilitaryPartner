import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Search, Power, Plus, RefreshCw, Mail, ShieldCheck, Eye, EyeOff, Copy, X } from "lucide-react";
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
  { value: "referrer_l1", label: "Реферал 1-го уровня (для конкретной программы)" },
];

function CreateStaffModal({ onClose, onCreated, masterLinks, currentRole, isOpen }) {
   const { toast } = useToast();
   const [form, setForm] = useState({ email: "", full_name: "", role: "moderator", master_link_id: "", program_id: "" });
   const [loading, setLoading] = useState(false);
   const [error, setError] = useState("");
   const [createdCode, setCreatedCode] = useState(null);
   const [showCode, setShowCode] = useState(false);
   const [freshPrograms, setFreshPrograms] = useState([]);
   const [programsLoading, setProgramsLoading] = useState(false);
   const isL1Referrer = form.role === "referrer_l1";

   // Загружаем свежие программы КАЖДЫЙ РАЗ при открытии модала (зависимость isOpen)
   useEffect(() => {
     if (!isOpen) return;
     setProgramsLoading(true);
     base44.entities.ReferralProgram.filter({ is_root: true, is_archived: false })
       .then(progs => {
         const active = progs.filter(p => p.program_status === "active");
         setFreshPrograms(active);
       })
       .catch(err => {
         console.error("[CreateStaffModal] Ошибка загрузки программ:", err);
         setFreshPrograms([]);
       })
       .finally(() => setProgramsLoading(false));
   }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (currentRole !== "super_admin") { setError("Недостаточно прав."); return; }
    // Email обязателен для staff и L1 рефералов
    const emailLower = form.email.trim().toLowerCase();
    if ((isL1Referrer || form.role === "moderator") && !form.program_id) { setError("Выберите программу."); return; }
    setLoading(true);
    try {
      {
        const existing = await base44.entities.ReferralProfile.filter({ email: emailLower });
        if (existing.length > 0) { setError("Пользователь с таким email уже существует."); return; }
      }

      // Гарантируем уникальность кода
      let secretCode;
      let attempts = 0;
      while (attempts < 5) {
        secretCode = genSecretCode();
        const conflict = await base44.entities.ReferralProfile.filter({ secret_code: secretCode });
        if (conflict.length === 0) break;
        attempts++;
      }
      const now = new Date().toISOString();

      const role = isL1Referrer ? "referrer" : form.role;
      const profile = await base44.entities.ReferralProfile.create({
        email: emailLower,
        full_name: form.full_name || (form.role === "admin" ? "Администратор" : form.role === "moderator" ? "Модератор" : "Реферал"),
        role: role,
        status: "active",
        secret_code: secretCode,
        masked_secret_code: maskCode(secretCode),
        secret_code_last_sent_at: now,
        referral_code: form.role + "-" + Date.now().toString(36),
        level: isL1Referrer ? "L0_novice" : undefined,
      });

      // Если это модератор — обновляем программу с assigned_moderator_id
      if (form.role === "moderator" && form.program_id) {
        const selectedProgram = freshPrograms.find(p => p.id === form.program_id);
        if (!selectedProgram) throw new Error("Программа не найдена");

        await base44.entities.ReferralProgram.update(form.program_id, {
          assigned_moderator_id: profile.id,
        });
      }

      // Если это L1 реферал — создаём собственную ReferralProgram
      let childProgram = null;
      if (isL1Referrer && form.program_id) {
        const parentProgram = freshPrograms.find(p => p.id === form.program_id);
        if (!parentProgram) throw new Error("Родительская программа не найдена");

        // Генерируем уникальные коды (аналогично RefLanding.jsx)
        const [linkCode, formCode] = await Promise.all([
          (async () => {
            for (let i = 0; i < 10; i++) {
              const code = Math.random().toString(36).substr(2, 10).toUpperCase();
              const exists = await base44.entities.ReferralProgram.filter({ link_code: code });
              if (exists.length === 0) return code;
            }
            throw new Error("Не удалось сгенерировать уникальный link_code");
          })(),
          (async () => {
            for (let i = 0; i < 10; i++) {
              const code = Math.random().toString(36).substr(2, 10).toUpperCase();
              const exists = await base44.entities.ReferralProgram.filter({ candidate_form_code: code });
              if (exists.length === 0) return code;
            }
            throw new Error("Не удалось сгенерировать уникальный candidate_form_code");
          })(),
        ]);

        // Вычисляем ancestry (как в RefLanding.jsx)
        let ancestryIds = [];
        try { ancestryIds = JSON.parse(parentProgram.ancestry_path_ids || "[]"); } catch {}
        ancestryIds.push(parentProgram.id);
        const ancestryJson = JSON.stringify(ancestryIds);
        const ancestryText = (parentProgram.ancestry_path_text || parentProgram.base_program_title || parentProgram.title) + " / " + (form.full_name || "Реферал");

        // Вычисляем названия программы (как в programUtils.js)
        const baseProgramTitle = parentProgram.base_program_title || parentProgram.title || "";
        const internalDisplayTitle = form.full_name
          ? `${baseProgramTitle} — ${form.full_name}`
          : baseProgramTitle;
        const publicProgramTitle = baseProgramTitle;

        // Создаём дочернюю программу НАПРЯМУЮ (без createChildProgram, чтобы избежать валидации "меньше квоты")
        childProgram = await base44.entities.ReferralProgram.create({
          title: internalDisplayTitle,
          base_program_title: baseProgramTitle,
          child_prefix_title: form.full_name || "Реферал",
          internal_display_title: internalDisplayTitle,
          public_program_title: publicProgramTitle,
          link_code: linkCode,
          candidate_form_code: formCode,
          owner_user_id: profile.id,  // ← ключевое: реферал владеет этой программой!
          parent_program_id: parentProgram.id,
          root_program_id: parentProgram.root_program_id || parentProgram.id,
          root_master_link_id: parentProgram.root_master_link_id,
          assigned_moderator_id: parentProgram.assigned_moderator_id,
          reward_quota: parentProgram.reward_quota,  // наследуем полную квоту
          parent_reward_quota: parentProgram.reward_quota,
          depth: (parentProgram.depth || 0) + 1,
          ancestry_path_ids: ancestryJson,
          ancestry_path_text: ancestryText,
          program_kind: "child",
          program_status: "active",
          is_root: false,
          is_active: true,
          is_archived: false,
          can_create_child: parentProgram.reward_quota > 5000,  // MIN_QUOTA
          direct_children_count: 0,
          children_count: 0,
          candidates_count: 0,
          contracts_count: 0,
          pending_rewards_sum: 0,
          paid_rewards_sum: 0,
          owner_program_level: 0,
          region_code: parentProgram.region_code,
          region_name: parentProgram.region_name,
          program_category: parentProgram.program_category,
        });

        // Создаём ProgramMembership БЕЗ silent catch (ошибки должны быть видны!)
        await base44.entities.ProgramMembership.create({
          user_id: profile.id,
          program_id: childProgram.id,
          membership_role: "owner",
          membership_status: "active",
          source_join_type: "direct_assignment",
          source_program_id: parentProgram.id,
          joined_at: now,
        });

        // Обновляем счётчики родителя
        await base44.entities.ReferralProgram.update(parentProgram.id, {
          direct_children_count: (parentProgram.direct_children_count || 0) + 1,
          children_count: (parentProgram.children_count || 0) + 1,
        });
      }

      // Отправляем email только если он указан
      if (emailLower) {
        await base44.integrations.Core.SendEmail({
          to: emailLower,
          subject: `Ваш аккаунт — МилитариПартнер`,
          body: `<h2>Аккаунт создан</h2><p><strong>Секретный код для входа:</strong></p>
      <p style="font-size:18px;font-family:monospace;background:#f4f4f4;padding:12px;border-radius:6px">${secretCode}</p>
      <p>Используйте код для входа — email при входе не нужен.</p>
      <p><a href="${window.location.origin}/secret-login">Войти →</a></p>`,
        }).catch(() => {});
      }

      await base44.entities.ActionLog.create({
        actor_user_id: getStoredProfileId(), actor_role: currentRole,
        action_type: isL1Referrer ? "L1_REFERRER_CREATED" : "STAFF_USER_CREATED",
        entity_type: "ReferralProfile", entity_id: profile.id,
        action_payload: JSON.stringify({ 
          email: emailLower || null, 
          role: form.role, 
          program_id: form.program_id,
          child_program_id: childProgram?.id || null,
        }),
      }).catch(() => {});

      // Показываем код администратору сразу
      setCreatedCode({ secretCode, profile, emailLower });
      onCreated();
    } catch (err) {
      setError("Ошибка создания: " + (err?.message || "попробуйте ещё раз"));
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = async () => {
    if (createdCode?.secretCode) {
      await navigator.clipboard.writeText(createdCode.secretCode);
      toast({ title: "Код скопирован!" });
      await base44.entities.ActionLog.create({
        actor_user_id: getStoredProfileId(), actor_role: currentRole,
        action_type: "SECRET_CODE_COPIED",
        entity_type: "ReferralProfile", entity_id: createdCode.profile.id,
      }).catch(() => {});
    }
  };

  // После создания — показываем результат с кодом
  if (createdCode) return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-xl p-6">
        <div className="text-center mb-4">
          <div className="text-green-600 font-heading font-bold text-lg mb-1">✓ Аккаунт создан</div>
          <p className="text-sm text-muted-foreground">Передайте секретный код пользователю через ваш канал связи</p>
        </div>
        <div className="bg-muted rounded-xl p-4 font-mono text-center text-sm mb-3 break-all min-h-[52px] flex items-center justify-center">
          {showCode ? createdCode.secretCode : maskCode(createdCode.secretCode)}
        </div>
        {createdCode.emailLower && (
          <p className="text-xs text-muted-foreground text-center mb-3">Код также отправлен на {createdCode.emailLower}</p>
        )}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <Button variant="outline" size="sm" onClick={() => setShowCode(v => !v)} className="h-10 text-xs">
            {showCode ? <EyeOff className="w-3.5 h-3.5 mr-1" /> : <Eye className="w-3.5 h-3.5 mr-1" />}
            {showCode ? "Скрыть" : "Показать"}
          </Button>
          <Button variant="outline" size="sm" onClick={handleCopyCode} className="h-10 text-xs">
            <Copy className="w-3.5 h-3.5 mr-1" /> Копировать
          </Button>
        </div>
        <Button onClick={onClose} className="w-full bg-primary font-bold">Закрыть</Button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="font-heading font-bold text-lg">{isL1Referrer ? "Создать реферала 1-го уровня" : "Создать staff-аккаунт"}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <Label>Имя</Label>
            <Input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Полное имя" autoFocus />
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="user@example.com (опционально)" />
            <p className="text-xs text-muted-foreground mt-1">Если указан, секретный код будет отправлен. Если нет — код появится в интерфейсе.</p>
          </div>
          <div>
            <Label>Роль *</Label>
            <select className="w-full h-10 px-3 border border-input rounded-md bg-background text-sm" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value, program_id: "" }))}>
              {CREATABLE_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          {(isL1Referrer || form.role === "moderator") && (
            <div>
              <Label>{isL1Referrer ? "Программа для владения *" : "Программа для курирования *"}</Label>
              {programsLoading ? (
                <div className="h-10 flex items-center text-xs text-muted-foreground">Загрузка программ…</div>
              ) : freshPrograms.filter(p => p.program_status === "active" && !p.is_archived).length > 0 ? (
                <select className="w-full h-10 px-3 border border-input rounded-md bg-background text-sm" value={form.program_id} onChange={e => setForm(f => ({ ...f, program_id: e.target.value }))}>
                  <option value="">Выберите программу…</option>
                  {freshPrograms.filter(p => p.program_status === "active" && !p.is_archived).map(p => <option key={p.id} value={p.id}>{p.internal_display_title || p.title} ({(p.reward_quota || 0).toLocaleString()} ₽)</option>)}
                </select>
              ) : (
                <div className="h-10 flex items-center text-xs text-destructive">Нет доступных активных программ</div>
              )}
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
  const [programs, setPrograms] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [actionLoading, setActionLoading] = useState({});
  const [visibleCodes, setVisibleCodes] = useState({}); // id -> true/false показывать код

  const load = async () => {
    const [data, mls, progs] = await Promise.all([
      base44.entities.ReferralProfile.list(),
      base44.entities.MasterLink.list(),
      base44.entities.ReferralProgram.list(),
    ]);
    setUsers(data);
    setMasterLinks(mls);
    setPrograms(progs);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    let f = users;
    if (search) f = f.filter(u =>
      u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      (u.email && u.email.toLowerCase().includes(search.toLowerCase())) ||
      u.referral_code?.includes(search)
    );
    if (roleFilter !== "all") f = f.filter(u => u.role === roleFilter);
    setFiltered(f);
  }, [search, roleFilter, users]);

  const setLoaderFor = (id, val) => setActionLoading(prev => ({ ...prev, [id]: val }));

  // Удаление пользователей (админ удаляет кандидатов/модераторов, суперадмин удаляет всех)
  const canDeleteUser = (u) => {
    if (u.id === currentId) return false; // себя удалять нельзя
    if (u.role === "super_admin") return currentRole === "super_admin"; // super_admin только суперадмин
    if (u.role === "admin") return currentRole === "super_admin"; // admin только суперадмин
    return true; // кандидатов и модераторов может админ и суперадмин
  };

  const deleteUser = async (u) => {
    const msg = currentRole === "super_admin" && u.role === "admin" ? `Удалить администратора ${u.full_name || u.email}?` : `Деактивировать ${u.full_name || u.email}?`;
    if (!confirm(msg)) return;

    setLoaderFor(u.id, "delete");
    try {
      // Soft delete: помечаем как inactive/blocked
      await base44.entities.ReferralProfile.update(u.id, { status: "blocked" });
      await base44.entities.ActionLog.create({
        actor_user_id: currentId, actor_role: currentRole,
        action_type: "USER_DELETED",
        entity_type: "ReferralProfile", entity_id: u.id,
        action_payload: JSON.stringify({ role: u.role, email: u.email }),
      }).catch(() => {});
      toast({ title: "Пользователь удален" });
      load();
    } catch (err) {
      toast({ title: "Ошибка удаления", variant: "destructive" });
    } finally {
      setLoaderFor(u.id, null);
    }
  };

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

  const toggleCodeVisibility = async (u) => {
    const next = !visibleCodes[u.id];
    setVisibleCodes(prev => ({ ...prev, [u.id]: next }));
    if (next) {
      await base44.entities.ActionLog.create({
        actor_user_id: currentId, actor_role: currentRole,
        action_type: "SECRET_CODE_VIEWED",
        entity_type: "ReferralProfile", entity_id: u.id,
      }).catch(() => {});
    }
  };

  const copyCode = async (u) => {
    if (u.secret_code) {
      await navigator.clipboard.writeText(u.secret_code);
      toast({ title: "Код скопирован!" });
      await base44.entities.ActionLog.create({
        actor_user_id: currentId, actor_role: currentRole,
        action_type: "SECRET_CODE_COPIED",
        entity_type: "ReferralProfile", entity_id: u.id,
      }).catch(() => {});
    }
  };

  // Resend secret code — только если email указан
  const resendCode = async (u) => {
    if (!isSuperAdmin || !u.email) return;
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

  // Regenerate secret code — email отправляется только если указан
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
    if (u.email) {
      await base44.integrations.Core.SendEmail({
        to: u.email,
        subject: "Новый секретный код — МилитариПартнер",
        body: `<p>Ваш новый секретный код для входа:</p><p style="font-size:18px;font-family:monospace;background:#f4f4f4;padding:12px;border-radius:6px">${secretCode}</p><p><a href="${window.location.origin}/secret-login">Войти →</a></p>`,
      }).catch(() => {});
    }
    await base44.entities.ActionLog.create({
      actor_user_id: currentId, actor_role: currentRole,
      action_type: "SECRET_CODE_REGENERATED",
      entity_type: "ReferralProfile", entity_id: u.id,
      action_payload: JSON.stringify({ email: u.email || null }),
    }).catch(() => {});
    // Скрываем старый видимый код — данные перезагрузятся
    setVisibleCodes(prev => ({ ...prev, [u.id]: false }));
    toast({ title: u.email ? "Новый код сгенерирован и отправлен на email" : "Новый код сгенерирован. Скопируйте и передайте пользователю." });
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
          <Input className="pl-9" placeholder="Поиск по имени или email" value={search} onChange={e => setSearch(e.target.value)} />
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
                  {["Имя", "Email", "Роль", "Статус", "Secret Code", "Последний вход", ""].map(h => (
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
                      <td className="px-4 py-3">
                        {isSuperAdmin && (
                          <div className="flex items-center gap-1">
                            <span className="font-mono text-xs text-muted-foreground max-w-[120px] truncate">
                              {visibleCodes[u.id] ? u.secret_code : maskCode(u.secret_code || "")}
                            </span>
                            <button onClick={() => toggleCodeVisibility(u)} title={visibleCodes[u.id] ? "Скрыть" : "Показать"} className="p-1 rounded hover:bg-muted">
                              {visibleCodes[u.id] ? <EyeOff className="w-3.5 h-3.5 text-muted-foreground" /> : <Eye className="w-3.5 h-3.5 text-muted-foreground" />}
                            </button>
                            <button onClick={() => copyCode(u)} title="Копировать" className="p-1 rounded hover:bg-muted">
                              <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {u.last_login_at ? moment(u.last_login_at).fromNow() : "Не входил"}
                      </td>
                      <td className="px-4 py-3">
                        {(isSuperAdmin || currentRole === "admin") && (
                          <div className="flex items-center gap-1">
                            {isSuperAdmin && u.email && (
                              <button onClick={() => resendCode(u)} disabled={!!actionLoading[u.id]} title="Отправить код на email" className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                                {actionLoading[u.id] === "resend" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                              </button>
                            )}
                            {isSuperAdmin && (
                              <button onClick={() => regenCode(u)} disabled={!!actionLoading[u.id]} title="Новый код" className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                                {actionLoading[u.id] === "regen" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                              </button>
                            )}
                            {!isLastSuperAdmin && (isSuperAdmin || (currentRole === "admin" && u.role !== "admin")) && (
                              <button onClick={() => toggleStatus(u)} disabled={!!actionLoading[u.id]} title={u.status === "active" ? "Заблокировать" : "Активировать"} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                                {actionLoading[u.id] === "status" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Power className="w-3.5 h-3.5" />}
                              </button>
                            )}
                            {canDeleteUser(u) && (
                              <button onClick={() => deleteUser(u)} disabled={!!actionLoading[u.id]} title="Удалить" className="p-1.5 rounded hover:bg-destructive/10 text-destructive hover:text-destructive transition-colors">
                                {actionLoading[u.id] === "delete" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
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

      {/* Referrers section */}
      {(roleFilter === "all" || !staffRoles.includes(roleFilter)) && referrerUsers.length > 0 && (
        <div>
          <h2 className="font-heading font-bold text-sm uppercase tracking-wide text-muted-foreground mb-3">Рефералы</h2>
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
           isOpen={showCreate}
         />
       )}
    </div>
  );
}
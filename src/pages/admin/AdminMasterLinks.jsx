/**
 * Управление реферальными программами (корень + дерево).
 * Единый источник истины: ReferralProgram.is_root = true.
 * Финансовые параметры и дерево неизменяемы после создания.
 * Модератор — единственный изменяемый параметр.
 */
import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Plus, Power, X, Copy, ChevronRight, Users, GitBranch, Shield, ChevronDown, ChevronUp, Edit2, Info } from "lucide-react";
import { genUniqueLinkCode, genUniqueCandidateCode, validateQuota, MIN_QUOTA, QUOTA_STEP, canHaveChildren, MAX_DIRECT_CHILDREN } from "@/lib/programUtils";
import { getStoredProfile } from "@/lib/profileSession";
import { guessRegionCode, recommendCategory, CATEGORY_LABELS } from "@/lib/regionHelpers";

const DENSITY_COLOR = (count) => {
  if (count === 0) return "bg-gray-100 text-gray-500";
  if (count < 5) return "bg-blue-100 text-blue-700";
  if (count < 20) return "bg-blue-200 text-blue-800";
  return "bg-blue-300 text-blue-900";
};

export default function AdminMasterLinks() {
  const { toast } = useToast();
  const [rootPrograms, setRootPrograms] = useState([]);
  const [allPrograms, setAllPrograms] = useState([]);
  const [moderators, setModerators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({ 
      title: "", 
      max_reward: "", 
      moderator_id: "", 
      region_name: "", 
      region_code: "", 
      program_category: recommendCategory("") // рекомендация по умолчанию
    });
  const [formError, setFormError] = useState("");
  const [expandedRoots, setExpandedRoots] = useState({});
  const [changingModerator, setChangingModerator] = useState(null);
  const [newModeratorId, setNewModeratorId] = useState("");
  const [savingMod, setSavingMod] = useState(false);
  const [changingStatus, setChangingStatus] = useState(null); // prog id
  const [newStatus, setNewStatus] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const currentProfile = getStoredProfile();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [roots, all, mods] = await Promise.all([
        base44.entities.ReferralProgram.filter({ is_root: true }),
        base44.entities.ReferralProgram.list(),
        base44.entities.ReferralProfile.filter({ role: "moderator" }),
      ]);
      setRootPrograms(roots.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)));
      setAllPrograms(all);
      setModerators(mods);
    } catch (e) {
      console.error("[AdminMasterLinks] Load failed:", e);
      toast({ title: "Ошибка загрузки программ", variant: "destructive" });
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const getChildren = (parentId) => allPrograms.filter(p => p.parent_program_id === parentId);
  const getModerator = (id) => moderators.find(m => m.id === id);

  const handleSave = async () => {
    setFormError("");
    const quota = Number(form.max_reward);
    const { valid, error } = validateQuota(quota);
    if (!valid) { setFormError(error); return; }
    if (!form.title.trim()) { setFormError("Введите название программы"); return; }

    setSaving(true);
    try {
      const [linkCode, formCode] = await Promise.all([genUniqueLinkCode(), genUniqueCandidateCode()]);

      const program = await base44.entities.ReferralProgram.create({
        title: form.title.trim(),
        link_code: linkCode,
        candidate_form_code: formCode,
        owner_user_id: form.moderator_id || currentProfile?.id,
        assigned_moderator_id: form.moderator_id || undefined,
        reward_quota: quota,
        parent_reward_quota: null,
        depth: 0,
        ancestry_path_ids: "[]",
        ancestry_path_text: form.title.trim(),
        program_kind: "root",
        is_root: true,
        is_active: true,
        is_archived: false,
        can_create_child: quota > MIN_QUOTA,
        direct_children_count: 0,
        children_count: 0,
        candidates_count: 0,
        contracts_count: 0,
        pending_rewards_sum: 0,
        paid_rewards_sum: 0,
        program_status: "active",
        owner_program_level: 0,
        region_code: form.region_code || undefined,
        region_name: form.region_name || undefined,
        program_category: form.program_category || undefined,
      });

      try {
        await base44.entities.ActionLog.create({
          actor_user_id: currentProfile?.id,
          actor_role: currentProfile?.role,
          action_type: "ROOT_PROGRAM_CREATED",
          entity_type: "ReferralProgram",
          entity_id: program.id,
          action_payload: JSON.stringify({ title: form.title, max_reward: quota, moderator_id: form.moderator_id }),
        });
      } catch (logErr) {
        console.warn("[AdminMasterLinks] ActionLog creation failed (non-critical):", logErr);
      }

      if (form.moderator_id) {
        try {
          await base44.entities.ActionLog.create({
            actor_user_id: currentProfile?.id,
            action_type: "PROGRAM_MODERATOR_ASSIGNED",
            entity_type: "ReferralProgram",
            entity_id: program.id,
            action_payload: JSON.stringify({ moderator_id: form.moderator_id }),
          });
        } catch (logErr) {
          console.warn("[AdminMasterLinks] ActionLog moderator assignment failed (non-critical):", logErr);
        }
      }

      toast({ title: "Программа создана!" });
      setShowCreateForm(false);
      setForm({ title: "", max_reward: "", moderator_id: "", region_name: "", region_code: "", program_category: "" });
      load();
    } catch {
      setFormError("Ошибка при создании. Попробуйте ещё раз.");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (prog) => {
    try {
      await base44.entities.ReferralProgram.update(prog.id, { is_active: !prog.is_active });
      toast({ title: prog.is_active ? "Программа отключена" : "Программа включена" });
      load();
    } catch (e) {
      console.error("[AdminMasterLinks] Toggle active failed:", e);
      toast({ title: "Ошибка", variant: "destructive" });
    }
  };

  // Lifecycle: active / frozen / replaced / archived
  const LIFECYCLE_LABELS = { active: "Активна", frozen: "Заморожена", replaced: "Заменена", archived: "В архиве" };
  const LIFECYCLE_COLORS = {
    active: "bg-green-100 text-green-700", frozen: "bg-blue-100 text-blue-700",
    replaced: "bg-amber-100 text-amber-700", archived: "bg-gray-100 text-gray-500",
  };
  const changeLifecycle = async (prog) => {
    setSavingStatus(true);
    const now = new Date().toISOString();
    const updates = { program_status: newStatus };
    if (newStatus === "frozen") updates.frozen_at = now;
    if (newStatus === "replaced") updates.replaced_at = now;
    if (newStatus === "archived") { updates.archived_at = now; updates.is_active = false; }
    try {
      await base44.entities.ReferralProgram.update(prog.id, updates);
      try {
        await base44.entities.ActionLog.create({
          actor_user_id: currentProfile?.id,
          action_type: "PROGRAM_STATUS_CHANGED",
          entity_type: "ReferralProgram",
          entity_id: prog.id,
          action_payload: JSON.stringify({ old: prog.program_status || "active", new: newStatus }),
        });
      } catch (logErr) {
        console.warn("[AdminMasterLinks] ActionLog status change failed (non-critical):", logErr);
      }
      toast({ title: `Статус изменён: ${LIFECYCLE_LABELS[newStatus]}` });
      setChangingStatus(null);
      load();
    } catch (e) {
      console.error("[AdminMasterLinks] Status change failed:", e);
      toast({ title: "Ошибка", variant: "destructive" });
    }
    finally { setSavingStatus(false); }
  };

  const changeModerator = async (prog) => {
    setSavingMod(true);
    try {
      const old = prog.assigned_moderator_id;
      await base44.entities.ReferralProgram.update(prog.id, { assigned_moderator_id: newModeratorId || null });
      try {
        await base44.entities.ActionLog.create({
          actor_user_id: currentProfile?.id,
          action_type: "PROGRAM_MODERATOR_CHANGED",
          entity_type: "ReferralProgram",
          entity_id: prog.id,
          action_payload: JSON.stringify({ old_moderator_id: old, new_moderator_id: newModeratorId }),
        });
      } catch (logErr) {
        console.warn("[AdminMasterLinks] ActionLog moderator change failed (non-critical):", logErr);
      }
      toast({ title: "Модератор обновлён" });
      setChangingModerator(null);
      load();
    } catch (e) {
      console.error("[AdminMasterLinks] Moderator change failed:", e);
      toast({ title: "Ошибка", variant: "destructive" });
    } finally {
      setSavingMod(false);
    }
  };

  const copyLink = (url) => {
    navigator.clipboard.writeText(url);
    toast({ title: "Ссылка скопирована!" });
  };

  const baseUrl = window.location.origin;

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  // Рекурсивный компонент узла дерева
  const TreeNode = ({ prog, indent = 0 }) => {
    const children = getChildren(prog.id);
    const mod = getModerator(prog.assigned_moderator_id);
    const isExpanded = expandedRoots[prog.id];
    const density = prog.candidates_count || 0;

    return (
      <div style={{ marginLeft: indent > 0 ? `${indent * 20}px` : 0 }}>
        <div className={`flex flex-col sm:flex-row items-start gap-3 p-3 rounded-xl border mb-2 ${indent === 0 ? "border-primary/20 bg-primary/3" : "border-border bg-card"}`}>
          {/* Левая часть */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              {indent > 0 && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
              <span className="font-medium text-sm">{prog.title}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${LIFECYCLE_COLORS[prog.program_status || "active"]}`}>
                {LIFECYCLE_LABELS[prog.program_status || "active"]}
              </span>
              {prog.is_root && <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">Root</span>}
              {(prog.owner_program_level || 0) >= 1 && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">★ Уровень 1</span>}
            </div>

            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span className="font-bold text-accent text-sm">{(prog.reward_quota || 0).toLocaleString()} ₽</span>
              <span className="flex items-center gap-1"><GitBranch className="w-3 h-3" />{prog.direct_children_count || 0}/{MAX_DIRECT_CHILDREN} подпрограмм</span>
              <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${DENSITY_COLOR(density)}`}>
                <Users className="w-3 h-3" />{density} кандидатов
              </span>
              <span>Глубина ветки: {prog.depth}</span>
            </div>

            {mod && (
              <div className="flex items-center gap-1 mt-1 text-xs">
                <Shield className="w-3 h-3 text-primary" />
                <span className="text-muted-foreground">Модератор:</span>
                <span className="font-medium">{mod.full_name || mod.email}</span>
              </div>
            )}
            {!mod && prog.is_root && (
              <div className="text-xs text-amber-600 mt-1">⚠️ Модератор не назначен</div>
            )}

            {prog.ancestry_path_text && !prog.is_root && (
              <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                <Info className="w-3 h-3 shrink-0" />{prog.ancestry_path_text}
              </div>
            )}

            {/* Ссылки (только для корневых или при раскрытии) */}
            {(indent === 0 || isExpanded) && (
              <div className="mt-2 flex flex-wrap gap-2">
                <button onClick={() => copyLink(`${baseUrl}/join/${prog.link_code}`)}
                  className="flex items-center gap-1 text-xs bg-muted hover:bg-muted/70 px-2 py-1 rounded-lg transition-colors">
                  <Copy className="w-3 h-3" />Партнёрская ссылка
                </button>
                <button onClick={() => copyLink(`${baseUrl}/candidate/${prog.candidate_form_code}`)}
                  className="flex items-center gap-1 text-xs bg-muted hover:bg-muted/70 px-2 py-1 rounded-lg transition-colors">
                  <Copy className="w-3 h-3" />Анкета кандидата
                </button>
              </div>
            )}
          </div>

          {/* Правая часть — действия */}
          <div className="flex gap-1 shrink-0 flex-wrap">
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setChangingModerator(prog.id); setNewModeratorId(prog.assigned_moderator_id || ""); }}>
              <Edit2 className="w-3 h-3" />
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" title="Жизненный цикл" onClick={() => { setChangingStatus(prog.id); setNewStatus(prog.program_status || "active"); }}>
              <Power className="w-3 h-3" />
            </Button>
            {children.length > 0 && (
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setExpandedRoots(prev => ({ ...prev, [prog.id]: !prev[prog.id] }))}>
                {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </Button>
            )}
          </div>
        </div>

        {/* Модальное изменение модератора */}
        {changingModerator === prog.id && (
          <div className="ml-2 mb-3 bg-muted rounded-xl p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Назначить модератора</span>
              <button onClick={() => setChangingModerator(null)}><X className="w-4 h-4 text-muted-foreground" /></button>
            </div>
            <select className="h-9 px-3 border border-input rounded-md bg-background text-sm w-full"
              value={newModeratorId} onChange={e => setNewModeratorId(e.target.value)}>
              <option value="">— без модератора —</option>
              {moderators.map(m => <option key={m.id} value={m.id}>{m.full_name || m.email}</option>)}
            </select>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => setChangingModerator(null)}>Отмена</Button>
              <Button size="sm" className="flex-1 bg-primary" onClick={() => changeModerator(prog)} disabled={savingMod}>
                {savingMod ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Сохранить"}
              </Button>
            </div>
          </div>
        )}

        {/* Смена lifecycle-статуса */}
        {changingStatus === prog.id && (
          <div className="ml-2 mb-3 bg-muted rounded-xl p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Жизненный цикл программы</span>
              <button onClick={() => setChangingStatus(null)}><X className="w-4 h-4 text-muted-foreground" /></button>
            </div>
            <select className="h-9 px-3 border border-input rounded-md bg-background text-sm w-full"
              value={newStatus} onChange={e => setNewStatus(e.target.value)}>
              <option value="active">✅ Активна — принимает новых партнёров</option>
              <option value="frozen">❄️ Заморожена — старые ветки живут, новых нет</option>
              <option value="replaced">🔄 Заменена — есть новая замещающая программа</option>
              <option value="archived">📦 В архиве — только история</option>
            </select>
            <div className="text-xs text-muted-foreground bg-amber-50 border border-amber-100 rounded-lg p-2">
              ⚠️ Квота и дерево не изменяются. Старые ветки сохраняются по snapshot-данным.
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => setChangingStatus(null)}>Отмена</Button>
              <Button size="sm" className="flex-1 bg-primary" onClick={() => changeLifecycle(prog)} disabled={savingStatus}>
                {savingStatus ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Применить"}
              </Button>
            </div>
          </div>
        )}

        {/* Дочерние узлы */}
        {isExpanded && children.map(child => (
          <TreeNode key={child.id} prog={child} indent={indent + 1} />
        ))}
      </div>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold">Реферальные программы</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Корневых программ: <strong>{rootPrograms.filter(p => !p.is_archived || showArchived).length}</strong> · Всего программ: <strong>{allPrograms.filter(p => !p.is_archived || showArchived).length}</strong>
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant={showArchived ? "default" : "outline"} onClick={() => setShowArchived(!showArchived)} size="sm" className="text-xs">
            {showArchived ? "Скрыть архив" : "Показать архив"}
          </Button>
          <Button onClick={() => { setShowCreateForm(true); setFormError(""); }} className="bg-primary font-medium">
            <Plus className="w-4 h-4 mr-2" />Создать программу
          </Button>
        </div>
      </div>

      {/* Форма создания */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-heading font-bold text-lg">Новая корневая программа</h2>
              <button onClick={() => setShowCreateForm(false)}><X className="w-5 h-5 text-muted-foreground" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <Label>Название программы *</Label>
                <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Контракт ВС РФ 2025" autoFocus />
              </div>
              <div>
                <Label>Максимальная квота (₽) *</Label>
                <Input type="number" value={form.max_reward} onChange={e => setForm(f => ({ ...f, max_reward: e.target.value }))}
                  placeholder={`мин. ${MIN_QUOTA.toLocaleString()}, кратно ${QUOTA_STEP.toLocaleString()}`}
                  min={MIN_QUOTA} step={QUOTA_STEP} />
                <p className="text-xs text-muted-foreground mt-1">Суммарная выплата по всей цепочке за один успешный контракт. Кратно {QUOTA_STEP.toLocaleString()} ₽.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Регион</Label>
                  <Input value={form.region_name} onChange={e => {
                    const name = e.target.value;
                    setForm(f => ({
                      ...f,
                      region_name: name,
                      region_code: guessRegionCode(name) // автоопределяем код
                    }));
                  }} placeholder="Москва" className="mt-1" />
                </div>
                <div>
                  <Label>Код региона</Label>
                  <Input value={form.region_code} onChange={e => setForm(f => ({ ...f, region_code: e.target.value.toUpperCase() }))} placeholder="MSK" className="mt-1" maxLength={6} />
                  <p className="text-xs text-muted-foreground mt-1">Определяется автоматически</p>
                </div>
              </div>
              <div>
                <Label>Категория программы</Label>
                <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm mt-1"
                  value={form.program_category} onChange={e => setForm(f => ({ ...f, program_category: e.target.value }))}>
                  <option value="">— не определена —</option>
                  {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  {form.program_category && CATEGORY_LABELS[form.program_category] ? `Выбрано: ${CATEGORY_LABELS[form.program_category]}` : "Помогает сегментировать и анализировать программы"}
                </p>
              </div>
              <div>
                <Label>Назначить модератора</Label>
                <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm mt-1"
                  value={form.moderator_id} onChange={e => setForm(f => ({ ...f, moderator_id: e.target.value }))}>
                  <option value="">— не назначен —</option>
                  {moderators.map(m => <option key={m.id} value={m.id}>{m.full_name || m.email}</option>)}
                </select>
              </div>
              {formError && <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-sm text-destructive">{formError}</div>}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                ⚠️ После создания квота, родительская программа и дерево не редактируются. Менять можно только модератора.
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <Button variant="outline" className="flex-1" onClick={() => setShowCreateForm(false)}>Отмена</Button>
              <Button className="flex-1 bg-primary" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Создать"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Дерево программ */}
      {rootPrograms.length === 0 && (
        <div className="text-center py-16 text-muted-foreground bg-card border border-dashed border-border rounded-xl">
          <Shield className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Нет корневых программ</p>
          <p className="text-sm mt-1">Создайте первую программу с помощью кнопки выше</p>
        </div>
      )}

      <div className="space-y-2">
        {rootPrograms.filter(p => showArchived ? true : !p.is_archived).map(prog => <TreeNode key={prog.id} prog={prog} indent={0} />)}
      </div>

      {/* Легенда плотности */}
      {rootPrograms.length > 0 && (
        <div className="mt-6 flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
          <span>Плотность кандидатов:</span>
          {[["bg-gray-100 text-gray-500", "0"], ["bg-blue-100 text-blue-700", "1–4"], ["bg-blue-200 text-blue-800", "5–19"], ["bg-blue-300 text-blue-900", "20+"]].map(([cls, lbl]) => (
            <span key={lbl} className={`px-2 py-0.5 rounded ${cls}`}>{lbl}</span>
          ))}
        </div>
      )}
    </div>
  );
}
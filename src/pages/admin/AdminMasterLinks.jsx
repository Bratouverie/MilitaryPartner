import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Plus, Edit2, Power, X, Copy, ChevronRight, Users, GitBranch, Shield } from "lucide-react";
import { genUniqueLinkCode, genUniqueCandidateCode } from "@/lib/programUtils";
import { getStoredProfile } from "@/lib/profileSession";

export default function AdminMasterLinks() {
  const { toast } = useToast();
  const [programs, setPrograms] = useState([]);
  const [moderators, setModerators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", max_reward: 200000, moderator_id: "" });
  const [selectedTree, setSelectedTree] = useState(null); // ID корневой программы для просмотра дерева
  const [treeData, setTreeData] = useState([]);
  const [treeLoading, setTreeLoading] = useState(false);

  const currentProfile = getStoredProfile();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [progs, mods] = await Promise.all([
        base44.entities.ReferralProgram.filter({ is_root: true }),
        base44.entities.ReferralProfile.filter({ role: "moderator" }),
      ]);
      setPrograms(progs);
      setModerators(mods);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setForm({ title: "", description: "", max_reward: 200000, moderator_id: "" });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title || !form.max_reward) {
      toast({ title: "Заполните обязательные поля", variant: "destructive" });
      return;
    }
    if (form.max_reward < 5000) {
      toast({ title: "Минимальная квота — 5 000 ₽", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const linkCode = await genUniqueLinkCode();
      const formCode = await genUniqueCandidateCode();

      const program = await base44.entities.ReferralProgram.create({
        title: form.title,
        link_code: linkCode,
        candidate_form_code: formCode,
        owner_user_id: form.moderator_id || currentProfile?.id,
        assigned_moderator_id: form.moderator_id || undefined,
        reward_quota: form.max_reward,
        parent_reward_quota: null,
        depth: 0,
        is_root: true,
        is_active: true,
        can_create_child: form.max_reward > 5000,
        children_count: 0,
        candidates_count: 0,
      });

      await base44.entities.ActionLog.create({
        actor_user_id: currentProfile?.id,
        actor_role: currentProfile?.role,
        action_type: "ROOT_PROGRAM_CREATED",
        entity_type: "ReferralProgram",
        entity_id: program.id,
        action_payload: JSON.stringify({ title: form.title, max_reward: form.max_reward, moderator_id: form.moderator_id }),
      }).catch(() => {});

      if (form.moderator_id) {
        await base44.entities.ActionLog.create({
          actor_user_id: currentProfile?.id,
          action_type: "PROGRAM_MODERATOR_ASSIGNED",
          entity_type: "ReferralProgram",
          entity_id: program.id,
          action_payload: JSON.stringify({ moderator_id: form.moderator_id }),
        }).catch(() => {});
      }

      toast({ title: "Программа создана!" });
      setShowForm(false);
      load();
    } catch {
      toast({ title: "Ошибка при создании", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (prog) => {
    await base44.entities.ReferralProgram.update(prog.id, { is_active: !prog.is_active });
    load();
  };

  const loadTree = async (rootId) => {
    if (selectedTree === rootId) { setSelectedTree(null); return; }
    setSelectedTree(rootId);
    setTreeLoading(true);
    try {
      const all = await base44.entities.ReferralProgram.filter({ root_program_id: rootId });
      setTreeData(all);
    } catch {}
    setTreeLoading(false);
  };

  const copyLink = (url) => {
    navigator.clipboard.writeText(url);
    toast({ title: "Ссылка скопирована!" });
  };

  const baseUrl = window.location.origin;

  const getModerator = (id) => moderators.find(m => m.id === id);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-2xl font-bold">Реферальные программы</h1>
          <p className="text-sm text-muted-foreground mt-1">Корневые программы и дерево уровней</p>
        </div>
        <Button onClick={openCreate} className="bg-primary font-medium">
          <Plus className="w-4 h-4 mr-2" />Создать программу
        </Button>
      </div>

      {/* Форма создания */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-heading font-bold text-lg">Новая корневая программа</h2>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-muted-foreground" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <Label>Название программы *</Label>
                <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Контракт ВС РФ 2025" />
              </div>
              <div>
                <Label>Максимальная квота (₽) *</Label>
                <Input type="number" value={form.max_reward} onChange={e => setForm(f => ({ ...f, max_reward: Number(e.target.value) }))} min={5000} />
                <p className="text-xs text-muted-foreground mt-1">Максимальная сумма выплаты по всей цепочке</p>
              </div>
              <div>
                <Label>Назначить модератора</Label>
                <select
                  value={form.moderator_id}
                  onChange={e => setForm(f => ({ ...f, moderator_id: e.target.value }))}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                >
                  <option value="">— не назначен —</option>
                  {moderators.map(m => (
                    <option key={m.id} value={m.id}>{m.full_name || m.email || m.id.slice(0, 8)}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <Button variant="outline" className="flex-1" onClick={() => setShowForm(false)}>Отмена</Button>
              <Button className="flex-1 bg-primary" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Создать"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Список корневых программ */}
      <div className="space-y-4">
        {programs.length === 0 && (
          <div className="text-center py-16 text-muted-foreground bg-card border border-dashed border-border rounded-xl">
            <Shield className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Нет корневых программ</p>
            <p className="text-sm mt-1">Создайте первую программу с помощью кнопки выше</p>
          </div>
        )}
        {programs.map(prog => {
          const mod = getModerator(prog.assigned_moderator_id);
          const joinLink = `${baseUrl}/join/${prog.link_code}`;
          const formLink = `${baseUrl}/candidate/${prog.candidate_form_code}`;
          const isExpanded = selectedTree === prog.id;
          return (
            <div key={prog.id} className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="p-5">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-heading font-bold text-lg">{prog.title}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${prog.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {prog.is_active ? "Активна" : "Отключена"}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">Root</span>
                    </div>
                    <div className="text-xl font-bold text-accent mb-2">{(prog.reward_quota || 0).toLocaleString()} ₽</div>
                    {mod && (
                      <div className="text-sm text-muted-foreground flex items-center gap-1">
                        <Shield className="w-3.5 h-3.5" />
                        Модератор: <span className="font-medium text-foreground">{mod.full_name || mod.email}</span>
                      </div>
                    )}
                    <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><GitBranch className="w-3 h-3" />{prog.children_count || 0} подпрограмм</span>
                      <span className="flex items-center gap-1"><Users className="w-3 h-3" />{prog.candidates_count || 0} кандидатов</span>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => loadTree(prog.id)}>
                      <GitBranch className="w-4 h-4 mr-1" />{isExpanded ? "Скрыть" : "Дерево"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => toggleActive(prog)}>
                      <Power className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Ссылки */}
                <div className="mt-4 grid sm:grid-cols-2 gap-3">
                  <div className="bg-muted rounded-lg p-3">
                    <div className="text-xs font-medium text-muted-foreground mb-1">Партнёрская ссылка</div>
                    <div className="font-mono text-xs break-all text-foreground mb-2">{joinLink}</div>
                    <Button size="sm" variant="outline" className="w-full text-xs h-7" onClick={() => copyLink(joinLink)}>
                      <Copy className="w-3 h-3 mr-1" />Копировать
                    </Button>
                  </div>
                  <div className="bg-muted rounded-lg p-3">
                    <div className="text-xs font-medium text-muted-foreground mb-1">Ссылка на анкету кандидата</div>
                    <div className="font-mono text-xs break-all text-foreground mb-2">{formLink}</div>
                    <Button size="sm" variant="outline" className="w-full text-xs h-7" onClick={() => copyLink(formLink)}>
                      <Copy className="w-3 h-3 mr-1" />Копировать
                    </Button>
                  </div>
                </div>
              </div>

              {/* Дерево подпрограмм */}
              {isExpanded && (
                <div className="border-t border-border bg-muted/30 p-4">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Дерево программ</div>
                  {treeLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" />Загрузка...</div>
                  ) : treeData.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Дочерних программ нет</p>
                  ) : (
                    <div className="space-y-2">
                      {treeData.map(child => (
                        <div key={child.id} className="flex items-center gap-3 bg-card rounded-lg p-3 border border-border">
                          <div className="flex items-center gap-1 text-muted-foreground" style={{ paddingLeft: `${(child.depth || 0) * 16}px` }}>
                            <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">{child.title}</div>
                            <div className="text-xs text-muted-foreground">Глубина {child.depth} · {(child.reward_quota || 0).toLocaleString()} ₽</div>
                          </div>
                          <div className="text-xs text-muted-foreground shrink-0">
                            {child.candidates_count || 0} канд.
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
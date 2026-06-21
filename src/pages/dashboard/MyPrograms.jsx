/**
 * Портфель программ — основной раздел для multi-program участия.
 * Каждая программа — отдельный финансовый контур.
 * selectedProgramId хранится в sessionStorage для устойчивости.
 */
import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useProfile } from "@/lib/useProfile.jsx";
import { toast } from "@/components/ui/use-toast";
import {
  Loader2, GitBranch, Users, TrendingUp, CheckCircle, Clock,
  MapPin, Tag, Copy, Share2, Plus, X, AlertCircle, ChevronDown, ChevronUp, Info
} from "lucide-react";
import { validateQuota, canHaveChildren, createChildProgram, MIN_QUOTA, QUOTA_STEP, MAX_DIRECT_CHILDREN } from "@/lib/programUtils";

const SELECTED_KEY = "mp_selected_program_id";
const BASE_KEY = "mp_selected_base_program_id";

const isValidBase = (p) =>
  p &&
  p.is_active === true &&
  p.is_archived !== true &&
  p.program_status === "active" &&
  (p.depth || 0) === 0 &&
  p.program_kind !== "child";

const resolveBaseProgramId = (program, allPrograms) => {
  if (!program) return null;
  if (isValidBase(program)) return program.id;

  let current = program;
  const visited = new Set();

  while (current?.parent_program_id && !visited.has(current.id)) {
    visited.add(current.id);
    const parent = allPrograms.find(p => p.id === current.parent_program_id);
    if (!parent) return null;
    if (isValidBase(parent)) return parent.id;
    current = parent;
  }

  return null;
};

const STATUS_LABELS = { active: "Активна", frozen: "Заморожена", replaced: "Заменена", archived: "В архиве" };
const STATUS_COLORS = {
  active: "bg-green-100 text-green-700", frozen: "bg-blue-100 text-blue-700",
  replaced: "bg-amber-100 text-amber-700", archived: "bg-gray-100 text-gray-500",
};
const KIND_LABELS = { root: "Корневая", child: "Дочерняя", promoted_root: "Новый контур (повышение)" };

export default function MyPrograms() {
  const { profile } = useProfile();
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(() => sessionStorage.getItem(SELECTED_KEY) || null);
  const [expandedId, setExpandedId] = useState(null);
  const [childPrograms, setChildPrograms] = useState({});
  const [showChildForm, setShowChildForm] = useState(null);
  const [childForm, setChildForm] = useState({ title: "", reward_quota: "" });
  const [childFormError, setChildFormError] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    try {
      const progs = await base44.entities.ReferralProgram.filter({ owner_user_id: profile.id });
      const sorted = progs.sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
      setPrograms(sorted);
      // Если нет сохранённого или сохранённый не в списке — выбрать первый
      const savedId = sessionStorage.getItem(SELECTED_KEY);
      if (!savedId || !sorted.find(p => p.id === savedId)) {
        if (sorted.length > 0) {
          const prog = sorted[0];
          setSelectedId(prog.id);
          sessionStorage.setItem(SELECTED_KEY, prog.id);
          const baseId = resolveBaseProgramId(prog, sorted);
          if (baseId) {
            sessionStorage.setItem(BASE_KEY, baseId);
          } else {
            sessionStorage.removeItem(BASE_KEY);
          }
        }
      } else {
        // Синхронизировать BASE_KEY для сохранённого выбора
        const savedProg = sorted.find(p => p.id === savedId);
        if (savedProg) {
          const baseId = resolveBaseProgramId(savedProg, sorted);
          if (baseId) {
            sessionStorage.setItem(BASE_KEY, baseId);
          } else {
            sessionStorage.removeItem(BASE_KEY);
          }
        }
      }
    } catch {}
    setLoading(false);
  }, [profile?.id]);

  useEffect(() => { load(); }, [load]);

  const selectProgram = (id) => {
    const prog = programs.find(p => p.id === id) || null;

    setSelectedId(id);
    sessionStorage.setItem(SELECTED_KEY, id);

    const baseId = resolveBaseProgramId(prog, programs);
    if (baseId) {
      sessionStorage.setItem(BASE_KEY, baseId);
    } else {
      sessionStorage.removeItem(BASE_KEY);
    }

    base44.entities.ActionLog.create({
      actor_user_id: profile?.id,
      action_type: "PROGRAM_CONTEXT_SWITCHED",
      entity_type: "ReferralProgram",
      entity_id: id,
    }).catch(() => {});
  };

  const loadChildren = async (programId) => {
    const children = await base44.entities.ReferralProgram.filter({ parent_program_id: programId });
    setChildPrograms(prev => ({ ...prev, [programId]: children }));
  };

  const toggleExpand = (prog) => {
    if (expandedId === prog.id) { setExpandedId(null); return; }
    setExpandedId(prog.id);
    if (!childPrograms[prog.id]) loadChildren(prog.id);
  };

  const baseUrl = window.location.origin;
  const copyLink = (url, label) => {
    navigator.clipboard.writeText(url);
    toast({ title: `${label} скопирована!` });
  };

  const handleCreateChild = async (parentProgram) => {
    setChildFormError("");
    const quota = Number(childForm.reward_quota);
    const { valid, error } = validateQuota(quota, parentProgram.reward_quota);
    if (!valid) { setChildFormError(error); return; }
    if (!childForm.title.trim()) { setChildFormError("Введите название подпрограммы"); return; }
    if (!canHaveChildren(parentProgram)) {
      setChildFormError("Нельзя создать подпрограмму: лимит или мин. квота достигнуты");
      return;
    }
    setCreating(true);
    const { program: child, error: createError } = await createChildProgram({
      parentProgram, title: childForm.title.trim(), childQuota: quota,
      ownerUserId: profile.id, actorUserId: profile.id,
    });
    setCreating(false);
    if (createError) { setChildFormError(createError); return; }
    toast({ title: "Подпрограмма создана!" });
    setShowChildForm(null);
    setChildForm({ title: "", reward_quota: "" });
    load();
    loadChildren(parentProgram.id);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  const selectedProgram = programs.find(p => p.id === selectedId);
  const joinLink = selectedProgram ? `${baseUrl}/join/${selectedProgram.link_code}` : "";
  const candidateLink = selectedProgram ? `${baseUrl}/candidate/${selectedProgram.candidate_form_code}` : "";

  // Агрегаты по всем программам
  const totals = {
    candidates: programs.reduce((s, p) => s + (p.candidates_count || 0), 0),
    contracts: programs.reduce((s, p) => s + (p.contracts_count || 0), 0),
    pending: programs.reduce((s, p) => s + (p.pending_rewards_sum || 0), 0),
    paid: programs.reduce((s, p) => s + (p.paid_rewards_sum || 0), 0),
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-bold">Портфель программ</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Программ: <strong>{programs.length}</strong> · Каждая программа — отдельный финансовый контур
        </p>
      </div>

      {/* Агрегаты по всем программам */}
      {programs.length > 1 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { icon: Users, label: "Кандидатов (все)", value: totals.candidates, color: "text-blue-600" },
            { icon: CheckCircle, label: "Контрактов (все)", value: totals.contracts, color: "text-green-600" },
            { icon: Clock, label: "Ожидает выплаты", value: `${totals.pending.toLocaleString()} ₽`, color: "text-amber-600" },
            { icon: TrendingUp, label: "Выплачено (все)", value: `${totals.paid.toLocaleString()} ₽`, color: "text-primary" },
          ].map((s, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1"><s.icon className={`w-3.5 h-3.5 ${s.color}`} /><span className="text-xs text-muted-foreground">{s.label}</span></div>
              <div className="font-bold text-lg">{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {programs.length === 0 && (
        <div className="text-center py-16 bg-card border border-dashed border-border rounded-2xl text-muted-foreground">
          <GitBranch className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Программа не назначена</p>
          <p className="text-sm mt-1">Обратитесь к пригласившему вас партнёру или администратору</p>
        </div>
      )}

      {/* Карточки программ — выбор */}
      {programs.length > 0 && (
        <div className="mb-6">
          <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-3">Ваши программы — выберите для работы</div>
          <div className="grid sm:grid-cols-2 gap-3">
            {programs.map(prog => {
              const isSelected = prog.id === selectedId;
              const statusColor = STATUS_COLORS[prog.program_status || "active"];
              const kindLabel = KIND_LABELS[prog.program_kind] || prog.program_kind;
              return (
                <button key={prog.id} onClick={() => selectProgram(prog.id)}
                  className={`text-left p-4 rounded-2xl border-2 transition-all ${isSelected ? "border-primary bg-primary/5 shadow-md" : "border-border bg-card hover:border-primary/30"}`}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="font-heading font-bold text-base leading-tight">{prog.title}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${statusColor}`}>{STATUS_LABELS[prog.program_status || "active"]}</span>
                  </div>
                  <div className="text-xl font-bold text-accent mb-1">{(prog.reward_quota || 0).toLocaleString()} ₽</div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>{kindLabel}</span>
                    {prog.region_name && <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" />{prog.region_name}</span>}
                    <span>{prog.candidates_count || 0} кандидатов</span>
                    <span>{prog.direct_children_count || 0}/{MAX_DIRECT_CHILDREN} подпрограмм</span>
                  </div>
                  {isSelected && (
                    <div className="mt-2 text-xs text-primary font-medium">✓ Выбрана</div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Детали выбранной программы */}
      {selectedProgram && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-border">
            <div className="flex items-center justify-between gap-3 mb-1">
              <h2 className="font-heading font-bold text-lg">{selectedProgram.title}</h2>
              {(selectedProgram.owner_program_level || 0) >= 1 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                  ★ Уровень 1 с {selectedProgram.owner_level_achieved_at ? new Date(selectedProgram.owner_level_achieved_at).toLocaleDateString("ru-RU") : ""}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
              <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[selectedProgram.program_status || "active"]}`}>
                {STATUS_LABELS[selectedProgram.program_status || "active"]}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                {KIND_LABELS[selectedProgram.program_kind] || selectedProgram.program_kind}
              </span>
              {selectedProgram.region_name && (
                <span className="flex items-center gap-1 text-xs bg-muted px-2 py-0.5 rounded-full">
                  <MapPin className="w-3 h-3" />{selectedProgram.region_name}
                </span>
              )}
            </div>

            <div className="text-3xl font-bold text-accent mb-1">{(selectedProgram.reward_quota || 0).toLocaleString()} ₽</div>
            <div className="text-xs text-muted-foreground mb-1">Квота вознаграждения этого уровня</div>
            {selectedProgram.parent_reward_quota && (
              <div className="text-xs text-muted-foreground">
                Суммарная цепочка: {(selectedProgram.parent_reward_quota).toLocaleString()} ₽ ·
                Вышестоящим: {(selectedProgram.parent_reward_quota - selectedProgram.reward_quota).toLocaleString()} ₽
              </div>
            )}
            {(selectedProgram.owner_program_level || 0) === 0 && (
              <div className="mt-2 text-xs text-muted-foreground">
                Уровень в программе: 0 → достигните 1 после первого прямого подписанного контракта
              </div>
            )}
            {selectedProgram.ancestry_path_text && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                <Info className="w-3 h-3 shrink-0" />Путь: {selectedProgram.ancestry_path_text}
              </div>
            )}
            {selectedProgram.promotion_origin_program_id && (
              <div className="mt-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-1.5">
                🚀 Новый контур — создан при повышении. Старая ветка сохранена без изменений.
              </div>
            )}
          </div>

          {/* Ссылки */}
          <div className="p-5 border-b border-border">
            <div className="text-sm font-medium mb-3">Ссылки выбранной программы</div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="bg-muted rounded-xl p-3">
                <div className="text-xs font-medium text-muted-foreground mb-1">🔗 Партнёрская ссылка</div>
                <div className="text-xs font-mono break-all text-foreground mb-2 line-clamp-2">{joinLink}</div>
                <div className="flex gap-1.5">
                  <Button size="sm" variant="outline" className="flex-1 text-xs h-7" onClick={() => copyLink(joinLink, "Партнёрская ссылка")}>
                    <Copy className="w-3 h-3 mr-1" />Копировать
                  </Button>
                  <Button size="sm" className="flex-1 text-xs h-7 bg-primary" onClick={() => navigator.share?.({ url: joinLink }) || copyLink(joinLink, "Ссылка")}>
                    <Share2 className="w-3 h-3 mr-1" />Поделиться
                  </Button>
                </div>
              </div>
              <div className="bg-muted rounded-xl p-3">
                <div className="text-xs font-medium text-muted-foreground mb-1">📋 Ссылка анкеты кандидата</div>
                <div className="text-xs font-mono break-all text-foreground mb-2 line-clamp-2">{candidateLink}</div>
                <div className="flex gap-1.5">
                  <Button size="sm" variant="outline" className="flex-1 text-xs h-7" onClick={() => copyLink(candidateLink, "Ссылка анкеты")}>
                    <Copy className="w-3 h-3 mr-1" />Копировать
                  </Button>
                  <Button size="sm" className="flex-1 text-xs h-7 bg-accent text-accent-foreground" onClick={() => window.open(candidateLink, "_blank")}>
                    Открыть →
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Подпрограммы */}
          <div className="p-5">
            <button onClick={() => toggleExpand(selectedProgram)}
              className="w-full flex items-center justify-between text-sm font-medium mb-3">
              <span className="flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-primary" />
                Подпрограммы ({selectedProgram.direct_children_count || 0}/{MAX_DIRECT_CHILDREN})
              </span>
              {expandedId === selectedProgram.id ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </button>

            {expandedId === selectedProgram.id && (
              <div>
                {canHaveChildren(selectedProgram) && showChildForm !== selectedProgram.id && (
                  <Button size="sm" onClick={() => { setShowChildForm(selectedProgram.id); setChildForm({ title: "", reward_quota: "" }); setChildFormError(""); }}
                    className="bg-primary text-xs mb-3">
                    <Plus className="w-3.5 h-3.5 mr-1" />Создать подпрограмму
                  </Button>
                )}
                {!canHaveChildren(selectedProgram) && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {(selectedProgram.reward_quota || 0) <= MIN_QUOTA
                      ? `Квота ${MIN_QUOTA.toLocaleString()} ₽ — создание подпрограмм невозможно`
                      : selectedProgram.program_status !== "active"
                      ? `Программа ${STATUS_LABELS[selectedProgram.program_status]} — подпрограммы не создаются`
                      : `Достигнут лимит в ${MAX_DIRECT_CHILDREN} прямых подпрограмм`}
                  </div>
                )}

                {showChildForm === selectedProgram.id && (
                  <div className="bg-muted rounded-xl p-4 mb-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Новая подпрограмма</span>
                      <button onClick={() => setShowChildForm(null)}><X className="w-4 h-4 text-muted-foreground" /></button>
                    </div>
                    <div>
                      <Label className="text-xs">Название *</Label>
                      <Input value={childForm.title} onChange={e => setChildForm(f => ({ ...f, title: e.target.value }))} placeholder="Команда Иванова" className="h-8 text-sm mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs">Квота подпрограммы (₽) *</Label>
                      <Input type="number" value={childForm.reward_quota}
                        onChange={e => setChildForm(f => ({ ...f, reward_quota: e.target.value }))}
                        placeholder={`от ${MIN_QUOTA.toLocaleString()} до ${(selectedProgram.reward_quota - QUOTA_STEP).toLocaleString()}`}
                        min={MIN_QUOTA} step={QUOTA_STEP} max={selectedProgram.reward_quota - QUOTA_STEP} className="h-8 text-sm mt-1" />
                      <p className="text-xs text-muted-foreground mt-1">
                        Ваш остаток: <strong>{(selectedProgram.reward_quota - Number(childForm.reward_quota || 0)).toLocaleString()} ₽</strong>
                      </p>
                    </div>
                    {childFormError && <div className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">{childFormError}</div>}
                    <Button onClick={() => handleCreateChild(selectedProgram)} disabled={creating} className="w-full bg-primary text-sm h-9">
                      {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Создать подпрограмму"}
                    </Button>
                  </div>
                )}

                <div className="space-y-2">
                  {(childPrograms[selectedProgram.id] || []).length === 0 && !showChildForm && (
                    <div className="text-center py-4 text-muted-foreground text-sm">
                      <GitBranch className="w-5 h-5 mx-auto mb-1 opacity-30" />Подпрограмм нет
                    </div>
                  )}
                  {(childPrograms[selectedProgram.id] || []).map(child => (
                    <div key={child.id} className="border border-border rounded-xl p-3 text-sm">
                      <div className="font-medium">{child.title}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {(child.reward_quota || 0).toLocaleString()} ₽ · {child.candidates_count || 0} кандидатов · глубина {child.depth}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
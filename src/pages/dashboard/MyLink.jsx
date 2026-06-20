/**
 * Кабинет партнёра — Мои ссылки и программы.
 * Поддерживает несколько программ у одного пользователя.
 * Строгая валидация квот через validateQuota().
 */
import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { Copy, Share2, Loader2, QrCode, Plus, GitBranch, Users, ChevronDown, ChevronUp, X, AlertCircle, Info } from "lucide-react";
import { useProfile } from "@/lib/useProfile.jsx";
import { validateQuota, canHaveChildren, createChildProgram, MIN_QUOTA, MAX_DIRECT_CHILDREN, QUOTA_STEP } from "@/lib/programUtils";

export default function MyLink() {
  const { profile } = useProfile();
  const [programs, setPrograms] = useState([]); // все программы пользователя
  const [selectedProgramId, setSelectedProgramId] = useState(null);
  const [childPrograms, setChildPrograms] = useState({}); // { programId: [children] }
  const [loading, setLoading] = useState(true);
  const [showChildForm, setShowChildForm] = useState(null); // ID программы, для которой создаём child
  const [childForm, setChildForm] = useState({ title: "", reward_quota: "" });
  const [creating, setCreating] = useState(false);
  const [childFormError, setChildFormError] = useState("");
  const [expandedChild, setExpandedChild] = useState({});
  const [expandedProgram, setExpandedProgram] = useState({});

  const load = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    try {
      const progs = await base44.entities.ReferralProgram.filter({ owner_user_id: profile.id });
      const sorted = progs.sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
      setPrograms(sorted);
      if (sorted.length > 0 && !selectedProgramId) {
        setSelectedProgramId(sorted[0].id);
      }
    } catch {}
    setLoading(false);
  }, [profile?.id]);

  useEffect(() => { load(); }, [load]);

  const loadChildren = async (programId) => {
    const children = await base44.entities.ReferralProgram.filter({ parent_program_id: programId });
    setChildPrograms(prev => ({ ...prev, [programId]: children }));
  };

  const toggleProgram = async (prog) => {
    const id = prog.id;
    setExpandedProgram(prev => {
      const next = { ...prev, [id]: !prev[id] };
      if (next[id] && !childPrograms[id]) loadChildren(id);
      return next;
    });
  };

  const baseUrl = window.location.origin;

  const copyLink = (url, label = "Ссылка") => {
    navigator.clipboard.writeText(url);
    toast({ title: `${label} скопирована!` });
    base44.entities.ActionLog.create({
      actor_user_id: profile?.id,
      action_type: "PROGRAM_LINK_COPIED",
      entity_type: "ReferralProgram",
      action_payload: JSON.stringify({ url }),
    }).catch(() => {});
  };

  const handleCreateChild = async (parentProgram) => {
    setChildFormError("");
    const quota = Number(childForm.reward_quota);
    const { valid, error } = validateQuota(quota, parentProgram.reward_quota);
    if (!valid) { setChildFormError(error); return; }
    if (!childForm.title.trim()) { setChildFormError("Введите название подпрограммы"); return; }
    if (!canHaveChildren(parentProgram)) {
      setChildFormError(`Нельзя создать подпрограмму: мин. квота ${MIN_QUOTA.toLocaleString()} ₽ или лимит 10 программ достигнут`);
      return;
    }

    setCreating(true);
    const { program: child, error: createError } = await createChildProgram({
      parentProgram,
      title: childForm.title.trim(),
      childQuota: quota,
      ownerUserId: profile.id,
      actorUserId: profile.id,
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
  if (!profile) return <div className="text-center py-16 text-muted-foreground">Профиль не найден</div>;
  if (programs.length === 0) return (
    <div className="text-center py-16 text-muted-foreground">
      <GitBranch className="w-12 h-12 mx-auto mb-3 opacity-30" />
      <p className="font-medium">Программа не назначена</p>
      <p className="text-sm mt-1">Обратитесь к пригласившему вас партнёру или администратору</p>
    </div>
  );

  const selectedProgram = programs.find(p => p.id === selectedProgramId) || programs[0];

  const ProgramBlock = ({ prog }) => {
    const joinLink = `${baseUrl}/join/${prog.link_code}`;
    const candidateLink = `${baseUrl}/candidate/${prog.candidate_form_code}`;
    const isExpanded = expandedProgram[prog.id];
    const children = childPrograms[prog.id] || [];
    const canChild = canHaveChildren(prog);
    const isCreatingForThis = showChildForm === prog.id;
    const qrJoin = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(joinLink)}`;
    const qrCand = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(candidateLink)}`;

    return (
      <div className="bg-card border border-border rounded-2xl overflow-hidden mb-4">
        {/* Заголовок программы */}
        <div className="p-5">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="font-heading font-bold text-lg">{prog.title}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${prog.program_kind === "root" || prog.is_root ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                  {prog.is_root || prog.program_kind === "root" ? "Корневая" : `Глубина ветки: ${prog.depth}`}
                </span>
              </div>
              <div className="text-2xl font-bold text-accent">{(prog.reward_quota || 0).toLocaleString()} ₽</div>
              <div className="text-xs text-muted-foreground mt-0.5">Квота вознаграждения этого уровня</div>
              {prog.parent_reward_quota && (
                <div className="text-xs text-muted-foreground mt-1">
                  Из цепочки: {(prog.parent_reward_quota - prog.reward_quota).toLocaleString()} ₽ идёт выше · {(prog.parent_reward_quota).toLocaleString()} ₽ суммарно
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1 items-end">
              <span className="text-xs text-muted-foreground">{prog.direct_children_count || 0}/{MAX_DIRECT_CHILDREN} подпрограмм</span>
              <span className="text-xs text-muted-foreground">{prog.candidates_count || 0} кандидатов</span>
            </div>
          </div>

          {/* Ancestry path */}
          {prog.ancestry_path_text && (
            <div className="text-xs text-muted-foreground bg-muted rounded-lg px-3 py-2 mb-4 flex items-center gap-1">
              <Info className="w-3 h-3 shrink-0" />
              <span>Путь: {prog.ancestry_path_text}</span>
            </div>
          )}

          {/* Ссылки */}
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="bg-muted rounded-xl p-3">
              <div className="text-xs font-medium text-muted-foreground mb-1">🔗 Партнёрская ссылка</div>
              <div className="text-xs font-mono break-all text-foreground mb-2 line-clamp-2">{joinLink}</div>
              <div className="flex gap-1.5">
                <Button size="sm" variant="outline" className="flex-1 text-xs h-7" onClick={() => copyLink(joinLink, "Партнёрская ссылка")}>
                  <Copy className="w-3 h-3 mr-1" />Копировать
                </Button>
                <Button size="sm" className="flex-1 text-xs h-7 bg-primary" onClick={() => navigator.share?.({ url: joinLink }) || copyLink(joinLink)}>
                  <Share2 className="w-3 h-3 mr-1" />Поделиться
                </Button>
              </div>
              <img src={qrJoin} alt="QR" className="w-24 h-24 mx-auto mt-2 rounded-lg" onError={e => e.target.style.display = "none"} />
            </div>
            <div className="bg-muted rounded-xl p-3">
              <div className="text-xs font-medium text-muted-foreground mb-1">📋 Анкета кандидата</div>
              <div className="text-xs font-mono break-all text-foreground mb-2 line-clamp-2">{candidateLink}</div>
              <div className="flex gap-1.5">
                <Button size="sm" variant="outline" className="flex-1 text-xs h-7" onClick={() => copyLink(candidateLink, "Ссылка анкеты")}>
                  <Copy className="w-3 h-3 mr-1" />Копировать
                </Button>
                <Button size="sm" className="flex-1 text-xs h-7 bg-accent text-accent-foreground" onClick={() => window.open(candidateLink, "_blank")}>
                  Открыть →
                </Button>
              </div>
              <img src={qrCand} alt="QR" className="w-24 h-24 mx-auto mt-2 rounded-lg" onError={e => e.target.style.display = "none"} />
            </div>
          </div>
        </div>

        {/* Блок подпрограмм */}
        <div className="border-t border-border">
          <button onClick={() => toggleProgram(prog)} className="w-full flex items-center justify-between px-5 py-3 hover:bg-muted/50 transition-colors text-sm font-medium">
            <span className="flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-primary" />
              Подпрограммы ({prog.direct_children_count || 0}/{MAX_DIRECT_CHILDREN})
            </span>
            {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>

          {isExpanded && (
            <div className="px-5 pb-5">
              {/* Кнопка создания */}
              {canChild && !isCreatingForThis && (
                <Button size="sm" onClick={() => { setShowChildForm(prog.id); setChildForm({ title: "", reward_quota: "" }); setChildFormError(""); }}
                  className="bg-primary text-xs mb-3">
                  <Plus className="w-3.5 h-3.5 mr-1" />Создать подпрограмму
                </Button>
              )}
              {!canChild && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {(prog.reward_quota || 0) <= MIN_QUOTA ? `Квота ${MIN_QUOTA.toLocaleString()} ₽ — создание подпрограмм невозможно` : `Достигнут лимит в ${MAX_DIRECT_CHILDREN} прямых подпрограмм`}
                </div>
              )}

              {/* Форма создания подпрограммы */}
              {isCreatingForThis && (
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
                      placeholder={`от ${MIN_QUOTA.toLocaleString()} до ${(prog.reward_quota - QUOTA_STEP).toLocaleString()}, кратно ${QUOTA_STEP.toLocaleString()}`}
                      min={MIN_QUOTA} step={QUOTA_STEP} max={prog.reward_quota - QUOTA_STEP} className="h-8 text-sm mt-1" />
                    <p className="text-xs text-muted-foreground mt-1">
                      <strong>Квота подпрограммы</strong> — сумма, которую получит следующий уровень при успешном контракте по этой ветке.<br />
                      Ваш остаток: <strong>{(prog.reward_quota - Number(childForm.reward_quota || 0)).toLocaleString()} ₽</strong>
                    </p>
                  </div>
                  {childFormError && <div className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">{childFormError}</div>}
                  <Button onClick={() => handleCreateChild(prog)} disabled={creating} className="w-full bg-primary text-sm h-9">
                    {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Создать подпрограмму"}
                  </Button>
                </div>
              )}

              {/* Список дочерних */}
              {children.length === 0 && !isCreatingForThis && (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  <GitBranch className="w-6 h-6 mx-auto mb-2 opacity-30" />Подпрограмм нет
                </div>
              )}
              <div className="space-y-2">
                {children.map(child => {
                  const childJoin = `${baseUrl}/join/${child.link_code}`;
                  const childCand = `${baseUrl}/candidate/${child.candidate_form_code}`;
                  const isOpen = expandedChild[child.id];
                  return (
                    <div key={child.id} className="border border-border rounded-xl overflow-hidden">
                      <button onClick={() => setExpandedChild(prev => ({ ...prev, [child.id]: !prev[child.id] }))}
                        className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors text-left">
                        <div>
                          <div className="font-medium text-sm">{child.title}</div>
                          <div className="text-xs text-muted-foreground">{(child.reward_quota || 0).toLocaleString()} ₽ · {child.candidates_count || 0} кандидатов · глубина {child.depth}</div>
                        </div>
                        {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                      </button>
                      {isOpen && (
                        <div className="border-t border-border bg-muted/20 p-3 space-y-2">
                          <div>
                            <div className="text-xs text-muted-foreground mb-0.5">Партнёрская ссылка</div>
                            <div className="flex gap-1.5 items-center">
                              <code className="text-xs font-mono flex-1 bg-muted rounded px-2 py-1 break-all">{childJoin}</code>
                              <Button size="sm" variant="outline" className="h-7 text-xs shrink-0" onClick={() => copyLink(childJoin)}>
                                <Copy className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground mb-0.5">Ссылка анкеты кандидата</div>
                            <div className="flex gap-1.5 items-center">
                              <code className="text-xs font-mono flex-1 bg-muted rounded px-2 py-1 break-all">{childCand}</code>
                              <Button size="sm" variant="outline" className="h-7 text-xs shrink-0" onClick={() => copyLink(childCand)}>
                                <Copy className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-bold">Мои ссылки и программы</h1>
        <p className="text-sm text-muted-foreground mt-1">Ранг партнёра: <strong>{profile.level?.replace("_", " ") || "L0 novice"}</strong> · Всего программ: {programs.length}</p>
      </div>

      {/* Переключатель программ (если их несколько) */}
      {programs.length > 1 && (
        <div className="mb-4 flex gap-2 flex-wrap">
          {programs.map(p => (
            <button key={p.id} onClick={() => setSelectedProgramId(p.id)}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${selectedProgramId === p.id ? "border-primary bg-primary/10 text-primary font-medium" : "border-border text-muted-foreground hover:border-primary/40"}`}>
              {p.title}
            </button>
          ))}
        </div>
      )}

      {/* Блок выбранной программы */}
      {selectedProgram && <ProgramBlock prog={selectedProgram} />}

      {/* Остальные программы (если есть) */}
      {programs.length > 1 && programs.filter(p => p.id !== selectedProgram?.id).map(prog => (
        <details key={prog.id} className="mb-2">
          <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground px-1 py-2">
            {prog.title} — {(prog.reward_quota || 0).toLocaleString()} ₽
          </summary>
          <div className="mt-2"><ProgramBlock prog={prog} /></div>
        </details>
      ))}
    </div>
  );
}
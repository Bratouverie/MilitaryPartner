import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { Copy, Share2, Loader2, QrCode, Plus, GitBranch, Users, ChevronDown, ChevronUp, X, AlertCircle } from "lucide-react";
import { useProfile } from "@/lib/useProfile.jsx";
import { genUniqueLinkCode, genUniqueCandidateCode, MIN_CHILD_QUOTA } from "@/lib/programUtils";

export default function MyLink() {
  const { profile, loading } = useProfile();
  const [myProgram, setMyProgram] = useState(null);
  const [childPrograms, setChildPrograms] = useState([]);
  const [progLoading, setProgLoading] = useState(true);
  const [showChildForm, setShowChildForm] = useState(false);
  const [childForm, setChildForm] = useState({ title: "", reward_quota: "" });
  const [creating, setCreating] = useState(false);
  const [childFormError, setChildFormError] = useState("");
  const [expandedChild, setExpandedChild] = useState(null);

  const loadProgram = useCallback(async () => {
    if (!profile?.id) return;
    setProgLoading(true);
    try {
      const progs = await base44.entities.ReferralProgram.filter({ owner_user_id: profile.id, is_active: true });
      if (progs.length > 0) {
        const prog = progs[0];
        setMyProgram(prog);
        const children = await base44.entities.ReferralProgram.filter({ parent_program_id: prog.id });
        setChildPrograms(children);
      }
    } catch {}
    setProgLoading(false);
  }, [profile?.id]);

  useEffect(() => { loadProgram(); }, [loadProgram]);

  const baseUrl = window.location.origin;
  const joinLink = myProgram ? `${baseUrl}/join/${myProgram.link_code}` : "";
  const candidateLink = myProgram ? `${baseUrl}/candidate/${myProgram.candidate_form_code}` : "";

  const copyLink = (url, label = "Ссылка") => {
    navigator.clipboard.writeText(url);
    toast({ title: `${label} скопирована!` });
    base44.entities.ActionLog.create({
      actor_user_id: profile?.id,
      action_type: "PROGRAM_LINK_COPIED",
      entity_type: "ReferralProgram",
      entity_id: myProgram?.id,
      action_payload: JSON.stringify({ url }),
    }).catch(() => {});
  };

  const handleCreateChild = async () => {
    setChildFormError("");
    const quota = Number(childForm.reward_quota);
    if (!childForm.title) { setChildFormError("Введите название"); return; }
    if (!quota || quota < MIN_CHILD_QUOTA) { setChildFormError(`Минимальная квота — ${MIN_CHILD_QUOTA.toLocaleString()} ₽`); return; }
    if (quota >= (myProgram?.reward_quota || 0)) { setChildFormError(`Квота должна быть меньше вашей: ${(myProgram?.reward_quota || 0).toLocaleString()} ₽`); return; }

    setCreating(true);
    try {
      const linkCode = await genUniqueLinkCode();
      const formCode = await genUniqueCandidateCode();

      const child = await base44.entities.ReferralProgram.create({
        title: childForm.title,
        link_code: linkCode,
        candidate_form_code: formCode,
        owner_user_id: profile.id,
        parent_program_id: myProgram.id,
        root_program_id: myProgram.root_program_id || myProgram.id,
        root_master_link_id: myProgram.root_master_link_id,
        assigned_moderator_id: myProgram.assigned_moderator_id,
        reward_quota: quota,
        parent_reward_quota: myProgram.reward_quota,
        depth: (myProgram.depth || 0) + 1,
        is_root: false,
        is_active: true,
        can_create_child: quota > MIN_CHILD_QUOTA,
        children_count: 0,
        candidates_count: 0,
      });

      await base44.entities.ReferralProgram.update(myProgram.id, {
        children_count: (myProgram.children_count || 0) + 1,
      }).catch(() => {});

      await base44.entities.ActionLog.create({
        actor_user_id: profile.id,
        action_type: "CHILD_PROGRAM_CREATED",
        entity_type: "ReferralProgram",
        entity_id: child.id,
        action_payload: JSON.stringify({ parent_id: myProgram.id, reward_quota: quota }),
      }).catch(() => {});

      toast({ title: "Подпрограмма создана!" });
      setShowChildForm(false);
      setChildForm({ title: "", reward_quota: "" });
      loadProgram();
    } catch {
      setChildFormError("Ошибка при создании. Попробуйте ещё раз.");
    } finally {
      setCreating(false);
    }
  };

  const openCandidateLink = () => {
    base44.entities.ActionLog.create({
      actor_user_id: profile?.id,
      action_type: "CANDIDATE_FORM_LINK_OPENED",
      entity_type: "ReferralProgram",
      entity_id: myProgram?.id,
    }).catch(() => {});
    window.open(candidateLink, "_blank");
  };

  if (loading || progLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!profile) return <div className="text-center py-16 text-muted-foreground">Профиль не найден</div>;

  if (!myProgram) return (
    <div className="text-center py-16 text-muted-foreground">
      <GitBranch className="w-12 h-12 mx-auto mb-3 opacity-30" />
      <p className="font-medium">Программа не найдена</p>
      <p className="text-sm mt-1">Обратитесь к пригласившему вас партнёру или администратору</p>
    </div>
  );

  const canCreateChild = myProgram.can_create_child && (myProgram.reward_quota || 0) > MIN_CHILD_QUOTA;
  const qrJoinUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(joinLink)}`;
  const qrCandidateUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(candidateLink)}`;

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-bold">Мои ссылки</h1>
        <p className="text-sm text-muted-foreground mt-1">Программа: <strong>{myProgram.title}</strong> · Квота: <strong className="text-accent">{(myProgram.reward_quota || 0).toLocaleString()} ₽</strong> · Уровень: {myProgram.depth || 0}</p>
      </div>

      {/* Reward Split Preview */}
      {myProgram.parent_reward_quota && (
        <div className="mb-6 bg-primary/5 border border-primary/20 rounded-xl p-4">
          <div className="text-sm font-medium text-primary mb-2">Распределение вознаграждения</div>
          <div className="flex items-center gap-2 text-sm flex-wrap">
            <span className="bg-accent text-accent-foreground px-2 py-0.5 rounded font-bold">{(myProgram.reward_quota).toLocaleString()} ₽ — вам</span>
            <span className="text-muted-foreground">+</span>
            <span className="bg-muted px-2 py-0.5 rounded text-muted-foreground">{(myProgram.parent_reward_quota - myProgram.reward_quota).toLocaleString()} ₽ — выше по цепочке</span>
            <span className="text-muted-foreground">=</span>
            <span className="font-medium">{(myProgram.parent_reward_quota).toLocaleString()} ₽ всего</span>
          </div>
        </div>
      )}

      {/* Партнёрская ссылка */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="w-4 h-4 text-primary" />
            </div>
            <div>
              <div className="font-heading font-bold text-sm">Партнёрская ссылка</div>
              <div className="text-xs text-muted-foreground">Для приглашения новых партнёров</div>
            </div>
          </div>
          <div className="bg-muted rounded-lg p-3 font-mono text-xs break-all">{joinLink}</div>
          <div className="flex gap-2">
            <Button onClick={() => copyLink(joinLink, "Партнёрская ссылка")} variant="outline" className="flex-1 text-xs">
              <Copy className="w-3.5 h-3.5 mr-1" />Копировать
            </Button>
            <Button onClick={() => navigator.share?.({ url: joinLink }) || copyLink(joinLink, "Ссылка")} className="flex-1 bg-primary text-xs">
              <Share2 className="w-3.5 h-3.5 mr-1" />Поделиться
            </Button>
          </div>
          <img src={qrJoinUrl} alt="QR партнёрской ссылки" className="w-36 h-36 rounded-xl border border-border mx-auto" onError={e => e.target.style.display = "none"} />
        </div>

        {/* Ссылка анкеты кандидата */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
              <QrCode className="w-4 h-4 text-accent" />
            </div>
            <div>
              <div className="font-heading font-bold text-sm">Ссылка на анкету кандидата</div>
              <div className="text-xs text-muted-foreground">Для себя, друга или кандидата</div>
            </div>
          </div>
          <div className="bg-muted rounded-lg p-3 font-mono text-xs break-all">{candidateLink}</div>
          <div className="flex gap-2">
            <Button onClick={() => copyLink(candidateLink, "Ссылка анкеты")} variant="outline" className="flex-1 text-xs">
              <Copy className="w-3.5 h-3.5 mr-1" />Копировать
            </Button>
            <Button onClick={openCandidateLink} className="flex-1 bg-accent text-accent-foreground text-xs">
              Открыть анкету →
            </Button>
          </div>
          <img src={qrCandidateUrl} alt="QR анкеты кандидата" className="w-36 h-36 rounded-xl border border-border mx-auto" onError={e => e.target.style.display = "none"} />
        </div>
      </div>

      {/* Создание подпрограммы */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="font-heading font-bold">Подпрограммы</div>
            <div className="text-xs text-muted-foreground mt-0.5">Раздайте часть квоты своим партнёрам</div>
          </div>
          {canCreateChild && (
            <Button size="sm" onClick={() => setShowChildForm(v => !v)} className="bg-primary text-xs">
              <Plus className="w-3.5 h-3.5 mr-1" />Создать подпрограмму
            </Button>
          )}
          {!canCreateChild && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <AlertCircle className="w-3.5 h-3.5" />
              Минимальная квота достигнута
            </div>
          )}
        </div>

        {showChildForm && (
          <div className="bg-muted rounded-xl p-4 mb-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Новая подпрограмма</span>
              <button onClick={() => setShowChildForm(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
            </div>
            <div>
              <Label className="text-xs">Название</Label>
              <Input value={childForm.title} onChange={e => setChildForm(f => ({ ...f, title: e.target.value }))} placeholder="Команда Иванова" className="h-8 text-sm mt-1" />
            </div>
            <div>
              <Label className="text-xs">Квота для этого уровня (₽)</Label>
              <Input type="number" value={childForm.reward_quota} onChange={e => setChildForm(f => ({ ...f, reward_quota: e.target.value }))}
                placeholder={`от ${MIN_CHILD_QUOTA.toLocaleString()} до ${((myProgram?.reward_quota || 0) - 1).toLocaleString()}`}
                min={MIN_CHILD_QUOTA} max={(myProgram?.reward_quota || 0) - 1} className="h-8 text-sm mt-1" />
              <p className="text-xs text-muted-foreground mt-1">
                Ваша квота: <strong>{(myProgram.reward_quota || 0).toLocaleString()} ₽</strong>. Подпрограмма получит выбранную сумму, вы — разницу.
              </p>
            </div>
            {childFormError && <div className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">{childFormError}</div>}
            <Button onClick={handleCreateChild} disabled={creating} className="w-full bg-primary text-sm h-9">
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Создать подпрограмму"}
            </Button>
          </div>
        )}

        {/* Список дочерних программ */}
        {childPrograms.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            <GitBranch className="w-8 h-8 mx-auto mb-2 opacity-30" />
            Подпрограмм пока нет
          </div>
        ) : (
          <div className="space-y-3">
            {childPrograms.map(child => {
              const childJoin = `${baseUrl}/join/${child.link_code}`;
              const childForm2 = `${baseUrl}/candidate/${child.candidate_form_code}`;
              const isOpen = expandedChild === child.id;
              return (
                <div key={child.id} className="border border-border rounded-xl overflow-hidden">
                  <button onClick={() => setExpandedChild(isOpen ? null : child.id)}
                    className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors text-left">
                    <div>
                      <div className="font-medium text-sm">{child.title}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">Квота: {(child.reward_quota || 0).toLocaleString()} ₽ · {child.candidates_count || 0} кандидатов</div>
                    </div>
                    {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </button>
                  {isOpen && (
                    <div className="border-t border-border bg-muted/20 p-4 space-y-3">
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Партнёрская ссылка</div>
                        <div className="flex gap-2 items-center">
                          <code className="text-xs font-mono flex-1 bg-muted rounded px-2 py-1 break-all">{childJoin}</code>
                          <Button size="sm" variant="outline" className="h-7 text-xs shrink-0" onClick={() => copyLink(childJoin, "Ссылка")}>
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Ссылка анкеты</div>
                        <div className="flex gap-2 items-center">
                          <code className="text-xs font-mono flex-1 bg-muted rounded px-2 py-1 break-all">{childForm2}</code>
                          <Button size="sm" variant="outline" className="h-7 text-xs shrink-0" onClick={() => copyLink(childForm2, "Ссылка анкеты")}>
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
        )}
      </div>
    </div>
  );
}
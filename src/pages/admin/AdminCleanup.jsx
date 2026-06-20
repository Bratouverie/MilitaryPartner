/**
 * Утилита безопасной очистки тестовых / ошибочных сущностей.
 * Режим dry-run: только отчёт, без изменений.
 * Режим cleanup: архивирование/пометка, без жёсткого удаления там где есть аудит.
 */
import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, CheckCircle, Trash2, Eye } from "lucide-react";
import { useProfile } from "@/lib/useProfile.jsx";
import { toast } from "@/components/ui/use-toast";

export default function AdminCleanup() {
  const { profile } = useProfile();
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState(null);
  const [mode, setMode] = useState("dry_run");

  const run = async () => {
    setRunning(true);
    setReport(null);
    try {
      const [allPrograms, allCandidates, allMemberships] = await Promise.all([
        base44.entities.ReferralProgram.list(),
        base44.entities.CandidateApplication.list(),
        base44.entities.ProgramMembership.list(),
      ]);

      // --- Правила выявления проблемных программ ---
      const suspicious = allPrograms.filter(p => {
        const hasTestTitle =
          /вася|тест|test|demo|ветка партнёра/i.test(p.title) ||
          /ветка партнёра/i.test(p.title);
        const hasNoOwner = !p.owner_user_id;
        const hasInvalidAncestry = (() => {
          try {
            const ids = JSON.parse(p.ancestry_path_ids || "[]");
            if (ids.length === 0 && !p.is_root) return true;
            return false;
          } catch { return true; }
        })();
        const noCandidates = (p.candidates_count || 0) === 0;
        const isChildWithNullParent = !p.is_root && !p.parent_program_id;
        return hasTestTitle || hasNoOwner || hasInvalidAncestry || isChildWithNullParent;
      });

      // Кандидаты без source_program_id
      const orphanCandidates = allCandidates.filter(c => !c.source_program_id && !c.source_referrer_id);

      // Membership без корректных ссылок
      const orphanMemberships = allMemberships.filter(m => {
        const progExists = allPrograms.find(p => p.id === m.program_id);
        return !progExists;
      });

      const result = {
        suspicious_programs: suspicious.map(p => ({
          id: p.id, title: p.title, depth: p.depth, owner: p.owner_user_id,
          candidates_count: p.candidates_count, program_status: p.program_status,
          is_root: p.is_root, reason: [
            /ветка партнёра/i.test(p.title) && "test-title:ветка партнёра",
            /вася|тест|test|demo/i.test(p.title) && "test-title:match",
            !p.owner_user_id && "no-owner",
            (!p.is_root && !p.parent_program_id) && "child-no-parent",
          ].filter(Boolean).join(", ")
        })),
        orphan_candidates: orphanCandidates.map(c => ({ id: c.id, full_name: c.full_name, phone: c.phone })),
        orphan_memberships: orphanMemberships.map(m => ({ id: m.id, user_id: m.user_id, program_id: m.program_id })),
        total_programs: allPrograms.length,
        total_candidates: allCandidates.length,
      };

      if (mode === "cleanup") {
        let archived = 0;
        for (const p of suspicious) {
          // Не архивируем если уже архивирована или есть активные кандидаты > 0
          if (p.program_status === "archived") continue;
          if ((p.candidates_count || 0) > 0) {
            // Помечаем как frozen, не архивируем
            await base44.entities.ReferralProgram.update(p.id, {
              program_status: "frozen",
              is_active: false,
            }).catch(() => {});
          } else {
            await base44.entities.ReferralProgram.update(p.id, {
              program_status: "archived",
              is_active: false,
              is_archived: true,
              archived_at: new Date().toISOString(),
            }).catch(() => {});
          }
          archived++;
        }

        await base44.entities.ActionLog.create({
          actor_user_id: profile?.id,
          actor_role: "admin",
          action_type: "CLEANUP_EXECUTED",
          entity_type: "ReferralProgram",
          action_payload: JSON.stringify({
            archived_programs: archived,
            orphan_candidates: orphanCandidates.length,
            orphan_memberships: orphanMemberships.length,
            mode: "cleanup",
          }),
        }).catch(() => {});

        result.cleanup_done = true;
        result.archived_count = archived;
        toast({ title: `Очистка выполнена: ${archived} программ архивировано` });
      }

      setReport(result);
    } catch (e) {
      toast({ title: "Ошибка при анализе: " + e.message, variant: "destructive" });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="max-w-3xl">
      <h1 className="font-heading text-2xl font-bold mb-2">Очистка тестовых данных</h1>
      <p className="text-muted-foreground text-sm mb-6">
        Безопасная архивация ошибочно созданных программ и сущностей. Dry-run показывает отчёт без изменений.
      </p>

      <div className="flex gap-3 mb-6">
        <button onClick={() => setMode("dry_run")}
          className={`px-4 py-2 text-sm rounded-lg border transition-colors ${mode === "dry_run" ? "border-primary bg-primary/10 text-primary font-medium" : "border-border text-muted-foreground"}`}>
          <Eye className="w-4 h-4 inline mr-1.5" />Dry-run (только отчёт)
        </button>
        <button onClick={() => setMode("cleanup")}
          className={`px-4 py-2 text-sm rounded-lg border transition-colors ${mode === "cleanup" ? "border-destructive bg-destructive/10 text-destructive font-medium" : "border-border text-muted-foreground"}`}>
          <Trash2 className="w-4 h-4 inline mr-1.5" />Выполнить очистку
        </button>
      </div>

      {mode === "cleanup" && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 mb-4 text-sm text-destructive">
          <AlertTriangle className="w-4 h-4 inline mr-1.5" />
          <strong>Внимание!</strong> Будет выполнена реальная архивация/заморозка найденных сущностей. Программы с кандидатами будут только заморожены. Без кандидатов — архивированы.
        </div>
      )}

      <Button onClick={run} disabled={running} className={mode === "cleanup" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : "bg-primary"}>
        {running ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
        {mode === "dry_run" ? "Запустить анализ" : "Выполнить очистку"}
      </Button>

      {report && (
        <div className="mt-6 space-y-4">
          {report.cleanup_done && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-2 text-green-800">
              <CheckCircle className="w-5 h-5" />
              Очистка выполнена: архивировано {report.archived_count} программ
            </div>
          )}

          <div className="bg-card border border-border rounded-xl p-5">
            <div className="font-bold mb-2">Итог анализа</div>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div><div className="text-muted-foreground">Всего программ</div><div className="font-bold text-lg">{report.total_programs}</div></div>
              <div><div className="text-muted-foreground">Подозрительных</div><div className="font-bold text-lg text-destructive">{report.suspicious_programs.length}</div></div>
              <div><div className="text-muted-foreground">Кандидатов сирот</div><div className="font-bold text-lg text-amber-600">{report.orphan_candidates.length}</div></div>
            </div>
          </div>

          {report.suspicious_programs.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="font-bold mb-3">Подозрительные программы ({report.suspicious_programs.length})</div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {report.suspicious_programs.map(p => (
                  <div key={p.id} className="text-xs border border-border rounded-lg p-2.5">
                    <div className="font-medium">{p.title}</div>
                    <div className="text-muted-foreground mt-0.5">
                      depth:{p.depth} · кандидатов:{p.candidates_count} · статус:{p.program_status}
                    </div>
                    <div className="text-destructive mt-0.5">причина: {p.reason}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {report.orphan_memberships.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="font-bold mb-2">Осиротевшие ProgramMembership ({report.orphan_memberships.length})</div>
              <p className="text-sm text-muted-foreground">Ссылаются на несуществующие программы. Очистка вручную через базу.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
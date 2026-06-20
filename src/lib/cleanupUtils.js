/**
 * Утилита для безопасной очистки ошибочных сущностей.
 * Поддерживает dry-run режим и reconciliation.
 */
import { base44 } from "@/api/base44Client";

const ISSUE_TYPES = {
  INVALID_DEPTH: "invalid_depth",
  ORPHANED_PROGRAM: "orphaned_program",
  BROKEN_ANCESTRY: "broken_ancestry",
  TEST_DATA: "test_data",
  INVALID_QUOTA: "invalid_quota",
};

/**
 * Найти ошибочные сущности по критериям.
 */
export async function findProblematicPrograms() {
  const allPrograms = await base44.entities.ReferralProgram.list();
  const issues = [];

  for (const prog of allPrograms) {
    // Глубина должна быть 0 для root, 1+ для child
    if (!prog.is_root && prog.depth === 0) {
      issues.push({
        id: prog.id,
        title: prog.title,
        type: ISSUE_TYPES.INVALID_DEPTH,
        description: "Non-root программа имеет depth=0",
        severity: "high",
      });
    }

    // Root без owner должен быть исключением
    if (prog.is_root && !prog.owner_user_id && !prog.assigned_moderator_id) {
      issues.push({
        id: prog.id,
        title: prog.title,
        type: ISSUE_TYPES.ORPHANED_PROGRAM,
        description: "Root программа без owner и модератора",
        severity: "high",
      });
    }

    // Проверка ancestry
    if (!prog.is_root && prog.parent_program_id) {
      try {
        const ancestors = JSON.parse(prog.ancestry_path_ids || "[]");
        if (!ancestors.includes(prog.parent_program_id)) {
          issues.push({
            id: prog.id,
            title: prog.title,
            type: ISSUE_TYPES.BROKEN_ANCESTRY,
            description: "Parent не входит в ancestry chain",
            severity: "medium",
          });
        }
      } catch {
        issues.push({
          id: prog.id,
          title: prog.title,
          type: ISSUE_TYPES.BROKEN_ANCESTRY,
          description: "Невозможно распарсить ancestry_path_ids",
          severity: "high",
        });
      }
    }

    // Глубокие программы 4+ уровня (обычно ошибка)
    if (prog.depth && prog.depth >= 4) {
      issues.push({
        id: prog.id,
        title: prog.title,
        type: "deep_nesting",
        description: `Глубокая вложенность (depth=${prog.depth}), обычно это ошибка`,
        severity: "medium",
      });
    }

    // Квота не кратна 5000
    if ((prog.reward_quota || 0) % 5000 !== 0) {
      issues.push({
        id: prog.id,
        title: prog.title,
        type: ISSUE_TYPES.INVALID_QUOTA,
        description: `Квота ${prog.reward_quota} не кратна 5000`,
        severity: "high",
      });
    }
  }

  return issues;
}

/**
 * Получить orphaned сущности (candidates, rewards, memberships без программы).
 */
export async function findOrphanedRecords() {
  const orphans = { candidates: [], rewards: [], memberships: [] };

  try {
    const [candidates, programs] = await Promise.all([
      base44.entities.CandidateApplication.list(),
      base44.entities.ReferralProgram.list(),
    ]);

    const programIds = new Set(programs.map(p => p.id));
    orphans.candidates = candidates.filter(c => !programIds.has(c.source_program_id));
  } catch {}

  return orphans;
}

/**
 * Dry-run: показать что будет удалено/архивировано.
 */
export async function dryRunCleanup(issuesToFix) {
  const plan = {
    toArchive: [],
    toDelete: [],
    skip: [],
  };

  for (const issue of issuesToFix) {
    if (
      issue.type === ISSUE_TYPES.INVALID_DEPTH ||
      issue.type === ISSUE_TYPES.ORPHANED_PROGRAM ||
      issue.type === ISSUE_TYPES.BROKEN_ANCESTRY ||
      issue.type === "deep_nesting"
    ) {
      // Проверяем есть ли children
      const children = await base44.entities.ReferralProgram.filter({
        parent_program_id: issue.id,
      }).catch(() => []);

      if (children.length === 0) {
        plan.toDelete.push(issue);
      } else {
        plan.toArchive.push(issue);
      }
    } else {
      plan.skip.push(issue);
    }
  }

  return plan;
}

/**
 * Выполнить cleanup (если dryRun=false).
 */
export async function executeCleanup(plan, dryRun = true, actorUserId = null) {
  const report = {
    archived: 0,
    deleted: 0,
    skipped: 0,
    errors: [],
  };

  if (dryRun) {
    report.dryRun = true;
    return report;
  }

  // Архивирование
  for (const issue of plan.toArchive || []) {
    try {
      await base44.entities.ReferralProgram.update(issue.id, {
        is_archived: true,
        program_status: "archived",
        archived_at: new Date().toISOString(),
      });
      if (actorUserId) {
        await base44.entities.ActionLog.create({
          actor_user_id: actorUserId,
          action_type: "PROGRAM_ARCHIVED_CLEANUP",
          entity_type: "ReferralProgram",
          entity_id: issue.id,
          action_payload: JSON.stringify({ issue_type: issue.type, reason: issue.description }),
        }).catch(() => {});
      }
      report.archived++;
    } catch (e) {
      report.errors.push({ id: issue.id, error: e.message });
    }
  }

  // Удаление (только если нет children и это не root)
  for (const issue of plan.toDelete || []) {
    try {
      const prog = await base44.entities.ReferralProgram.filter({ id: issue.id }).then(r => r[0]);
      if (!prog || prog.is_root) {
        report.skipped++;
        continue;
      }

      await base44.entities.ReferralProgram.delete(issue.id);
      if (actorUserId) {
        await base44.entities.ActionLog.create({
          actor_user_id: actorUserId,
          action_type: "PROGRAM_DELETED_CLEANUP",
          entity_type: "ReferralProgram",
          entity_id: issue.id,
          action_payload: JSON.stringify({ issue_type: issue.type, reason: issue.description }),
        }).catch(() => {});
      }
      report.deleted++;
    } catch (e) {
      report.errors.push({ id: issue.id, error: e.message });
    }
  }

  return report;
}
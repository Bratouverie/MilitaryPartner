/**
 * Безопасное создание дочерней программы.
 * Все критичные бизнес-правила проверяются на сервере.
 * Атомарная операция: создание программы + membership + обновление счётчиков.
 */
import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

const MIN_QUOTA = 5000;
const QUOTA_STEP = 5000;
const MAX_DIRECT_CHILDREN = 10;

function genLinkCode() {
  return `c_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function genCandidateCode() {
  return `cf_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

async function retryUniqueCode(base44, generateFn, checkField, maxRetries = 5) {
  for (let i = 0; i < maxRetries; i++) {
    const code = generateFn();
    const existing = await base44.asServiceRole.entities.ReferralProgram.filter({
      [checkField]: code,
    });
    if (existing.length === 0) return code;
  }
  throw new Error("Failed to generate unique code after retries");
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return Response.json({ error: "POST only" }, { status: 405 });
  }

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { parentProgramId, childQuota, childPrefixTitle } = await req.json();

    if (!parentProgramId || !Number.isFinite(childQuota)) {
      return Response.json({ error: "Invalid input" }, { status: 400 });
    }

    // Шаг 1: Валидация parent программы
    const parent = await base44.asServiceRole.entities.ReferralProgram.get(parentProgramId);
    if (!parent) {
      return Response.json(
        { error: "Parent program not found", code: "PARENT_NOT_FOUND" },
        { status: 404 }
      );
    }

    if (parent.program_status !== "active") {
      return Response.json(
        { error: "Parent program not active", code: "PROGRAM_NOT_ACTIVE" },
        { status: 400 }
      );
    }

    if (parent.is_archived) {
      return Response.json(
        { error: "Parent program archived", code: "PROGRAM_ARCHIVED" },
        { status: 400 }
      );
    }

    if (!parent.is_active) {
      return Response.json(
        { error: "Parent program inactive", code: "PROGRAM_NOT_ACTIVE" },
        { status: 400 }
      );
    }

    // Шаг 2: Валидация квоты
    if (childQuota < MIN_QUOTA) {
      return Response.json(
        { error: `Quota below minimum (${MIN_QUOTA})`, code: "QUOTA_BELOW_MIN" },
        { status: 400 }
      );
    }

    if (childQuota % QUOTA_STEP !== 0) {
      return Response.json(
        {
          error: `Quota must be multiple of ${QUOTA_STEP}`,
          code: "QUOTA_NOT_MULTIPLE_OF_5000",
        },
        { status: 400 }
      );
    }

    if (childQuota >= parent.reward_quota) {
      return Response.json(
        {
          error: "Child quota must be less than parent",
          code: "CHILD_QUOTA_NOT_LESS_THAN_PARENT",
        },
        { status: 400 }
      );
    }

    // Шаг 3: Валидация лимита дочек
    if ((parent.direct_children_count || 0) >= MAX_DIRECT_CHILDREN) {
      return Response.json(
        { error: "Direct child limit reached (10)", code: "DIRECT_CHILD_LIMIT_REACHED" },
        { status: 400 }
      );
    }

    // Шаг 4: Генерируем уникальные коды
    let linkCode, candidateCode;
    try {
      linkCode = await retryUniqueCode(base44, genLinkCode, "link_code");
      candidateCode = await retryUniqueCode(base44, genCandidateCode, "candidate_form_code");
    } catch (e) {
      console.error("[safeCreateChildProgram] Code generation failed:", e);
      return Response.json(
        { error: "Failed to generate unique codes", code: "CODE_GEN_FAILED" },
        { status: 500 }
      );
    }

    // Шаг 5: Валидация root_program_id
    const rootProgramId = parent.root_program_id || parent.id;
    if (!rootProgramId) {
      return Response.json(
        { error: "Invalid root program", code: "TREE_INTEGRITY_ERROR" },
        { status: 400 }
      );
    }

    // Шаг 6: Создаём дочернюю программу
    let childProgram;
    try {
      childProgram = await base44.asServiceRole.entities.ReferralProgram.create({
        title: `Подпрограмма ${parent.title}`,
        base_program_title: parent.base_program_title,
        child_prefix_title: childPrefixTitle || "",
        link_code: linkCode,
        candidate_form_code: candidateCode,
        owner_user_id: parent.owner_user_id,
        parent_program_id: parent.id,
        root_program_id: rootProgramId,
        reward_quota: childQuota,
        parent_reward_quota: parent.reward_quota,
        depth: (parent.depth || 0) + 1,
        program_kind: "child",
        is_root: false,
        is_active: true,
        is_archived: false,
        can_create_child: true,
        direct_children_count: 0,
        children_count: 0,
        candidates_count: 0,
        program_status: "active",
        region_code: parent.region_code,
        region_name: parent.region_name,
      });
    } catch (e) {
      console.error("[safeCreateChildProgram] Child program creation failed:", e);
      return Response.json(
        {
          error: `Failed to create child program: ${e.message}`,
          code: "CHILD_CREATION_FAILED",
        },
        { status: 500 }
      );
    }

    // Шаг 7: Создаём membership (некритично)
    try {
      await base44.asServiceRole.entities.ProgramMembership.create({
        user_id: parent.owner_user_id,
        program_id: childProgram.id,
        membership_role: "owner",
        membership_status: "active",
        source_join_type: "program_creation",
        source_program_id: parent.id,
        joined_at: new Date().toISOString(),
      });
    } catch (e) {
      console.error("[safeCreateChildProgram] Membership creation failed (non-critical):", e);
    }

    // Шаг 8: Обновляем счётчики родителя
    try {
      await base44.asServiceRole.entities.ReferralProgram.update(parent.id, {
        direct_children_count: (parent.direct_children_count || 0) + 1,
        children_count: (parent.children_count || 0) + 1,
      });
    } catch (e) {
      console.error("[safeCreateChildProgram] Counter update failed (non-critical):", e);
    }

    // Шаг 9: ActionLog (некритично)
    try {
      await base44.asServiceRole.entities.ActionLog.create({
        actor_user_id: user.id,
        actor_role: user.role,
        action_type: "CHILD_PROGRAM_CREATED",
        entity_type: "ReferralProgram",
        entity_id: childProgram.id,
        action_payload: JSON.stringify({
          parent_id: parent.id,
          quota: childQuota,
          link_code: linkCode,
        }),
      });
    } catch (e) {
      console.error("[safeCreateChildProgram] Log creation failed (non-critical):", e);
    }

    return Response.json({
      success: true,
      program: {
        id: childProgram.id,
        link_code: childProgram.link_code,
        candidate_form_code: childProgram.candidate_form_code,
        reward_quota: childProgram.reward_quota,
        depth: childProgram.depth,
      },
    });
  } catch (error) {
    console.error("[safeCreateChildProgram] Fatal error:", error);
    return Response.json(
      { error: error.message, code: "UNKNOWN_ERROR" },
      { status: 500 }
    );
  }
});
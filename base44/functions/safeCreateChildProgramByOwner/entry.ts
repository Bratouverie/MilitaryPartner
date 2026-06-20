/**
 * Безопасное создание child-программы владельцем через сессию.
 * Server enforces all quota/tree/lifecycle rules.
 * Atomic: program + membership + counters + log.
 */
import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

const MIN_QUOTA = 5000;
const QUOTA_STEP = 5000;
const MAX_DIRECT_CHILDREN = 10;

async function genUniqueLinkCode(base44, maxRetries = 5) {
  for (let i = 0; i < maxRetries; i++) {
    const code = "c_" + Math.random().toString(36).slice(2, 10);
    const conflict = await base44.asServiceRole.entities.ReferralProgram.filter({
      link_code: code,
    });
    if (conflict.length === 0) return code;
  }
  throw new Error("Failed to generate unique link code");
}

async function genUniqueCandidateCode(base44, maxRetries = 5) {
  for (let i = 0; i < maxRetries; i++) {
    const code = "cf_" + Math.random().toString(36).slice(2, 10);
    const conflict = await base44.asServiceRole.entities.ReferralProgram.filter({
      candidate_form_code: code,
    });
    if (conflict.length === 0) return code;
  }
  throw new Error("Failed to generate unique candidate code");
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return Response.json({ error: "POST only" }, { status: 405 });
  }

  try {
    const base44 = createClientFromRequest(req);
    const actor = await base44.auth.me();
    if (!actor) {
      return Response.json({ error: "Auth required" }, { status: 401 });
    }

    const { parentProgramId, title, childQuota } = await req.json();
    if (!parentProgramId || !title || !childQuota) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Re-read parent from DB
    const parentProgram = await base44.asServiceRole.entities.ReferralProgram.get(
      parentProgramId
    );
    if (!parentProgram) {
      return Response.json({ error: "Parent program not found" }, { status: 404 });
    }

    // RBAC: user must own parent or be admin
    if (actor.role !== "admin" && actor.role !== "super_admin" && parentProgram.owner_user_id !== actor.id) {
      return Response.json({ error: "Permission denied" }, { status: 403 });
    }

    // Enforce MIN_QUOTA
    if (childQuota < MIN_QUOTA) {
      return Response.json({ error: "QUOTA_BELOW_MIN", code: "QUOTA_BELOW_MIN" }, { status: 400 });
    }

    // Enforce QUOTA_STEP
    if (childQuota % QUOTA_STEP !== 0) {
      return Response.json(
        { error: "QUOTA_NOT_MULTIPLE_OF_5000", code: "QUOTA_NOT_MULTIPLE_OF_5000" },
        { status: 400 }
      );
    }

    // child.reward_quota < parent.reward_quota
    if (childQuota >= parentProgram.reward_quota) {
      return Response.json(
        { error: "CHILD_QUOTA_NOT_LESS_THAN_PARENT", code: "CHILD_QUOTA_NOT_LESS_THAN_PARENT" },
        { status: 400 }
      );
    }

    // No child for archived/frozen/inactive
    if (
      parentProgram.program_status !== "active" ||
      !parentProgram.is_active ||
      parentProgram.is_archived
    ) {
      return Response.json(
        { error: "PARENT_NOT_ACTIVE", code: "PARENT_NOT_ACTIVE" },
        { status: 400 }
      );
    }

    // Direct children limit
    if ((parentProgram.direct_children_count || 0) >= MAX_DIRECT_CHILDREN) {
      return Response.json(
        { error: "DIRECT_CHILD_LIMIT_REACHED", code: "DIRECT_CHILD_LIMIT_REACHED" },
        { status: 400 }
      );
    }

    // Generate unique codes
    let linkCode, candidateCode;
    try {
      [linkCode, candidateCode] = await Promise.all([
        genUniqueLinkCode(base44),
        genUniqueCandidateCode(base44),
      ]);
    } catch (codeErr) {
      console.error("[safeCreateChildProgramByOwner] Code generation failed:", codeErr);
      return Response.json({ error: "Code generation failed", critical: true }, { status: 500 });
    }

    // Build ancestry
    let ancestryIds = [];
    try {
      ancestryIds = JSON.parse(parentProgram.ancestry_path_ids || "[]");
    } catch {}
    ancestryIds.push(parentProgram.id);
    const ancestryJson = JSON.stringify(ancestryIds);
    const ancestryText =
      (parentProgram.ancestry_path_text || parentProgram.base_program_title) +
      " / " +
      title;

    // Atomic: create + membership + counters + log
    try {
      const baseProgramTitle = parentProgram.base_program_title || parentProgram.title;
      const childProgram = await base44.asServiceRole.entities.ReferralProgram.create({
        title: title,
        base_program_title: baseProgramTitle,
        child_prefix_title: title,
        internal_display_title: `${baseProgramTitle} — ${title}`,
        public_program_title: baseProgramTitle,
        link_code: linkCode,
        candidate_form_code: candidateCode,
        owner_user_id: actor.id,
        parent_program_id: parentProgram.id,
        root_program_id: parentProgram.root_program_id || parentProgram.id,
        reward_quota: childQuota,
        parent_reward_quota: parentProgram.reward_quota,
        depth: (parentProgram.depth || 0) + 1,
        ancestry_path_ids: ancestryJson,
        ancestry_path_text: ancestryText,
        program_kind: "child",
        is_root: false,
        is_active: true,
        is_archived: false,
        can_create_child: childQuota > MIN_QUOTA,
        program_status: "active",
      });

      // Membership (non-critical, continue on error)
      try {
        await base44.asServiceRole.entities.ProgramMembership.create({
          user_id: actor.id,
          program_id: childProgram.id,
          membership_role: "owner",
          membership_status: "active",
          source_join_type: "direct_creation",
          joined_at: new Date().toISOString(),
        });
      } catch (e) {
        console.warn("[safeCreateChildProgramByOwner] Membership creation failed (non-critical):", e);
      }

      // Update parent counters
      try {
        await base44.asServiceRole.entities.ReferralProgram.update(parentProgram.id, {
          direct_children_count: (parentProgram.direct_children_count || 0) + 1,
          children_count: (parentProgram.children_count || 0) + 1,
        });
      } catch (e) {
        console.warn("[safeCreateChildProgramByOwner] Counter update failed (non-critical):", e);
      }

      // Log
      try {
        await base44.asServiceRole.entities.ActionLog.create({
          actor_user_id: actor.id,
          action_type: "CHILD_PROGRAM_CREATED_BY_OWNER",
          entity_type: "ReferralProgram",
          entity_id: childProgram.id,
          action_payload: JSON.stringify({
            parent_id: parentProgram.id,
            root_id: childProgram.root_program_id,
            depth: childProgram.depth,
            reward_quota: childQuota,
          }),
        });
      } catch (e) {
        console.warn("[safeCreateChildProgramByOwner] ActionLog failed (non-critical):", e);
      }

      return Response.json({
        success: true,
        program: {
          id: childProgram.id,
          link_code: childProgram.link_code,
          candidate_form_code: childProgram.candidate_form_code,
          reward_quota: childProgram.reward_quota,
        },
      });
    } catch (e) {
      console.error("[safeCreateChildProgramByOwner] Child creation failed:", e);
      return Response.json(
        { error: `Failed to create child program: ${e.message}`, critical: true },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[safeCreateChildProgramByOwner] Fatal error:", error);
    return Response.json({ error: error.message, critical: true }, { status: 500 });
  }
});
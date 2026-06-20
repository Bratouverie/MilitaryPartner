/**
 * Server-side validation для критичных бизнес-инвариантов ReferralProgram.
 * Всё, что может нарушить целостность системы, проверяется на сервере.
 */
import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

const MIN_QUOTA = 5000;
const QUOTA_STEP = 5000;
const MAX_DIRECT_CHILDREN = 10;

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return Response.json({ error: "POST only" }, { status: 405 });
  }

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { action, parentProgramId, childQuota, programId, newStatus } = await req.json();

    if (action === "validateChildQuota") {
      return await validateChildQuota(base44, parentProgramId, childQuota);
    }
    if (action === "validateCanCreateChild") {
      return await validateCanCreateChild(base44, parentProgramId);
    }
    if (action === "validateCanArchive") {
      return await validateCanArchive(base44, programId);
    }
    if (action === "validateCanReplace") {
      return await validateCanReplace(base44, programId);
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("[validateProgramRules]", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function validateChildQuota(base44, parentProgramId, childQuota) {
  if (!parentProgramId || !Number.isFinite(childQuota)) {
    return Response.json({ valid: false, reason: "Invalid input" }, { status: 400 });
  }

  const parent = await base44.asServiceRole.entities.ReferralProgram.get(parentProgramId);
  if (!parent) {
    return Response.json({ valid: false, reason: "Parent program not found" }, { status: 404 });
  }

  if (parent.program_status === "archived" || parent.program_status === "frozen" || !parent.is_active) {
    return Response.json({ valid: false, reason: "Parent program not active" }, { status: 400 });
  }

  if (childQuota < MIN_QUOTA) {
    return Response.json({ valid: false, reason: `Минимальная квота: ${MIN_QUOTA}` }, { status: 400 });
  }

  if (childQuota % QUOTA_STEP !== 0) {
    return Response.json({ valid: false, reason: "Quota must be multiple of 5000" }, { status: 400 });
  }

  if (childQuota >= parent.reward_quota) {
    return Response.json({ valid: false, reason: "Child quota must be less than parent" }, { status: 400 });
  }

  return Response.json({ valid: true, parentQuota: parent.reward_quota });
}

async function validateCanCreateChild(base44, parentProgramId) {
  const parent = await base44.asServiceRole.entities.ReferralProgram.get(parentProgramId);
  if (!parent) {
    return Response.json({ valid: false, reason: "Parent not found" }, { status: 404 });
  }

  if (!parent.can_create_child) {
    return Response.json({ valid: false, reason: "Parent forbids children" }, { status: 400 });
  }

  if ((parent.direct_children_count || 0) >= MAX_DIRECT_CHILDREN) {
    return Response.json({ valid: false, reason: "Max children limit reached" }, { status: 400 });
  }

  if (parent.program_status === "archived" || parent.program_status === "frozen" || !parent.is_active) {
    return Response.json({ valid: false, reason: "Parent not active" }, { status: 400 });
  }

  return Response.json({ valid: true });
}

async function validateCanArchive(base44, programId) {
  const prog = await base44.asServiceRole.entities.ReferralProgram.get(programId);
  if (!prog) {
    return Response.json({ valid: false, reason: "Program not found" }, { status: 404 });
  }

  if (prog.program_status === "archived") {
    return Response.json({ valid: false, reason: "Already archived" }, { status: 400 });
  }

  // Проверяем, нет ли активных дочек
  const children = await base44.asServiceRole.entities.ReferralProgram.filter({
    parent_program_id: programId,
    is_archived: false,
  });
  if (children.length > 0) {
    return Response.json({ valid: false, reason: "Cannot archive parent with active children" }, { status: 400 });
  }

  return Response.json({ valid: true });
}

async function validateCanReplace(base44, programId) {
  const prog = await base44.asServiceRole.entities.ReferralProgram.get(programId);
  if (!prog) {
    return Response.json({ valid: false, reason: "Program not found" }, { status: 404 });
  }

  if (prog.program_status === "replaced") {
    return Response.json({ valid: false, reason: "Already replaced" }, { status: 400 });
  }

  return Response.json({ valid: true });
}
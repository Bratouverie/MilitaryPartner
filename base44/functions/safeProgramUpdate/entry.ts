/**
 * Безопасное обновление программы.
 * Гарантирует что обновляются только разрешённые поля,
 * все действия логируются, lifecycle transitions валидны.
 */
import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return Response.json({ error: "POST only" }, { status: 405 });
  }

  try {
    const base44 = createClientFromRequest(req);
    const actor = await base44.auth.me();
    if (!actor || (actor.role !== "admin" && actor.role !== "super_admin")) {
      return Response.json({ error: "Admin required" }, { status: 403 });
    }

    const { programId, action, newValue, reason } = await req.json();

    if (!programId || !action) {
      return Response.json({ error: "Missing programId or action" }, { status: 400 });
    }

    const prog = await base44.asServiceRole.entities.ReferralProgram.get(programId);
    if (!prog) {
      return Response.json({ error: "Program not found" }, { status: 404 });
    }

    // ACTION 1: Assign moderator
    if (action === "assignModerator") {
      const moderatorId = newValue;
      if (!moderatorId) {
        return Response.json({ error: "moderatorId required" }, { status: 400 });
      }

      // Проверяем что это moderator
      const moderator = await base44.asServiceRole.entities.ReferralProfile.get(moderatorId);
      if (!moderator || moderator.role !== "moderator") {
        return Response.json({ error: "Invalid moderator" }, { status: 400 });
      }

      // Обновляем программу
      try {
        await base44.asServiceRole.entities.ReferralProgram.update(programId, {
          assigned_moderator_id: moderatorId,
        });
      } catch (e) {
        console.error("[safeProgramUpdate] Program update failed:", e);
        return Response.json(
          { error: `Failed to assign moderator: ${e.message}`, critical: true },
          { status: 500 }
        );
      }

      // Логируем
      try {
        await base44.asServiceRole.entities.ActionLog.create({
          actor_user_id: actor.id,
          actor_role: actor.role,
          action_type: "MODERATOR_ASSIGNED",
          entity_type: "ReferralProgram",
          entity_id: programId,
          action_payload: JSON.stringify({
            moderator_id: moderatorId,
            reason: reason || null,
          }),
        });
      } catch (e) {
        console.warn("[safeProgramUpdate] ActionLog failed (non-critical):", e);
      }

      return Response.json({ success: true });
    }

    // ACTION 2: Change lifecycle status
    if (action === "changeStatus") {
      const newStatus = newValue; // "active", "frozen", "replaced", "archived"
      const currentStatus = prog.program_status;

      // Валидируем переход
      const validTransitions = {
        active: ["frozen", "archived", "replaced"],
        frozen: ["active", "archived"],
        replaced: [],
        archived: [],
      };

      if (!validTransitions[currentStatus] || !validTransitions[currentStatus].includes(newStatus)) {
        return Response.json(
          {
            error: `Cannot transition from ${currentStatus} to ${newStatus}`,
            code: "INVALID_TRANSITION",
          },
          { status: 400 }
        );
      }

      // Спецпроверки
      if (newStatus === "archived") {
        // Проверяем что нет активных дочек
        const activeChildren = await base44.asServiceRole.entities.ReferralProgram.filter({
          parent_program_id: programId,
          is_archived: false,
        });
        if (activeChildren.length > 0) {
          return Response.json(
            {
              error: "Cannot archive program with active children",
              code: "CANNOT_ARCHIVE_WITH_CHILDREN",
            },
            { status: 400 }
          );
        }
      }

      if (newStatus === "replaced") {
        // Требуется replacement_program_id
        if (!prog.replacement_program_id) {
          return Response.json(
            {
              error: "Replacement requires replacement_program_id",
              code: "REPLACEMENT_ID_REQUIRED",
            },
            { status: 400 }
          );
        }
      }

      // Обновляем статус
      try {
        const updates = {
          program_status: newStatus,
        };

        if (newStatus === "archived") {
          updates.archived_at = new Date().toISOString();
          updates.is_archived = true;
        } else if (newStatus === "frozen") {
          updates.frozen_at = new Date().toISOString();
        } else if (newStatus === "replaced") {
          updates.replaced_at = new Date().toISOString();
        }

        await base44.asServiceRole.entities.ReferralProgram.update(programId, updates);
      } catch (e) {
        console.error("[safeProgramUpdate] Status update failed:", e);
        return Response.json(
          { error: `Failed to update status: ${e.message}`, critical: true },
          { status: 500 }
        );
      }

      // Логируем изменение
      try {
        await base44.asServiceRole.entities.ActionLog.create({
          actor_user_id: actor.id,
          actor_role: actor.role,
          action_type: "PROGRAM_STATUS_CHANGED",
          entity_type: "ReferralProgram",
          entity_id: programId,
          action_payload: JSON.stringify({
            old_status: currentStatus,
            new_status: newStatus,
            reason: reason || null,
          }),
        });
      } catch (e) {
        console.warn("[safeProgramUpdate] ActionLog failed (non-critical):", e);
      }

      return Response.json({ success: true });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("[safeProgramUpdate] Fatal error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
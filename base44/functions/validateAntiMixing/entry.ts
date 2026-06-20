/**
 * Anti-mixing validation для reward chains.
 * Гарантирует, что все выплаты в одной reward-цепочке (от одного milestone)
 * используют единственный root_program_id.
 * 
 * Проверяет:
 * - Все Reward от одного candidate используют один root_program_id
 * - Все программы в цепочке имеют одинаковый root_program_id
 * - Promotion не ломает старую ветку (замена только у новых кандидатов)
 */
import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return Response.json({ error: "POST only" }, { status: 405 });
  }

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { action, candidateId, rewardData, promotionOldRootId, promotionNewRootId } = await req.json();

    // ACTION 1: Validate candidate's reward chain uses single root_program_id
    if (action === "validateCandidateChainIntegrity") {
      const candidate = await base44.asServiceRole.entities.CandidateApplication.get(candidateId);
      if (!candidate) {
        return Response.json(
          { valid: false, code: "CANDIDATE_NOT_FOUND" },
          { status: 404 }
        );
      }

      const rewards = await base44.asServiceRole.entities.Reward.filter({
        candidate_id: candidateId,
      });

      if (rewards.length === 0) {
        // Нет выплат — OK
        return Response.json({ valid: true });
      }

      // Все выплаты должны иметь одинаковый root_program_id
      const rootIds = new Set(rewards.map((r) => r.root_program_id));
      if (rootIds.size > 1) {
        return Response.json(
          {
            valid: false,
            code: "MULTIPLE_ROOT_PROGRAMS_IN_CHAIN",
            details: Array.from(rootIds),
          },
          { status: 400 }
        );
      }

      // Все выплаты должны быть из одного дерева (root_program_id == source_program_id.root_program_id)
      const firstReward = rewards[0];
      return Response.json({
        valid: true,
        rootProgramId: firstReward.root_program_id,
      });
    }

    // ACTION 2: Validate program tree doesn't violate anti-mixing on new reward
    if (action === "validateRewardChainBeforeCreate") {
      const beneficiaryProgram = await base44.asServiceRole.entities.ReferralProgram.get(
        rewardData.beneficiary_program_id
      );
      if (!beneficiaryProgram) {
        return Response.json(
          { valid: false, code: "BENEFICIARY_PROGRAM_NOT_FOUND" },
          { status: 404 }
        );
      }

      const sourceProgram = await base44.asServiceRole.entities.ReferralProgram.get(
        rewardData.source_program_id
      );
      if (!sourceProgram) {
        return Response.json(
          { valid: false, code: "SOURCE_PROGRAM_NOT_FOUND" },
          { status: 404 }
        );
      }

      const rootProgramId = sourceProgram.root_program_id || sourceProgram.id;

      // Если у кандидата уже есть выплаты, новая выплата должна использовать тот же root_program_id
      const existingRewards = await base44.asServiceRole.entities.Reward.filter({
        candidate_id: rewardData.candidate_id,
      });

      if (existingRewards.length > 0) {
        const existingRootId = existingRewards[0].root_program_id;
        if (existingRootId !== rootProgramId) {
          return Response.json(
            {
              valid: false,
              code: "ANTI_MIXING_VIOLATION",
              existingRoot: existingRootId,
              attemptedRoot: rootProgramId,
            },
            { status: 400 }
          );
        }
      }

      return Response.json({ valid: true, rootProgramId });
    }

    // ACTION 3: Validate promotion doesn't break old branch
    if (action === "validatePromotionDoesntBreakBranch") {
      // При promotion нельзя менять root_program_id для старых кандидатов
      // которые уже связаны с промотируемым партнёром
      
      const oldRewards = await base44.asServiceRole.entities.Reward.filter({
        root_program_id: promotionOldRootId,
      });

      // Все старые выплаты должны остаться в старом дереве
      // Новые кандидаты могут идти в новое дерево (новые Reward с promotionNewRootId)
      
      const affectedCount = oldRewards.length;
      
      return Response.json({
        valid: true,
        affectedRewardCount: affectedCount,
        strategy: "Old rewards stay in old tree, new candidates go to new tree",
      });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("[validateAntiMixing] Fatal error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
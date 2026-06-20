/**
 * Утилиты для иерархической реферальной модели.
 */
import { base44 } from "@/api/base44Client";

export const MIN_CHILD_QUOTA = 5000;

export function genCode(len = 10) {
  const c = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: len }, () => c[Math.floor(Math.random() * c.length)]).join("");
}

/** Уникальный link_code для партнёрской ссылки */
export async function genUniqueLinkCode() {
  for (let i = 0; i < 5; i++) {
    const code = genCode(12);
    const ex = await base44.entities.ReferralProgram.filter({ link_code: code });
    if (ex.length === 0) return code;
  }
  return genCode(16);
}

/** Уникальный candidate_form_code для анкеты */
export async function genUniqueCandidateCode() {
  for (let i = 0; i < 5; i++) {
    const code = "cf-" + genCode(10);
    const ex = await base44.entities.ReferralProgram.filter({ candidate_form_code: code });
    if (ex.length === 0) return code;
  }
  return "cf-" + genCode(14);
}

/**
 * Строит цепочку программ от leaf к root.
 * Возвращает массив [leaf, ..., root].
 */
export async function buildProgramChain(programId) {
  const chain = [];
  let currentId = programId;
  const visited = new Set();
  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const programs = await base44.entities.ReferralProgram.filter({ id: currentId });
    if (programs.length === 0) break;
    const p = programs[0];
    chain.push(p);
    currentId = p.parent_program_id || null;
  }
  return chain;
}

/**
 * Вычисляет reward для каждого участника цепочки.
 * chain — массив от leaf к root.
 * Возвращает [{ program, amount }].
 *
 * Правило:
 * - leaf owner получает свою reward_quota
 * - каждый parent получает разницу (parent.quota - child.quota)
 * Сумма всегда = root.reward_quota
 */
export function calcRewardChain(chain) {
  if (!chain || chain.length === 0) return [];
  return chain.map((program, i) => {
    const child = chain[i - 1];
    const amount = i === 0 ? program.reward_quota : program.reward_quota - (child?.reward_quota || 0);
    return { program, amount };
  }).filter(r => r.amount > 0);
}

/**
 * Создаёт Reward-записи для всей цепочки по достижении milestone кандидатом.
 * Предотвращает дублирование для той же пары (candidate_id, reward_type).
 */
export async function createRewardChain({ candidateId, programId, rewardType = "contract_signed", actorUserId }) {
  const existing = await base44.entities.Reward.filter({ candidate_id: candidateId, reward_type: rewardType });
  if (existing.length > 0) return existing;

  const chain = await buildProgramChain(programId);
  if (chain.length === 0) return [];

  const allocation = calcRewardChain(chain);
  const rootProgram = chain[chain.length - 1];
  const created = [];

  for (let i = 0; i < allocation.length; i++) {
    const { program, amount } = allocation[i];
    const reward = await base44.entities.Reward.create({
      candidate_id: candidateId,
      beneficiary_user_id: program.owner_user_id,
      source_referrer_id: chain[0]?.owner_user_id,
      amount,
      reward_type: rewardType,
      status: "pending",
      admin_comment: `Уровень ${i} · Программа: ${program.title}`,
    });
    created.push(reward);
  }

  await base44.entities.ActionLog.create({
    actor_user_id: actorUserId || "system",
    action_type: "REWARD_CHAIN_CREATED",
    entity_type: "CandidateApplication",
    entity_id: candidateId,
    action_payload: JSON.stringify({
      program_id: programId,
      root_program_id: rootProgram.id,
      chain_length: chain.length,
      total_amount: allocation.reduce((s, a) => s + a.amount, 0),
      allocation: allocation.map(a => ({ program_id: a.program.id, amount: a.amount })),
    }),
  }).catch(() => {});

  return created;
}
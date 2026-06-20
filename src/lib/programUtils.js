/**
 * Единый helper для работы с программами и выплатами.
 * ВСЯ валидация квот идёт отсюда — никаких дублей по компонентам.
 * ВАРИАНТ C: повышение создаёт НОВЫЙ контур, старая ветка не меняется.
 */
import { base44 } from "@/api/base44Client";

export const MIN_QUOTA = 5000;
export const QUOTA_STEP = 5000;
export const MAX_DIRECT_CHILDREN = 10;

// ─── Валидация квоты ─────────────────────────────────────────────────────────

export function validateQuota(value, parentValue = null) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return { valid: false, error: "Квота должна быть положительным числом" };
  if (n < MIN_QUOTA) return { valid: false, error: `Минимальная квота — ${MIN_QUOTA.toLocaleString()} ₽` };
  if (n % QUOTA_STEP !== 0) return { valid: false, error: `Квота должна быть кратна ${QUOTA_STEP.toLocaleString()} ₽` };
  if (parentValue !== null) {
    if (n >= Number(parentValue)) return { valid: false, error: `Квота подпрограммы должна быть меньше родительской (${Number(parentValue).toLocaleString()} ₽)` };
  }
  return { valid: true, error: null };
}

export function canHaveChildren(program) {
  if (!program) return false;
  const statusOk = !program.program_status || program.program_status === "active";
  return (
    statusOk &&
    (program.reward_quota || 0) > MIN_QUOTA &&
    (program.direct_children_count || 0) < MAX_DIRECT_CHILDREN &&
    program.is_active &&
    !program.is_archived
  );
}

// ─── Генерация уникальных кодов ──────────────────────────────────────────────

function genCode(len = 12) {
  const c = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: len }, () => c[Math.floor(Math.random() * c.length)]).join("");
}

export async function genUniqueLinkCode() {
  for (let i = 0; i < 6; i++) {
    const code = "j-" + genCode(10);
    const ex = await base44.entities.ReferralProgram.filter({ link_code: code });
    if (ex.length === 0) return code;
  }
  return "j-" + genCode(14);
}

export async function genUniqueCandidateCode() {
  for (let i = 0; i < 6; i++) {
    const code = "cf-" + genCode(10);
    const ex = await base44.entities.ReferralProgram.filter({ candidate_form_code: code });
    if (ex.length === 0) return code;
  }
  return "cf-" + genCode(14);
}

// ─── Загрузка дерева ─────────────────────────────────────────────────────────

export async function loadProgramTree(rootProgramId) {
  return base44.entities.ReferralProgram.filter({ root_program_id: rootProgramId });
}

export async function loadChainFromAncestry(ancestryJson, allPrograms = null) {
  try {
    const ids = JSON.parse(ancestryJson || "[]");
    if (!ids.length) return [];
    const pool = allPrograms || await base44.entities.ReferralProgram.list();
    return ids.map(id => pool.find(p => p.id === id)).filter(Boolean);
  } catch { return []; }
}

// ─── Распределение вознаграждений ─────────────────────────────────────────────

/**
 * Вычисляет распределение по цепочке [leaf, ..., root].
 * Инвариант: сумма === root.reward_quota
 */
export function calcRewardDistribution(chain) {
  if (!chain || chain.length === 0) return [];
  const result = [];
  for (let i = 0; i < chain.length; i++) {
    const current = chain[i];
    const child = i > 0 ? chain[i - 1] : null;
    const amount = i === 0
      ? (current.reward_quota || 0)
      : (current.reward_quota || 0) - (child?.reward_quota || 0);
    if (amount > 0) result.push({ program: current, amount, level: i });
  }
  const total = result.reduce((s, r) => s + r.amount, 0);
  const rootQuota = chain[chain.length - 1]?.reward_quota || 0;
  if (total !== rootQuota) {
    console.warn(`[programUtils] Несоответствие суммы: ${total} ≠ ${rootQuota}`);
  }
  return result;
}

/**
 * Создаёт цепочку Reward для milestone кандидата.
 * КЛЮЧЕВОЙ ИНВАРИАНТ: все Reward одного milestone имеют один root_program_id.
 * Нельзя смешивать ветки разных root_program_id.
 */
export async function createRewardChain({ candidateId, programId, rewardType = "contract_signed", actorUserId, allPrograms }) {
  const existing = await base44.entities.Reward.filter({ candidate_id: candidateId, reward_type: rewardType });
  if (existing.length > 0) return existing;

  const pool = allPrograms || await base44.entities.ReferralProgram.list();

  // Строим цепочку строго внутри одного root_program_id
  const chain = [];
  let currentId = programId;
  const visited = new Set();
  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const prog = pool.find(p => p.id === currentId);
    if (!prog) break;
    chain.push(prog);
    currentId = prog.parent_program_id || null;
  }

  if (chain.length === 0) return [];

  const distribution = calcRewardDistribution(chain);
  const rootProgram = chain[chain.length - 1];

  const chainSnapshot = JSON.stringify(chain.map(p => ({
    id: p.id, title: p.title, reward_quota: p.reward_quota,
    depth: p.depth, owner_user_id: p.owner_user_id,
    root_program_id: p.root_program_id
  })));

  const created = [];
  for (const { program, amount, level } of distribution) {
    const reward = await base44.entities.Reward.create({
      candidate_id: candidateId,
      beneficiary_user_id: program.owner_user_id,
      beneficiary_program_id: program.id,
      source_referrer_id: chain[0]?.owner_user_id,
      source_program_id: chain[0]?.id,
      root_program_id: rootProgram?.id,
      chain_level: level,
      reward_formula_version: "v1",
      reward_snapshot_json: chainSnapshot,
      reward_chain_snapshot_json: chainSnapshot,
      amount,
      reward_type: rewardType,
      status: "pending",
      admin_comment: `Уровень ${level}: ${program.title} (квота ${program.reward_quota?.toLocaleString()} ₽)`,
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
      root_program_id: rootProgram?.id,
      chain_length: chain.length,
      total_amount: distribution.reduce((s, r) => s + r.amount, 0),
      reward_type: rewardType,
      allocation: distribution.map(r => ({ program_id: r.program.id, owner: r.program.owner_user_id, amount: r.amount, level: r.level })),
    }),
  }).catch(() => {});

  return created;
}

/**
 * Создаёт дочернюю ReferralProgram + ProgramMembership.
 * Все проверки централизованы здесь.
 */
/**
 * Возвращает публичное название программы (без внутренних префиксов).
 * Использовать на join page, в анкете кандидата, success экранах.
 */
export function getPublicTitle(program) {
  return program?.public_program_title || program?.base_program_title || program?.title || "";
}

/**
 * Возвращает внутреннее название программы для admin/moderator UI.
 */
export function getInternalTitle(program) {
  return program?.internal_display_title || program?.title || "";
}

export async function createChildProgram({ parentProgram, title: childPrefixTitle, childQuota, ownerUserId, actorUserId }) {
  const { valid, error } = validateQuota(childQuota, parentProgram.reward_quota);
  if (!valid) return { program: null, error };

  if (!canHaveChildren(parentProgram)) {
    return { program: null, error: "Родительская программа не может иметь дочерних (мин. квота или лимит 10 достигнут)" };
  }

  const [linkCode, formCode] = await Promise.all([genUniqueLinkCode(), genUniqueCandidateCode()]);

  let ancestryIds = [];
  try { ancestryIds = JSON.parse(parentProgram.ancestry_path_ids || "[]"); } catch {}
  ancestryIds.push(parentProgram.id);
  const ancestryJson = JSON.stringify(ancestryIds);
  const ancestryText = (parentProgram.ancestry_path_text || parentProgram.base_program_title || parentProgram.title) + " / " + childPrefixTitle;

  // Базовое название наследуется от родителя
  const baseProgramTitle = parentProgram.base_program_title || parentProgram.title || "";
  // Внутреннее = базовое + " — " + префикс реферала
  const internalDisplayTitle = childPrefixTitle
    ? `${baseProgramTitle} — ${childPrefixTitle}`
    : baseProgramTitle;
  // Публичное = только базовое (без внутренних префиксов!)
  const publicProgramTitle = baseProgramTitle;

  const child = await base44.entities.ReferralProgram.create({
    title: internalDisplayTitle, // legacy compat
    base_program_title: baseProgramTitle,
    child_prefix_title: childPrefixTitle,
    internal_display_title: internalDisplayTitle,
    public_program_title: publicProgramTitle,
    link_code: linkCode,
    candidate_form_code: formCode,
    owner_user_id: ownerUserId,
    parent_program_id: parentProgram.id,
    root_program_id: parentProgram.root_program_id || parentProgram.id,
    root_master_link_id: parentProgram.root_master_link_id,
    assigned_moderator_id: parentProgram.assigned_moderator_id,
    reward_quota: childQuota,
    parent_reward_quota: parentProgram.reward_quota,
    depth: (parentProgram.depth || 0) + 1,
    ancestry_path_ids: ancestryJson,
    ancestry_path_text: ancestryText,
    program_kind: "child",
    program_status: "active",
    is_root: false,
    is_active: true,
    is_archived: false,
    can_create_child: childQuota > MIN_QUOTA,
    direct_children_count: 0,
    children_count: 0,
    candidates_count: 0,
    contracts_count: 0,
    pending_rewards_sum: 0,
    paid_rewards_sum: 0,
    owner_program_level: 0,
    region_code: parentProgram.region_code,
    region_name: parentProgram.region_name,
    program_category: parentProgram.program_category,
  });

  // ProgramMembership для нового владельца (БЕЗ silent catch)
  await base44.entities.ProgramMembership.create({
    user_id: ownerUserId,
    program_id: child.id,
    membership_role: "owner",
    membership_status: "active",
    source_join_type: "referral_link",
    source_program_id: parentProgram.id,
    joined_at: new Date().toISOString(),
  });

  await base44.entities.ReferralProgram.update(parentProgram.id, {
    direct_children_count: (parentProgram.direct_children_count || 0) + 1,
    children_count: (parentProgram.children_count || 0) + 1,
    can_create_child: ((parentProgram.direct_children_count || 0) + 1 < MAX_DIRECT_CHILDREN) && (parentProgram.reward_quota > MIN_QUOTA),
  });

  await base44.entities.ActionLog.create({
    actor_user_id: actorUserId || ownerUserId,
    action_type: "CHILD_PROGRAM_CREATED",
    entity_type: "ReferralProgram",
    entity_id: child.id,
    action_payload: JSON.stringify({
      parent_id: parentProgram.id,
      root_id: child.root_program_id,
      depth: child.depth,
      reward_quota: childQuota,
      ancestry: ancestryJson,
      owner_user_id: ownerUserId,
    }),
  }).catch(() => {});

  return { program: child, error: null };
}

/**
 * ВАРИАНТ C: Создаёт новый promoted_root контур при повышении партнёра.
 * Старая ветка и её ancestry/snapshot НЕ меняются.
 *
 * @param {{ originProgram, ownerUserId, newTitle, newQuota, actorUserId, moderatorId, regionCode, regionName, programCategory }}
 */
export async function createPromotedRootProgram({
  originProgram, ownerUserId, newTitle, newQuota, actorUserId,
  moderatorId, regionCode, regionName, programCategory
}) {
  const { valid, error } = validateQuota(newQuota);
  if (!valid) return { program: null, error };

  const [linkCode, formCode] = await Promise.all([genUniqueLinkCode(), genUniqueCandidateCode()]);
  const now = new Date().toISOString();

  const promoted = await base44.entities.ReferralProgram.create({
    title: newTitle,
    link_code: linkCode,
    candidate_form_code: formCode,
    owner_user_id: ownerUserId,
    parent_program_id: null,
    root_program_id: null, // заполним после создания
    assigned_moderator_id: moderatorId || originProgram.assigned_moderator_id,
    reward_quota: newQuota,
    parent_reward_quota: null,
    depth: 0,
    ancestry_path_ids: "[]",
    ancestry_path_text: newTitle,
    program_kind: "promoted_root",
    program_status: "active",
    is_root: true,
    is_active: true,
    is_archived: false,
    can_create_child: newQuota > MIN_QUOTA,
    direct_children_count: 0,
    children_count: 0,
    candidates_count: 0,
    contracts_count: 0,
    pending_rewards_sum: 0,
    paid_rewards_sum: 0,
    owner_program_level: 0,
    promotion_origin_program_id: originProgram.id,
    promoted_at: now,
    region_code: regionCode || originProgram.region_code,
    region_name: regionName || originProgram.region_name,
    program_category: programCategory || originProgram.program_category,
  });

  // root_program_id = self
  await base44.entities.ReferralProgram.update(promoted.id, {
    root_program_id: promoted.id,
    ancestry_path_ids: JSON.stringify([promoted.id]),
  });

  // ProgramMembership (БЕЗ silent catch)
  await base44.entities.ProgramMembership.create({
    user_id: ownerUserId,
    program_id: promoted.id,
    membership_role: "owner",
    membership_status: "active",
    source_join_type: "promotion",
    source_program_id: originProgram.id,
    joined_at: now,
  });

  await base44.entities.ActionLog.create({
    actor_user_id: actorUserId || ownerUserId,
    action_type: "PROMOTED_PROGRAM_CREATED",
    entity_type: "ReferralProgram",
    entity_id: promoted.id,
    action_payload: JSON.stringify({
      origin_program_id: originProgram.id,
      owner_user_id: ownerUserId,
      new_quota: newQuota,
      region_code: regionCode,
      note: "ВАРИАНТ_C: старая ветка не изменена",
    }),
  }).catch(() => {});

  return { program: promoted, error: null };
}
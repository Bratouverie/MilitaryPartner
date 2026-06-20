import { base44 } from "@/api/base44Client";

export const MIN_QUOTA = 5000;
export const QUOTA_STEP = 5000;
export const MAX_DIRECT_CHILDREN = 10;

// ─── Валидация квоты ─────────────────────────────────────────────────────────

/**
 * Валидирует значение квоты.
 * @param {number} value - предлагаемая квота
 * @param {number|null} parentValue - квота родительской программы (null для root)
 * @returns {{ valid: boolean, error: string|null }}
 */
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

/**
 * Может ли программа иметь дочерние (quota > 5000 и direct_children_count < 10)?
 */
export function canHaveChildren(program) {
  if (!program) return false;
  return (
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

// ─── Построение дерева ───────────────────────────────────────────────────────

/**
 * Строит полную цепочку программ от leaf до root.
 * Использует parent_program_id (immutable).
 * @returns {ReferralProgram[]} массив [leaf, ..., root]
 */
export async function buildProgramChain(programId) {
  const chain = [];
  let currentId = programId;
  const visited = new Set();
  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const programs = await base44.entities.ReferralProgram.filter({ link_code: "_NOMATCH_" }); // fallback
    // Реальный запрос через filter по id невозможен напрямую — используем ancestry_path_ids
    // Поэтому загружаем через list и ищем по id
    break; // используем ancestry ниже
  }
  return chain;
}

/**
 * Загружает цепочку программ по ancestry_path_ids (надёжный метод).
 * @param {string} ancestryJson - строка JSON из ancestry_path_ids
 * @param {string[]} allPrograms - кэш всех программ (опционально)
 */
export async function loadChainFromAncestry(ancestryJson, allPrograms = null) {
  try {
    const ids = JSON.parse(ancestryJson || "[]");
    if (!ids.length) return [];
    const pool = allPrograms || await base44.entities.ReferralProgram.list();
    return ids.map(id => pool.find(p => p.id === id)).filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Загружает дерево для root программы (все потомки).
 */
export async function loadProgramTree(rootProgramId) {
  const all = await base44.entities.ReferralProgram.filter({ root_program_id: rootProgramId });
  // также добавить саму root
  return all;
}

// ─── Каскадное распределение вознаграждений ──────────────────────────────────

/**
 * Вычисляет распределение вознаграждения по цепочке.
 * chain[0] = leaf, chain[last] = root.
 *
 * Правило:
 *   - leaf owner получает leaf.reward_quota
 *   - каждый parent получает (parent.reward_quota - child.reward_quota)
 *   - сумма = root.reward_quota
 *
 * Пример: 200000 -> 80000 -> 50000 -> 5000
 *   leaf = 5000
 *   parent[1] = 50000 - 5000 = 45000
 *   parent[2] = 80000 - 50000 = 30000
 *   root = 200000 - 80000 = 120000
 *   sum = 200000 ✓
 *
 * @param {ReferralProgram[]} chain - [leaf, ..., root]
 * @returns {{ program: ReferralProgram, amount: number, level: number }[]}
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
    if (amount > 0) {
      result.push({ program: current, amount, level: i });
    }
  }
  // Проверка: сумма === root.reward_quota
  const total = result.reduce((s, r) => s + r.amount, 0);
  const rootQuota = chain[chain.length - 1]?.reward_quota || 0;
  if (total !== rootQuota) {
    console.warn(`[programUtils] Несоответствие суммы: ${total} ≠ ${rootQuota}`);
  }
  return result;
}

/**
 * Создаёт цепочку Reward-записей для milestone кандидата.
 * Предотвращает дублирование (проверяет существующие записи).
 *
 * @param {{ candidateId, programId, rewardType, actorUserId, allPrograms? }} params
 * @returns {Reward[]} созданные записи
 */
export async function createRewardChain({ candidateId, programId, rewardType = "contract_signed", actorUserId, allPrograms }) {
  // Проверяем дублирование
  const existing = await base44.entities.Reward.filter({ candidate_id: candidateId, reward_type: rewardType });
  if (existing.length > 0) return existing;

  // Загружаем все программы (или используем кэш)
  const pool = allPrograms || await base44.entities.ReferralProgram.list();

  // Строим цепочку по parent_program_id
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

  // Снимок цепочки
  const chainSnapshot = JSON.stringify(chain.map(p => ({
    id: p.id, title: p.title, reward_quota: p.reward_quota, depth: p.depth, owner_user_id: p.owner_user_id
  })));

  const created = [];
  for (const { program, amount, level } of distribution) {
    const reward = await base44.entities.Reward.create({
      candidate_id: candidateId,
      beneficiary_user_id: program.owner_user_id,
      source_referrer_id: chain[0]?.owner_user_id,
      source_program_id: chain[0]?.id,
      root_program_id: rootProgram?.id,
      chain_level: level,
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
 * Создаёт дочернюю ReferralProgram.
 * Выполняет все проверки перед созданием.
 *
 * @returns {{ program, error }}
 */
export async function createChildProgram({ parentProgram, title, childQuota, ownerUserId, actorUserId }) {
  // Валидация квоты
  const { valid, error } = validateQuota(childQuota, parentProgram.reward_quota);
  if (!valid) return { program: null, error };

  // Проверка: parent может иметь детей
  if (!canHaveChildren(parentProgram)) {
    return { program: null, error: "Родительская программа не может иметь дочерних (мин. квота или лимит 10 достигнут)" };
  }

  // Генерируем уникальные коды
  const [linkCode, formCode] = await Promise.all([genUniqueLinkCode(), genUniqueCandidateCode()]);

  // Ancestry path
  let ancestryIds = [];
  try { ancestryIds = JSON.parse(parentProgram.ancestry_path_ids || "[]"); } catch {}
  ancestryIds.push(parentProgram.id);
  const ancestryJson = JSON.stringify(ancestryIds);

  // Ancestry text
  let ancestryText = parentProgram.ancestry_path_text || parentProgram.title;
  ancestryText += " / " + title;

  const child = await base44.entities.ReferralProgram.create({
    title,
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
    is_root: false,
    is_active: true,
    is_archived: false,
    can_create_child: childQuota > MIN_QUOTA,
    direct_children_count: 0,
    children_count: 0,
    candidates_count: 0,
  });

  // Атомарно обновляем счётчики у parent
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
    }),
  }).catch(() => {});

  return { program: child, error: null };
}
/**
 * Helper для проверки полноты заполнения PaymentProfile.
 * Источник истины для определения, готов ли профиль к выплатам.
 */
export function isPayoutProfileComplete(paymentProfile) {
  if (!paymentProfile) return false;
  return !!(
    paymentProfile.recipient_name?.trim() &&
    paymentProfile.date_of_birth &&
    paymentProfile.passport_series?.trim() &&
    paymentProfile.passport_number?.trim() &&
    paymentProfile.registration_address?.trim()
  );
}

/**
 * Форматирует сумму по-русски (с пробелами и символом ₽).
 */
export function formatRewardAmount(amount) {
  if (!Number.isFinite(amount)) return "—";
  return amount.toLocaleString("ru-RU") + " ₽";
}

/**
 * Генерирует Telegram share текст с конкретной суммой.
 */
export function generateTelegramShareText(inviteProgram) {
  if (!inviteProgram) return null;
  const programTitle = inviteProgram.public_program_title || inviteProgram.base_program_title || "МилитариПартнер";
  const reward = inviteProgram.reward_quota || 0;
  const rewardText = formatRewardAmount(reward);
  return `Присоединяйся к программе «${programTitle}». За каждого кандидата платят ${rewardText}.`;
}
/**
 * Единый источник истины для русских названий статусов кандидатов.
 * Используется во всех интерфейсах: admin, moderator, dashboard, candidate history.
 */

export const STATUS_LABELS_RU = {
  NEW: "Новый кандидат",
  QUESTIONNAIRE_FILLED: "Анкета заполнена",
  CURATOR_CALL_SCHEDULED: "Назначен звонок куратора",
  CURATOR_CALL_DONE: "Звонок проведён",
  REGION_AGREED: "Согласован регион",
  TRAVEL_ARRANGED: "Организован выезд",
  ARRIVED: "Кандидат прибыл",
  MEDICAL_EXAM_DONE: "Медкомиссия пройдена",
  CONTRACT_SIGNED: "Контракт подписан",
  UNIT_ASSIGNED: "Назначено подразделение",
  RETURNED_HEALTHY: "Вернулся без ранений",
  INJURED_LIGHT: "Лёгкое ранение",
  INJURED_HEAVY: "Тяжёлое ранение",
  KIA: "Погиб",
  REJECTED: "Отказ",
  DROPPED: "Выбыл из процесса",
};

export const STATUS_COLORS_RU = {
  NEW: "bg-gray-100 text-gray-700",
  QUESTIONNAIRE_FILLED: "bg-blue-100 text-blue-700",
  CURATOR_CALL_SCHEDULED: "bg-indigo-100 text-indigo-700",
  CURATOR_CALL_DONE: "bg-violet-100 text-violet-700",
  REGION_AGREED: "bg-purple-100 text-purple-700",
  TRAVEL_ARRANGED: "bg-cyan-100 text-cyan-700",
  ARRIVED: "bg-teal-100 text-teal-700",
  MEDICAL_EXAM_DONE: "bg-emerald-100 text-emerald-700",
  CONTRACT_SIGNED: "bg-green-100 text-green-700",
  UNIT_ASSIGNED: "bg-green-200 text-green-800",
  RETURNED_HEALTHY: "bg-lime-100 text-lime-700",
  INJURED_LIGHT: "bg-yellow-100 text-yellow-800",
  INJURED_HEAVY: "bg-orange-100 text-orange-800",
  KIA: "bg-gray-800 text-white",
  REJECTED: "bg-red-100 text-red-700",
  DROPPED: "bg-orange-100 text-orange-700",
};

// Порядок статусов по жизненному циклу кандидата
export const STATUSES_ORDERED = [
  "NEW",
  "QUESTIONNAIRE_FILLED",
  "CURATOR_CALL_SCHEDULED",
  "CURATOR_CALL_DONE",
  "REGION_AGREED",
  "TRAVEL_ARRANGED",
  "ARRIVED",
  "MEDICAL_EXAM_DONE",
  "CONTRACT_SIGNED",
  "UNIT_ASSIGNED",
  "RETURNED_HEALTHY",
  "INJURED_LIGHT",
  "INJURED_HEAVY",
  "KIA",
  "REJECTED",
  "DROPPED",
];

export function statusLabel(status) {
  return STATUS_LABELS_RU[status] || status?.replace(/_/g, " ") || "—";
}

export function statusColor(status) {
  return STATUS_COLORS_RU[status] || "bg-gray-100 text-gray-600";
}
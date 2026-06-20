/**
 * Диагностический модуль для отладки join flow.
 * Логирует все шаги создания кабинета по реферальной ссылке.
 */

const STEPS = {
  STEP0_VALIDATE: { name: "STEP0_VALIDATE", label: "Проверка программы" },
  STEP1_GENCODE: { name: "STEP1_GENCODE", label: "Генерация кода входа" },
  STEP2_CREATE_PROFILE: { name: "STEP2_CREATE_PROFILE", label: "Создание профиля" },
  STEP3_CREATE_PROGRAM: { name: "STEP3_CREATE_PROGRAM", label: "Создание подпрограммы" },
  STEP4_MEMBERSHIP: { name: "STEP4_MEMBERSHIP", label: "Связь с программой" },
  STEP5_COUNTERS: { name: "STEP5_COUNTERS", label: "Обновление счётчиков" },
  STEP6_LOG: { name: "STEP6_LOG", label: "Запись истории" },
  STEP7_SESSION: { name: "STEP7_SESSION", label: "Сохранение сессии" },
};

class JoinFlowDiagnostics {
  constructor() {
    this.logs = [];
    this.startTime = null;
    this.currentStep = null;
  }

  start() {
    this.logs = [];
    this.startTime = Date.now();
    console.log("[JoinFlow] 🔵 Начало flow создания кабинета");
  }

  step(stepKey, message = "") {
    const step = STEPS[stepKey];
    if (!step) return;
    
    this.currentStep = step;
    const elapsed = Date.now() - this.startTime;
    const logEntry = {
      step: step.name,
      label: step.label,
      message,
      timestamp: new Date().toISOString(),
      elapsedMs: elapsed,
    };
    
    this.logs.push(logEntry);
    console.log(`[JoinFlow] ⏱️ +${elapsed}ms | ${step.label} | ${message}`);
  }

  success(message = "") {
    const elapsed = Date.now() - this.startTime;
    console.log(`[JoinFlow] ✅ УСПЕХ (+${elapsed}ms) | ${message}`);
    return {
      success: true,
      logs: this.logs,
      totalElapsedMs: elapsed,
    };
  }

  error(stepKey, error, attemptRollback = null) {
    const step = STEPS[stepKey] || { name: stepKey, label: stepKey };
    const elapsed = Date.now() - this.startTime;
    
    console.error(`[JoinFlow] ❌ ОШИБКА на ${step.label} (+${elapsed}ms)`);
    console.error(`[JoinFlow] Причина: ${error.message || error}`);
    console.error(`[JoinFlow] Stack:`, error.stack || "—");
    
    if (attemptRollback) {
      console.warn(`[JoinFlow] 🔄 Попытка откката: ${attemptRollback}`);
    }
    
    this.logs.push({
      step: step.name,
      label: step.label,
      message: `ОШИБКА: ${error.message || error}`,
      timestamp: new Date().toISOString(),
      elapsedMs: elapsed,
      error: true,
    });
    
    return {
      success: false,
      failedStep: step.name,
      error: error.message || String(error),
      logs: this.logs,
      totalElapsedMs: elapsed,
    };
  }

  report() {
    console.group("[JoinFlow] 📋 ПОЛНЫЙ ОТЧЁТ");
    console.table(this.logs);
    console.groupEnd();
    return {
      logs: this.logs,
      stepCount: this.logs.length,
      lastStep: this.currentStep?.label || "—",
      totalTime: Date.now() - this.startTime,
    };
  }
}

export const joinFlowDiagnostics = new JoinFlowDiagnostics();
export { STEPS };
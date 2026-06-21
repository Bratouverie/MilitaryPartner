/**
 * Компактный модал «Укажи размер выплаты рефералу».
 * Открывается при первом share/copy и при клике «Изменить размер выплаты».
 * Отправляет запрос на safePrepareReferralSubprogram.
 */
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, X, Zap } from "lucide-react";
import { MIN_QUOTA, QUOTA_STEP } from "@/lib/programUtils";
import { formatRewardAmount } from "@/lib/payoutHelpers";

export default function SetRewardModal({ baseProgram, onClose, onReady }) {
  const parentQuota = baseProgram?.reward_quota || 0;
  const defaultQuota = Math.floor((parentQuota * 0.5) / QUOTA_STEP) * QUOTA_STEP || MIN_QUOTA;

  const [quota, setQuota] = useState(defaultQuota);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldError, setFieldError] = useState("");

  const maxQuota = parentQuota - QUOTA_STEP;

  const validate = (val) => {
    const n = Number(val);
    if (!Number.isFinite(n) || n <= 0) return "Введите сумму";
    if (n < MIN_QUOTA) return `Минимум — ${MIN_QUOTA.toLocaleString()} ₽`;
    if (n % QUOTA_STEP !== 0) return `Должна быть кратна ${QUOTA_STEP.toLocaleString()} ₽`;
    if (n >= parentQuota) return `Должна быть меньше вашей программы (${parentQuota.toLocaleString()} ₽)`;
    return "";
  };

  const handleChange = (e) => {
    const val = e.target.value;
    setQuota(val);
    setFieldError(validate(val));
  };

  const handleSubmit = async () => {
    const err = validate(quota);
    if (err) { setFieldError(err); return; }

    setLoading(true);
    setError("");
    try {
      const res = await base44.functions.invoke("safePrepareReferralSubprogram", {
        requestedQuota: Number(quota),
      });

      if (!res.data?.success) {
        setError(res.data?.error || "Ошибка. Попробуйте ещё раз.");
        setLoading(false);
        return;
      }

      onReady(res.data);
    } catch (e) {
      setError("Ошибка сети. Попробуйте ещё раз.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-accent" />
            <h2 className="font-heading font-bold text-base">Размер выплаты рефералу</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-muted-foreground leading-snug">
            Укажи, сколько получит новый реферал. Мы автоматически создадим ссылку на эту подпрограмму.
          </p>

          {/* Quota input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium">Вознаграждение реферала</label>
              <span className="text-xs text-muted-foreground">
                До {maxQuota.toLocaleString()} ₽
              </span>
            </div>
            <div className="relative">
              <Input
                type="number"
                value={quota}
                onChange={handleChange}
                min={MIN_QUOTA}
                max={maxQuota}
                step={QUOTA_STEP}
                className={`h-11 text-base font-semibold pr-8 ${fieldError ? "border-destructive" : ""}`}
                autoFocus
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₽</span>
            </div>
            {fieldError && <p className="text-xs text-destructive mt-1">{fieldError}</p>}

            {/* Preset chips */}
            <div className="flex gap-2 mt-2 flex-wrap">
              {[0.25, 0.5, 0.75].map(pct => {
                const val = Math.floor((parentQuota * pct) / QUOTA_STEP) * QUOTA_STEP;
                if (val < MIN_QUOTA || val >= parentQuota) return null;
                return (
                  <button
                    key={pct}
                    onClick={() => { setQuota(val); setFieldError(""); }}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      Number(quota) === val
                        ? "border-primary bg-primary/10 text-primary font-semibold"
                        : "border-border text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    {Math.round(pct * 100)}% · {val.toLocaleString()} ₽
                  </button>
                );
              })}
            </div>
          </div>

          {/* Helper */}
          <div className="bg-muted/60 rounded-xl p-3 text-xs text-muted-foreground leading-snug">
            Ваша программа: <strong>{parentQuota.toLocaleString()} ₽</strong><br />
            Реферал получит: <strong className="text-foreground">{Number(quota) > 0 ? Number(quota).toLocaleString() : "—"} ₽</strong><br />
            Вы зарабатываете: <strong className="text-foreground">{parentQuota - (Number(quota) || 0) > 0 ? (parentQuota - Number(quota)).toLocaleString() : "—"} ₽</strong>
          </div>

          {error && <div className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</div>}

          <Button
            onClick={handleSubmit}
            disabled={loading || !!fieldError || !quota}
            className="w-full bg-primary font-bold h-11"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Zap className="w-4 h-4 mr-2" />}
            Создать и использовать
          </Button>
        </div>
      </div>
    </div>
  );
}
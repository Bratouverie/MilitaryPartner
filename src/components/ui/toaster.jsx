import React from "react";
import { useToast, dismiss } from "@/components/ui/use-toast";
import { X, CheckCircle, AlertTriangle } from "lucide-react";

export function Toaster() {
  const { toasts } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)]">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm animate-in slide-in-from-bottom-2 fade-in
            ${t.variant === "destructive"
              ? "bg-destructive text-destructive-foreground border-destructive/50"
              : "bg-card text-card-foreground border-border"
            }`}
        >
          {t.variant === "destructive"
            ? <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            : <CheckCircle className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
          }
          <div className="flex-1 min-w-0">
            {t.title && <div className="font-medium leading-tight">{t.title}</div>}
            {t.description && <div className="text-xs mt-0.5 opacity-80">{t.description}</div>}
          </div>
          <button
            onClick={() => dismiss(t.id)}
            className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
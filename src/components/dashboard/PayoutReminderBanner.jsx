import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { CreditCard, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useProfile } from "@/lib/useProfile.jsx";
import { isPayoutProfileComplete } from "@/lib/payoutHelpers";

export default function PayoutReminderBanner() {
  const { profile } = useProfile();
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!profile?.id || dismissed) return;
    base44.entities.PaymentProfile.filter({ user_id: profile.id })
      .then(pp => {
        setShow(!isPayoutProfileComplete(pp[0]));
      })
      .catch(() => {});
  }, [profile?.id, dismissed]);

  if (!show || dismissed) return null;

  return (
    <div className="sticky top-0 z-30 bg-amber-50 border-b border-amber-200">
      <div className="max-w-5xl mx-auto px-4 py-2.5 flex items-center gap-3">
        <CreditCard className="w-4 h-4 text-amber-600 shrink-0" />
        <p className="text-sm text-amber-800 flex-1">
          Заполните паспортные данные для получения выплат.{" "}
          <Link
            to="/dashboard/payouts"
            className="font-semibold underline underline-offset-2 hover:text-amber-900"
          >
            Заполнить данные
          </Link>
        </p>
        <button
          onClick={() => setDismissed(true)}
          className="p-1 rounded text-amber-500 hover:text-amber-700 hover:bg-amber-100 transition-colors shrink-0"
          aria-label="Закрыть"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
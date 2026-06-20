import React from "react";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useBusinessProfile } from "@/lib/useBusinessProfile";
import { roleHomePath } from "@/lib/profileSession";

/**
 * Ролевой guard на основе бизнес-профиля (sessionStorage + ReferralProfile).
 * Не зависит от BASE44 auth токена.
 */
export default function RoleGuard({ allowedRoles, children }) {
  const { profile, loading } = useBusinessProfile();

  if (loading) return (
    <div className="fixed inset-0 flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );

  if (!profile) return <Navigate to="/secret-login" replace />;

  if (!allowedRoles.includes(profile.role)) {
    return <Navigate to={roleHomePath(profile.role)} replace />;
  }

  return children;
}
import React from "react";
import { Navigate } from "react-router-dom";
import { getStoredProfileId, getStoredRole, roleHomePath } from "@/lib/profileSession";

/**
 * Ролевой guard. Единственный источник истины — ReferralProfile в sessionStorage.
 * Синхронная проверка — без async задержки, без лишних рендеров.
 */
export default function RoleGuard({ allowedRoles, children }) {
  const profileId = getStoredProfileId();
  const role = getStoredRole();

  if (!profileId) return <Navigate to="/secret-login" replace />;
  if (!allowedRoles.includes(role)) return <Navigate to={roleHomePath(role)} replace />;

  return children;
}
import React from "react";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useBusinessProfile } from "@/lib/useBusinessProfile";

const ROLE_REDIRECTS = {
  referrer: "/dashboard",
  moderator: "/moderator",
  admin: "/admin",
  super_admin: "/admin",
};

export default function RoleGuard({ allowedRoles, children }) {
  const { profile, loading } = useBusinessProfile();

  if (loading) return (
    <div className="fixed inset-0 flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );

  if (!profile) return <Navigate to="/secret-login" replace />;

  if (!allowedRoles.includes(profile.role)) {
    const dest = ROLE_REDIRECTS[profile.role] || "/secret-login";
    return <Navigate to={dest} replace />;
  }

  return children;
}
/**
 * Единый источник истины для бизнес-профиля пользователя.
 * Хранит данные в sessionStorage, не зависит от BASE44 auth токена.
 */
import { base44 } from "@/api/base44Client";

const KEY_ID = "mp_profile_id";
const KEY_ROLE = "mp_profile_role";
const KEY_EMAIL = "mp_profile_email";

export function getStoredProfileId() {
  return sessionStorage.getItem(KEY_ID) || null;
}

export function setStoredProfile(profile) {
  if (!profile?.id) return;
  sessionStorage.setItem(KEY_ID, profile.id);
  sessionStorage.setItem(KEY_ROLE, profile.role || "");
  // Email необязателен — не сохраняем null/undefined как строку
  if (profile.email) {
    sessionStorage.setItem(KEY_EMAIL, profile.email);
  } else {
    sessionStorage.removeItem(KEY_EMAIL);
  }
}

export function clearStoredProfile() {
  sessionStorage.removeItem(KEY_ID);
  sessionStorage.removeItem(KEY_ROLE);
  sessionStorage.removeItem(KEY_EMAIL);
}

export function getStoredRole() {
  return sessionStorage.getItem(KEY_ROLE) || null;
}

export function getStoredEmail() {
  return sessionStorage.getItem(KEY_EMAIL) || null;
}

/** Загружает профиль из БД по сохранённому ID. */
export async function loadProfile() {
  const id = getStoredProfileId();
  if (!id) return null;
  try {
    const profiles = await base44.entities.ReferralProfile.filter({ id });
    return profiles[0] || null;
  } catch {
    return null;
  }
}

/** Возвращает домашний маршрут по роли */
export function roleHomePath(role) {
  if (role === "referrer") return "/dashboard";
  if (role === "moderator") return "/moderator";
  if (role === "admin" || role === "super_admin") return "/admin";
  return "/secret-login";
}
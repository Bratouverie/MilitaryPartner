import { useState, useEffect } from "react";
import { loadProfile, setStoredProfile } from "@/lib/profileSession";

/**
 * Хук для получения бизнес-профиля текущего пользователя.
 * Читает из sessionStorage → БД. Не зависит от BASE44 auth токена.
 */
export function useBusinessProfile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile().then(p => {
      if (p) {
        setStoredProfile(p); // актуализируем sessionStorage
        setProfile(p);
      }
      setLoading(false);
    });
  }, []);

  return { profile, loading };
}
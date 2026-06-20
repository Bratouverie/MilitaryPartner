import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { getStoredProfileId, setStoredProfile } from "@/lib/profileSession";

const ProfileContext = createContext(null);

export function ProfileProvider({ children }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    const id = getStoredProfileId();
    if (!id) { setProfile(null); setLoading(false); return; }
    try {
      const list = await base44.entities.ReferralProfile.filter({ id });
      const p = list[0] || null;
      if (p) setStoredProfile(p);
      setProfile(p);
    } catch { setProfile(null); }
    setLoading(false);
  }, []);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const refreshProfile = useCallback(async () => {
    const id = getStoredProfileId();
    if (!id) return;
    try {
      const list = await base44.entities.ReferralProfile.filter({ id });
      const p = list[0] || null;
      if (p) { setStoredProfile(p); setProfile(p); }
    } catch {}
  }, []);

  const updateProfile = useCallback(async (data) => {
    if (!profile) return;
    await base44.entities.ReferralProfile.update(profile.id, data);
    setProfile(p => ({ ...p, ...data }));
    setStoredProfile({ ...profile, ...data });
  }, [profile]);

  return (
    <ProfileContext.Provider value={{ profile, loading, refreshProfile, updateProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be used within ProfileProvider");
  return ctx;
}
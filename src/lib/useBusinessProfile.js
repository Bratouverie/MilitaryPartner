import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";

// Returns the business profile from sessionStorage + ReferralProfile entity
export function useBusinessProfile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const storedId = sessionStorage.getItem("mp_profile_id");
      if (storedId) {
        try {
          const profiles = await base44.entities.ReferralProfile.filter({ id: storedId });
          if (profiles[0]) { setProfile(profiles[0]); setLoading(false); return; }
        } catch {}
      }
      // Try by email from BASE44 auth
      try {
        const user = await base44.auth.me();
        const byLinked = await base44.entities.ReferralProfile.filter({ linked_user_id: user.id });
        if (byLinked[0]) {
          sessionStorage.setItem("mp_profile_id", byLinked[0].id);
          setProfile(byLinked[0]);
          setLoading(false);
          return;
        }
        const byEmail = await base44.entities.ReferralProfile.filter({ email: user.email });
        if (byEmail[0]) {
          await base44.entities.ReferralProfile.update(byEmail[0].id, { linked_user_id: user.id });
          sessionStorage.setItem("mp_profile_id", byEmail[0].id);
          setProfile(byEmail[0]);
          setLoading(false);
          return;
        }
      } catch {}
      setProfile(null);
      setLoading(false);
    };
    load();
  }, []);

  return { profile, loading };
}
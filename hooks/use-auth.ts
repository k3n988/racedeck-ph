'use client';

import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import type { Database } from '@/types/database.types';

type Profile = Database['public']['Tables']['user_profiles']['Row'];
type AuthState = {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.auth.getUser();
    setUser(data.user ?? null);
    if (data.user) {
      const { data: loadedProfile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', data.user.id)
        .maybeSingle();
      setProfile(loadedProfile);
    } else {
      setProfile(null);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void refresh();
    const { data } = supabase.auth.onAuthStateChange(() => void refresh());
    return () => data.subscription.unsubscribe();
  }, [refresh, supabase]);

  const value = useMemo<AuthState>(() => ({
    user,
    profile,
    loading,
    refresh,
    signOut: async () => {
      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
    },
  }), [loading, profile, refresh, supabase, user]);

  return createElement(AuthContext.Provider, { value }, children);
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}

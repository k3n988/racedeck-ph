'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import type { Database } from '@/types/database.types';

type Organization = Database['public']['Tables']['organizations']['Row'];
type Member = Database['public']['Tables']['organization_members']['Row'];

export function useOrganization(organizationId?: string) {
  const { user } = useAuth();
  const supabase = createClient();
  const [memberships, setMemberships] = useState<Array<Member & { organization: Organization | null }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!user) { setMemberships([]); setLoading(false); return; }
      setLoading(true);
      const { data: members } = await supabase.from('organization_members').select('*').eq('user_id', user.id).eq('is_active', true);
      const ids = Array.from(new Set((members ?? []).map((member) => member.organization_id)));
      const { data: organizations } = ids.length
        ? await supabase.from('organizations').select('*').in('id', ids)
        : { data: [] as Organization[] };
      if (!cancelled) {
        const byId = new Map((organizations ?? []).map((organization) => [organization.id, organization]));
        setMemberships((members ?? []).map((member) => ({ ...member, organization: byId.get(member.organization_id) ?? null })));
        setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [supabase, user]);

  const current = useMemo(
    () => memberships.find((membership) => membership.organization_id === organizationId) ?? memberships[0] ?? null,
    [memberships, organizationId],
  );
  return { memberships, current, organization: current?.organization ?? null, loading };
}

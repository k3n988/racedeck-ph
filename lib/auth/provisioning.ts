import 'server-only';

import type { User } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';

function text(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

export async function provisionUser(user: User, organizationName?: string) {
  const admin = createAdminClient();
  const metadata = user.user_metadata ?? {};
  const { error: profileError } = await admin.from('user_profiles').upsert({
    id: user.id,
    first_name: text(metadata.first_name, user.email?.split('@')[0] ?? 'RaceDeck'),
    last_name: text(metadata.last_name, 'User'),
  }, { onConflict: 'id' });
  if (profileError) throw new Error('Profile setup failed');

  if (!organizationName?.trim()) return;
  const name = organizationName.trim();
  const baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70) || 'organization';
  const slug = `${baseSlug}-${user.id.slice(0, 8)}`;
  const existing = await admin.from('organizations').select('id').eq('created_by', user.id).eq('name', name).maybeSingle();
  if (existing.error) throw new Error('Organization lookup failed');
  let organizationId = existing.data?.id;
  if (!organizationId) {
    const { data: organization, error: organizationError } = await admin
      .from('organizations')
      .insert({ name, slug, created_by: user.id })
      .select('id')
      .single();
    if (organizationError || !organization) throw new Error('Organization setup failed');
    organizationId = organization.id;
  }
  const { error: membershipError } = await admin.from('organization_members').upsert({
    organization_id: organizationId,
    user_id: user.id,
    role: 'owner',
    is_active: true,
  }, { onConflict: 'organization_id,user_id' });
  if (membershipError) throw new Error('Organization membership setup failed');
}

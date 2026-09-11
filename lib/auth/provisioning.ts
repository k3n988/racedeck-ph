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
  if (profileError) { console.error('RaceDeck profile provisioning failed', profileError); throw new Error(`Profile setup failed: ${profileError.code ?? 'unknown'} ${profileError.message}`); }

  if (!organizationName?.trim()) return;
  const name = organizationName.trim();
  const baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70) || 'organization';
  const slug = `${baseSlug}-${user.id.slice(0, 8)}`;
  const existing = await admin.from('organizations').select('id').eq('created_by', user.id).eq('name', name).maybeSingle();
  if (existing.error) { console.error('RaceDeck organization lookup failed', existing.error); throw new Error(`Organization lookup failed: ${existing.error.code ?? 'unknown'} ${existing.error.message}`); }
  let organizationId = existing.data?.id;
  if (!organizationId) {
    const { data: organization, error: organizationError } = await admin
      .from('organizations')
      .insert({ name, slug, created_by: user.id })
      .select('id')
      .single();
    if (organizationError || !organization) { console.error('RaceDeck organization provisioning failed', organizationError); throw new Error(`Organization setup failed: ${organizationError?.code ?? 'unknown'} ${organizationError?.message ?? 'no organization returned'}`); }
    organizationId = organization.id;
  }
  const { error: membershipError } = await admin.from('organization_members').upsert({
    organization_id: organizationId,
    user_id: user.id,
    role: 'owner',
    is_active: true,
  }, { onConflict: 'organization_id,user_id' });
  if (membershipError) { console.error('RaceDeck organization membership provisioning failed', membershipError); throw new Error(`Organization membership setup failed: ${membershipError.code ?? 'unknown'} ${membershipError.message}`); }
}

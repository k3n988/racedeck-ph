import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOrganizationContext } from '@/lib/auth/rbac';
import { createClient } from '@/lib/supabase/server';
import { ORGANIZATION_COUNTRY_CODES } from '@/lib/organization/countries';

const countryCodes = new Set(ORGANIZATION_COUNTRY_CODES);
const validTimezone = (timezone: string) => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
};

const profileSchema = z.object({
  name: z.string().trim().min(2).max(160),
  logo_url: z.string().trim().url().max(1000).nullable(),
  website: z.union([z.string().trim().url().max(1000), z.literal('')]).nullable(),
  facebook_url: z.union([z.string().trim().url().max(1000), z.literal('')]).nullable(),
  is_nonprofit: z.boolean(),
  address: z.string().trim().min(3).max(1000),
  country_code: z.string().trim().length(2).toUpperCase().refine(code => countryCodes.has(code), 'Choose a supported country'),
  state_province: z.string().trim().max(120).nullable(),
  city: z.string().trim().min(1).max(120),
  postal_code: z.string().trim().min(1).max(32),
  timezone: z.string().trim().min(1).max(100).refine(validTimezone, 'Choose a valid time zone'),
  contact_person: z.string().trim().min(1).max(160),
  contact_phone: z.string().trim().min(5).max(50).regex(/^[+\d().\s-]+$/, 'Enter a valid phone number'),
  contact_phone_extension: z.string().trim().max(12).nullable(),
  contact_email: z.string().trim().email().max(320),
});

const profileFields = 'id,name,slug,logo_url,contact_person,contact_email,contact_phone,contact_phone_extension,address,website,social_links,country_code,state_province,city,postal_code,timezone,is_nonprofit,account_status,verification_status';

export async function GET() {
  const { membership } = await requireOrganizationContext();
  const supabase = await createClient();
  const { data, error } = await supabase.from('organizations').select(profileFields).eq('id', membership.organization_id).single();
  if (error) {
    console.error('Organization profile load failed', error);
    return NextResponse.json({ error: 'Organization details could not be loaded' }, { status: 500 });
  }
  const socialLinks = data.social_links && typeof data.social_links === 'object' && !Array.isArray(data.social_links) ? data.social_links : {};
  return NextResponse.json({ ...data, facebook_url: typeof socialLinks.facebook === 'string' ? socialLinks.facebook : '' });
}

export async function PUT(request: Request) {
  const { membership } = await requireOrganizationContext();
  if (membership.role !== 'owner') return NextResponse.json({ error: 'Owner permission required' }, { status: 403 });

  const parsed = profileSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Check the organization details and try again' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: current, error: currentError } = await supabase.from('organizations').select('social_links').eq('id', membership.organization_id).single();
  if (currentError) {
    console.error('Organization social links load failed', currentError);
    return NextResponse.json({ error: 'Organization details could not be loaded before saving' }, { status: 500 });
  }
  const currentLinks = current.social_links && typeof current.social_links === 'object' && !Array.isArray(current.social_links) ? current.social_links : {};
  const { facebook_url, ...profile } = parsed.data;
  const { data, error } = await supabase.from('organizations').update({
    ...profile,
    website: profile.website || null,
    social_links: { ...currentLinks, facebook: facebook_url || null },
  }).eq('id', membership.organization_id).select(profileFields).single();
  if (error) {
    console.error('Organization profile save failed', error);
    return NextResponse.json({ error: process.env.NODE_ENV === 'development' ? `Organization details could not be saved: ${error.message}` : 'Organization details could not be saved' }, { status: 500 });
  }
  const socialLinks = data.social_links && typeof data.social_links === 'object' && !Array.isArray(data.social_links) ? data.social_links : {};
  return NextResponse.json({ ...data, facebook_url: typeof socialLinks.facebook === 'string' ? socialLinks.facebook : '' });
}

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOrganizerPermission } from '@/lib/auth/organizer-access';
import { createClient } from '@/lib/supabase/server';
const availability = z.enum(['not_yet_open', 'open', 'closed', 'sold_out']);
const updateSchema = z.object({ name: z.string().trim().min(1).max(120), distance_km: z.number().finite().nonnegative().max(9999.99).nullable(), registration_fee: z.number().finite().nonnegative().max(99999999.99), max_slots: z.number().int().nonnegative().max(2147483647).nullable(), gun_start_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/).nullable(), cutoff_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/).nullable(), registration_availability: availability });
async function authorized(eventId: string) {
  const auth = await requireOrganizerPermission('edit_events', eventId);
  if ('response' in auth) return { response: auth.response } as const;
  return { ...auth, supabase: await createClient() } as const;
}
export async function PATCH(request: Request,{params}:{params:{eventId:string;categoryId:string}}){const result=await authorized(params.eventId);if('response'in result)return result.response;const parsed=updateSchema.safeParse(await request.json().catch(()=>null));if(!parsed.success)return NextResponse.json({error:'Invalid category details'},{status:400});const{data:category}=await result.supabase.from('race_categories').select('id,confirmed_count').eq('id',params.categoryId).eq('event_id',params.eventId).maybeSingle();if(!category)return NextResponse.json({error:'Category not found for this event'},{status:404});if(parsed.data.max_slots!==null&&parsed.data.max_slots<category.confirmed_count)return NextResponse.json({error:'Capacity cannot be lower than confirmed registrations'},{status:400});const{data,error}=await result.supabase.from('race_categories').update(parsed.data).eq('id',category.id).eq('event_id',params.eventId).select('*').single();if(error){console.error('Unable to update event category',error);return NextResponse.json({error:'Category could not be updated'},{status:500})}return NextResponse.json(data)}

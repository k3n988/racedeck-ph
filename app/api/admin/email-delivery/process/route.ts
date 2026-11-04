import { NextResponse } from 'next/server';
import { requireInternalAccess } from '@/lib/auth/rbac';
import { createAdminClient } from '@/lib/supabase/admin';
import { processEmailQueue } from '@/lib/email/email.service';

export async function POST() {
  const context = await requireInternalAccess();
  try {
    const result = await processEmailQueue(25);
    const admin = createAdminClient();
    const { error } = await admin.from('audit_logs').insert({
      actor_user_id: context.user.id,
      actor_role_context: context.internalRoles[0] ?? 'admin',
      action: 'email_queue_processed',
      resource_type: 'communication',
      new_values: result,
    });
    if (error) console.error('Email queue audit record failed', error);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Email queue processing failed', error);
    return NextResponse.json({ error: 'Email queue could not be processed. Confirm the provider configuration and try again.' }, { status: 503 });
  }
}

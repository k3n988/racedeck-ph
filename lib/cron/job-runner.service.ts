import 'server-only';

import { expireRegistrationHolds } from '@/lib/cron/hold-expiry.service';
import { processEmailQueue } from '@/lib/email/email.service';
import { dispatchDueReminders } from '@/lib/email/reminder.service';
import { recoverPayMongoWebhooks } from '@/lib/payments/webhook-recovery.service';

export type CronJobName = 'hold_expiry' | 'payment_webhook_recovery' | 'email_delivery' | 'race_reminders';
export type CronJobResult = { status: 'succeeded' | 'failed'; result?: unknown; error?: string };

async function runJob(name: CronJobName): Promise<CronJobResult> {
  try {
    const result = name === 'hold_expiry'
      ? await expireRegistrationHolds()
      : name === 'payment_webhook_recovery'
        ? await recoverPayMongoWebhooks()
        : name === 'email_delivery'
          ? await processEmailQueue()
          : await dispatchDueReminders();
    return { status: 'succeeded', result };
  } catch (error) {
    return { status: 'failed', error: error instanceof Error ? error.message.slice(0, 500) : 'Cron job failed' };
  }
}

export async function runScheduledJobs(): Promise<Record<CronJobName, CronJobResult>> {
  const names: CronJobName[] = ['hold_expiry', 'payment_webhook_recovery', 'email_delivery', 'race_reminders'];
  const results = await Promise.all(names.map(async (name) => [name, await runJob(name)] as const));
  return Object.fromEntries(results) as Record<CronJobName, CronJobResult>;
}

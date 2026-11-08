import { NextResponse } from 'next/server';
import { runScheduledJobs } from '@/lib/cron/job-runner.service';

export async function POST(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected || request.headers.get('authorization') !== `Bearer ${expected}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const jobs = await runScheduledJobs();
  const failed = Object.values(jobs).filter((job) => job.status === 'failed').length;
  return NextResponse.json({ jobs, failed }, { status: failed ? 207 : 200 });
}

import Link from 'next/link';
import {
  ArrowUpRight,
  CheckCircle2,
  CircleHelp,
  Database,
  Mail,
  Settings2,
  ShieldCheck,
  TriangleAlert,
  Webhook,
} from 'lucide-react';
import { AdminPage } from '@/components/admin/admin-ui';
import { requireInternalRoleManagement } from '@/lib/auth/rbac';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

type Integration = {
  name: string;
  description: string;
  variables: string[];
  icon: typeof Database;
};

const integrations: Integration[] = [
  {
    name: 'Supabase',
    description: 'Database and server-side platform access.',
    variables: ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'],
    icon: Database,
  },
  {
    name: 'PayMongo',
    description: 'Payment checkout and webhook signature verification.',
    variables: ['PAYMONGO_SECRET_KEY', 'PAYMONGO_WEBHOOK_SECRET'],
    icon: Webhook,
  },
  {
    name: 'Transactional email',
    description: 'Resend delivery credentials and sender identity.',
    variables: ['RESEND_API_KEY', 'EMAIL_FROM'],
    icon: Mail,
  },
  {
    name: 'Scheduled jobs',
    description: 'Authentication for protected background job endpoints.',
    variables: ['CRON_SECRET'],
    icon: Settings2,
  },
];

const operations = [
  {
    title: 'Staff access',
    description: 'Assign internal roles and review who can operate the admin platform.',
    href: '/admin/roles-permissions',
    action: 'Manage access',
  },
  {
    title: 'Audit logs',
    description: 'Review the recorded history of important platform actions.',
    href: '/admin/audit-logs',
    action: 'Review activity',
  },
  {
    title: 'Email delivery',
    description: 'Review queued messages, delivery results, and provider errors.',
    href: '/admin/email-delivery',
    action: 'Open email delivery',
  },
  {
    title: 'Payment operations',
    description: 'Review payment events and webhook processing activity.',
    href: '/admin/payment-operations',
    action: 'Open payment operations',
  },
  {
    title: 'Platform fees',
    description: 'Review fee records collected from platform transactions.',
    href: '/admin/finance/platform-fees',
    action: 'Review fees',
  },
];

function isConfigured(name: string) {
  return Boolean(process.env[name]?.trim());
}

async function checkDatabase() {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from('audit_logs').select('id', { head: true, count: 'exact' });
    return !error;
  } catch {
    return false;
  }
}

function StateLabel({ ready, children }: { ready: boolean; children: string }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${ready ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>
    {ready ? <CheckCircle2 size={14} aria-hidden="true" /> : <TriangleAlert size={14} aria-hidden="true" />}
    {children}
  </span>;
}

export default async function AdminSettingsPage() {
  await requireInternalRoleManagement();
  const databaseReachable = await checkDatabase();
  const readiness = integrations.map((integration) => ({
    ...integration,
    missing: integration.variables.filter((name) => !isConfigured(name)),
  }));
  const readyCount = readiness.filter(({ missing }) => missing.length === 0).length;

  return <AdminPage
    title="Platform Settings"
    description="Review platform service readiness and open the admin controls used to operate RaceDeck."
    showHeading
    compactTop
    compactSections
  >
    <section aria-labelledby="service-readiness-title" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <h2 id="service-readiness-title" className="text-lg font-bold text-[#071b41]">Service readiness</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">Checks whether required configuration is present. Secret values are never shown, and only the Supabase database is actively checked for connectivity.</p>
        </div>
        <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700">{readyCount} of {integrations.length} integrations configured</span>
      </div>

      <ul className="divide-y divide-slate-100">
        {readiness.map(({ name, description, variables, missing, icon: Icon }) => {
          const configured = missing.length === 0;
          return <li key={name} className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
            <div className="flex min-w-0 gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-50 text-slate-600"><Icon size={19} aria-hidden="true" /></span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-slate-900">{name}</h3><StateLabel ready={configured}>{configured ? 'Configuration present' : 'Setup required'}</StateLabel></div>
                <p className="mt-1 text-sm text-slate-500">{description}</p>
                <p className="mt-2 text-xs text-slate-500"><span className="font-semibold text-slate-600">Required:</span> {variables.join(', ')}</p>
                {missing.length > 0 && <p className="mt-1 text-xs font-medium text-amber-800"><span className="font-semibold">Missing:</span> {missing.join(', ')}</p>}
              </div>
            </div>
          </li>;
        })}
      </ul>

      <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
        <StateLabel ready={databaseReachable}>{databaseReachable ? 'Supabase database reachable' : 'Supabase database unavailable'}</StateLabel>
        <span className="text-xs text-slate-500">Checked on page load. Refresh this page to check again.</span>
      </div>
    </section>

    <section aria-labelledby="operations-title">
      <div className="mb-3">
        <h2 id="operations-title" className="text-lg font-bold text-[#071b41]">Admin operations</h2>
        <p className="text-sm text-slate-500">Open the working screens for access, payments, communication, and platform activity.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {operations.map((operation) => <article key={operation.title} className="flex min-h-36 flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="font-bold text-[#071b41]">{operation.title}</h3>
          <p className="mt-1 flex-1 text-sm leading-5 text-slate-500">{operation.description}</p>
          <Link href={operation.href} className="mt-4 inline-flex w-fit items-center gap-1 text-sm font-bold text-orange-700 hover:text-orange-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500 focus-visible:outline-offset-2">
            {operation.action}<ArrowUpRight size={15} aria-hidden="true" />
          </Link>
        </article>)}
      </div>
    </section>

    <aside className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-slate-700">
      <ShieldCheck size={19} className="mt-0.5 shrink-0 text-[#071b41]" aria-hidden="true" />
      <div>
        <h2 className="font-bold text-[#071b41]">Where to change configuration</h2>
        <p className="mt-1 leading-5">Provider keys, sender identity, and cron secrets are deployment environment variables. Update them in the hosting environment and redeploy; this page reports their presence but does not store or expose secret values.</p>
        <p className="mt-2 flex items-start gap-1.5 text-xs leading-5 text-slate-600"><CircleHelp size={14} className="mt-0.5 shrink-0" />A configured credential does not guarantee that the external provider accepts it. Check provider dashboards and delivery or payment activity for live provider results.</p>
      </div>
    </aside>
  </AdminPage>;
}

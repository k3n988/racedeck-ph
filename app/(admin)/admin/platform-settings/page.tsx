import Link from 'next/link';
import { CheckCircle2, CircleHelp, ExternalLink, ShieldCheck, TriangleAlert } from 'lucide-react';
import { AdminPage, StatusBadge } from '@/components/admin/admin-ui';

const integrations = [
  { label: 'Supabase project', ready: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY), description: 'Database, authentication, and server-side operations.' },
  { label: 'Transactional email', ready: Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM), description: 'Resend API key and sender identity are configured.' },
  { label: 'PayMongo payments', ready: Boolean(process.env.PAYMONGO_SECRET_KEY && process.env.PAYMONGO_WEBHOOK_SECRET), description: 'Server payment key and webhook verification secret are configured.' },
  { label: 'Scheduled jobs', ready: Boolean(process.env.CRON_SECRET), description: 'Protected cron endpoints for queue and event operations.' },
];

const sections = [
  { title: 'Events and public content', description: 'Manage published homepage and public site content blocks.', href: '/admin/content-management', label: 'Manage content' },
  { title: 'Email delivery', description: 'Check delivery health, inspect provider logs, and process the email queue.', href: '/admin/email-delivery', label: 'Open email delivery' },
  { title: 'Payment operations', description: 'Review gateway events, webhooks, and payment reconciliation.', href: '/admin/payment-operations', label: 'Open payment operations' },
  { title: 'Platform fees', description: 'Review fee records and current collection status.', href: '/admin/finance/platform-fees', label: 'Review platform fees' },
  { title: 'Staff access', description: 'Review internal roles and permission mappings.', href: '/admin/roles-permissions', label: 'Review roles' },
  { title: 'Audit trail', description: 'Search immutable records of important platform actions.', href: '/admin/audit-logs', label: 'Open audit logs' },
];

export default function AdminSettingsPage() {
  const readyCount = integrations.filter((integration) => integration.ready).length;
  return <AdminPage title="Platform Settings" description="Review platform service readiness and open the operational settings managed in RaceDeck.">
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.55fr)]">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-4"><div><h2 className="font-bold text-[#071b41]">Service configuration</h2><p className="mt-1 text-sm text-slate-500">Readiness only. Secret values are never exposed in the admin interface.</p></div><StatusBadge value={`${readyCount} of ${integrations.length} ready`} tone={readyCount === integrations.length ? 'green' : 'amber'} /></div><ul className="mt-4 divide-y divide-slate-100">{integrations.map((integration) => <li key={integration.label} className="flex items-start gap-3 py-4"><span className={`mt-0.5 ${integration.ready ? 'text-emerald-600' : 'text-amber-600'}`}>{integration.ready ? <CheckCircle2 size={19} aria-hidden="true" /> : <TriangleAlert size={19} aria-hidden="true" />}</span><div><p className="font-semibold text-slate-800">{integration.label} <span className={`ml-2 text-xs font-bold ${integration.ready ? 'text-emerald-700' : 'text-amber-700'}`}>{integration.ready ? 'Ready' : 'Needs configuration'}</span></p><p className="mt-1 text-sm text-slate-500">{integration.description}</p></div></li>)}</ul></div>
      <aside className="rounded-2xl border border-blue-200 bg-blue-50 p-5"><div className="flex items-center gap-2 text-[#071b41]"><ShieldCheck size={20} aria-hidden="true" /><h2 className="font-bold">Production safeguards</h2></div><ul className="mt-3 space-y-2 text-sm leading-5 text-slate-700"><li>Payment status is confirmed from server-verified gateway events.</li><li>Admin access is checked on protected pages and API routes.</li><li>Audit records are immutable and provide the operational change history.</li><li>Service credentials are stored in server environment configuration, never in browser forms.</li></ul><p className="mt-4 flex items-start gap-2 border-t border-blue-200 pt-4 text-xs leading-5 text-slate-600"><CircleHelp size={16} className="mt-0.5 shrink-0" />Update provider keys, sender domains, and cron secrets in the deployment environment, then redeploy. This page does not pretend to save values it cannot persist.</p></aside>
    </section>
    <section><div className="mb-3"><h2 className="text-lg font-bold text-[#071b41]">Platform operations</h2><p className="text-sm text-slate-500">Open the working screens for the platform areas that currently have persisted data and actions.</p></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{sections.map((section) => <article key={section.title} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-bold text-[#071b41]">{section.title}</h3><p className="mt-2 min-h-10 text-sm leading-5 text-slate-500">{section.description}</p><Link href={section.href} className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-orange-600 hover:text-orange-700">{section.label}<ExternalLink size={14} aria-hidden="true" /></Link></article>)}</div></section>
  </AdminPage>;
}

import Link from 'next/link';
import { CheckCircle2, CircleHelp, ExternalLink, ShieldCheck, TriangleAlert } from 'lucide-react';
import { AdminPage, StatusBadge } from '@/components/admin/admin-ui';

const integrations = [
  { label: 'Supabase project', variables: ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'], description: 'Database, authentication, and server-side operations.' },
  { label: 'Transactional email', variables: ['RESEND_API_KEY', 'EMAIL_FROM'], description: 'Email provider credentials and sender identity.' },
  { label: 'PayMongo payments', variables: ['PAYMONGO_SECRET_KEY', 'PAYMONGO_WEBHOOK_SECRET'], description: 'Server payment key and webhook verification secret.' },
  { label: 'Scheduled jobs', variables: ['CRON_SECRET'], description: 'Protected cron endpoints for queue and event operations.' },
];

const sections = [
  { title: 'Events and public content', description: 'Manage published homepage and public site content blocks.', href: '/admin/content-management', label: 'Manage content' },
  { title: 'Email delivery', description: 'Review delivery status, message history, and provider responses.', href: '/admin/email-delivery', label: 'Open email delivery' },
  { title: 'Payment operations', description: 'Review gateway events, webhooks, and payment reconciliation.', href: '/admin/payment-operations', label: 'Open payment operations' },
  { title: 'Platform fees', description: 'Review fee records and current collection status.', href: '/admin/finance/platform-fees', label: 'Review platform fees' },
  { title: 'Staff access', description: 'Review internal roles and permission mappings.', href: '/admin/roles-permissions', label: 'Review roles' },
  { title: 'Audit trail', description: 'Search immutable records of important platform actions.', href: '/admin/audit-logs', label: 'Open audit logs' },
];

export default function AdminSettingsPage() {
  const configured = (name: string) => Boolean(process.env[name]?.trim());
  const configuredCount = integrations.filter((integration) => integration.variables.every(configured)).length;
  return <AdminPage title="Platform Settings" description="" compactTop compactSections>
    <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.55fr)]">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-bold text-[#071b41]">Service configuration</h2><p className="mt-1 text-sm text-slate-500">Configuration presence only. Secret values and provider connectivity are not exposed or tested here.</p></div><StatusBadge value={`${configuredCount} of ${integrations.length} configured`} tone={configuredCount === integrations.length ? 'green' : 'amber'} /></div><ul className="mt-2 divide-y divide-slate-100">{integrations.map((integration) => { const missing = integration.variables.filter((name) => !configured(name)); const isConfigured = missing.length === 0; return <li key={integration.label} className="flex items-start gap-3 py-3"><span className={`mt-0.5 ${isConfigured ? 'text-emerald-600' : 'text-amber-600'}`}>{isConfigured ? <CheckCircle2 size={19} aria-hidden="true" /> : <TriangleAlert size={19} aria-hidden="true" />}</span><div className="min-w-0"><p className="font-semibold text-slate-800">{integration.label} <span className={`ml-2 text-xs font-bold ${isConfigured ? 'text-emerald-700' : 'text-amber-700'}`}>{isConfigured ? 'Configured' : 'Missing configuration'}</span></p><p className="mt-1 text-sm text-slate-500">{integration.description}</p>{!isConfigured && <p className="mt-1 break-words text-xs text-amber-800">Missing environment variables: {missing.join(', ')}</p>}</div></li>; })}</ul></div>
      <aside className="rounded-2xl border border-blue-200 bg-blue-50 p-4"><div className="flex items-center gap-2 text-[#071b41]"><ShieldCheck size={20} aria-hidden="true" /><h2 className="font-bold">Production safeguards</h2></div><ul className="mt-2 space-y-2 text-sm leading-5 text-slate-700"><li>Payment status is confirmed from server-verified gateway events.</li><li>Admin access is checked on protected pages and API routes.</li><li>Audit records are immutable and provide the operational change history.</li><li>Service credentials are stored in server environment configuration, never in browser forms.</li></ul><p className="mt-3 flex items-start gap-2 border-t border-blue-200 pt-3 text-xs leading-5 text-slate-600"><CircleHelp size={16} className="mt-0.5 shrink-0" />Update provider keys, sender domains, and cron secrets in the deployment environment, then redeploy. This page does not pretend to save values it cannot persist.</p></aside>
    </section>
    <section><div className="mb-2"><h2 className="text-lg font-bold text-[#071b41]">Platform operations</h2><p className="text-sm text-slate-500">Open the working screens for the platform areas that currently have persisted data and actions.</p></div><div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">{sections.map((section) => <article key={section.title} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><h3 className="font-bold text-[#071b41]">{section.title}</h3><p className="mt-1 min-h-10 text-sm leading-5 text-slate-500">{section.description}</p><Link href={section.href} className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-orange-600 hover:text-orange-700">{section.label}<ExternalLink size={14} aria-hidden="true" /></Link></article>)}</div></section>
  </AdminPage>;
}

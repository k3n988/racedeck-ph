'use client';

import { ToastFeedback } from '@/components/toast-feedback';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, CheckCircle2, ChevronLeft, ChevronRight, Eye, PackageCheck, Search, StopCircle, Users, X } from 'lucide-react';

type ClaimSummary = { id: string; claimed_at: string; claimed_by: string; claim_method: 'qr_scan' | 'manual_lookup'; staff_name?: string };
type MerchandiseLine = { id: string; item_name: string; variant?: string | null; quantity: number };
type KitSelection = { item_id: string; item_name?: string | null; variant: string };
type HandoverItem = { id: string; name: string; variant: string | null; quantity: number; details: string | null; selectionMissing: boolean };
type Participant = { id: string; registration_number: string; user_id?: string | null; first_name: string; middle_name?: string | null; last_name: string; email: string; status: string; shirt_size?: string | null; race_categories?: { id: string; name: string; distance_km?: number | null } | null; payments?: { status: string; paid_at?: string | null } | null; bib?: { bib_number: number; bib_code: string; status: string } | null; claim?: ClaimSummary | null };
type Dashboard = { event: { id: string; name: string; event_date: string | null }; stats: { confirmed: number; claimed: number; unclaimed: number; progress: number }; categories: Array<{ id: string; name: string; distance_km?: number | null }>; participants: Participant[]; pagination: { page: number; page_size: number; total: number; total_pages: number } };
type ParticipantView = { registration: Participant & { mobile?: string | null }; event: Dashboard['event']; category: { id: string; name: string; distance_km?: number | null } | null; bib: Participant['bib']; payment: Participant['payments']; kit: { id: string; name: string; description?: string | null; race_kit_items?: Array<{ id: string; item_name: string; quantity: number; details?: { description?: string | null; variants?: Array<string | { name: string; slots: number | null }> } | null; is_required: boolean; is_active: boolean; display_order: number }> } | null; kit_selections: KitSelection[]; merchandise: MerchandiseLine[]; claim: ClaimSummary | null; claim_allowed: boolean; eligibility_message: string | null };

const inputClass = 'min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-500 focus:ring-4 focus:ring-orange-100 disabled:cursor-not-allowed disabled:bg-slate-100';
const formatDate = (value?: string | null) => value ? new Date(value).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
const displayName = (row: Participant) => [row.first_name, row.middle_name, row.last_name].filter(Boolean).join(' ');

export default function RaceKitClaimingPage({ params }: { params: { eventId: string } }) {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [view, setView] = useState<ParticipantView | null>(null);
  const [lookupMethod, setLookupMethod] = useState<'qr_scan' | 'manual_lookup'>('manual_lookup');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [claimStatus, setClaimStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [qrValue, setQrValue] = useState('');
  const [cameraOn, setCameraOn] = useState(false);
  const [devices, setDevices] = useState<Array<{ deviceId: string; label: string }>>([]);
  const [deviceId, setDeviceId] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [cameraError, setCameraError] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const scanLockRef = useRef(false);
  const isDialogOpen = Boolean(view);

  const loadDashboard = useCallback(async (nextPage = page) => {
    setLoading(true); setError('');
    try {
      const query = new URLSearchParams({ page: String(nextPage), page_size: String(pageSize), claim_status: claimStatus });
      if (search) query.set('search', search);
      if (categoryId) query.set('category_id', categoryId);
      const response = await fetch(`/api/organizer/events/${params.eventId}/race-kit-claiming?${query}`, { cache: 'no-store' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? 'Race-kit dashboard could not be loaded.');
      setDashboard(body as Dashboard);
    } catch (err) { setError(err instanceof Error ? err.message : 'Race-kit dashboard could not be loaded.'); }
    finally { setLoading(false); }
  }, [params.eventId, page, pageSize, claimStatus, categoryId, search]);

  useEffect(() => { void loadDashboard(page); }, [loadDashboard, page]);
  useEffect(() => {
    const timeout = window.setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 300);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);
  useEffect(() => () => { controlsRef.current?.stop(); }, []);
  useEffect(() => {
    if (!isDialogOpen) { previousFocusRef.current?.focus(); previousFocusRef.current = null; return; }
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    const focusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])') ?? []);
    focusable()[0]?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setView(null); return; }
      if (event.key === 'Tab') { const elements = focusable(); if (!elements.length) return; const first = elements[0]; const last = elements[elements.length - 1]; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); } }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isDialogOpen]);

  async function lookup(body: Record<string, unknown>, method: 'qr_scan' | 'manual_lookup' = 'manual_lookup') {
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    setLookupMethod(method);
    if (method === 'manual_lookup') setQrValue('');
    try {
      const response = await fetch(`/api/organizer/events/${params.eventId}/race-kit-claiming`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'lookup', ...body }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? 'Participant lookup failed.');
      if (Array.isArray(data.matches)) { setNotice(data.matches.length ? `${data.matches.length} matching participant${data.matches.length === 1 ? '' : 's'} found. Select one in the table.` : 'No matching participants were found.'); return; }
      setView(data as ParticipantView);
      if (method === 'qr_scan') { setQrValue(String(body.qr_value ?? '')); controlsRef.current?.stop(); controlsRef.current = null; setCameraOn(false); }
    } catch (err) { setError(err instanceof Error ? err.message : 'Participant lookup failed.'); }
    finally { setBusy(false); }
  }

  async function startCamera(preferredDeviceId?: string) {
    setCameraError('');
    try {
      const { BrowserQRCodeReader } = await import('@zxing/browser');
      const reader = new BrowserQRCodeReader();
      const cameras = await BrowserQRCodeReader.listVideoInputDevices();
      if (!cameras.length) throw new Error('No camera was found on this device. You can use a USB QR scanner or enter the QR value below.');
      setDevices(cameras.map((camera, index) => ({ deviceId: camera.deviceId, label: camera.label || `Camera ${index + 1}` })));
      const selected = preferredDeviceId || deviceId || cameras.find(camera => /back|rear|environment/i.test(camera.label))?.deviceId || cameras[0].deviceId;
      setDeviceId(selected); setCameraOn(true);
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      if (!videoRef.current) throw new Error('Camera preview is unavailable.');
      const controls = await reader.decodeFromVideoDevice(selected, videoRef.current, (result, decodeError) => {
        if (result && !scanLockRef.current) { scanLockRef.current = true; const text = result.getText(); setQrValue(text); controlsRef.current?.stop(); controlsRef.current = null; setCameraOn(false); void lookup({ qr_value: text }, 'qr_scan').finally(() => { window.setTimeout(() => { scanLockRef.current = false; }, 1000); }); }
        else if (decodeError && decodeError.name !== 'NotFoundException') setCameraError('Camera scan had a problem. Try again or use manual lookup.');
      });
      controlsRef.current = controls;
    } catch (err) { controlsRef.current?.stop(); controlsRef.current = null; setCameraOn(false); setCameraError(err instanceof Error ? err.message : 'Camera could not be started. Check browser camera permission.'); }
  }

  function stopCamera() { controlsRef.current?.stop(); controlsRef.current = null; setCameraOn(false); }

  async function openParticipant(id: string) { await lookup({ registration_id: id }); }

  async function claim() {
    if (!view?.claim_allowed || busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/organizer/events/${params.eventId}/race-kit-claiming`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'claim', registration_id: view.registration.id, claim_method: lookupMethod, ...(lookupMethod === 'qr_scan' && qrValue ? { qr_value: qrValue } : {}) }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { if (data.claim) setView(current => current ? { ...current, claim: data.claim, claim_allowed: false } : current); throw new Error(data.error ?? 'Race kit could not be marked as claimed.'); }
      setView(current => current ? { ...current, claim: data.claim, claim_allowed: false, eligibility_message: null } : current);
      setNotice('Race kit release recorded.'); await loadDashboard(page);
    } catch (err) { setError(err instanceof Error ? err.message : 'Race kit could not be marked as claimed.'); }
    finally { setBusy(false); }
  }

  const rows = dashboard?.participants ?? [];
  const stats = dashboard?.stats;
  const configuredKitItems = (view?.kit?.race_kit_items ?? []).filter(item => item.is_active && item.item_name.trim().toLocaleLowerCase() !== 'race kit claiming').sort((a, b) => a.display_order - b.display_order);
  const pickupLocation = view?.kit_selections?.find(selection => selection.item_name?.trim().toLocaleLowerCase() === 'race kit claiming')?.variant ?? 'Not selected';
  const kitSelections = (view?.kit_selections ?? []).filter(selection => selection.item_name?.trim().toLocaleLowerCase() !== 'race kit claiming');
  const selectionByItemId = new Map(kitSelections.map(selection => [selection.item_id, selection]));
  const configuredKitItemIds = new Set(configuredKitItems.map(item => item.id));
  const includesSinglet = configuredKitItems.some(item => /shirt|singlet/i.test(item.item_name));
  const handoverKitItems: HandoverItem[] = [
    ...configuredKitItems.map(item => {
      const selectedVariant = selectionByItemId.get(item.id)?.variant ?? (/shirt|singlet/i.test(item.item_name) ? view?.registration.shirt_size ?? null : null);
      return ({
      id: item.id,
      name: item.item_name,
      variant: selectedVariant,
      quantity: item.quantity,
      details: item.details?.description ?? null,
      selectionMissing: Boolean(item.details?.variants?.length && !selectedVariant),
    });
    }),
    ...kitSelections.filter(selection => !configuredKitItemIds.has(selection.item_id)).map(selection => ({
      id: selection.item_id,
      name: selection.item_name || 'Race kit item',
      variant: selection.variant,
      quantity: 1,
      details: null,
      selectionMissing: false,
    })),
    ...(!includesSinglet && view?.registration.shirt_size ? [{ id: 'race-singlet', name: 'Race singlet', variant: view.registration.shirt_size, quantity: 1, details: null, selectionMissing: false }] : []),
  ];

  return <main className="mx-auto w-full max-w-[1760px] space-y-5 bg-[#f4f6fa] p-4 sm:p-6 lg:p-6">
    {(error || notice) && <ToastFeedback message={error || notice} tone={error ? 'error' : 'auto'}>{error ? <div className="flex items-center justify-between gap-3"><span>{error}</span><button type="button" onClick={() => void loadDashboard(page)} className="shrink-0 font-semibold underline underline-offset-2">Try again</button></div> : undefined}</ToastFeedback>}

    <section aria-label="Race kit claiming summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {[
        { title: 'Confirmed participants', value: stats?.confirmed ?? '—', icon: Users, tint: 'bg-blue-50 text-blue-700' },
        { title: 'Kits claimed', value: stats?.claimed ?? '—', icon: PackageCheck, tint: 'bg-emerald-50 text-emerald-700' },
        { title: 'Kits unclaimed', value: stats?.unclaimed ?? '—', icon: CheckCircle2, tint: 'bg-amber-50 text-amber-700' },
      ].map(card => <article key={card.title} className="flex min-h-24 items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${card.tint}`}><card.icon className="h-5 w-5" aria-hidden="true" /></span><div><p className="text-sm font-medium text-slate-600">{card.title}</p><p className="mt-1 text-2xl font-extrabold tabular-nums text-[#0b2b5b]">{loading ? '…' : card.value}</p></div></article>)}
    </section>

    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="space-y-3 border-b border-slate-200 px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-[#071b41]">Participant records</h2>
          <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
            <label className="sr-only" htmlFor="participant-search">Search participants</label><div className="relative min-w-[220px] flex-1 sm:max-w-xs"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" /><input id="participant-search" value={searchInput} onChange={event => setSearchInput(event.target.value)} disabled={busy} placeholder="Name, registration, email, or bib" className={`${inputClass} pl-9`} /></div>
            <label className="sr-only" htmlFor="race-kit-category">Filter by category</label><select id="race-kit-category" value={categoryId} onChange={event => { setCategoryId(event.target.value); setPage(1); }} className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm"><option value="">All categories</option>{dashboard?.categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
            <label className="sr-only" htmlFor="race-kit-claim-status">Filter by claiming status</label><select id="race-kit-claim-status" value={claimStatus} onChange={event => { setClaimStatus(event.target.value); setPage(1); }} className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm"><option value="all">All claim statuses</option><option value="claimed">Claimed</option><option value="unclaimed">Unclaimed</option></select>
            {cameraOn ? <button type="button" onClick={stopCamera} className="ml-auto inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 px-3.5 text-sm font-semibold text-slate-700"><StopCircle className="h-4 w-4" />Stop camera</button> : <button type="button" onClick={() => void startCamera()} className="ml-auto inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#0b2b5b] px-3.5 text-sm font-bold text-white hover:bg-[#123b78]"><Camera className="h-4 w-4" />Scan QR</button>}
          </div>
        </div>
        {(cameraOn || cameraError) && <div className="grid gap-3 md:grid-cols-2">
          {cameraOn && <div className="overflow-hidden rounded-xl bg-slate-950"><video ref={videoRef} className="max-h-56 min-h-40 w-full object-contain" muted playsInline aria-label="Registration QR camera preview" />{devices.length > 1 && <label className="block border-t border-slate-700 p-2 text-sm text-white">Camera<select value={deviceId} onChange={event => { const next = event.target.value; stopCamera(); setDeviceId(next); window.setTimeout(() => void startCamera(next), 0); }} className="ml-2 max-w-[70%] rounded-lg bg-white px-2 py-1 text-slate-900">{devices.map(camera => <option key={camera.deviceId} value={camera.deviceId}>{camera.label}</option>)}</select></label>}</div>}
          <div>{cameraError && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{cameraError}</p>}<p className="mt-2 text-xs leading-5 text-slate-500">Scanning verifies the registration. Staff must confirm the handover separately.</p></div>
        </div>}
      </div>
      {loading && !dashboard ? <div className="p-12 text-center text-sm text-slate-500">Loading participant records…</div> : !rows.length ? <div className="p-12 text-center"><PackageCheck className="mx-auto h-8 w-8 text-slate-300" aria-hidden="true" /><p className="mt-3 font-semibold text-slate-700">No participants found</p><p className="mt-1 text-sm text-slate-500">Try changing your search or filters.</p></div> : <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="w-14 px-4 py-3">#</th><th className="px-4 py-3">Participant</th><th className="px-4 py-3">Registration</th><th className="px-4 py-3">Distance</th><th className="px-4 py-3">Bib</th><th className="px-4 py-3">Payment</th><th className="px-4 py-3">Race kit</th><th className="px-4 py-3">Claimed at</th><th className="px-4 py-3 text-right">Action</th></tr></thead><tbody className="divide-y divide-slate-100">{rows.map((row, index) => <tr key={row.id} className="hover:bg-slate-50/70"><td className="px-4 py-3 text-slate-500">{(page - 1) * pageSize + index + 1}</td><td className="px-4 py-3"><p className="font-semibold text-slate-900">{displayName(row)}</p><p className="mt-0.5 text-xs text-slate-500">{row.email}</p></td><td className="px-4 py-3 font-medium text-slate-700">{row.registration_number}</td><td className="px-4 py-3 text-slate-700">{row.race_categories?.distance_km != null ? `${row.race_categories.distance_km} km` : row.race_categories?.name ?? '—'}</td><td className="px-4 py-3 text-slate-700">{row.bib?.bib_code ?? '—'}</td><td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${row.payments?.status === 'succeeded' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{row.payments?.status?.replaceAll('_', ' ') ?? 'Unpaid'}</span></td><td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${row.claim ? 'bg-emerald-50 text-emerald-700' : row.status === 'confirmed' && row.payments?.status === 'succeeded' ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>{row.claim ? 'Claimed' : 'Unclaimed'}</span></td><td className="px-4 py-3 text-slate-600">{row.claim ? formatDate(row.claim.claimed_at) : '—'}</td><td className="px-4 py-3 text-right"><button type="button" onClick={() => void openParticipant(row.id)} disabled={busy} aria-label={`View ${displayName(row)} registration`} title="View participant" className="inline-grid h-9 w-9 place-items-center rounded-lg border border-slate-300 text-[#0b2b5b] transition hover:border-orange-400 hover:bg-orange-50 disabled:opacity-50"><Eye className="h-4 w-4" aria-hidden="true" /></button></td></tr>)}</tbody></table></div>}
      <footer className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-2 text-sm text-slate-600"><label htmlFor="race-kit-page-size">Rows</label><select id="race-kit-page-size" value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1); }} className="min-h-9 rounded-lg border border-slate-300 bg-white px-2"><option value={20}>20</option><option value={30}>30</option><option value={50}>50</option></select><span>per page</span><span className="ml-2">{dashboard?.pagination.total ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, dashboard.pagination.total)} of ${dashboard.pagination.total}` : '0 results'}</span></div><div className="flex items-center justify-end gap-2"><button type="button" onClick={() => setPage(value => Math.max(1, value - 1))} disabled={page <= 1 || loading} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-300 px-3 text-sm font-semibold disabled:opacity-45"><ChevronLeft className="h-4 w-4" />Previous</button><span className="px-1 text-sm text-slate-600">Page {dashboard?.pagination.page ?? page} of {Math.max(dashboard?.pagination.total_pages ?? 1, 1)}</span><button type="button" onClick={() => setPage(value => value + 1)} disabled={!dashboard || page >= dashboard.pagination.total_pages || loading} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-300 px-3 text-sm font-semibold disabled:opacity-45">Next<ChevronRight className="h-4 w-4" /></button></div></footer>
    </section>

    {view && <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-5" onMouseDown={event => { if (event.target === event.currentTarget) setView(null); }}><section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="race-kit-verification-title" tabIndex={-1} className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"><header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 bg-white px-5 py-4 sm:px-6"><div><p className="text-xs font-bold uppercase tracking-wide text-orange-600">Registration verification</p><h2 id="race-kit-verification-title" className="mt-1 text-xl font-extrabold text-[#071b41]">{displayName(view.registration)}</h2><p className="mt-1 text-sm text-slate-600">{view.registration.registration_number} · {view.event.name}</p></div><button type="button" onClick={() => setView(null)} aria-label="Close participant verification" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"><X className="h-4 w-4" /></button></header>
      <div className="space-y-5 p-5 sm:p-6"><div className="flex flex-wrap gap-2"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold capitalize text-slate-700">Registration: {view.registration.status.replaceAll('_', ' ')}</span><span className={`rounded-full px-2.5 py-1 text-xs font-bold capitalize ${view.payment?.status === 'succeeded' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>Payment: {view.payment?.status?.replaceAll('_', ' ') ?? 'unknown'}</span><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${view.claim ? 'bg-emerald-50 text-emerald-700' : view.claim_allowed ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>{view.claim ? 'Race kit claimed' : view.claim_allowed ? 'Eligible · unclaimed' : 'Not eligible'}</span></div>
        <div className="grid gap-x-5 gap-y-4 rounded-xl bg-slate-50 p-4 sm:grid-cols-2"><Detail label="Category / distance" value={`${view.category?.name ?? '—'}${view.category && 'distance_km' in view.category && view.category.distance_km ? ` · ${view.category.distance_km} km` : ''}`} /><Detail label="Pickup / delivery" value={pickupLocation} /><Detail label="Race singlet size" value={view.registration.shirt_size ?? 'Not selected'} /><Detail label="Registration channel" value={view.registration.user_id ? 'Participant account' : 'Guest registration'} /><Detail label="Assigned bib" value={view.bib?.bib_code ?? 'Not assigned'} /><Detail label="Email" value={view.registration.email} /><Detail label="Contact number" value={view.registration.mobile ?? '—'} /></div>
        <div><h3 className="font-bold text-[#071b41]">Additional merchandise</h3>{view.merchandise.length ? <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200 px-4">{view.merchandise.map(item => <li key={item.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><span className="font-semibold text-slate-800">{item.item_name}</span><span className="text-slate-600">{item.variant || 'No variant'} · Qty {item.quantity}</span></li>)}</ul> : <p className="mt-2 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">No additional merchandise selected.</p>}</div>
        <div><h3 className="font-bold text-[#071b41]">Items to hand over</h3>{view.kit ? <div className="mt-2 rounded-xl border border-slate-200 p-4"><p className="font-semibold text-slate-800">{view.kit.name}</p>{view.kit.description && <p className="mt-1 text-sm text-slate-600">{view.kit.description}</p>}{handoverKitItems.length ? <ul className="mt-3 divide-y divide-slate-100">{handoverKitItems.map(item => <li key={item.id} className="flex flex-wrap justify-between gap-2 py-3 first:pt-0 last:pb-0"><span className="font-semibold text-slate-800">{item.name}{item.details && <span className="mt-0.5 block text-xs font-normal text-slate-500">{item.details}</span>}</span><span className={`text-sm ${item.selectionMissing ? 'font-semibold text-amber-700' : 'text-slate-600'}`}>{item.variant ? `${item.variant} · Qty ${item.quantity}` : item.selectionMissing ? 'Selection not recorded' : `Included · Qty ${item.quantity}`}</span></li>)}</ul> : <p className="mt-3 text-sm text-slate-600">No itemized inclusions are configured for this race kit.</p>}</div> : <p className="mt-2 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">No active race-kit configuration is set for this category.</p>}</div>
        <div><h3 className="font-bold text-[#071b41]">Merchandise</h3>{view.merchandise.length ? <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200 px-4">{view.merchandise.map(item => <li key={item.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><span className="font-semibold text-slate-800">{item.item_name}</span><span className="text-slate-600">{item.variant || 'No variant'} · Qty {item.quantity}</span></li>)}</ul> : <p className="mt-2 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">No merchandise selected.</p>}</div>
        {view.claim && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><h3 className="font-bold text-emerald-900">Race kit already claimed</h3><p className="mt-1 text-sm text-emerald-900">{formatDate(view.claim.claimed_at)} by {view.claim.staff_name || 'Event staff'} · {view.claim.claim_method === 'qr_scan' ? 'QR scan' : 'Manual lookup'}</p></div>}
        {!view.claim && !view.claim_allowed && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{view.eligibility_message ?? 'This registration does not currently meet the race-kit claiming requirements.'}</p>}
      </div><footer className="sticky bottom-0 flex flex-col-reverse gap-2 border-t border-slate-100 bg-white px-5 py-4 sm:flex-row sm:justify-end sm:px-6"><button type="button" onClick={() => setView(null)} className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50">Close</button>{view.claim_allowed && <button type="button" onClick={() => void claim()} disabled={busy} className="min-h-11 rounded-xl bg-orange-600 px-5 text-sm font-bold text-white hover:bg-orange-700 disabled:opacity-50">{busy ? 'Recording release…' : 'Confirm race kit claimed'}</button>}</footer></section></div>}
  </main>;
}

function Detail({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 break-words text-sm font-semibold text-slate-800">{value}</dd></div>; }

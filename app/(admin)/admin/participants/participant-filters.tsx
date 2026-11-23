'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarDays, Check, ChevronDown, Search } from 'lucide-react';

type Option = { id: string; name: string };
type SelectOption = { value: string; label: string };
type Props = {
  status: string;
  search: string;
  from: string;
  to: string;
  organizer: string;
  event: string;
  paymentStatus: string;
  organizers: Option[];
  events: Option[];
};

function SearchableFilter({ label, name, value, options, onChange }: { label: string; name: string; value: string; options: SelectOption[]; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(options.find((option) => option.value === value)?.label ?? '');
  const selected = options.find((option) => option.value === value);
  const visibleOptions = options.filter((option) => option.label.toLowerCase().includes(query.trim().toLowerCase()));

  useEffect(() => {
    if (!open) setQuery(selected?.label ?? '');
  }, [open, selected?.label]);

  const choose = (option: SelectOption) => {
    onChange(option.value);
    setQuery(option.label);
    setOpen(false);
  };

  return <div className="relative min-w-0">
    <input type="hidden" name={name} value={value} />
    <div className="relative">
      <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-3 text-slate-400" />
      <input type="text" role="combobox" aria-label={label} aria-expanded={open} aria-haspopup="listbox" aria-controls={`participant-filter-options-${name}`} aria-autocomplete="list" autoComplete="off" value={query} onFocus={() => { setQuery(''); setOpen(true); }} onChange={(event) => { setQuery(event.target.value); setOpen(true); }} onKeyDown={(event) => {
        if (event.key === 'Escape') setOpen(false);
        if (event.key === 'Enter' && open && visibleOptions[0]) { event.preventDefault(); choose(visibleOptions[0]); }
      }} placeholder={options[0]?.label ?? label} className="h-10 w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-9 text-sm text-slate-800 outline-none placeholder:text-slate-500 focus:border-orange-500 focus:ring-2 focus:ring-orange-100" />
      <ChevronDown size={16} aria-hidden="true" className={`pointer-events-none absolute right-3 top-3 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
    </div>
    {open && <>
      <button type="button" aria-label={`Close ${label} options`} className="fixed inset-0 z-20 cursor-default" onClick={() => setOpen(false)} />
      <ul id={`participant-filter-options-${name}`} role="listbox" aria-label={`${label} options`} className="absolute left-0 top-[calc(100%+4px)] z-30 max-h-64 w-full min-w-48 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
        {visibleOptions.length ? visibleOptions.map((option) => <li key={option.value}><button type="button" role="option" aria-selected={option.value === value} onClick={() => choose(option)} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-orange-50 hover:text-orange-800"><span className="truncate">{option.label}</span>{option.value === value && <Check size={15} aria-hidden="true" className="shrink-0 text-orange-600" />}</button></li>) : <li className="px-3 py-2 text-sm text-slate-500">No matches found</li>}
      </ul>
    </>}
  </div>;
}

export default function ParticipantFilters({ status, search, from, to, organizer, event, paymentStatus, organizers, events }: Props) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [searchValue, setSearchValue] = useState(search);
  const [selectedStatus, setSelectedStatus] = useState(status);
  const [selectedOrganizer, setSelectedOrganizer] = useState(organizer);
  const [selectedEvent, setSelectedEvent] = useState(event);
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState(paymentStatus);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (searchValue !== search) formRef.current?.requestSubmit();
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchValue, search]);

  useEffect(() => {
    setSelectedStatus(status);
    setSelectedOrganizer(organizer);
    setSelectedEvent(event);
    setSelectedPaymentStatus(paymentStatus);
  }, [status, organizer, event, paymentStatus]);

  const submitFilters = () => window.requestAnimationFrame(() => formRef.current?.requestSubmit());
  const hasFilters = Boolean(search || selectedStatus !== 'all' || from || to || selectedOrganizer || selectedEvent || selectedPaymentStatus !== 'all');
  const resetFilters = () => {
    setSearchValue('');
    setSelectedStatus('all');
    setSelectedOrganizer('');
    setSelectedEvent('');
    setSelectedPaymentStatus('all');
    router.push('/admin/participants');
  };

  return <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm" aria-label="Registration filters">
    <form ref={formRef} method="get" action="/admin/participants">
      <div className="flex flex-wrap items-center gap-2 xl:flex-nowrap">
        <label className="relative min-w-[220px] flex-1">
          <Search size={18} aria-hidden="true" className="pointer-events-none absolute left-3 top-3 text-slate-400" />
          <input name="q" value={searchValue} onChange={(e) => setSearchValue(e.target.value)} placeholder="Search name, email, or registration ID..." aria-label="Search participants" className="h-10 w-full rounded-lg border border-slate-300 bg-white py-2 pl-10 pr-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-100" />
        </label>
        <label className="flex h-10 min-w-[180px] items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold uppercase tracking-wide text-slate-500 focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-100">
          <CalendarDays size={16} aria-hidden="true" /> From
          <input type="date" name="from" value={from} onChange={submitFilters} aria-label="Registered from" className="ml-auto min-w-0 bg-transparent text-sm font-medium normal-case tracking-normal text-slate-800 outline-none" />
        </label>
        <label className="flex h-10 min-w-[180px] items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold uppercase tracking-wide text-slate-500 focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-100">
          <CalendarDays size={16} aria-hidden="true" /> To
          <input type="date" name="to" value={to} onChange={submitFilters} aria-label="Registered to" className="ml-auto min-w-0 bg-transparent text-sm font-medium normal-case tracking-normal text-slate-800 outline-none" />
        </label>
        {hasFilters && <button type="button" onClick={resetFilters} className="inline-flex h-10 items-center rounded-lg border border-slate-300 px-3 text-sm font-bold text-slate-700 hover:border-orange-400">Reset</button>}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <label className="block"><span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Organizer</span><SearchableFilter label="Organizer" name="organizer" value={selectedOrganizer} options={[{ value: '', label: 'All organizers' }, ...organizers.map((item) => ({ value: item.id, label: item.name }))]} onChange={(value) => { setSelectedOrganizer(value); submitFilters(); }} /></label>
        <label className="block"><span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Event</span><SearchableFilter label="Event" name="event" value={selectedEvent} options={[{ value: '', label: 'All events' }, ...events.map((item) => ({ value: item.id, label: item.name }))]} onChange={(value) => { setSelectedEvent(value); submitFilters(); }} /></label>
        <label className="block"><span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Registration status</span><SearchableFilter label="Registration status" name="status" value={selectedStatus} options={[{ value: 'all', label: 'All statuses' }, { value: 'confirmed', label: 'Confirmed' }, { value: 'pending_payment', label: 'Awaiting payment' }, { value: 'cancelled', label: 'Cancelled' }, { value: 'transferred', label: 'Transferred' }, { value: 'refunded', label: 'Refunded' }, { value: 'expired', label: 'Expired' }]} onChange={(value) => { setSelectedStatus(value); submitFilters(); }} /></label>
        <label className="block"><span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Payment status</span><SearchableFilter label="Payment status" name="payment_status" value={selectedPaymentStatus} options={[{ value: 'all', label: 'All payments' }, { value: 'succeeded', label: 'Paid' }, { value: 'pending', label: 'Pending' }, { value: 'processing', label: 'Processing' }, { value: 'failed', label: 'Failed' }, { value: 'cancelled', label: 'Cancelled' }, { value: 'partially_refunded', label: 'Partially refunded' }, { value: 'refunded', label: 'Refunded' }]} onChange={(value) => { setSelectedPaymentStatus(value); submitFilters(); }} /></label>
      </div>
    </form>
  </section>;
}

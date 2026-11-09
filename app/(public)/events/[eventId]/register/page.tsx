"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { EMERGENCY_CONTACT_RELATIONSHIPS } from "@/lib/registrations/emergency-contact";

type Option = {
  id: string;
  label: string;
  value: string;
  display_order: number;
};
type Field = {
  id: string;
  label: string;
  field_type:
    "short_text" | "long_text" | "dropdown" | "radio" | "checkbox" | "yes_no" | "multi_select";
  section_key: "additional" | "health";
  is_required: boolean;
  event_registration_field_options: Option[];
};
type Category = {
  id: string;
  name: string;
  category_group_name: string | null;
  distance_km: number | null;
  registration_fee: number;
  regular_registration_fee: number;
  early_bird_fee: number | null;
  early_bird_deadline: string | null;
  registration_opens_at: string | null;
  registration_closes_at: string | null;
  registration_availability: string;
  availability_reason: string;
  max_slots: number | null;
  confirmed_count: number;
};
type KitItem = { id: string; item_name: string; details: unknown; is_required: boolean; is_active: boolean; display_order: number };
type KitConfig = { id: string; category_id: string | null; name: string; race_kit_items: KitItem[] };
type MerchandiseOption = { id: string; name: string; description: string | null; unit_price: number; variants: string[]; image_urls: string[]; display_order: number };
type RegistrationInfo = {
  event: {
    id: string;
    name: string;
    banner_url: string | null;
    event_date: string;
    venue: string | null;
    address: string | null;
    registration_availability: string;
    registration_opens_at: string | null;
    registration_closes_at: string | null;
  };
  categories: Category[];
  fields: Field[];
  kits: KitConfig[];
  merchandise: MerchandiseOption[];
  waiver: {
    id: string;
    title: string;
    version: number;
    content: string | null;
  } | null;
};
type RegistrantDraft = {
  id: string;
  categoryId: string;
  answers: Record<string, string>;
  kitSelections: Record<string, string>;
  merchandiseSelections: Record<string, { quantity: number; variant: string }>;
  acceptWaiver: boolean;
};

function blankRegistrant(id: string): RegistrantDraft {
  return { id, categoryId: "", answers: {}, kitSelections: {}, merchandiseSelections: {}, acceptWaiver: false };
}

function kitDetails(details: unknown) {
  const value = details && typeof details === "object" && !Array.isArray(details) ? details as Record<string, unknown> : {};
  return {
    description: typeof value.description === "string" ? value.description : "",
    variants: Array.isArray(value.variants) ? value.variants.filter((variant): variant is string => typeof variant === "string") : [],
    images: [...(Array.isArray(value.product_image_urls) ? value.product_image_urls.filter((url): url is string => typeof url === "string") : []), ...(typeof value.reference_image_url === "string" ? [value.reference_image_url] : [])],
  };
}

function ProductImageCarousel({ images, label }: { images: string[]; label: string }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isEnlarged, setIsEnlarged] = useState(false);
  const move = (direction: -1 | 1) => setActiveIndex((current) => (current + direction + images.length) % images.length);
  useEffect(() => {
    if (!isEnlarged) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setIsEnlarged(false); };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [isEnlarged]);
  if (images.length === 0) return null;

  return <div className="min-w-0">
    <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-white" role="region" aria-roledescription="carousel" aria-label={`${label} photos`}>
      <button type="button" onClick={() => setIsEnlarged(true)} aria-label={`Enlarge ${label} photo ${activeIndex + 1} of ${images.length}`} title="Click to enlarge" className="block w-full cursor-zoom-in focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-orange-500">
        <Image src={images[activeIndex]} alt={`${label} photo ${activeIndex + 1} of ${images.length}`} width={440} height={300} unoptimized className="h-40 w-full object-contain sm:h-44" />
      </button>
      {images.length > 1 && <>
        <button type="button" onClick={() => move(-1)} aria-label={`Previous ${label} photo`} className="absolute left-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-slate-900/65 text-xl font-bold text-white shadow transition hover:bg-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500">&larr;</button>
        <button type="button" onClick={() => move(1)} aria-label={`Next ${label} photo`} className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-slate-900/65 text-xl font-bold text-white shadow transition hover:bg-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500">&rarr;</button>
      </>}
    </div>
    {images.length > 1 && <div className="mt-2 flex items-center justify-center gap-2" role="group" aria-label={`${label} photo pagination`}>
      {images.map((_, index) => <button key={`${label}-${index}`} type="button" onClick={() => setActiveIndex(index)} aria-label={`Show ${label} photo ${index + 1}`} aria-pressed={activeIndex === index} className={`h-2.5 w-2.5 rounded-full transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 ${activeIndex === index ? "bg-orange-600" : "bg-slate-300 hover:bg-slate-400"}`} />)}
      <span className="sr-only" aria-live="polite">Photo {activeIndex + 1} of {images.length}</span>
    </div>}
    <p className="mt-1 text-center text-[11px] text-slate-500">Click image to enlarge</p>
    {isEnlarged && <div role="dialog" aria-modal="true" aria-label={`${label} image preview`} onClick={() => setIsEnlarged(false)} className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/85 p-4 sm:p-8">
      <button type="button" autoFocus onClick={() => setIsEnlarged(false)} aria-label="Close enlarged image" className="absolute right-4 top-4 z-10 grid h-11 w-11 place-items-center rounded-full bg-white text-2xl font-bold text-slate-900 shadow-lg hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500">×</button>
      {images.length > 1 && <button type="button" onClick={(event) => { event.stopPropagation(); move(-1); }} aria-label={`Previous ${label} photo`} className="absolute left-3 z-10 grid h-11 w-11 place-items-center rounded-full bg-white/95 text-2xl text-slate-900 shadow-lg hover:bg-white sm:left-8">‹</button>}
      <Image src={images[activeIndex]} alt={`${label} enlarged photo ${activeIndex + 1} of ${images.length}`} width={1600} height={1200} unoptimized onClick={(event) => event.stopPropagation()} className="max-h-[88vh] max-w-[92vw] cursor-zoom-out rounded-lg object-contain shadow-2xl" />
      {images.length > 1 && <button type="button" onClick={(event) => { event.stopPropagation(); move(1); }} aria-label={`Next ${label} photo`} className="absolute right-3 z-10 grid h-11 w-11 place-items-center rounded-full bg-white/95 text-2xl text-slate-900 shadow-lg hover:bg-white sm:right-8">›</button>}
      <p aria-live="polite" className="absolute bottom-3 rounded-full bg-slate-900/70 px-3 py-1 text-xs font-medium text-white">{label} · {activeIndex + 1} / {images.length}</p>
    </div>}
  </div>;
}

const peso = (amount: number) => `PHP ${Number(amount).toFixed(2)}`;
const manilaDateTime = (value: string) => new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
const manilaShortDate = (value: string) => new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", month: "short", day: "2-digit" }).format(new Date(value));

function RegistrationEndsCountdown({ closesAt }: { closesAt: string | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  if (!closesAt) return <p className="mt-2 text-xs text-slate-500">Registration closing date to be announced</p>;
  const remaining = Math.max(0, Date.parse(closesAt) - now);
  const totalSeconds = Math.floor(remaining / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (remaining === 0) return <p role="status" className="mt-2 text-sm font-semibold text-slate-600">Registration has ended</p>;
  return <div className="mt-2" aria-label={`Registration ends in ${days} days, ${hours} hours, ${minutes} minutes, and ${seconds} seconds`}>
    <div className="grid max-w-xs grid-cols-4 gap-1.5 text-center">
      {[{ value: days, label: "Days" }, { value: hours, label: "Hours" }, { value: minutes, label: "Mins" }, { value: seconds, label: "Secs" }].map((part) => <div key={part.label}><span aria-hidden="true" className="block rounded-md bg-[#0b2b5b] px-2 py-1 text-sm font-bold tabular-nums text-white">{String(part.value).padStart(2, "0")}</span><span aria-hidden="true" className="mt-0.5 block text-[10px] text-slate-500">{part.label}</span></div>)}
    </div>
  </div>;
}

function registrationAvailabilityMessage(event: RegistrationInfo["event"]) {
  if (event.registration_availability === "not_yet_open") return event.registration_opens_at ? `Registration opens ${manilaDateTime(event.registration_opens_at)} (Manila time).` : "Registration has not opened yet.";
  if (event.registration_availability === "sold_out") return "All registration slots are currently sold out.";
  if (event.registration_closes_at && Date.now() >= Date.parse(event.registration_closes_at)) return `Registration closed ${manilaDateTime(event.registration_closes_at)} (Manila time). Contact the organizer if you think the deadline should be extended.`;
  return "The organizer has closed registration for this event. Please contact them if you need help.";
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: Field;
  value: string;
  onChange: (value: string) => void;
}) {
  const options = [...(field.event_registration_field_options ?? [])].sort(
    (a, b) => a.display_order - b.display_order,
  );
  if (field.field_type === "multi_select") {
    let selected: string[] = [];
    let other = "";
    try {
      const parsed = JSON.parse(value || "{}");
      if (Array.isArray(parsed)) selected = parsed.filter((item): item is string => typeof item === "string");
      else if (parsed && typeof parsed === "object") {
        selected = Array.isArray(parsed.selected) ? parsed.selected.filter((item: unknown): item is string => typeof item === "string") : [];
        other = typeof parsed.other === "string" ? parsed.other : "";
      }
    } catch { /* Keep invalid stale drafts empty; the server validates persisted answers. */ }
    const otherChoice = options.find((option) => option.value.toLowerCase() === "other" || option.label.toLowerCase().startsWith("other"));
    const otherSelected = Boolean(otherChoice && selected.includes(otherChoice.value));
    const write = (next: string[], nextOther = other) => onChange(JSON.stringify({ selected: next, other: nextOther }));
    return <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label={field.label} aria-required={field.is_required}>
      {options.map((option) => <label key={option.id} className="cursor-pointer">
        <input type="checkbox" checked={selected.includes(option.value)} onChange={(event) => write(event.target.checked ? [...selected, option.value] : selected.filter((item) => item !== option.value))} className="peer sr-only" />
        <span className="inline-flex min-h-10 items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-orange-400 peer-checked:border-orange-600 peer-checked:bg-orange-50 peer-checked:text-orange-800 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-orange-500">{option.label}</span>
      </label>)}
      {otherSelected && <input aria-label={`${field.label}: other answer`} value={other} onChange={(event) => write(selected, event.target.value)} maxLength={500} placeholder="Please specify" className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-normal text-slate-800 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100" />}
    </div>;
  }
  if (field.field_type === "long_text")
    return (
      <textarea
        required={field.is_required}
        aria-label={field.label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal text-slate-800 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
      />
    );
  if (field.field_type === "radio" || field.field_type === "yes_no") {
    const buttonOptions = field.field_type === "yes_no"
      ? [{ id: "yes", value: "yes", label: "Yes" }, { id: "no", value: "no", label: "No" }]
      : options;
    return (
      <div className="mt-2 space-y-2" role="radiogroup" aria-label={field.label} aria-required={field.is_required}>
        {buttonOptions.map((option) => (
          <label key={option.id} className="flex w-fit cursor-pointer items-center gap-2 text-sm font-normal text-slate-700">
            <input required={field.is_required} type="radio" name={field.id} value={option.value} checked={value === option.value} onChange={(event) => onChange(event.target.value)} className="h-5 w-5 accent-orange-600" />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    );
  }
  if (field.field_type === "dropdown")
    return (
      <select
        required={field.is_required}
        aria-label={field.label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal text-slate-800 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
      >
        <option value="">Select an option</option>
        {options.map((option) => (
          <option key={option.id} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  if (field.field_type === "checkbox")
    return (
      <label className="mt-2 flex items-center gap-2 text-sm">
        <input
          required={field.is_required}
          aria-label={field.label}
          type="checkbox"
          checked={value === "yes"}
          onChange={(event) => onChange(event.target.checked ? "yes" : "")}
        />
        {options[0]?.label ?? "Yes"}
      </label>
    );
  return (
    <input
      required={field.is_required}
      aria-label={field.label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
    />
  );
}
function AnswerInput({
  label,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  const autofillFields: Record<string, { name: string; autoComplete: string }> = {
    "First Name": { name: "first_name", autoComplete: "given-name" },
    "Middle Name (optional)": { name: "middle_name", autoComplete: "additional-name" },
    "Last Name": { name: "last_name", autoComplete: "family-name" },
    Birthdate: { name: "birthdate", autoComplete: "bday" },
    Email: { name: "email", autoComplete: "email" },
    "Contact Number": { name: "contact_number", autoComplete: "tel" },
    Address: { name: "address", autoComplete: "street-address" },
  };
  const autofill = autofillFields[label];
  return (
    <label className="block text-sm font-semibold text-slate-800">
      {label}
      {required && <span className="text-orange-600"> *</span>}
      <input
        required={required}
        type={type}
        name={autofill?.name}
        autoComplete={autofill?.autoComplete}
        max={type === "date" ? new Date().toISOString().slice(0, 10) : undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal text-slate-800 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
      />
    </label>
  );
}

function RegistrantFields({
  data,
  registrant,
  index,
  step,
  pricingNow,
  onChange,
  onRemove,
}: {
  data: RegistrationInfo;
  registrant: RegistrantDraft;
  index: number;
  step: 1 | 2 | 3;
  pricingNow: number;
  onChange: (value: Partial<RegistrantDraft>) => void;
  onRemove?: () => void;
}) {
  const categoryKits = data.kits.filter((kit) => kit.category_id === registrant.categoryId);
  const sharedKits = data.kits.filter((kit) => kit.category_id === null);
  // Shared items apply to every category; category-specific items extend them.
  // Do not hide the shared kit just because this category has its own config.
  const selectedKits = [...sharedKits, ...categoryKits].flatMap((kit) => kit.race_kit_items ?? []).filter((item) => {
    if (!item.is_active) return false;
    const details = item.details && typeof item.details === "object" && !Array.isArray(item.details) ? item.details as Record<string, unknown> : {};
    return details.kind !== "text_inclusion";
  }).sort((a, b) => a.display_order - b.display_order);
  const merchandiseTotal = data.merchandise.reduce((total, item) => total + item.unit_price * (registrant.merchandiseSelections[item.id]?.quantity ?? 0), 0);
  const updateAnswer = (key: string, value: string) => onChange({ answers: { ...registrant.answers, [key]: value } });
  const categoryFirstHint = `category-first-${registrant.id}`;
  const renderCategoryCard = (category: Category) => {
    const selected = registrant.categoryId === category.id;
    const available = ['open', 'closing_soon'].includes(category.registration_availability);
    const earlyBirdActive = category.early_bird_fee !== null && category.early_bird_deadline !== null && Date.parse(category.early_bird_deadline) > pricingNow;
    const price = Number(earlyBirdActive ? category.early_bird_fee : category.regular_registration_fee);
    const periodEnd = earlyBirdActive ? category.early_bird_deadline : category.registration_closes_at ?? data.event.registration_closes_at;
    const includedItems = data.kits.filter((kit) => kit.category_id === null || kit.category_id === category.id)
      .flatMap((kit) => kit.race_kit_items ?? []).filter((item) => item.is_active)
      .sort((a, b) => a.display_order - b.display_order);
    const distanceLabel = category.distance_km === null ? category.name : `${category.distance_km}K`;
    return <label key={category.id} className={`block rounded-xl border p-4 transition focus-within:ring-2 focus-within:ring-orange-200 ${available ? 'cursor-pointer' : 'cursor-not-allowed opacity-75'} ${selected ? 'border-orange-500 bg-orange-50/60 shadow-sm' : 'border-slate-200 bg-slate-50 hover:border-orange-300 hover:bg-white'}`}>
      <input className="sr-only" type="radio" name={`category-${registrant.id}`} value={category.id} checked={selected} disabled={!available} required onChange={() => onChange({ categoryId: category.id, kitSelections: {} })} />
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(220px,0.8fr)] sm:gap-6">
        <div className="min-w-0">
          <div className="flex items-start gap-3">
            <span aria-hidden="true" className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border ${selected ? 'border-orange-600' : 'border-slate-400'}`}>{selected && <span className="h-2.5 w-2.5 rounded-full bg-orange-600" />}</span>
            <div className="min-w-0">
              <span className="block font-bold text-[#0b2b5b]">{distanceLabel}</span>
              <span className="mt-1 block text-sm font-semibold text-orange-700">{peso(price)} <span className="font-normal text-slate-600">({earlyBirdActive ? 'Early Bird' : 'Reg. Period'}){periodEnd ? ` until ${manilaShortDate(periodEnd)}` : ''}</span></span>
              {category.registration_availability !== 'open' && <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${available ? 'bg-emerald-100 text-emerald-800' : category.registration_availability === 'sold_out' ? 'bg-rose-100 text-rose-800' : 'bg-slate-200 text-slate-700'}`}>{available ? 'Closing soon' : category.registration_availability.replaceAll('_', ' ')}</span>}
              {!available && <p className="mt-1 text-xs text-slate-600">{category.availability_reason}</p>}
              {category.registration_availability === 'not_yet_open' && category.registration_opens_at && <p className="mt-1 text-xs text-slate-600">Opens {manilaDateTime(category.registration_opens_at)} (Manila time)</p>}
            </div>
          </div>
          <div className="mt-4 pl-8">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Inclusions</p>
            {includedItems.length > 0 ? <ul className="mt-1.5 space-y-1 text-sm text-slate-700">{includedItems.map((item) => <li key={item.id} className="flex items-start gap-2"><span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-orange-500" />{item.item_name}</li>)}</ul> : <p className="mt-1.5 text-sm text-slate-500">No kit inclusions listed for this category.</p>}
          </div>
        </div>
        <div className="rounded-lg bg-white/80 p-3 sm:border sm:border-slate-200">
          <p className="text-xs font-medium text-slate-600">Registration ends in</p>
          <RegistrationEndsCountdown closesAt={periodEnd} />
          {periodEnd && <p className="mt-2 rounded-md bg-slate-50 px-3 py-2 text-sm font-bold text-[#0b2b5b]">{peso(price)} ({earlyBirdActive ? 'Early Bird' : 'Reg. Period'}) until {manilaShortDate(periodEnd)}</p>}
        </div>
      </div>
    </label>;
  };
  const groupedCategories = Array.from(data.categories.reduce((groups, category) => {
    const groupName = category.category_group_name?.trim();
    if (groupName) groups.set(groupName, [...(groups.get(groupName) ?? []), category]);
    return groups;
  }, new Map<string, Category[]>()));
  const standaloneCategories = data.categories.filter((category) => !category.category_group_name?.trim());

  return (
    <article className="space-y-5 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 rounded-md border-l-4 border-orange-500 bg-[#0b2b5b] px-4 py-3 text-sm font-bold text-white">
        <span>Registrant No. {index + 1}</span>
        <div className="flex items-center gap-3">
        <span className="text-xs font-medium text-white/80">{(() => { const selected = data.categories.find((category) => category.id === registrant.categoryId); return selected ? `${selected.category_group_name ? `${selected.category_group_name} · ` : ''}${selected.distance_km === null ? selected.name : `${selected.distance_km}K`}` : 'Choose a category to begin'; })()}</span>
          {onRemove && <button type="button" onClick={onRemove} className="rounded-md border border-white/40 px-2.5 py-1 text-xs font-bold text-white hover:bg-white/10">Remove</button>}
        </div>
      </div>

      {step === 1 && <section>
        <fieldset aria-describedby={!registrant.categoryId && data.categories.length > 0 ? categoryFirstHint : undefined}>
          <legend className="sr-only">Choose your race category (required)</legend>
          {data.categories.length === 0 ? <p role="status" className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">No race distances have been configured for this event yet.</p> : <div className="mt-3 space-y-3">
            {standaloneCategories.map(renderCategoryCard)}
            {groupedCategories.map(([groupName, categories]) => <details key={groupName} open={categories.some((category) => category.id === registrant.categoryId)} className="group rounded-xl border border-slate-200 bg-white">
              <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-100 px-4 py-3 font-bold text-[#0b2b5b] marker:hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500">
                <span>{groupName}<span className="ml-2 text-sm font-normal text-slate-600">Choose a distance</span></span>
                <span className="text-sm font-semibold text-slate-600">{categories.length} {categories.length === 1 ? 'distance' : 'distances'} <span aria-hidden="true" className="ml-1 inline-block transition group-open:rotate-180">v</span></span>
              </summary>
              <div className="space-y-3 p-3 sm:p-4">{categories.map(renderCategoryCard)}</div>
            </details>)}
          </div>}
        </fieldset>
      </section>}
      {step === 1 && !registrant.categoryId && data.categories.length > 0 && <p id={categoryFirstHint} role="status" className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900">Select a race category above to continue with this participant.</p>}

      {registrant.categoryId && <fieldset className="min-w-0 space-y-5">
        {step === 1 && <>
        <section>
          <h2 className="rounded-md bg-slate-100 px-3 py-2 text-xs font-bold uppercase tracking-wide text-[#071b41]">Personal information</h2>
          <p className="mt-3 text-xs text-slate-500">Enter details for the person who will take part. Event-specific questions configured by the organizer appear here.</p>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <AnswerInput label="First Name" value={registrant.answers.first_name ?? ""} onChange={(value) => updateAnswer("first_name", value)} required />
            <AnswerInput label="Middle Name (optional)" value={registrant.answers.middle_name ?? ""} onChange={(value) => updateAnswer("middle_name", value)} />
            <AnswerInput label="Last Name" value={registrant.answers.last_name ?? ""} onChange={(value) => updateAnswer("last_name", value)} required />
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <AnswerInput label="Birthdate" type="date" value={registrant.answers.birthdate ?? ""} onChange={(value) => updateAnswer("birthdate", value)} required />
            <label className="block min-w-0 text-sm font-semibold text-slate-800">Gender
              <select name="gender" autoComplete="sex" value={registrant.answers.gender ?? ""} onChange={(event) => updateAnswer("gender", event.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal text-slate-800 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100">
                <option value="">Select gender (optional)</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
              </select>
            </label>
            <AnswerInput label="Email" type="email" value={registrant.answers.email ?? ""} onChange={(value) => updateAnswer("email", value)} required />
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <AnswerInput label="Contact Number" type="tel" value={registrant.answers.contact_number ?? ""} onChange={(value) => updateAnswer("contact_number", value)} required />
            <AnswerInput label="Address" value={registrant.answers.address ?? ""} onChange={(value) => updateAnswer("address", value)} required />
          </div>
          {(["additional", "health"] as const).map((section) => {
            const fields = data.fields.filter((field) => (field.section_key ?? "additional") === section);
            if (!fields.length) return null;
            return <section key={section} className="mt-5 rounded-xl border border-slate-200 p-4 sm:p-5">
              <h3 className="rounded-md bg-slate-100 px-3 py-2 text-xs font-bold uppercase tracking-wide text-[#071b41]">{section === "health" ? "Health Information" : "Additional Information"}</h3>
              <div className="mt-4 grid gap-5 md:grid-cols-2">{fields.map((field) => <fieldset key={field.id} className="min-w-0 text-sm font-semibold text-slate-800"><legend>{field.label}{field.is_required && <span className="text-orange-600"> *</span>}</legend><FieldInput field={field} value={registrant.answers[field.id] ?? ""} onChange={(value) => updateAnswer(field.id, value)} /></fieldset>)}</div>
            </section>;
          })}
        </section>

        {selectedKits.length > 0 && <section>
          <h2 className="text-lg font-bold text-slate-900">Included race kit</h2><p className="mt-1 text-sm text-slate-600">Items configured for this selected category. Select a size or option for every item that offers choices.</p>
          <div className="mt-4 space-y-3">{selectedKits.map((item) => { const details = kitDetails(item.details); return <article key={item.id} className="grid gap-4 rounded-xl border border-slate-200 p-4 sm:grid-cols-[minmax(0,1fr)_200px]">
            <div><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-[#071b41]">{item.item_name}</h3><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">Included</span></div>{details.description && <p className="mt-1 text-sm text-slate-600">{details.description}</p>}
              {details.variants.length > 0 && <label className="mt-3 block text-sm font-semibold text-slate-800">{item.item_name.trim().toLowerCase() === "race kit claiming" ? "Claiming place" : "Size / option"} {item.is_required ? <span className="text-orange-600">*</span> : <span className="text-xs font-normal text-slate-500">(optional)</span>}<select required={item.is_required} value={registrant.kitSelections[item.id] ?? ""} onChange={(event) => onChange({ kitSelections: { ...registrant.kitSelections, [item.id]: event.target.value } })} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-normal"><option value="">{item.item_name.trim().toLowerCase() === "race kit claiming" ? "Select a claiming place" : "Choose a size or option"}</option>{details.variants.map((variant) => <option key={variant}>{variant}</option>)}</select></label>}
            </div>
            {details.images.length > 0 && <ProductImageCarousel images={details.images} label={item.item_name} />}
          </article>; })}</div>
        </section>}

        {data.merchandise.length > 0 && <section>
          <div className="flex flex-wrap items-end justify-between gap-2"><div><h2 className="text-lg font-bold text-slate-900">Optional merchandise</h2><p className="mt-1 text-sm text-slate-600">Optional paid add-ons; they are not part of the included race kit.</p></div><span className="text-sm font-bold text-slate-700">Registrant subtotal: {peso(merchandiseTotal)}</span></div>
          <div className="mt-4 space-y-3">{data.merchandise.map((item) => { const selection = registrant.merchandiseSelections[item.id] ?? { quantity: 0, variant: "" }; const selected = selection.quantity > 0; const variants = item.variants ?? []; const images = item.image_urls ?? []; const checkboxId = `merch-${registrant.id}-${item.id}`; return <article key={item.id} className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-[minmax(0,1fr)_200px]">
            <div><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-[#071b41]">{item.name}</h3><span className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-bold text-orange-800">Optional</span></div>{item.description && <p className="mt-1 text-sm text-slate-600">{item.description}</p>}<p className="mt-2 text-sm font-bold text-[#071b41]">{peso(item.unit_price)} each</p>
              <label htmlFor={checkboxId} className="mt-3 inline-flex min-h-10 cursor-pointer items-center gap-2 text-sm font-medium text-slate-700"><input id={checkboxId} type="checkbox" checked={selected} onChange={(event) => onChange({ merchandiseSelections: { ...registrant.merchandiseSelections, [item.id]: { quantity: event.target.checked ? 1 : 0, variant: event.target.checked ? selection.variant : "" } } })} className="h-4 w-4 accent-orange-600" />Add to order</label>
              {selected && variants.length > 0 && <label className="mt-2 block text-sm font-semibold text-slate-800">Size / variant <span className="text-orange-600">*</span><select required value={selection.variant} onChange={(event) => onChange({ merchandiseSelections: { ...registrant.merchandiseSelections, [item.id]: { ...selection, variant: event.target.value } } })} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal"><option value="">Choose a size or option</option>{variants.map((variant) => <option key={variant}>{variant}</option>)}</select></label>}
              {selected && <div className="mt-2 flex items-center gap-3"><span className="text-sm text-slate-600">Quantity</span><div className="inline-flex items-center rounded-lg border border-slate-300" aria-label={`Quantity for ${item.name}`}><button type="button" aria-label={`Remove one ${item.name}`} disabled={selection.quantity <= 1} onClick={() => onChange({ merchandiseSelections: { ...registrant.merchandiseSelections, [item.id]: { ...selection, quantity: selection.quantity - 1 } } })} className="h-9 w-9 rounded-l-lg text-lg font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">−</button><span aria-live="polite" className="min-w-8 text-center text-sm font-semibold text-slate-900">{selection.quantity}</span><button type="button" aria-label={`Add one ${item.name}`} disabled={selection.quantity >= 5} onClick={() => onChange({ merchandiseSelections: { ...registrant.merchandiseSelections, [item.id]: { ...selection, quantity: selection.quantity + 1 } } })} className="h-9 w-9 rounded-r-lg text-lg font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">+</button></div><span className="text-sm font-semibold text-slate-700">{peso(item.unit_price * selection.quantity)}</span></div>}
            </div>
            {images.length > 0 && <ProductImageCarousel images={images} label={item.name} />}
          </article>; })}</div>
        </section>}

        <section><h2 className="rounded-md bg-slate-100 px-3 py-2 text-xs font-bold uppercase tracking-wide text-[#071b41]">Emergency contact information</h2><div className="mt-4 grid gap-4 md:grid-cols-3"><AnswerInput label="Emergency contact person" value={registrant.answers.emergency_contact ?? ""} onChange={(value) => updateAnswer("emergency_contact", value)} required /><AnswerInput label="Emergency contact phone" type="tel" value={registrant.answers.emergency_contact_phone ?? ""} onChange={(value) => updateAnswer("emergency_contact_phone", value)} required /><label className="block min-w-0 text-sm font-semibold text-slate-800">Relationship to participant <span className="text-orange-600">*</span><select required value={registrant.answers.emergency_contact_relationship ?? ""} onChange={(event) => updateAnswer("emergency_contact_relationship", event.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal text-slate-800 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"><option value="">Select relationship</option>{EMERGENCY_CONTACT_RELATIONSHIPS.map((relationship) => <option key={relationship} value={relationship}>{relationship}</option>)}</select></label></div></section>

        </>}

        {step >= 2 && data.waiver && <section><h2 className="rounded-md bg-slate-100 px-3 py-2 text-xs font-bold uppercase tracking-wide text-[#071b41]">Waiver agreement</h2><div className="mt-3 max-h-64 overflow-y-auto rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-600"><p className="font-semibold text-slate-900">{data.waiver.title} · Version {data.waiver.version}</p><p className="mt-2 whitespace-pre-wrap">{data.waiver.content ?? "Review the event waiver before continuing."}</p></div><label className="mt-3 flex items-start gap-3 text-sm text-slate-700"><input className="mt-1" required type="checkbox" checked={registrant.acceptWaiver} onChange={(event) => onChange({ acceptWaiver: event.target.checked })} /><span>I have read and accept this event waiver.</span></label></section>}
        {step >= 2 && !data.waiver && <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">No waiver is required for this event.</p>}
      </fieldset>}
    </article>
  );
}

export default function RegisterPage({
  params,
}: {
  params: { eventId: string };
}) {
  const [data, setData] = useState<RegistrationInfo | null>(null);
  const [registrants, setRegistrants] = useState<RegistrantDraft[]>(() => [blankRegistrant("registrant-1")]);
  const [promoCode, setPromoCode] = useState("");
  const [message, setMessage] = useState("Loading registration details...");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [pricingNow, setPricingNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [registrationHref, setRegistrationHref] = useState<string | null>(null);
  const [registrationReference, setRegistrationReference] = useState<string | null>(null);
  const idempotencyKey = useRef<string>("");
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const interval = window.setInterval(() => setPricingNow(Date.now()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    idempotencyKey.current = crypto.randomUUID();
    const supabase = createClient();
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(`/api/events/${params.eventId}/registration-info`, { cache: 'no-store' });
        if (cancelled) return;
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error ?? "Registration details could not be loaded");
        const info = body as RegistrationInfo;
        if (!Array.isArray(info.categories) || !Array.isArray(info.fields)) throw new Error("Registration details are incomplete. Please try again later.");
        setData(info);
        // A guest can start immediately. Session lookup and profile prefill are
        // optional enhancements and must never hold the registration form open.
        setAuthenticated(false);
        setMessage("");
        void supabase.auth.getUser().then(async ({ data: auth }) => {
          if (cancelled || !auth.user) return;
          setAuthenticated(true);
          try {
            const profileResponse = await fetch("/api/participant/profile");
            if (!profileResponse.ok || cancelled) return;
            const profileBody = await profileResponse.json();
            const profile = profileBody.profile ?? {};
            const prefilled: Record<string, string> = {
              first_name: profile.first_name ?? "", last_name: profile.last_name ?? "",
              birthdate: profile.birthdate ?? "", email: profileBody.email ?? "",
              contact_number: profile.mobile ?? "", address: profile.address ?? "",
              emergency_contact: profile.emergency_contact_name ?? "",
              emergency_contact_phone: profile.emergency_contact_number ?? "",
            };
            setRegistrants((current) => current.map((registrant, index) => index === 0
              ? { ...registrant, answers: Object.fromEntries(Object.entries({ ...prefilled, ...registrant.answers }).filter(([, value]) => Boolean(value))) }
              : registrant));
          } catch {
            // Profile prefill is optional; participant details remain editable.
          }
        }).catch(() => {
          // Auth service availability is not a prerequisite for guest signup.
        });
      } catch (error) {
        if (!cancelled) setMessage(error instanceof Error ? error.message : "Registration details could not be loaded");
      }
    })();
    return () => { cancelled = true; };
  }, [params.eventId, loadAttempt]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data || busy) return;
    if (step === 1) {
      if (!formRef.current?.reportValidity()) return;
      if (!registrants.every((registrant) => registrant.categoryId)) {
        setMessage("Choose a race category for each registrant before continuing.");
        return;
      }
      setMessage("");
      setStep(2);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (registrants.some((registrant) => !registrant.categoryId)) {
      setMessage("Choose a race category for each registrant before continuing.");
      return;
    }
    const unavailable = registrants.map((registrant) => data.categories.find((category) => category.id === registrant.categoryId)).find((category) => !category || !['open', 'closing_soon'].includes(category.registration_availability));
    if (unavailable) {
      setMessage(unavailable?.availability_reason ?? 'This race distance is no longer available. Refresh the page and choose an open distance.');
      return;
    }
    setBusy(true);
    setStep(3);
    setRegistrationHref(null);
    setMessage("Saving your registration and preparing the next step...");
    try {
      const response = await fetch(`/api/events/${params.eventId}/register/group`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registrants: registrants.map((registrant) => ({
            category_id: registrant.categoryId,
            answers: registrant.answers,
            race_kit_selections: registrant.kitSelections,
            merchandise: Object.entries(registrant.merchandiseSelections).filter(([, selection]) => selection.quantity > 0).map(([item_id, selection]) => ({ item_id, quantity: selection.quantity, variant: selection.variant || null })),
            accept_waiver: registrant.acceptWaiver,
          })),
          promo_code: promoCode.trim() || undefined,
          idempotency_key: idempotencyKey.current,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        // Keep the key on server/network errors so a retry can recover an
        // already-created registration instead of opening a duplicate slot.
        if (response.status < 500) idempotencyKey.current = crypto.randomUUID();
        setMessage(body.error ?? "Registration could not be started. Please try again.");
        return;
      }
      const nextRegistrationHref = authenticated && typeof body.registration_id === "string"
        ? `/my-races/${encodeURIComponent(body.registration_id)}`
        : null;
      if (nextRegistrationHref) setRegistrationHref(nextRegistrationHref);
      const reference = Array.isArray(body.registration_numbers) ? body.registration_numbers[0] : null;
      if (typeof reference === "string") setRegistrationReference(reference);
      // An idempotent retry may return an old URL for a completed or cancelled
      // payment. Only active pending payments may launch hosted checkout.
      if (body.status === "pending" && typeof body.checkout_url === "string" && body.checkout_url) {
        window.location.assign(body.checkout_url);
        return;
      }
      if (body.status === "pending" || body.status === "processing") {
        setMessage(body.payment_setup_pending
          ? authenticated
            ? "Your registration details were saved, but online payment is not set up yet. Your place is not confirmed until payment is verified. Open My Races to review your registration."
            : "Your registration details were saved. Online payment is not set up yet, so your place is not confirmed. Keep your registration reference for follow-up."
          : authenticated
            ? "Your registration is saved. Continue to My Races to review its payment status."
            : "Your registration is saved. Keep your registration reference for payment follow-up.");
        return;
      }
      if (body.status === "succeeded") {
        setMessage("Payment is already confirmed. View your registration in My Races.");
        return;
      }
      if (body.status) {
        idempotencyKey.current = crypto.randomUUID();
        setMessage("The previous payment session is no longer active. Review your details and start a new secure checkout.");
        return;
      }
      setMessage("Your registration is saved. Open My Races to review the next step.");
    } catch {
      setMessage("We could not reach RaceDeck. Your entered details are still here; please try again.");
    } finally {
      setBusy(false);
      setStep(2);
    }
  }

  if (!data)
    return (
      <main className="mx-auto max-w-3xl p-6">
        <Link
          href={`/events/${params.eventId}`}
          className="text-sm font-semibold text-orange-600"
        >
          ← Back to event
        </Link>
        <p
          role="status"
          className="mt-6 rounded-xl border border-slate-200 p-5 text-sm text-slate-600"
        >
              {message}{registrationReference && <> Reference: <strong>{registrationReference}</strong>.</>}
        </p>
        {message !== "Loading registration details..." && (
          <button type="button" onClick={() => { setMessage("Loading registration details..."); setLoadAttempt((attempt) => attempt + 1); }} className="mt-3 rounded-lg bg-[#0b2b5b] px-4 py-2 text-sm font-semibold text-white hover:bg-[#123b78]">
            Try again
          </button>
        )}
      </main>
    );
  const selectedTotal = registrants.reduce((total, registrant) => {
    const category = data.categories.find((item) => item.id === registrant.categoryId);
    const merchandise = data.merchandise.reduce((sum, item) => sum + item.unit_price * (registrant.merchandiseSelections[item.id]?.quantity ?? 0), 0);
    const earlyBirdActive = Boolean(category?.early_bird_fee !== null && category?.early_bird_fee !== undefined && category.early_bird_deadline && Date.parse(category.early_bird_deadline) > pricingNow);
    return total + Number(earlyBirdActive ? category?.early_bird_fee : category?.regular_registration_fee ?? category?.registration_fee ?? 0) + merchandise;
  }, 0);
  const selectedCategories = registrants.map((registrant) => data.categories.find((category) => category.id === registrant.categoryId));
  const selectedCategoriesAvailable = selectedCategories.length > 0 && selectedCategories.every((category) => category && ['open', 'closing_soon'].includes(category.registration_availability));
  const anyCategoryAvailable = data.categories.some((category) => ['open', 'closing_soon'].includes(category.registration_availability));
  const updateRegistrant = (id: string, changes: Partial<RegistrantDraft>) => setRegistrants((current) => current.map((registrant) => registrant.id === id ? { ...registrant, ...changes } : registrant));
  const addRegistrant = () => setRegistrants((current) => current.length >= 10 ? current : [...current, blankRegistrant(crypto.randomUUID())]);
  return (
    <main className="min-h-screen bg-slate-100 px-3 py-5 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-6xl">
      <Link
        href={`/events/${params.eventId}`}
        className="text-sm font-semibold text-orange-600 hover:text-orange-700"
      >
        ← Back to event details
      </Link>
      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="relative h-32 bg-slate-100 sm:h-44">
          {data.event.banner_url ? (
            <Image
              src={data.event.banner_url}
              alt={`${data.event.name} banner`}
              fill
              unoptimized
              sizes="(max-width: 768px) 100vw, 1152px"
              className="object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-r from-[#071b41] via-[#102b58] to-[#a7421c]" />
          )}
        </div>
      </div>
      <div className="mt-5">
        <section className="min-w-0">
          <header>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-orange-600">
              RaceDeck PH · Participant registration
            </p>
            <h1 className="mt-1 text-2xl font-extrabold text-[#071b41] sm:text-3xl">
              Register for {data.event.name}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              {data.event.event_date} •{" "}
              {data.event.venue ??
                data.event.address ??
                "Venue to be announced"}
            </p>
            <p className="mt-2 text-sm font-medium text-slate-600">No RaceDeck account required. Enter the participant details to register.</p>
          </header>
          <div className="mt-5 rounded-xl border border-slate-200 bg-white px-4 py-4 sm:px-6">
            <p className="mb-3 text-right text-xs font-semibold text-slate-500">Step {step} of 3</p>
            <ol aria-label="Registration progress" className="grid grid-cols-3 gap-2">
              {(["Category & Information", "Waiver Agreement", "Payment"] as const).map((label, index) => {
                const itemStep = (index + 1) as 1 | 2 | 3;
                const isCurrent = step === itemStep;
                const isComplete = step > itemStep;
                return (
                  <li key={label} aria-current={isCurrent ? "step" : undefined} className={`flex min-w-0 items-center gap-1.5 text-[10px] font-semibold sm:gap-2 sm:text-sm ${isCurrent || isComplete ? "text-slate-800" : "text-slate-500"}`}>
                    <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold text-white sm:h-6 sm:w-6 sm:text-xs ${isCurrent || isComplete ? "bg-orange-500" : "bg-slate-500"}`}>{isComplete ? "✓" : itemStep}</span>
                    <span className="leading-tight">{label}</span>
                  </li>
                );
              })}
            </ol>
            <div role="progressbar" aria-label="Registration progress" aria-valuemin={1} aria-valuemax={3} aria-valuenow={step} className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-orange-500 transition-[width] duration-300" style={{ width: `${(step / 3) * 100}%` }} />
            </div>
          </div>
          {!anyCategoryAvailable && data.categories.length > 0 && <div role="status" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950"><p className="font-bold">Registration is unavailable</p><p>{data.categories[0]?.availability_reason || registrationAvailabilityMessage(data.event)}</p></div>}
          <form
            ref={formRef}
            onSubmit={submit}
            className="mt-4 space-y-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"
          >
            <div className="space-y-5">
              {registrants.map((registrant, index) => (
                <RegistrantFields
                  key={registrant.id}
                  data={data}
                  registrant={registrant}
                  index={index}
                  step={step}
                  pricingNow={pricingNow}
                  onChange={(changes) => updateRegistrant(registrant.id, changes)}
                  onRemove={registrants.length > 1 ? () => setRegistrants((current) => current.filter((item) => item.id !== registrant.id)) : undefined}
                />
              ))}
            </div>
            {step === 2 && <section>
              <h2 className="rounded-md bg-slate-100 px-3 py-2 text-xs font-bold uppercase tracking-wide text-[#071b41]">Promo code</h2>
              <p className="mt-2 text-sm text-slate-600">One code will be applied to eligible participants in this checkout.</p>
              <input
                value={promoCode}
                onChange={(event) => setPromoCode(event.target.value.toUpperCase())}
                maxLength={64}
                autoComplete="off"
                placeholder="Optional promo code"
                className="mt-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal text-slate-800 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
              />
            </section>}
            {step === 2 && <button type="button" onClick={() => { setStep(1); setMessage(""); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="w-full rounded-lg border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">Back to personal information</button>}
            <div className="flex flex-wrap items-center justify-center gap-3">
              {step === 1 && <button
                type="button"
                onClick={addRegistrant}
                disabled={registrants.length >= 10}
                className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[#0b2b5b] px-4 py-2.5 text-sm font-bold text-[#0b2b5b] transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                + Add another registrant{registrants.length >= 10 ? " (maximum 10)" : ""}
              </button>}
              <button
                disabled={busy || (step === 1 ? registrants.some((registrant) => !registrant.categoryId) : !selectedCategoriesAvailable)}
                className="min-h-11 min-w-[220px] rounded-lg bg-orange-600 px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {busy
                  ? step === 1 ? "Continuing..." : "Opening secure payment..."
                  : step === 1 && registrants.some((registrant) => !registrant.categoryId)
                    ? "Choose a race distance to continue"
                    : !selectedCategoriesAvailable
                      ? "Selected race distance unavailable"
                      : step === 1 ? "Continue" : `Continue to payment · ${peso(selectedTotal)}`}
              </button>
            </div>
            {message && (
              <p role="status" aria-live="polite" className="text-center text-sm text-slate-600">
                {message}
                {registrationHref && <> <Link href={registrationHref} className="font-semibold text-orange-700 underline underline-offset-2">Open My Races</Link></>}
              </p>
            )}
          </form>
        </section>
      </div>
      </div>
    </main>
  );
}

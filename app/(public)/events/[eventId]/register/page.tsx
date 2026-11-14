"use client";

import Link from "next/link";
import Image from "next/image";
import { Fragment, useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronRight, Clock3, LockKeyhole, Pencil, PhoneCall, ShoppingCart, Tag, Users, Zap } from "lucide-react";
import { EMERGENCY_CONTACT_RELATIONSHIPS } from "@/lib/registrations/emergency-contact";
import { parseVariantOptions } from "@/lib/events/variant-options";
import { bannerFrameStyle } from "@/lib/events/banner-frame";
import type { CheckoutPaymentMethod } from "@/lib/payments/gateway.interface";

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
type KitItem = { id: string; item_name: string; details: unknown; is_required: boolean; is_active: boolean; display_order: number; unavailable_variants?: string[] };
type KitConfig = { id: string; category_id: string | null; name: string; race_kit_items: KitItem[] };
type MerchandiseOption = { id: string; name: string; description: string | null; unit_price: number; variants: string[]; unavailable_variants?: string[]; image_urls: string[]; display_order: number };
const PAYMENT_METHOD_OPTIONS: Array<{ id: CheckoutPaymentMethod; label: string; detail: string; badge: string }> = [
  { id: "qrph", label: "QR Ph", detail: "Scan with a participating bank or e-wallet", badge: "QR" },
  { id: "paymaya", label: "Maya", detail: "Continue in the Maya app", badge: "M" },
  { id: "gcash", label: "GCash", detail: "Continue in the GCash app", badge: "G" },
];
type RegistrationInfo = {
  event: {
    id: string;
    name: string;
    banner_url: string | null;
    banner_position_x: number | null;
    banner_position_y: number | null;
    banner_zoom: number | null;
    poster_fallback: boolean;
    event_date: string;
    assembly_time: string | null;
    venue: string | null;
    address: string | null;
    organizer_name: string;
    registration_availability: string;
    registration_personal_fields: string[];
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
    variants: parseVariantOptions(value.variants).map((option) => option.name),
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
const manilaClockTime = (value: string | null) => {
  if (!value) return "To be announced";
  const [hours, minutes] = value.split(":").map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return value;
  return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${hours >= 12 ? "PM" : "AM"}`;
};
const reviewAnswer = (field: Field, value: string) => {
  if (field.field_type !== "multi_select") return value;
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.filter((item): item is string => typeof item === "string").join(", ") || "—";
    if (parsed && typeof parsed === "object") {
      const answer = parsed as { selected?: unknown; other?: unknown };
      const selected = Array.isArray(answer.selected) ? answer.selected.filter((item): item is string => typeof item === "string") : [];
      if (typeof answer.other === "string" && answer.other.trim()) selected.push(answer.other.trim());
      return selected.join(", ") || "—";
    }
  } catch { /* Display unstructured legacy answers as entered. */ }
  return value;
};

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

function VariantChoiceGroup({
  label,
  name,
  value,
  variants,
  unavailableVariants = [],
  required,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  variants: string[];
  unavailableVariants?: string[];
  required: boolean;
  onChange: (value: string) => void;
}) {
  return <fieldset className="mt-3 min-w-0">
    <legend className="text-sm font-semibold text-slate-800">{label}{required && <span className="ml-1 text-orange-600">*</span>}</legend>
    <div className="mt-2 flex flex-wrap gap-2">
      {variants.map((variant, index) => {
        const unavailable = unavailableVariants.includes(variant);
        return (
          <label key={`${variant}-${index}`} className={`w-fit max-w-full ${unavailable ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
            <input className="peer sr-only" type="radio" name={name} value={variant} checked={value === variant} required={required && !unavailable} disabled={unavailable} onChange={() => onChange(variant)} />
            <span className={`flex min-h-8 min-w-20 max-w-full items-center justify-center rounded-md border px-3 py-1 text-center text-sm font-medium transition peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-orange-500 ${unavailable ? 'border-green-700 bg-white text-green-700 line-through opacity-80' : 'border-[#ed3b36] bg-white text-slate-700 hover:bg-orange-50 peer-checked:bg-orange-50 peer-checked:text-[#071b41] peer-checked:ring-1 peer-checked:ring-[#ed3b36]'}`}>{unavailable ? `${variant} (Unavailable)` : variant}</span>
          </label>
        );
      })}
    </div>
    {variants.length > 0 && unavailableVariants.length >= variants.length && <p className="mt-2 text-xs font-semibold text-rose-700">All options are currently out of stock.</p>}
    {!required && value && <button type="button" onClick={() => onChange("")} className="mt-2 min-h-9 rounded-lg px-2 text-xs font-semibold text-slate-500 underline underline-offset-2 hover:text-slate-800">Clear size selection</button>}
  </fieldset>;
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
  step: 1 | 2 | 3 | 4;
  pricingNow: number;
  onChange: (value: Partial<RegistrantDraft>) => void;
  onRemove?: () => void;
}) {
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const collectsPersonalField = (key: string) => data.event.registration_personal_fields.includes(key);
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
      <input className="sr-only" type="radio" name={`category-${registrant.id}`} value={category.id} checked={selected} disabled={!available} required onChange={() => { onChange({ categoryId: category.id, kitSelections: {} }); setCategoryPickerOpen(false); }} />
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
      <div className="flex flex-wrap items-start justify-between gap-2 rounded-md border-l-4 border-orange-500 bg-[#0b2b5b] px-3 py-3 text-sm font-bold text-white sm:items-center sm:px-4">
        <span>Registrant No. {index + 1}</span>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2 sm:gap-3">
        <span className="min-w-0 break-words text-right text-xs font-medium text-white/80">{(() => { const selected = data.categories.find((category) => category.id === registrant.categoryId); return selected ? `${selected.category_group_name ? `${selected.category_group_name} · ` : ''}${selected.distance_km === null ? selected.name : `${selected.distance_km}K`}` : 'Choose a category to begin'; })()}</span>
          {onRemove && <button type="button" onClick={onRemove} className="rounded-md border border-white/40 px-2.5 py-1 text-xs font-bold text-white hover:bg-white/10">Remove</button>}
        </div>
      </div>

      {step === 1 && <section>
        <fieldset aria-describedby={!registrant.categoryId && data.categories.length > 0 ? categoryFirstHint : undefined}>
          <legend className="sr-only">Choose your race category (required)</legend>
          {data.categories.length === 0 ? <p role="status" className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">No race distances have been configured for this event yet.</p> : registrant.categoryId && !categoryPickerOpen ? <div className="mt-3 space-y-3">
            <div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold text-slate-700">Selected category</p><button type="button" onClick={() => setCategoryPickerOpen(true)} className="min-h-9 rounded-lg border border-[#0b2b5b] px-3 text-sm font-semibold text-[#0b2b5b] transition hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500">Change</button></div>
            {data.categories.find((category) => category.id === registrant.categoryId) && renderCategoryCard(data.categories.find((category) => category.id === registrant.categoryId)!)}
          </div> : <div className="mt-3 space-y-3">
            {registrant.categoryId && <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold text-slate-700">Choose a category or distance</p><button type="button" onClick={() => setCategoryPickerOpen(false)} className="min-h-9 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500">Keep current category</button></div>}
            {standaloneCategories.map(renderCategoryCard)}
            {groupedCategories.map(([groupName, categories]) => <details key={groupName} open={categoryPickerOpen || categories.some((category) => category.id === registrant.categoryId)} className="group rounded-xl border border-slate-200 bg-white">
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
            {collectsPersonalField("first_name") && <AnswerInput label="First Name" value={registrant.answers.first_name ?? ""} onChange={(value) => updateAnswer("first_name", value)} required />}
            {collectsPersonalField("middle_name") && <AnswerInput label="Middle Name (optional)" value={registrant.answers.middle_name ?? ""} onChange={(value) => updateAnswer("middle_name", value)} />}
            {collectsPersonalField("last_name") && <AnswerInput label="Last Name" value={registrant.answers.last_name ?? ""} onChange={(value) => updateAnswer("last_name", value)} required />}
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {collectsPersonalField("birthdate") && <AnswerInput label="Birthdate" type="date" value={registrant.answers.birthdate ?? ""} onChange={(value) => updateAnswer("birthdate", value)} required />}
            {collectsPersonalField("gender") && <label className="block min-w-0 text-sm font-semibold text-slate-800">Gender
              <select name="gender" autoComplete="sex" value={registrant.answers.gender ?? ""} onChange={(event) => updateAnswer("gender", event.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal text-slate-800 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100">
                <option value="">Select gender (optional)</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
              </select>
            </label>}
            {collectsPersonalField("email") && <AnswerInput label="Email" type="email" value={registrant.answers.email ?? ""} onChange={(value) => updateAnswer("email", value)} required />}
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {collectsPersonalField("contact_number") && <AnswerInput label="Contact Number" type="tel" value={registrant.answers.contact_number ?? ""} onChange={(value) => updateAnswer("contact_number", value)} required />}
            {collectsPersonalField("address") && <AnswerInput label="Address" value={registrant.answers.address ?? ""} onChange={(value) => updateAnswer("address", value)} required />}
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
              {details.variants.length > 0 && <VariantChoiceGroup label={item.item_name.trim().toLowerCase() === "race kit claiming" ? "Pickup or delivery" : "Size / option"} name={`kit-${registrant.id}-${item.id}`} value={registrant.kitSelections[item.id] ?? ""} variants={details.variants} unavailableVariants={item.unavailable_variants} required={item.is_required} onChange={(value) => onChange({ kitSelections: { ...registrant.kitSelections, [item.id]: value } })} />}
            </div>
            {details.images.length > 0 && <ProductImageCarousel images={details.images} label={item.item_name} />}
          </article>; })}</div>
        </section>}

        {data.merchandise.length > 0 && <section>
          <div className="flex flex-wrap items-end justify-between gap-2"><h2 className="text-lg font-bold text-slate-900">Optional merchandise</h2><span className="text-sm font-bold text-slate-700">Registrant subtotal: {peso(merchandiseTotal)}</span></div>
          <div className="mt-4 space-y-3">{data.merchandise.map((item) => { const selection = registrant.merchandiseSelections[item.id] ?? { quantity: 0, variant: "" }; const selected = selection.quantity > 0; const variants = item.variants ?? []; const images = item.image_urls ?? []; const checkboxId = `merch-${registrant.id}-${item.id}`; return <article key={item.id} className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-[minmax(0,1fr)_200px]">
            <div><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-[#071b41]">{item.name}</h3><span className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-bold text-orange-800">Optional</span></div>{item.description && <p className="mt-1 text-sm text-slate-600">{item.description}</p>}<p className="mt-2 text-sm font-bold text-[#071b41]">{peso(item.unit_price)} each</p>
              <label htmlFor={checkboxId} className={`mt-3 inline-flex min-h-10 items-center gap-2 text-sm font-medium text-slate-700 ${variants.length > 0 && variants.every((variant) => item.unavailable_variants?.includes(variant)) ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}><input id={checkboxId} type="checkbox" checked={selected} disabled={variants.length > 0 && variants.every((variant) => item.unavailable_variants?.includes(variant))} onChange={(event) => onChange({ merchandiseSelections: { ...registrant.merchandiseSelections, [item.id]: { quantity: event.target.checked ? 1 : 0, variant: event.target.checked ? selection.variant : "" } } })} className="h-4 w-4 accent-orange-600" />Add to order</label>
              {selected && variants.length > 0 && <VariantChoiceGroup label="Size / variant" name={`merch-${registrant.id}-${item.id}`} value={selection.variant} variants={variants} unavailableVariants={item.unavailable_variants} required onChange={(variant) => onChange({ merchandiseSelections: { ...registrant.merchandiseSelections, [item.id]: { ...selection, variant } } })} />}
              {selected && <div className="mt-2 flex items-center gap-3"><span className="text-sm text-slate-600">Quantity</span><div className="inline-flex items-center rounded-lg border border-slate-300" aria-label={`Quantity for ${item.name}`}><button type="button" aria-label={`Remove one ${item.name}`} disabled={selection.quantity <= 1} onClick={() => onChange({ merchandiseSelections: { ...registrant.merchandiseSelections, [item.id]: { ...selection, quantity: selection.quantity - 1 } } })} className="h-9 w-9 rounded-l-lg text-lg font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">−</button><span aria-live="polite" className="min-w-8 text-center text-sm font-semibold text-slate-900">{selection.quantity}</span><button type="button" aria-label={`Add one ${item.name}`} disabled={selection.quantity >= 5} onClick={() => onChange({ merchandiseSelections: { ...registrant.merchandiseSelections, [item.id]: { ...selection, quantity: selection.quantity + 1 } } })} className="h-9 w-9 rounded-r-lg text-lg font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">+</button></div><span className="text-sm font-semibold text-slate-700">{peso(item.unit_price * selection.quantity)}</span></div>}
            </div>
            {images.length > 0 && <div className={`grid ${images.length > 1 ? 'grid-cols-2' : 'grid-cols-1'} gap-2 sm:w-[200px] sm:justify-self-end`}>{images.map((image, imageIndex) => <Image key={`${image}-${imageIndex}`} src={image} alt={`${item.name} product photo ${imageIndex + 1}`} width={480} height={480} unoptimized className={`h-auto max-h-64 w-full rounded-lg object-contain ${images.length > 1 ? 'max-h-32' : ''}`} />)}</div>}
          </article>; })}</div>
        </section>}

        {(collectsPersonalField("emergency_contact") || collectsPersonalField("emergency_contact_phone") || collectsPersonalField("emergency_contact_relationship")) && <section><h2 className="rounded-md bg-slate-100 px-3 py-2 text-xs font-bold uppercase tracking-wide text-[#071b41]">Emergency contact information</h2><div className="mt-4 grid gap-4 md:grid-cols-3">{collectsPersonalField("emergency_contact") && <AnswerInput label="Emergency contact person" value={registrant.answers.emergency_contact ?? ""} onChange={(value) => updateAnswer("emergency_contact", value)} required />}{collectsPersonalField("emergency_contact_phone") && <AnswerInput label="Emergency contact phone" type="tel" value={registrant.answers.emergency_contact_phone ?? ""} onChange={(value) => updateAnswer("emergency_contact_phone", value)} required />}{collectsPersonalField("emergency_contact_relationship") && <label className="block min-w-0 text-sm font-semibold text-slate-800">Relationship to participant <span className="text-orange-600">*</span><select required value={registrant.answers.emergency_contact_relationship ?? ""} onChange={(event) => updateAnswer("emergency_contact_relationship", event.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal text-slate-800 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"><option value="">Select relationship</option>{EMERGENCY_CONTACT_RELATIONSHIPS.map((relationship) => <option key={relationship} value={relationship}>{relationship}</option>)}</select></label>}</div></section>}

        </>}

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
  const [promoStatus, setPromoStatus] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<CheckoutPaymentMethod>("qrph");
  const [acceptPlatformTerms, setAcceptPlatformTerms] = useState(false);
  const [message, setMessage] = useState("Loading registration details...");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [pricingNow, setPricingNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [registrationReference, setRegistrationReference] = useState<string | null>(null);
  const [registrationSaved, setRegistrationSaved] = useState(false);
  const idempotencyKey = useRef<string>("");
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const interval = window.setInterval(() => setPricingNow(Date.now()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    idempotencyKey.current = crypto.randomUUID();
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
        setMessage("");
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
      const requiredKitOutOfStock = registrants.some((registrant) => data.kits
        .filter((kit) => kit.category_id === null || kit.category_id === registrant.categoryId)
        .flatMap((kit) => kit.race_kit_items ?? [])
        .some((item) => {
          if (!item.is_active || !item.is_required || !item.unavailable_variants?.length) return false;
          const details = item.details && typeof item.details === "object" && !Array.isArray(item.details) ? item.details as Record<string, unknown> : {};
          const options = parseVariantOptions(details.variants).map((option) => option.name);
          return options.length > 0 && options.every((option) => item.unavailable_variants?.includes(option));
        }));
      if (requiredKitOutOfStock) {
        setMessage("A required included item is out of stock in every available size. Please contact the event organizer.");
        return;
      }
      setMessage("");
      setStep(2);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (step === 2) {
      if (!allWaiversAccepted) {
        setMessage("Please check I Agree to accept the Participant Waiver for all participants.");
        return;
      }
      if (!acceptPlatformTerms) {
        setMessage("Please accept the Platform Disclaimer and Terms and Conditions to continue.");
        return;
      }
      setMessage("");
      setStep(3);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (step === 3) {
      setMessage("");
      setStep(4);
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
    setRegistrationReference(null);
    setRegistrationSaved(false);
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
          payment_method: paymentMethod,
          idempotency_key: idempotencyKey.current,
            accept_platform_terms: acceptPlatformTerms,
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
      setRegistrationSaved(true);
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
          ? "Your registration details were saved. Online payment is not set up yet, so your place is not confirmed. Keep your registration reference for follow-up."
          : "Your registration is saved. Keep your registration reference for payment follow-up.");
        return;
      }
      if (body.status === "succeeded") {
        setMessage("Payment is already confirmed. Keep your registration reference for your records.");
        return;
      }
      if (body.status) {
        idempotencyKey.current = crypto.randomUUID();
        setMessage("The previous payment session is no longer active. Review your details and start a new secure checkout.");
        return;
      }
      setMessage("Your registration is saved. Keep your registration reference for follow-up.");
    } catch {
      setMessage("We could not reach RaceDeck. Your entered details are still here; please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!data)
    return (
      <main className="min-h-[60vh] bg-slate-100 px-3 pb-8 pt-4 sm:px-6 sm:pt-6">
        <div className="mx-auto max-w-6xl">
          <Link href={`/events/${params.eventId}`} className="text-sm font-semibold text-orange-600 hover:text-orange-700">← Back to event</Link>
          {message === "Loading registration details..." ? <div role="status" aria-live="polite" aria-busy="true" aria-label="Loading registration details" className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="h-28 animate-pulse bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 motion-reduce:animate-none sm:h-40" />
            <div className="space-y-5 p-4 sm:p-6">
              <div className="space-y-3"><div className="h-3 w-52 animate-pulse rounded bg-slate-200 motion-reduce:animate-none" /><div className="h-8 max-w-lg animate-pulse rounded bg-slate-200 motion-reduce:animate-none" /><div className="h-4 w-64 max-w-full animate-pulse rounded bg-slate-100 motion-reduce:animate-none" /></div>
              <div className="rounded-xl border border-slate-200 p-4 sm:p-5"><div className="mb-4 flex justify-end"><span className="h-3 w-20 animate-pulse rounded bg-slate-100 motion-reduce:animate-none" /></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[0, 1, 2, 3].map((item) => <div key={item} className="flex items-center gap-2"><span className="h-6 w-6 animate-pulse rounded-full bg-slate-200 motion-reduce:animate-none" /><span className="h-3 flex-1 animate-pulse rounded bg-slate-100 motion-reduce:animate-none" /></div>)}</div><div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full w-1/4 animate-pulse rounded-full bg-orange-400 motion-reduce:animate-none" /></div></div>
              <div className="space-y-4 rounded-2xl border border-slate-200 p-4 sm:p-6"><div className="h-5 w-48 animate-pulse rounded bg-slate-200 motion-reduce:animate-none" /><div className="grid gap-4 sm:grid-cols-2">{[0, 1].map((item) => <div key={item} className="h-36 animate-pulse rounded-xl border border-slate-100 bg-slate-50 motion-reduce:animate-none" />)}</div><div className="grid gap-4 sm:grid-cols-3">{[0, 1, 2].map((item) => <div key={item} className="h-11 animate-pulse rounded-lg bg-slate-100 motion-reduce:animate-none" />)}</div></div>
              <p className="text-center text-sm text-slate-500">Loading event registration…</p>
            </div>
          </div> : <div role="alert" className="mt-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-700">{message}{registrationReference && <> Reference: <strong>{registrationReference}</strong>.</>}</p><button type="button" onClick={() => { setMessage("Loading registration details..."); setLoadAttempt((attempt) => attempt + 1); }} className="mt-3 rounded-lg bg-[#0b2b5b] px-4 py-2 text-sm font-semibold text-white hover:bg-[#123b78]">Try again</button></div>}
        </div>
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
  const allWaiversAccepted = registrants.length > 0 && registrants.every((registrant) => registrant.acceptWaiver);
  const canReviewPayment = allWaiversAccepted && acceptPlatformTerms;
  const anyCategoryAvailable = data.categories.some((category) => ['open', 'closing_soon'].includes(category.registration_availability));
  const updateRegistrant = (id: string, changes: Partial<RegistrantDraft>) => setRegistrants((current) => current.map((registrant) => registrant.id === id ? { ...registrant, ...changes } : registrant));
  const addRegistrant = () => setRegistrants((current) => current.length >= 10 ? current : [...current, blankRegistrant(crypto.randomUUID())]);
  const participantWaiverSections = [
    { title: "1. Voluntary Participation & Physical Fitness", content: `I voluntarily choose to participate in ${data.event.name}, organized by ${data.event.organizer_name}. I confirm that I am physically able to take part and will seek medical advice if I have concerns about my fitness or health.` },
    { title: "2. Assumption of Risk", content: "I understand that running and event activities involve inherent risks, including falls, collisions, traffic, uneven surfaces, weather, heat, dehydration, illness, and other physical injury. I knowingly accept these inherent risks and will stop if I feel unwell or unsafe." },
    { title: "3. Release of Liability & Waiver", content: `To the extent permitted by Philippine law, I release ${data.event.organizer_name}, its event staff, volunteers, and service providers from claims arising from the inherent risks of participation or my own acts or omissions. This does not waive liability that cannot legally be excluded, including liability for fraud, willful misconduct, or gross negligence.` },
    { title: "4. Medical Consent", content: "If I become ill or injured, I authorize event personnel to seek reasonable emergency assistance for me when they consider it necessary. I understand that medical care and transport may involve costs for which I may be responsible, subject to applicable law." },
    { title: "5. Event Rules & Safety", content: `I will follow the event rules, route instructions, safety notices, and directions of ${data.event.organizer_name}'s staff, marshals, and authorities. I will not participate while impaired or behave in a way that endangers others.` },
    { title: "6. Personal Responsibility", content: "I am responsible for pacing myself, carrying any personal medication or supplies I need, and promptly telling event staff if I need help. I understand that event staff may remove me from the course for safety reasons." },
    { title: "7. Event Changes & Cancellation", content: `${data.event.organizer_name} may change the schedule, route, venue, or event arrangements, postpone, or cancel the event when needed for safety, weather, permits, public-authority directions, or circumstances beyond reasonable control. Refunds or credits will follow the event's published policy and applicable law.` },
    { title: "8. Registration Accuracy", content: "I confirm that the information submitted for this registration is accurate and belongs to the participant. I will promptly correct any material error and will not transfer a race number or registration unless the organizer permits it." },
    { title: "9. Personal Belongings", content: `${data.event.organizer_name} is not responsible for personal belongings that are lost, stolen, or damaged, except to the extent responsibility cannot legally be excluded.` },
    { title: "10. Photography & Media", content: "The event may be photographed or recorded for event documentation. Any optional use of an identifiable participant's image for promotional or marketing purposes requires the separate optional consent below and is not a condition of registration." },
    { title: "11. Data Privacy", content: `${data.event.organizer_name} and RaceDeck PH use registration information to administer the event, communicate essential updates, support safety, and process payment and registration records. Information will be handled under applicable Philippine data-protection law and the published Privacy Notice.` },
    { title: "12. Minor Participants & Guardian Consent", content: "A participant who will be under 18 on the event date may take part only with authorization from a parent or legal guardian. The guardian must provide their details and separately confirm authorization below for each minor participant." },
    { title: "13. Electronic Agreement", content: "By selecting “I Agree,” I confirm that I have read and understood this Participant Waiver and agree to it electronically for the participant(s) listed in this registration. The acceptance is recorded with this event registration." },
  ];
  return (
    <main className="min-h-screen bg-slate-100 px-4 pb-5 pt-2 sm:px-6 sm:pb-8 sm:pt-5">
      <div className="mx-auto max-w-[938px]">
      <Link
        href={`/events/${params.eventId}`}
        className="relative -top-1 text-sm font-semibold text-orange-600 hover:text-orange-700"
      >
        ← Back to event details
      </Link>
      <div className="mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="relative aspect-[4/1] min-h-40 bg-[#071b41]">
          {data.event.banner_url ? (
            <Image
              src={data.event.banner_url}
              alt={`${data.event.name} banner`}
              fill
              unoptimized
              sizes="(max-width: 768px) 100vw, 938px"
              className={data.event.poster_fallback ? "object-contain object-center p-2" : "object-cover object-center"}
              style={data.event.poster_fallback ? undefined : bannerFrameStyle({ x: data.event.banner_position_x, y: data.event.banner_position_y, zoom: data.event.banner_zoom })}
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center px-5 text-center text-xl font-bold text-white sm:text-2xl">{data.event.name}</div>
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
              {data.event.name}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              {data.event.event_date} •{" "}
              {data.event.venue ??
                data.event.address ??
                "Venue to be announced"}
            </p>
          </header>
          <div className="mt-5 rounded-xl border border-slate-200 bg-white px-4 py-4 sm:px-6">
            <ol aria-label="Registration progress" className="grid grid-cols-2 gap-x-3 gap-y-3 sm:grid-cols-4 sm:gap-y-0">
              {(["Category & Information", "Waiver Agreement", "Review", "Payment"] as const).map((label, index) => {
                const itemStep = (index + 1) as 1 | 2 | 3 | 4;
                const isCurrent = step === itemStep;
                const isComplete = step > itemStep;
                return (
                  <li key={label} aria-current={isCurrent ? "step" : undefined} className="relative flex min-w-0 items-center justify-start gap-2 sm:justify-center">
                    <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold transition-colors ${isCurrent || isComplete ? "bg-[#ed3b36] text-white" : "bg-slate-500 text-white"}`}>{isComplete ? "✓" : itemStep}</span>
                    <span className={`min-w-0 text-xs leading-tight sm:text-sm ${isCurrent ? "font-bold text-[#071b41]" : isComplete ? "font-semibold text-slate-700" : "font-medium text-slate-500"}`}>{label}</span>
                    {index < 3 && <ChevronRight aria-hidden="true" className="absolute -right-2 top-1/2 hidden h-4 w-4 -translate-y-1/2 text-slate-300 sm:block" />}
                  </li>
                );
              })}
            </ol>
            <div role="progressbar" aria-label="Registration progress" aria-valuemin={1} aria-valuemax={4} aria-valuenow={step} className="relative mt-3 h-5 overflow-hidden rounded-full bg-slate-200">
              <div className="flex h-full items-center justify-center rounded-full bg-[#ed3b36] transition-[width] duration-300" style={{ width: `${(step / 4) * 100}%` }}><span className="whitespace-nowrap px-1 text-[10px] font-semibold leading-none text-white sm:text-xs">Step {step} of 4</span></div>
            </div>
          </div>
          {!anyCategoryAvailable && data.categories.length > 0 && <div role="status" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950"><p className="font-bold">Registration is unavailable</p><p>{data.categories[0]?.availability_reason || registrationAvailabilityMessage(data.event)}</p></div>}
          <form
            ref={formRef}
            onSubmit={submit}
            className={`space-y-5 rounded-2xl border border-slate-200 bg-white shadow-sm ${step === 2 ? "mt-2 p-3 sm:p-4" : "mt-4 p-4 sm:p-6"}`}
          >
            {step === 1 && <div className="space-y-5">
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
            </div>}
            {step === 2 && <section aria-labelledby="participant-waiver-heading" className="space-y-4">
              <div>
                <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                  <div>
                    <h2 id="participant-waiver-heading" className="text-lg font-bold text-[#071b41]">Participant waiver</h2>
                  </div>
                  <span className="inline-flex w-fit shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">Version {data.waiver?.version ?? 1}</span>
                </div>
                <div role="region" aria-label="Complete participant waiver" tabIndex={0} className="mx-auto h-[min(32vh,250px)] w-full max-w-5xl overflow-x-hidden overflow-y-auto overscroll-contain rounded-xl border border-slate-200 bg-slate-50 p-4 text-[15px] leading-7 text-slate-700 break-words focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500 sm:h-[min(38vh,340px)] sm:p-5">
                  <div className="mx-auto max-w-[78ch] space-y-5">
                    {participantWaiverSections.map((section) => <section key={section.title}>
                      <h3 className="font-bold text-slate-900">{section.title}</h3>
                      <p className="mt-1">{section.content}{section.title.startsWith("11.") && <> <Link href="/legal/privacy" target="_blank" rel="noreferrer" className="font-semibold text-orange-700 underline underline-offset-2">Read the Privacy Notice</Link>.</>}</p>
                    </section>)}
                    {data.waiver?.content?.trim() && <section>
                      <h3 className="font-bold text-slate-900">Additional Event-Specific Terms · {data.waiver.title}</h3>
                      <p className="mt-1 whitespace-pre-wrap">{data.waiver.content}</p>
                    </section>}
                  </div>
                </div>
              </div>

              <fieldset className="mx-auto w-full max-w-5xl px-4 sm:px-5">
                <legend className="sr-only">Required agreements</legend>
                <div className="mx-auto w-full space-y-1">
                  <label className="flex min-h-9 cursor-pointer items-center gap-2 py-1 text-[13px] leading-5 text-slate-600">
                    <input type="checkbox" checked={allWaiversAccepted} onChange={(event) => setRegistrants((current) => current.map((registrant) => ({ ...registrant, acceptWaiver: event.target.checked })))} className="relative h-4 w-4 shrink-0 appearance-none rounded-[4px] border border-green-700 bg-white checked:bg-green-700 checked:after:absolute checked:after:left-[5px] checked:after:top-[1px] checked:after:h-2.5 checked:after:w-1 checked:after:rotate-45 checked:after:border-b-2 checked:after:border-r-2 checked:after:border-white checked:after:content-[''] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700" />
                    <span className="min-w-0 break-words lg:whitespace-nowrap">I have read and understood the terms of the <span className="font-semibold text-slate-700">{data.event.name}</span> waiver, and agree on behalf of the participant(s) in this registration.</span>
                  </label>
                  <label className="flex min-h-9 cursor-pointer items-center gap-2 py-1 text-[13px] leading-5 text-slate-600">
                    <input type="checkbox" checked={acceptPlatformTerms} onChange={(event) => setAcceptPlatformTerms(event.target.checked)} className="relative h-4 w-4 shrink-0 appearance-none rounded-[4px] border border-green-700 bg-white checked:bg-green-700 checked:after:absolute checked:after:left-[5px] checked:after:top-[1px] checked:after:h-2.5 checked:after:w-1 checked:after:rotate-45 checked:after:border-b-2 checked:after:border-r-2 checked:after:border-white checked:after:content-[''] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700" />
                    <span className="min-w-0 break-words lg:whitespace-nowrap">I agree to the <Link href="/legal/terms" target="_blank" rel="noreferrer" className="font-medium text-indigo-600 underline underline-offset-2">Platform Disclaimer and Terms and Conditions</Link>.</span>
                  </label>
                </div>
              </fieldset>

            </section>}
            {step === 3 && <section aria-labelledby="payment-review-heading" className="mx-auto w-full max-w-5xl space-y-4">
              <div className="min-w-0 space-y-4">
                <header className="px-1 pb-1">
                  <h2 id="payment-review-heading" className="text-xl font-extrabold text-[#071b41] sm:text-2xl">Review your registration</h2>
                  <p className="mt-1 text-sm text-slate-600">Please review your details below before proceeding with payment.</p>
                </header>

                <section aria-labelledby="review-category-heading" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                  <div className="flex items-center justify-between gap-3"><h3 id="review-category-heading" className="flex items-center gap-2 font-bold text-[#071b41]"><Zap className="h-5 w-5" aria-hidden="true" />Selected Category</h3><button type="button" onClick={() => { setStep(1); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-[#0b2b5b] hover:bg-slate-50"><Pencil className="h-3.5 w-3.5" aria-hidden="true" />Edit</button></div>
                  <div className="mt-3 space-y-3">
                    {registrants.map((registrant, index) => {
                      const category = data.categories.find((item) => item.id === registrant.categoryId);
                      const earlyBird = Boolean(category?.early_bird_fee !== null && category?.early_bird_fee !== undefined && category.early_bird_deadline && Date.parse(category.early_bird_deadline) > pricingNow);
                      const amount = Number(earlyBird ? category?.early_bird_fee : category?.regular_registration_fee ?? category?.registration_fee ?? 0);
                      const includedItems = data.kits
                        .filter((kitConfig) => kitConfig.category_id === null || kitConfig.category_id === category?.id)
                        .flatMap((kitConfig) => kitConfig.race_kit_items ?? [])
                        .filter((item) => item.is_active)
                        .sort((a, b) => a.display_order - b.display_order);
                      const selectedKitOptions = includedItems.filter((item) => registrant.kitSelections[item.id]);
                      const label = category?.distance_km ? `${category.distance_km}K` : category?.name ?? "Race category";
                      return <article key={registrant.id} className="grid gap-3 rounded-xl border border-orange-200 bg-orange-50/40 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                        <div className="min-w-0"><p className="font-bold text-slate-900">{registrants.length > 1 ? `Participant ${index + 1} · ` : ""}{label}</p><p className="mt-1 text-sm font-semibold text-orange-700">{peso(amount)}{earlyBird ? " · Early bird" : ""}</p><div className="mt-3 text-xs text-slate-600"><p className="font-semibold">INCLUSIONS</p>{includedItems.length > 0 ? <ul className="mt-1 list-inside list-disc">{includedItems.map((item) => <li key={item.id}>{item.item_name}</li>)}</ul> : <p className="mt-1">No kit inclusions listed for this category.</p>}{selectedKitOptions.length > 0 && <><p className="mt-2 font-semibold">YOUR KIT SELECTIONS</p><ul className="mt-1 list-inside list-disc">{selectedKitOptions.map((item) => <li key={item.id}>{item.item_name}: {registrant.kitSelections[item.id]}</li>)}</ul></>}</div></div>
                        <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm sm:min-w-40"><p className="flex items-center gap-2 font-semibold text-[#071b41]"><CalendarDays className="h-4 w-4" aria-hidden="true" />Race Schedule</p><p className="mt-2 font-semibold text-slate-800">{manilaShortDate(data.event.event_date)}</p><p className="mt-1 text-xs text-slate-500">Event date</p><p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-slate-700"><Clock3 className="h-3.5 w-3.5" aria-hidden="true" />Assembly: {manilaClockTime(data.event.assembly_time)}</p></div>
                      </article>;
                    })}
                  </div>
                </section>

                <section aria-labelledby="review-participant-heading" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                  <div className="flex items-center justify-between gap-3"><h3 id="review-participant-heading" className="flex items-center gap-2 font-bold text-[#071b41]"><Users className="h-5 w-5" aria-hidden="true" />Registrant Information</h3><button type="button" onClick={() => { setStep(1); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-[#0b2b5b] hover:bg-slate-50"><Pencil className="h-3.5 w-3.5" aria-hidden="true" />Edit</button></div>
                  <div className="mt-4 grid gap-x-4 gap-y-3 sm:grid-cols-2 xl:grid-cols-3">{registrants.map((registrant, index) => <div key={registrant.id} className="contents">
                    {registrants.length > 1 && <p className="col-span-full border-t border-slate-100 pt-3 text-xs font-bold uppercase tracking-wide text-slate-500">Participant {index + 1}</p>}
                    {[ ["First name", "first_name"], ["Middle name", "middle_name"], ["Last name", "last_name"], ["Birthdate", "birthdate"], ["Gender", "gender"], ["Email", "email"], ["Contact number", "contact_number"], ["Address", "address"] ].filter(([, key]) => data.event.registration_personal_fields.includes(key)).map(([label, key]) => <div key={key} className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 break-words text-sm font-medium text-slate-800">{registrant.answers[key] || "—"}</p></div>)}
                    {data.fields.filter((field) => registrant.answers[field.id]).map((field) => <div key={field.id} className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{field.label}</p><p className="mt-1 break-words text-sm font-medium text-slate-800">{reviewAnswer(field, registrant.answers[field.id])}</p></div>)}
                  </div>)}</div>
                </section>

                {registrants.some((registrant) => Object.values(registrant.merchandiseSelections).some((selection) => selection.quantity > 0)) && <section aria-labelledby="review-merch-heading" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                  <div className="flex items-center justify-between gap-3"><h3 id="review-merch-heading" className="flex items-center gap-2 font-bold text-[#071b41]"><ShoppingCart className="h-5 w-5" aria-hidden="true" />Optional Merchandise</h3><button type="button" onClick={() => { setStep(1); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-[#0b2b5b] hover:bg-slate-50"><Pencil className="h-3.5 w-3.5" aria-hidden="true" />Edit</button></div>
                  <div className="mt-3 divide-y divide-slate-100">{registrants.map((registrant) => data.merchandise.filter((item) => (registrant.merchandiseSelections[item.id]?.quantity ?? 0) > 0).map((item) => { const selection = registrant.merchandiseSelections[item.id]; return <div key={`${registrant.id}-${item.id}`} className="flex items-center justify-between gap-3 py-3"><div className="flex min-w-0 items-center gap-3">{item.image_urls[0] && <Image src={item.image_urls[0]} alt="" width={56} height={56} unoptimized className="h-14 w-14 shrink-0 rounded-lg object-cover" />}<div className="min-w-0"><p className="break-words text-sm font-semibold text-slate-800">{item.name}{selection.variant ? ` · ${selection.variant}` : ""}</p><p className="text-xs text-slate-500">Qty {selection.quantity} · {peso(item.unit_price)} each</p></div></div><strong className="shrink-0 text-sm text-slate-800">{peso(item.unit_price * selection.quantity)}</strong></div>; }))}</div>
                </section>}

                {data.event.registration_personal_fields.some((field) => ["emergency_contact", "emergency_contact_phone", "emergency_contact_relationship"].includes(field)) && <section aria-labelledby="review-emergency-heading" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                  <div className="flex items-center justify-between gap-3"><h3 id="review-emergency-heading" className="flex items-center gap-2 font-bold text-[#071b41]"><PhoneCall className="h-5 w-5" aria-hidden="true" />Emergency Contact</h3><button type="button" onClick={() => { setStep(1); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-[#0b2b5b] hover:bg-slate-50"><Pencil className="h-3.5 w-3.5" aria-hidden="true" />Edit</button></div>
                  <div className="mt-3 space-y-2">{registrants.map((registrant, index) => <p key={registrant.id} className="break-words text-sm leading-6 text-slate-700">{registrants.length > 1 && <strong className="text-slate-900">Participant {index + 1}: </strong>}{data.event.registration_personal_fields.includes("emergency_contact") && <strong className="font-semibold text-slate-900">{registrant.answers.emergency_contact || "—"}</strong>}{data.event.registration_personal_fields.includes("emergency_contact_phone") && <span>{data.event.registration_personal_fields.includes("emergency_contact") ? " · " : ""}{registrant.answers.emergency_contact_phone || "—"}</span>}{data.event.registration_personal_fields.includes("emergency_contact_relationship") && <span>{data.event.registration_personal_fields.includes("emergency_contact") || data.event.registration_personal_fields.includes("emergency_contact_phone") ? " · " : ""}{registrant.answers.emergency_contact_relationship || "—"}</span>}</p>)}</div>
                </section>}

              </div>

            </section>}
            {step === 4 && <section aria-labelledby="payment-checkout-heading" className="mx-auto grid w-full max-w-5xl items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
              <div className="space-y-4">
                <header><h2 id="payment-checkout-heading" className="text-xl font-extrabold text-[#071b41] sm:text-2xl">Payment</h2><p className="mt-1 text-sm text-slate-600">Your participant details have been reviewed. Complete payment to finish registration.</p></header>
                <section aria-labelledby="secure-payment-heading" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <h3 id="secure-payment-heading" className="flex items-center gap-2 font-bold text-[#071b41]"><LockKeyhole className="h-5 w-5" aria-hidden="true" />Choose a payment method</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">Select how you’d like to pay. You’ll continue to PayMongo to securely complete checkout.</p>
                  <div role="radiogroup" aria-label="Payment method" className="mt-4 grid gap-2 sm:grid-cols-3">
                    {PAYMENT_METHOD_OPTIONS.map((method) => <label key={method.id} className="cursor-pointer">
                      <input className="peer sr-only" type="radio" name="payment-method" value={method.id} checked={paymentMethod === method.id} onChange={() => setPaymentMethod(method.id)} />
                      <span className="relative flex min-h-[76px] items-center gap-3 rounded-lg border border-slate-200 bg-white py-3 pl-3 pr-9 transition before:absolute before:right-3 before:top-1/2 before:h-4 before:w-4 before:-translate-y-1/2 before:rounded-full before:border before:border-slate-300 before:content-[''] after:absolute after:right-[17px] after:top-1/2 after:h-2 after:w-2 after:-translate-y-1/2 after:rounded-full after:bg-orange-600 after:opacity-0 after:content-[''] hover:border-orange-300 peer-checked:border-orange-600 peer-checked:bg-orange-50/60 peer-checked:ring-1 peer-checked:ring-orange-500 peer-checked:before:border-orange-600 peer-checked:after:opacity-100 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-orange-500">
                        <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-xs font-extrabold text-[#0b2b5b]">{method.badge}</span>
                        <span className="min-w-0 flex-1"><span className="block text-sm font-bold text-[#071b41]">{method.label}</span><span className="mt-0.5 block text-[11px] leading-4 text-slate-500">{method.detail}</span></span>
                      </span>
                    </label>)}
                  </div>
                  <p className="mt-3 text-xs leading-5 text-slate-500">Payment is processed securely by PayMongo. RaceDeck does not collect your wallet credentials.</p>
                </section>
                <section aria-labelledby="promo-code-heading" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <h3 id="promo-code-heading" className="font-bold text-[#071b41]">Promo code <span className="font-normal text-slate-500">(optional)</span></h3>
                  <p className="mt-1 text-sm text-slate-600">Apply a code before continuing to checkout.</p>
                  <div className="mt-3 flex gap-2"><label className="sr-only" htmlFor="registration-promo-code">Promo code</label><div className="relative min-w-0 flex-1"><Tag className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" /><input id="registration-promo-code" value={promoCode} onChange={(event) => { setPromoCode(event.target.value.toUpperCase()); setPromoStatus(""); }} maxLength={64} autoComplete="off" placeholder="Enter promo code" className="min-h-10 w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100" /></div><button type="button" onClick={() => setPromoStatus(promoCode.trim() ? "This code will be checked when secure checkout starts." : "Enter a promo code first.")} className="min-h-10 rounded-lg border border-[#0b2b5b] px-3 text-sm font-semibold text-[#0b2b5b] hover:bg-blue-50">Apply</button></div>
                  {promoStatus && <p role="status" className="mt-2 text-xs leading-5 text-slate-500">{promoStatus}</p>}
                  <p className="mt-2 text-xs leading-5 text-slate-500">Promo codes are validated when checkout starts. Eligible discounts will be reflected in the payment amount.</p>
                </section>
                {registrationSaved && <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950"><p className="font-bold">Registration details saved</p><p>{message}</p>{registrationReference && <p className="mt-1">Reference: <strong>{registrationReference}</strong></p>}</div>}
              </div>
              <aside aria-label="Payment total" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-6">
                <h3 className="text-lg font-bold text-[#071b41]">Amount due</h3>
                <p className="mt-1 text-sm text-slate-600">{registrants.length} participant{registrants.length === 1 ? "" : "s"} · {data.event.name}</p>
                <div className="mt-4 space-y-2 border-y border-slate-100 py-4">{registrants.map((registrant, index) => { const category = data.categories.find((item) => item.id === registrant.categoryId); const earlyBird = Boolean(category?.early_bird_fee !== null && category?.early_bird_fee !== undefined && category.early_bird_deadline && Date.parse(category.early_bird_deadline) > pricingNow); const categoryAmount = Number(earlyBird ? category?.early_bird_fee : category?.regular_registration_fee ?? category?.registration_fee ?? 0); const categoryName = category?.distance_km ? `${category.distance_km}K Registration` : `${category?.name ?? "Registration"}`; return <Fragment key={registrant.id}><div className="flex justify-between gap-3 text-sm"><span className="min-w-0 break-words">{registrants.length > 1 ? `Participant ${index + 1} · ` : ""}{categoryName}</span><span className="shrink-0">{peso(categoryAmount)}</span></div>{data.merchandise.filter((item) => (registrant.merchandiseSelections[item.id]?.quantity ?? 0) > 0).map((item) => <div key={item.id} className="flex justify-between gap-3 text-sm text-slate-600"><span className="min-w-0 break-words">{item.name} × {registrant.merchandiseSelections[item.id].quantity}</span><span className="shrink-0">{peso(item.unit_price * registrant.merchandiseSelections[item.id].quantity)}</span></div>)}</Fragment>; })}</div>
                <div className="mt-4 flex items-center justify-between gap-3 rounded-lg bg-orange-50 px-3 py-3 text-base font-extrabold text-orange-700"><span>Total</span><span>{peso(selectedTotal)}</span></div>
                <button type="button" onClick={() => { setStep(3); setMessage(""); window.scrollTo({ top: 0, behavior: "smooth" }); }} disabled={busy || registrationSaved} className="mt-4 min-h-11 w-full rounded-lg border border-[#0b2b5b] bg-white px-4 py-2.5 text-sm font-semibold text-[#0b2b5b] transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50">← Back to review</button>
                {!registrationSaved && <button type="submit" disabled={busy || !selectedCategoriesAvailable || !canReviewPayment} className="mt-2 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-orange-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-slate-300"><LockKeyhole className="h-4 w-4" aria-hidden="true" />{busy ? "Preparing secure checkout..." : "Pay & Complete Registration"}</button>}
              </aside>
            </section>}
            {step === 2 ? <div className="mx-auto flex w-full max-w-5xl flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-start">
              <button type="button" onClick={() => { setStep(1); setMessage(""); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-slate-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-600 sm:w-auto"><span aria-hidden="true">←</span> Back</button>
              <button disabled={busy || !selectedCategoriesAvailable || !canReviewPayment} className="inline-flex min-h-11 w-full min-w-[220px] items-center justify-center gap-2 rounded-lg bg-[#ed3b36] px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#d92f2b] disabled:cursor-not-allowed disabled:bg-slate-300 sm:w-auto">{busy ? "Preparing review..." : <>Review Registration <span aria-hidden="true">›</span></>}</button>
            </div> : step === 3 ? <div className="mx-auto flex w-full max-w-5xl flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button type="button" onClick={() => { setStep(2); setMessage(""); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Back to waiver</button>
              <button disabled={busy || !selectedCategoriesAvailable} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-orange-600 px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-slate-300">Continue to Payment <span aria-hidden="true">›</span></button>
            </div> : step === 4 ? null : <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end">
              {step === 1 && <button
                type="button"
                onClick={addRegistrant}
                disabled={registrants.length >= 10}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-[#0b2b5b] px-4 py-2.5 text-sm font-bold text-[#0b2b5b] transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                + Add another registrant{registrants.length >= 10 ? " (maximum 10)" : ""}
              </button>}
              <button
                disabled={busy || (step === 1 ? registrants.some((registrant) => !registrant.categoryId) : !selectedCategoriesAvailable)}
                className="min-h-11 w-full min-w-[220px] rounded-lg bg-orange-600 px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-slate-300 sm:w-auto"
              >
                {busy
                  ? step === 1 ? "Continuing..." : "Opening secure payment..."
                  : step === 1 && registrants.some((registrant) => !registrant.categoryId)
                    ? "Choose a race distance to continue"
                    : !selectedCategoriesAvailable
                      ? "Selected race distance unavailable"
                      : step === 1 ? "Continue" : `Continue to payment · ${peso(selectedTotal)}`}
              </button>
            </div>}
            {message && !(step === 4 && registrationSaved) && (
              <p role="status" aria-live="polite" className="text-center text-sm text-slate-600">
                {message}
              </p>
            )}
          </form>
        </section>
      </div>
      </div>
    </main>
  );
}

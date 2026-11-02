"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

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
    "short_text" | "long_text" | "dropdown" | "radio" | "checkbox" | "yes_no";
  is_required: boolean;
  event_registration_field_options: Option[];
};
type Category = {
  id: string;
  name: string;
  registration_fee: number;
  registration_availability: string;
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
    images: Array.isArray(value.product_image_urls) ? value.product_image_urls.filter((url): url is string => typeof url === "string") : [],
    sizeChart: typeof value.reference_image_url === "string" ? value.reference_image_url : "",
  };
}

const peso = (amount: number) => `PHP ${Number(amount).toFixed(2)}`;

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
  if (field.field_type === "dropdown" || field.field_type === "yes_no")
    return (
      <select
        required={field.is_required}
        aria-label={field.label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal text-slate-800 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
      >
        <option value="">Select an option</option>
        {field.field_type === "yes_no" ? (
          <>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </>
        ) : (
          options.map((option) => (
            <option key={option.id} value={option.value}>
              {option.label}
            </option>
          ))
        )}
      </select>
    );
  if (field.field_type === "radio")
    return (
      <div className="mt-2 space-y-2">
        {options.map((option) => (
          <label
            key={option.id}
            className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <input
              required={field.is_required}
              type="radio"
              name={field.id}
              value={option.value}
              checked={value === option.value}
              onChange={(event) => onChange(event.target.value)}
            />
            {option.label}
          </label>
        ))}
      </div>
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
  const autoComplete = label === "First Name" ? "given-name" : label === "Last Name" ? "family-name" : label === "Birthdate" ? "bday" : label === "Address" ? "street-address" : type === "email" ? "email" : type === "tel" ? "tel" : undefined;
  return (
    <label className="block text-sm font-semibold text-slate-800">
      {label}
      {required && <span className="text-orange-600"> *</span>}
      <input
        required={required}
        type={type}
        autoComplete={autoComplete}
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
  onChange,
  onRemove,
}: {
  data: RegistrationInfo;
  registrant: RegistrantDraft;
  index: number;
  onChange: (value: Partial<RegistrantDraft>) => void;
  onRemove?: () => void;
}) {
  const categoryKits = data.kits.filter((kit) => kit.category_id === registrant.categoryId);
  const sharedKits = data.kits.filter((kit) => kit.category_id === null);
  const selectedKits = (categoryKits.length ? categoryKits : sharedKits).flatMap((kit) => kit.race_kit_items ?? []).filter((item) => item.is_active).sort((a, b) => a.display_order - b.display_order);
  const merchandiseTotal = data.merchandise.reduce((total, item) => total + item.unit_price * (registrant.merchandiseSelections[item.id]?.quantity ?? 0), 0);
  const updateAnswer = (key: string, value: string) => onChange({ answers: { ...registrant.answers, [key]: value } });
  const categoryFirstHint = `category-first-${registrant.id}`;

  return (
    <article className="space-y-5 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 rounded-md border-l-4 border-orange-500 bg-[#0b2b5b] px-4 py-3 text-sm font-bold text-white">
        <span>Registrant No. {index + 1}</span>
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-white/80">{data.categories.find((category) => category.id === registrant.categoryId)?.name ?? "Choose a category to begin"}</span>
          {onRemove && <button type="button" onClick={onRemove} className="rounded-md border border-white/40 px-2.5 py-1 text-xs font-bold text-white hover:bg-white/10">Remove</button>}
        </div>
      </div>

      <section>
        <h2 className="rounded-md bg-slate-100 px-3 py-2 text-xs font-bold uppercase tracking-wide text-[#071b41]">Select race category <span className="text-orange-600">*</span></h2>
        {data.categories.length === 0 ? <p role="status" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Registration is currently unavailable for all race categories.</p> : <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {data.categories.map((category) => <label key={category.id} className={`cursor-pointer rounded-xl border p-4 transition focus-within:ring-2 focus-within:ring-orange-400 ${registrant.categoryId === category.id ? "border-orange-500 bg-orange-50 ring-1 ring-orange-500" : "border-slate-200 hover:border-orange-300"}`}>
            <input className="sr-only" type="radio" name={`category-${registrant.id}`} value={category.id} required checked={registrant.categoryId === category.id} onChange={() => onChange({ categoryId: category.id, kitSelections: {} })} />
            <span className="block font-bold text-slate-900">{category.name}</span><span className="mt-1 block text-sm text-slate-600">{peso(category.registration_fee)}</span>
          </label>)}
        </div>}
      </section>

      {!registrant.categoryId && data.categories.length > 0 && <p id={categoryFirstHint} role="status" className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900">Select a race category above to continue with this participant.</p>}

      <fieldset disabled={!registrant.categoryId} aria-describedby={!registrant.categoryId ? categoryFirstHint : undefined} className="min-w-0 space-y-5 disabled:opacity-50">
        <section>
          <h2 className="rounded-md bg-slate-100 px-3 py-2 text-xs font-bold uppercase tracking-wide text-[#071b41]">Personal information</h2>
          <p className="mt-3 text-xs text-slate-500">Enter details for the person who will take part. Event-specific questions configured by the organizer appear here.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <AnswerInput label="First Name" value={registrant.answers.first_name ?? ""} onChange={(value) => updateAnswer("first_name", value)} required />
            <AnswerInput label="Last Name" value={registrant.answers.last_name ?? ""} onChange={(value) => updateAnswer("last_name", value)} required />
            <AnswerInput label="Birthdate" type="date" value={registrant.answers.birthdate ?? ""} onChange={(value) => updateAnswer("birthdate", value)} required />
            <AnswerInput label="Email" type="email" value={registrant.answers.email ?? ""} onChange={(value) => updateAnswer("email", value)} required />
            <AnswerInput label="Contact Number" type="tel" value={registrant.answers.contact_number ?? ""} onChange={(value) => updateAnswer("contact_number", value)} required />
            <AnswerInput label="Address" value={registrant.answers.address ?? ""} onChange={(value) => updateAnswer("address", value)} required />
          </div>
          <label className="mt-4 block text-sm font-semibold text-slate-800">Shirt size <span className="text-xs font-normal text-slate-500">(optional)</span>
            <select value={registrant.answers.shirt_size ?? ""} onChange={(event) => updateAnswer("shirt_size", event.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-normal"><option value="">No shirt size</option>{["XS", "S", "M", "L", "XL", "XXL"].map((size) => <option key={size}>{size}</option>)}</select>
          </label>
          {data.fields.length > 0 && <div className="mt-5 space-y-4 border-t border-slate-100 pt-4">{data.fields.map((field) => <fieldset key={field.id} className="block text-sm font-semibold text-slate-800"><legend>{field.label}{field.is_required && <span className="text-orange-600"> *</span>}</legend><FieldInput field={field} value={registrant.answers[field.id] ?? ""} onChange={(value) => updateAnswer(field.id, value)} /></fieldset>)}</div>}
        </section>

        {selectedKits.length > 0 && <section>
          <h2 className="text-lg font-bold text-slate-900">Included race kit</h2><p className="mt-1 text-sm text-slate-600">Items configured for this selected category. Choose required sizes or variants below.</p>
          <div className="mt-4 space-y-3">{selectedKits.map((item) => { const details = kitDetails(item.details); return <article key={item.id} className="grid gap-4 rounded-xl border border-slate-200 p-4 sm:grid-cols-[minmax(0,1fr)_200px]">
            <div><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-[#071b41]">{item.item_name}</h3><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">Included</span></div>{details.description && <p className="mt-1 text-sm text-slate-600">{details.description}</p>}
              {details.variants.length > 0 && <label className="mt-3 block text-sm font-semibold text-slate-800">Option {item.is_required ? <span className="text-orange-600">*</span> : <span className="text-xs font-normal text-slate-500">(optional)</span>}<select required={item.is_required} value={registrant.kitSelections[item.id] ?? ""} onChange={(event) => onChange({ kitSelections: { ...registrant.kitSelections, [item.id]: event.target.value } })} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-normal"><option value="">Select an option</option>{details.variants.map((variant) => <option key={variant}>{variant}</option>)}</select></label>}
              {details.sizeChart && <a href={details.sizeChart} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-sm font-semibold text-orange-700 underline">View size chart</a>}
            </div>
            {details.images.length > 0 && <div className="grid grid-cols-2 gap-2 sm:grid-cols-1">{details.images.map((image, imageIndex) => <a key={`${image}-${imageIndex}`} href={image} target="_blank" rel="noreferrer" aria-label={`View ${item.item_name} photo ${imageIndex + 1}`}><Image src={image} alt={`${item.item_name} sample ${imageIndex + 1}`} width={440} height={224} unoptimized className="h-28 w-full rounded-lg border border-slate-200 object-cover" /></a>)}</div>}
          </article>; })}</div>
        </section>}

        {data.merchandise.length > 0 && <section>
          <div className="flex flex-wrap items-end justify-between gap-2"><div><h2 className="text-lg font-bold text-slate-900">Optional merchandise</h2><p className="mt-1 text-sm text-slate-600">Optional paid add-ons; they are not part of the included race kit.</p></div><span className="text-sm font-bold text-slate-700">Registrant subtotal: {peso(merchandiseTotal)}</span></div>
          <div className="mt-4 space-y-3">{data.merchandise.map((item) => { const selection = registrant.merchandiseSelections[item.id] ?? { quantity: 0, variant: "" }; const variants = item.variants ?? []; const images = item.image_urls ?? []; return <article key={item.id} className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-[minmax(0,1fr)_200px]">
            <div><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-[#071b41]">{item.name}</h3><span className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-bold text-orange-800">Optional</span></div>{item.description && <p className="mt-1 text-sm text-slate-600">{item.description}</p>}<p className="mt-2 text-sm font-bold text-[#071b41]">{peso(item.unit_price)} each</p>
              {variants.length > 0 && <label className="mt-3 block text-sm font-semibold text-slate-800">Variant {selection.quantity > 0 && <span className="text-orange-600">*</span>}<select required={selection.quantity > 0} value={selection.variant} onChange={(event) => onChange({ merchandiseSelections: { ...registrant.merchandiseSelections, [item.id]: { ...selection, variant: event.target.value } } })} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-normal"><option value="">Select an option</option>{variants.map((variant) => <option key={variant}>{variant}</option>)}</select></label>}
              <label className="mt-3 block max-w-48 text-sm font-semibold text-slate-800">Quantity<select value={selection.quantity} onChange={(event) => onChange({ merchandiseSelections: { ...registrant.merchandiseSelections, [item.id]: { ...selection, quantity: Number(event.target.value) } } })} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-normal">{[0, 1, 2, 3, 4, 5].map((quantity) => <option key={quantity} value={quantity}>{quantity === 0 ? "Not adding" : quantity}</option>)}</select></label>
            </div>
            {images.length > 0 && <div className="grid grid-cols-2 gap-2 sm:grid-cols-1">{images.map((image, imageIndex) => <a key={`${image}-${imageIndex}`} href={image} target="_blank" rel="noreferrer" aria-label={`View ${item.name} photo ${imageIndex + 1}`}><Image src={image} alt={`${item.name} sample ${imageIndex + 1}`} width={440} height={224} unoptimized className="h-28 w-full rounded-lg border border-slate-200 object-cover" /></a>)}</div>}
          </article>; })}</div>
        </section>}

        <section><h2 className="rounded-md bg-slate-100 px-3 py-2 text-xs font-bold uppercase tracking-wide text-[#071b41]">Emergency contact information</h2><div className="mt-4 grid gap-4 sm:grid-cols-2"><AnswerInput label="Emergency contact person" value={registrant.answers.emergency_contact ?? ""} onChange={(value) => updateAnswer("emergency_contact", value)} required /><AnswerInput label="Emergency contact phone" type="tel" value={registrant.answers.emergency_contact_phone ?? ""} onChange={(value) => updateAnswer("emergency_contact_phone", value)} required /></div></section>

        {data.waiver && <section><h2 className="rounded-md bg-slate-100 px-3 py-2 text-xs font-bold uppercase tracking-wide text-[#071b41]">Event waiver</h2><div className="mt-3 max-h-48 overflow-y-auto rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-600"><p className="font-semibold text-slate-900">{data.waiver.title} · Version {data.waiver.version}</p><p className="mt-2 whitespace-pre-wrap">{data.waiver.content ?? "Review the event waiver before continuing."}</p></div><label className="mt-3 flex items-start gap-3 text-sm text-slate-700"><input className="mt-1" required type="checkbox" checked={registrant.acceptWaiver} onChange={(event) => onChange({ acceptWaiver: event.target.checked })} /><span>I have read and accept this event waiver.</span></label></section>}
      </fieldset>
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
  const [busy, setBusy] = useState(false);
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [registrationHref, setRegistrationHref] = useState<string | null>(null);
  const idempotencyKey = useRef<string>("");

  useEffect(() => {
    idempotencyKey.current = crypto.randomUUID();
    const supabase = createClient();
    let cancelled = false;
    void (async () => {
      try {
        const [{ data: auth }, response] = await Promise.all([
          supabase.auth.getUser(),
          fetch(`/api/events/${params.eventId}/registration-info`),
        ]);
        if (cancelled) return;
        const signedIn = Boolean(auth.user);
        setAuthenticated(signedIn);
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error ?? "Registration details could not be loaded");
        const info = body as RegistrationInfo;
        if (!Array.isArray(info.categories) || !Array.isArray(info.fields)) throw new Error("Registration details are incomplete. Please try again later.");
        setData(info);
        // Each registrant must choose a category; profile details can still be prefilled.
        if (signedIn) {
          // Profile prefill is optional: its failure must not block registration.
          try {
            const profileResponse = await fetch("/api/participant/profile");
            if (profileResponse.ok) {
              const profileBody = await profileResponse.json();
              const profile = profileBody.profile ?? {};
              const prefilled: Record<string, string> = {
                first_name: profile.first_name ?? "", last_name: profile.last_name ?? "",
                birthdate: profile.birthdate ?? "", email: profileBody.email ?? "",
                contact_number: profile.mobile ?? "", address: profile.address ?? "",
                emergency_contact: profile.emergency_contact_name ?? "",
                emergency_contact_phone: profile.emergency_contact_number ?? "",
                shirt_size: profile.default_shirt_size ?? "",
              };
              setRegistrants((current) => current.map((registrant, index) => index === 0
                ? { ...registrant, answers: Object.fromEntries(Object.entries({ ...prefilled, ...registrant.answers }).filter(([, value]) => Boolean(value))) }
                : registrant));
            }
          } catch {
            // Participant can enter profile details directly in the form.
          }
        }
        if (!cancelled) setMessage("");
      } catch (error) {
        if (!cancelled) setMessage(error instanceof Error ? error.message : "Registration details could not be loaded");
      }
    })();
    return () => { cancelled = true; };
  }, [params.eventId, loadAttempt]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data || busy) return;
    if (registrants.some((registrant) => !registrant.categoryId)) {
      setMessage("Choose a race category for each registrant before continuing.");
      return;
    }
    if (data.event.registration_availability !== "open" && data.event.registration_availability !== "closing_soon") {
      setMessage(data.event.registration_availability === "not_yet_open" ? "Registration has not opened yet." : "Registration is currently closed.");
      return;
    }
    if (authenticated === false) {
      window.location.assign(
        `/login?next=${encodeURIComponent(`/events/${params.eventId}/register`)}`,
      );
      return;
    }
    if (authenticated === null) return;
    setBusy(true);
    setRegistrationHref(null);
    setMessage("Reserving your slot and preparing secure checkout...");
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
      const nextRegistrationHref = typeof body.registration_id === "string"
        ? `/my-races/${encodeURIComponent(body.registration_id)}`
        : null;
      if (nextRegistrationHref) setRegistrationHref(nextRegistrationHref);
      // An idempotent retry may return an old URL for a completed or cancelled
      // payment. Only active pending payments may launch hosted checkout.
      if (body.status === "pending" && typeof body.checkout_url === "string" && body.checkout_url) {
        window.location.assign(body.checkout_url);
        return;
      }
      if (body.status === "pending" || body.status === "processing") {
        setMessage("Your registration is saved. Continue to My Races to review its payment status.");
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
          {message}
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
    return total + Number(category?.registration_fee ?? 0) + merchandise;
  }, 0);
  const allCategoriesSelected = registrants.every((registrant) => Boolean(registrant.categoryId));
  const updateRegistrant = (id: string, changes: Partial<RegistrantDraft>) => setRegistrants((current) => current.map((registrant) => registrant.id === id ? { ...registrant, ...changes } : registrant));
  const addRegistrant = () => setRegistrants((current) => current.length >= 10 ? current : [...current, blankRegistrant(crypto.randomUUID())]);
  if (authenticated === false) {
    const returnToRegistration = `/events/${params.eventId}/register`;
    return (
      <main className="min-h-screen bg-slate-100 px-3 py-8 sm:px-6">
        <section className="mx-auto max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="bg-[#071b41] px-6 py-5 text-white">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-orange-300">RaceDeck PH · Registration</p>
            <h1 className="mt-2 text-2xl font-extrabold">Sign in to continue</h1>
            <p className="mt-2 text-sm text-white/80">Your account keeps payment updates and registration details together.</p>
          </div>
          <div className="p-6">
            <p className="font-semibold text-[#071b41]">{data.event.name}</p>
            <p className="mt-1 text-sm text-slate-600">{data.event.event_date} · {data.event.venue ?? data.event.address ?? "Venue to be announced"}</p>
            <p className="mt-4 text-sm leading-6 text-slate-600">Sign in or create a RaceDeck account first. You’ll return here to complete participant details and checkout.</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Link href={`/login?portal=participant&next=${encodeURIComponent(returnToRegistration)}`} className="rounded-lg bg-orange-600 px-5 py-3 text-center text-sm font-bold text-white transition hover:bg-orange-700">Sign in</Link>
              <Link href={`/register?next=${encodeURIComponent(returnToRegistration)}`} className="rounded-lg border border-slate-300 px-5 py-3 text-center text-sm font-bold text-[#071b41] transition hover:bg-slate-50">Create account</Link>
            </div>
            <Link href={`/events/${params.eventId}`} className="mt-5 inline-block text-sm font-semibold text-slate-600 underline underline-offset-2">Back to event details</Link>
          </div>
        </section>
      </main>
    );
  }
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
          </header>
          <div className="mt-4 grid grid-cols-3 overflow-hidden rounded-xl border border-slate-200 bg-white text-center text-[10px] font-bold sm:text-sm">
            <div className="bg-[#0b2b5b] px-2 py-3 text-white">1 · Choose category</div>
            <div className="px-2 py-3 text-slate-600">2 · Options &amp; waiver</div>
            <div className="px-2 py-3 text-slate-600">3 · Secure checkout</div>
          </div>
          <form
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
                  onChange={(changes) => updateRegistrant(registrant.id, changes)}
                  onRemove={registrants.length > 1 ? () => setRegistrants((current) => current.filter((item) => item.id !== registrant.id)) : undefined}
                />
              ))}
              <button
                type="button"
                onClick={addRegistrant}
                disabled={registrants.length >= 10}
                className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[#0b2b5b] px-4 py-2.5 text-sm font-bold text-[#0b2b5b] transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                + Add another registrant{registrants.length >= 10 ? " (maximum 10)" : ""}
              </button>
            </div>
            <section>
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
            </section>
            <button
              disabled={busy || !allCategoriesSelected || authenticated === null || !["open", "closing_soon"].includes(data.event.registration_availability)}
              className="w-full rounded-lg bg-orange-600 px-5 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {busy
                ? "Preparing checkout..."
                : !["open", "closing_soon"].includes(data.event.registration_availability)
                  ? data.event.registration_availability === "not_yet_open" ? "Registration has not opened" : "Registration is closed"
                  : `Continue to secure checkout · ${peso(selectedTotal)}`}
            </button>
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

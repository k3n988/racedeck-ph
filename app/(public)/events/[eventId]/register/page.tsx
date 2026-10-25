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
  return (
    <label className="block text-sm font-semibold text-slate-800">
      {label}
      {required && <span className="text-orange-600"> *</span>}
      <input
        required={required}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal text-slate-800 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
      />
    </label>
  );
}

export default function RegisterPage({
  params,
}: {
  params: { eventId: string };
}) {
  const [data, setData] = useState<RegistrationInfo | null>(null);
  const [categoryId, setCategoryId] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [kitSelections, setKitSelections] = useState<Record<string, string>>({});
  const [merchandiseSelections, setMerchandiseSelections] = useState<Record<string, { quantity: number; variant: string }>>({});
  const [acceptWaiver, setAcceptWaiver] = useState(false);
  const [message, setMessage] = useState("Loading registration details...");
  const [busy, setBusy] = useState(false);
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const idempotencyKey = useRef<string>("");

  useEffect(() => {
    idempotencyKey.current = crypto.randomUUID();
    const supabase = createClient();
    void Promise.all([
      supabase.auth
        .getUser()
        .then(({ data }) => setAuthenticated(Boolean(data.user))),
      fetch(`/api/events/${params.eventId}/registration-info`).then(
        async (response) => {
          const body = await response.json().catch(() => ({}));
          if (!response.ok)
            throw new Error(
              body.error ?? "Registration details could not be loaded",
            );
          setData(body as RegistrationInfo);
          setCategoryId(body.categories[0]?.id ?? "");
        },
      ),
    ])
      .then(() => setMessage(""))
      .catch((error) =>
        setMessage(
          error instanceof Error
            ? error.message
            : "Registration details could not be loaded",
        ),
      );
  }, [params.eventId]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data || !categoryId || busy) return;
    if (authenticated === false) {
      window.location.assign(
        `/login?next=${encodeURIComponent(`/events/${params.eventId}/register`)}`,
      );
      return;
    }
    if (authenticated === null) return;
    setBusy(true);
    setMessage("Reserving your slot and preparing secure checkout...");
    const response = await fetch(`/api/events/${params.eventId}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category_id: categoryId,
        answers,
        race_kit_selections: kitSelections,
        merchandise: Object.entries(merchandiseSelections).filter(([, selection]) => selection.quantity > 0).map(([item_id, selection]) => ({ item_id, quantity: selection.quantity, variant: selection.variant || null })),
        promo_code: promoCode.trim() || undefined,
        accept_waiver: acceptWaiver,
        idempotency_key: idempotencyKey.current,
      }),
    });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setMessage(
        body.error ?? "Registration could not be started. Please try again.",
      );
      return;
    }
    if (body.checkout_url) {
      window.location.assign(body.checkout_url);
      return;
    }
    setMessage("Your payment is pending. Open My Races to continue checkout.");
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
      </main>
    );
  const selectedCategory = data.categories.find(
    (category) => category.id === categoryId,
  );
  const categoryKits = data.kits.filter((kit) => kit.category_id === categoryId);
  const sharedKits = data.kits.filter((kit) => kit.category_id === null);
  const selectedKits = (categoryKits.length ? categoryKits : sharedKits).flatMap((kit) => kit.race_kit_items ?? []).filter((item) => item.is_active).sort((a, b) => a.display_order - b.display_order);
  const merchandiseTotal = data.merchandise.reduce((total, item) => total + item.unit_price * (merchandiseSelections[item.id]?.quantity ?? 0), 0);
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
      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
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
          <div className="mt-4 grid grid-cols-4 overflow-hidden rounded-xl border border-slate-200 bg-white text-center text-[10px] font-bold sm:text-sm">
            <div className="bg-[#0b2b5b] px-2 py-3 text-white">1 · Register</div>
            <div className="px-2 py-3 text-slate-500">2 · Agreement</div>
            <div className="px-2 py-3 text-slate-500">3 · Fulfillment</div>
            <div className="px-2 py-3 text-slate-500">4 · Checkout</div>
          </div>
          <form
            onSubmit={submit}
            className="mt-4 space-y-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"
          >
            <div className="flex items-center justify-between rounded-md border-l-4 border-orange-500 bg-[#0b2b5b] px-4 py-3 text-sm font-bold text-white">
              <span>Participant details</span>
              <span className="text-xs font-medium text-white/80">Required fields are marked *</span>
            </div>
            <section>
              <h2 className="rounded-md bg-slate-100 px-3 py-2 text-xs font-bold uppercase tracking-wide text-[#071b41]">
                Select your race category
              </h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {data.categories.map((category) => (
                  <label
                    key={category.id}
                    className={`cursor-pointer rounded-xl border p-4 transition ${categoryId === category.id ? "border-orange-500 bg-orange-50 ring-1 ring-orange-500" : "border-slate-200 hover:border-orange-300"}`}
                  >
                    <input
                      className="sr-only"
                      type="radio"
                      name="category"
                      value={category.id}
                      checked={categoryId === category.id}
                      onChange={() => { setCategoryId(category.id); setKitSelections({}); }}
                    />
                    <span className="block font-bold text-slate-900">
                      {category.name}
                    </span>
                    <span className="mt-1 block text-sm text-slate-600">
                      {peso(category.registration_fee)}
                    </span>
                  </label>
                ))}
              </div>
            </section>
            <section>
              <h2 className="rounded-md bg-slate-100 px-3 py-2 text-xs font-bold uppercase tracking-wide text-[#071b41]">
                Personal Information
              </h2>
              <div className="mt-4 space-y-4">
                <fieldset>
                  <legend className="text-sm font-semibold text-slate-800">Who are you registering? <span className="text-orange-600">*</span></legend>
                  <p className="mt-1 text-xs text-slate-500">Choose whether these participant details are yours or someone else?s.</p>
                  <div className="mt-3 grid gap-3 sm:max-w-xl sm:grid-cols-2">
                    {[
                      { value: "myself", title: "Myself", detail: "Registering yourself" },
                      { value: "someone_else", title: "Someone else", detail: "A family member or another participant" },
                    ].map((option) => (
                      <label key={option.value} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${(answers.form_for ?? "myself") === option.value ? "border-orange-500 bg-orange-50 ring-1 ring-orange-500" : "border-slate-200 hover:border-orange-300"}`}>
                        <input type="radio" name="form_for" required checked={(answers.form_for ?? "myself") === option.value} onChange={() => setAnswers((current) => ({ ...current, form_for: option.value }))} className="mt-1 accent-orange-600" />
                        <span><span className="block text-sm font-bold text-[#071b41]">{option.title}</span><span className="mt-0.5 block text-xs font-normal text-slate-500">{option.detail}</span></span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div className="grid gap-4 sm:grid-cols-2">
                  <AnswerInput
                    label="First Name"
                    value={answers.first_name ?? ""}
                    onChange={(value) =>
                      setAnswers((current) => ({
                        ...current,
                        first_name: value,
                      }))
                    }
                    required
                  />
                  <AnswerInput
                    label="Middle Name"
                    value={answers.middle_name ?? ""}
                    onChange={(value) =>
                      setAnswers((current) => ({
                        ...current,
                        middle_name: value,
                      }))
                    }
                  />
                  <AnswerInput
                    label="Last Name"
                    value={answers.last_name ?? ""}
                    onChange={(value) =>
                      setAnswers((current) => ({
                        ...current,
                        last_name: value,
                      }))
                    }
                    required
                  />
                  <AnswerInput
                    label="Birthdate"
                    type="date"
                    value={answers.birthdate ?? ""}
                    onChange={(value) =>
                      setAnswers((current) => ({
                        ...current,
                        birthdate: value,
                      }))
                    }
                    required
                  />
                  <AnswerInput
                    label="Age Range"
                    value={answers.age_range ?? ""}
                    onChange={(value) =>
                      setAnswers((current) => ({
                        ...current,
                        age_range: value,
                      }))
                    }
                    required
                  />
                  <label className="block text-sm font-semibold text-slate-800">
                    Gender <span className="text-orange-600">*</span>
                    <select
                      required
                      value={answers.gender ?? ""}
                      onChange={(event) =>
                        setAnswers((current) => ({
                          ...current,
                          gender: event.target.value,
                        }))
                      }
                      className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                    >
                      <option value="">-- Select Gender --</option>
                      <option>Male</option>
                      <option>Female</option>
                    </select>
                  </label>
                  <AnswerInput
                    label="Email"
                    type="email"
                    value={answers.email ?? ""}
                    onChange={(value) =>
                      setAnswers((current) => ({ ...current, email: value }))
                    }
                    required
                  />
                  <AnswerInput
                    label="Contact Number"
                    value={answers.contact_number ?? ""}
                    onChange={(value) =>
                      setAnswers((current) => ({
                        ...current,
                        contact_number: value,
                      }))
                    }
                    required
                  />
                  <AnswerInput
                    label="Company / School / Running Club"
                    value={answers.company_school_club ?? ""}
                    onChange={(value) =>
                      setAnswers((current) => ({
                        ...current,
                        company_school_club: value,
                      }))
                    }
                  />
                  <AnswerInput
                    label="Address"
                    value={answers.address ?? ""}
                    onChange={(value) => setAnswers((current) => ({ ...current, address: value }))}
                    required
                  />
                  <AnswerInput
                    label="Address line 2"
                    value={answers.address_line_2 ?? ""}
                    onChange={(value) => setAnswers((current) => ({ ...current, address_line_2: value }))}
                  />
                  <AnswerInput
                    label="City"
                    value={answers.city ?? ""}
                    onChange={(value) => setAnswers((current) => ({ ...current, city: value }))}
                    required
                  />
                  <AnswerInput
                    label="State / Province"
                    value={answers.province ?? ""}
                    onChange={(value) => setAnswers((current) => ({ ...current, province: value }))}
                    required
                  />
                  <AnswerInput
                    label="ZIP / Postal code"
                    value={answers.postal_code ?? ""}
                    onChange={(value) => setAnswers((current) => ({ ...current, postal_code: value }))}
                    required
                  />
                  <label className="block text-sm font-semibold text-slate-800">
                    Country <span className="text-orange-600">*</span>
                    <select required value={answers.country ?? ""} onChange={(event) => setAnswers((current) => ({ ...current, country: event.target.value }))} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal text-slate-800 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100">
                      <option value="">Select country</option><option>Philippines</option><option>Other</option>
                    </select>
                  </label>
                </div>
                <label className="block text-sm font-semibold text-slate-800">
                  Wave / Race Predicted Time{" "}
                  <span className="text-orange-600">*</span>
                  <select
                    required
                    value={answers.wave ?? ""}
                    onChange={(event) =>
                      setAnswers((current) => ({
                        ...current,
                        wave: event.target.value,
                      }))
                    }
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  >
                    <option value="">Select predicted wave</option>
                    <option>5K - Wave A (Below 40 mins)</option>
                    <option>5K - Wave B (Above 40 mins)</option>
                  </select>
                </label>
                <label className="block text-sm font-semibold text-slate-800">
                  Singlet Size <span className="text-orange-600">*</span>
                  <select
                    required
                    value={answers.singlet_size ?? ""}
                    onChange={(event) =>
                      setAnswers((current) => ({
                        ...current,
                        singlet_size: event.target.value,
                      }))
                    }
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  >
                    <option value="">Select singlet size</option>
                    {["XS", "S", "M", "L", "XL", "XXL"].map((size) => (
                      <option key={size}>{size}</option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm font-semibold text-slate-800">
                  Finisher Shirt Size <span className="text-orange-600">*</span>
                  <select
                    required
                    value={answers.finisher_shirt_size ?? ""}
                    onChange={(event) =>
                      setAnswers((current) => ({
                        ...current,
                        finisher_shirt_size: event.target.value,
                      }))
                    }
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  >
                    <option value="">Select finisher shirt size</option>
                    {['XS', 'S', 'M', 'L', 'XL', 'XXL'].map((size) => (
                      <option key={size}>{size}</option>
                    ))}
                  </select>
                </label>
                <p className="text-xs text-slate-500">Click image to enlarge</p>
              </div>
              <div className="mt-4 space-y-4">
                {data.fields.map((field) => (
                  <label
                    key={field.id}
                    className="block text-sm font-semibold text-slate-800"
                  >
                    {field.label}
                    {field.is_required && (
                      <span className="text-orange-600"> *</span>
                    )}
                    <FieldInput
                      field={field}
                      value={answers[field.id] ?? ""}
                      onChange={(value) =>
                        setAnswers((current) => ({
                          ...current,
                          [field.id]: value,
                        }))
                      }
                    />
                  </label>
                ))}
              </div>
            </section>
            {selectedKits.length > 0 && <section>
              <h2 className="text-xl font-bold text-slate-900">Race kit &amp; product options</h2>
              <p className="mt-1 text-sm text-slate-600">Review the included items and choose your preferred variants.</p>
              <div className="mt-4 space-y-4">{selectedKits.map((item) => { const details = kitDetails(item.details); return <article key={item.id} className="grid gap-4 rounded-xl border border-slate-200 p-4 sm:grid-cols-[minmax(0,1fr)_220px]">
                <div><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-[#071b41]">{item.item_name}</h3><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">Included</span></div>{details.description && <p className="mt-1 text-sm text-slate-600">{details.description}</p>}
                  {details.variants.length > 0 && <label className="mt-4 block text-sm font-semibold text-slate-800">Choose your option <span className="text-orange-600">*</span><select required value={kitSelections[item.id] ?? ""} onChange={(event) => setKitSelections((current) => ({ ...current, [item.id]: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"><option value="">Select {item.item_name.toLowerCase()} option</option>{details.variants.map((variant) => <option key={variant} value={variant}>{variant}</option>)}</select></label>}
                  {details.sizeChart && <a href={details.sizeChart} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-sm font-semibold text-orange-700 underline">View size chart</a>}
                </div>
                {details.images.length > 0 && <div className="grid grid-cols-2 gap-2 sm:grid-cols-1">{details.images.map((image, index) => <a key={`${image}-${index}`} href={image} target="_blank" rel="noreferrer" aria-label={`View ${item.item_name} photo ${index + 1}`}><Image src={image} alt={`${item.item_name} sample ${index + 1}`} width={440} height={224} unoptimized className="h-28 w-full rounded-lg border border-slate-200 object-cover" /></a>)}</div>}
              </article>; })}</div>
            </section>}
            {data.merchandise.length > 0 && <section>
              <div className="flex flex-wrap items-end justify-between gap-2"><div><h2 className="text-xl font-bold text-slate-900">Optional additional merchandise</h2><p className="mt-1 text-sm text-slate-600">Available to all categories. These items are paid add-ons, separate from your included race kit.</p></div><span className="text-sm font-bold text-slate-700">Subtotal: {peso(merchandiseTotal)}</span></div>
              <div className="mt-4 space-y-4">{data.merchandise.map((item) => { const selection = merchandiseSelections[item.id] ?? { quantity: 0, variant: "" }; const variants = item.variants ?? []; const images = item.image_urls ?? []; return <article key={item.id} className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-[minmax(0,1fr)_220px]">
                <div><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-[#071b41]">{item.name}</h3><span className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-bold text-orange-800">Optional add-on</span></div>{item.description && <p className="mt-1 text-sm text-slate-600">{item.description}</p>}<p className="mt-2 text-sm font-bold text-[#071b41]">{peso(item.unit_price)} each</p>
                  {variants.length > 0 && <label className="mt-3 block text-sm font-semibold text-slate-800">Variant {selection.quantity > 0 && <span className="text-orange-600">*</span>}<select required={selection.quantity > 0} value={selection.variant} onChange={(event) => setMerchandiseSelections((current) => ({ ...current, [item.id]: { ...selection, variant: event.target.value } }))} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"><option value="">Select an option</option>{variants.map((variant) => <option key={variant} value={variant}>{variant}</option>)}</select></label>}
                  <label className="mt-3 block max-w-48 text-sm font-semibold text-slate-800">Quantity<select value={selection.quantity} onChange={(event) => setMerchandiseSelections((current) => ({ ...current, [item.id]: { ...selection, quantity: Number(event.target.value) } }))} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm">{[0, 1, 2, 3, 4, 5].map((quantity) => <option key={quantity} value={quantity}>{quantity === 0 ? "Not adding" : quantity}</option>)}</select></label>
                </div>
                {images.length > 0 && <div className="grid grid-cols-2 gap-2 sm:grid-cols-1">{images.map((image, index) => <a key={`${image}-${index}`} href={image} target="_blank" rel="noreferrer" aria-label={`View ${item.name} photo ${index + 1}`}><Image src={image} alt={`${item.name} sample ${index + 1}`} width={440} height={224} unoptimized className="h-28 w-full rounded-lg border border-slate-200 object-cover" /></a>)}</div>}
              </article>; })}</div>
            </section>}
            <section>
              <h2 className="rounded-md bg-slate-100 px-3 py-2 text-xs font-bold uppercase tracking-wide text-[#071b41]">Emergency contact information</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <AnswerInput label="Emergency contact person" value={answers.emergency_contact ?? ""} onChange={(value) => setAnswers((current) => ({ ...current, emergency_contact: value }))} required />
                <AnswerInput label="Emergency contact phone" value={answers.emergency_contact_phone ?? ""} onChange={(value) => setAnswers((current) => ({ ...current, emergency_contact_phone: value }))} required />
              </div>
            </section>
            <section>
              <h2 className="rounded-md bg-slate-100 px-3 py-2 text-xs font-bold uppercase tracking-wide text-[#071b41]">
                Promo code
              </h2>
              <input
                value={promoCode}
                onChange={(event) =>
                  setPromoCode(event.target.value.toUpperCase())
                }
                maxLength={64}
                autoComplete="off"
                placeholder="Optional promo code"
                className="mt-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal text-slate-800 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
              />
            </section>
            {data.waiver && (
              <section>
                <h2 className="rounded-md bg-slate-100 px-3 py-2 text-xs font-bold uppercase tracking-wide text-[#071b41]">
                  Event waiver
                </h2>
                <div className="mt-3 max-h-48 overflow-y-auto rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                  <p className="font-semibold text-slate-900">
                    {data.waiver.title} · Version {data.waiver.version}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap">
                    {data.waiver.content ??
                      "Review the event waiver before continuing."}
                  </p>
                </div>
                <label className="mt-3 flex items-start gap-3 text-sm text-slate-700">
                  <input
                    className="mt-1"
                    required
                    type="checkbox"
                    checked={acceptWaiver}
                    onChange={(event) => setAcceptWaiver(event.target.checked)}
                  />
                  <span>I have read and accept this event waiver.</span>
                </label>
              </section>
            )}
            <button
              disabled={busy || !categoryId}
              className="w-full rounded-lg bg-orange-600 px-5 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {busy
                ? "Preparing checkout..."
                : `Continue to payment${selectedCategory ? ` · ${peso(selectedCategory.registration_fee)}` : ""}`}
            </button>
            {message && (
              <p role="status" className="text-center text-sm text-slate-600">
                {message}
              </p>
            )}
          </form>
        </section>
        <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-5">
          <h2 className="font-bold text-slate-900">Your slot hold</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Once checkout begins, RaceDeck holds your selected category slot for
            15 minutes. Your registration becomes confirmed only after verified
            payment.
          </p>
          <div className="mt-5 rounded-xl bg-white p-4 text-sm">
            {selectedCategory && <div className="mb-3 border-b border-slate-100 pb-3"><p className="font-semibold text-slate-900">Order summary</p><div className="mt-2 flex justify-between gap-3 text-slate-600"><span>{selectedCategory.name}</span><span>{peso(selectedCategory.registration_fee)}</span></div>{merchandiseTotal > 0 && <div className="mt-1 flex justify-between gap-3 text-slate-600"><span>Additional merchandise</span><span>{peso(merchandiseTotal)}</span></div>}<div className="mt-2 flex justify-between gap-3 font-bold text-[#071b41]"><span>Subtotal before fees</span><span>{peso(Number(selectedCategory.registration_fee) + merchandiseTotal)}</span></div></div>}
            <p className="font-semibold text-slate-900">What happens next</p>
            <ol className="mt-3 space-y-2 text-slate-600">
              <li>1. Slot is reserved</li>
              <li>2. Secure PayMongo checkout opens</li>
              <li>3. Gateway verifies payment</li>
              <li>4. RaceDeck confirms your registration</li>
            </ol>
          </div>
          {data.event.registration_closes_at && (
            <p className="mt-4 text-xs text-slate-500">
              Registration closes{" "}
              {new Date(data.event.registration_closes_at).toLocaleString()}
            </p>
          )}
        </aside>
      </div>
      </div>
    </main>
  );
}

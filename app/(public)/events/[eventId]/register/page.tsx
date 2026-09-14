"use client";

import Link from "next/link";
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
  waiver: {
    id: string;
    title: string;
    version: number;
    content: string | null;
  } | null;
};

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
        className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
      />
    );
  if (field.field_type === "dropdown" || field.field_type === "yes_no")
    return (
      <select
        required={field.is_required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
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
        className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
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
  const [registrantCount, setRegistrantCount] = useState("1");
  const [promoCode, setPromoCode] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
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
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Link
        href={`/events/${params.eventId}`}
        className="text-sm font-semibold text-orange-600 hover:text-orange-700"
      >
        ← Back to event details
      </Link>
      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="aspect-[4/1] min-h-40 bg-slate-100">
          {data.event.banner_url ? (
            <img
              src={data.event.banner_url}
              alt={`${data.event.name} banner`}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full bg-[#071b41]" />
          )}
        </div>
      </div>
      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section>
          <header>
            <p className="text-sm font-semibold uppercase tracking-[0.15em] text-orange-600">
              Secure race registration
            </p>
            <h1 className="mt-2 text-3xl font-extrabold text-slate-900">
              Register for {data.event.name}
            </h1>
            <p className="mt-2 text-slate-600">
              {data.event.event_date} •{" "}
              {data.event.venue ??
                data.event.address ??
                "Venue to be announced"}
            </p>
          </header>
          <div className="mt-5 grid grid-cols-4 overflow-hidden rounded-xl border border-slate-200 bg-white text-center text-xs font-bold">
            <div className="bg-orange-600 px-2 py-3 text-white">Register</div>
            <div className="px-2 py-3 text-slate-500">Agreements</div>
            <div className="px-2 py-3 text-slate-500">Fulfillment</div>
            <div className="px-2 py-3 text-slate-500">Checkout</div>
          </div>
          <form
            onSubmit={submit}
            className="mt-6 space-y-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"
          >
            <label className="block text-sm font-semibold text-slate-800">
              Registrants
              <select
                value={registrantCount}
                onChange={(event) => setRegistrantCount(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              >
                <option value="1">Registrant No. 1</option>
              </select>
            </label>
            <section>
              <h2 className="text-xl font-bold text-slate-900">
                1. Select your category
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
                      onChange={() => setCategoryId(category.id)}
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
              <h2 className="text-xl font-bold text-slate-900">
                Personal Information
              </h2>
              <div className="mt-4 space-y-4">
                <label className="block text-sm font-semibold text-slate-800">
                  I am completing this form for{" "}
                  <span className="text-orange-600">*</span>
                  <select
                    required
                    value={answers.form_for ?? "myself"}
                    onChange={(event) =>
                      setAnswers((current) => ({
                        ...current,
                        form_for: event.target.value,
                      }))
                    }
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  >
                    <option value="myself">Myself</option>
                    <option value="someone_else">Someone else</option>
                  </select>
                </label>
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
                <h3 className="pt-3 text-lg font-bold text-slate-900">
                  Emergency Contact Information
                </h3>
                <AnswerInput
                  label="Emergency Contact Person"
                  value={answers.emergency_contact ?? ""}
                  onChange={(value) =>
                    setAnswers((current) => ({
                      ...current,
                      emergency_contact: value,
                    }))
                  }
                  required
                />
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
            <section>
              <h2 className="text-xl font-bold text-slate-900">
                3. Promo code
              </h2>
              <input
                value={promoCode}
                onChange={(event) =>
                  setPromoCode(event.target.value.toUpperCase())
                }
                maxLength={64}
                autoComplete="off"
                placeholder="Optional promo code"
                className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </section>
            {data.waiver && (
              <section>
                <h2 className="text-xl font-bold text-slate-900">
                  4. Event waiver
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
              className="w-full rounded-xl bg-orange-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-slate-300"
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
        <aside className="h-fit rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <h2 className="font-bold text-slate-900">Your slot hold</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Once checkout begins, RaceDeck holds your selected category slot for
            15 minutes. Your registration becomes confirmed only after verified
            payment.
          </p>
          <div className="mt-5 rounded-xl bg-white p-4 text-sm">
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
    </main>
  );
}

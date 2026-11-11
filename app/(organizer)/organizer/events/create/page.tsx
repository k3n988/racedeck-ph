"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ContentEditor } from "@/components/organizer/content-editor";
import { OptionalEventLinks } from "@/components/organizer/optional-event-links";
import { eventPlatformLinkIsValid, type OptionalEventLinkPlatform } from "@/lib/events/event-social-links";
import { Check, Eye, Maximize2, X } from "lucide-react";
import { BannerFrameEditor, type BannerFrame } from "@/components/organizer/banner-frame-editor";
import { manilaDateTimeToIso } from "@/lib/events/category-pricing";
import { variantOptionsPayload } from "@/lib/events/variant-options";
import { DEFAULT_PARTICIPANT_WAIVER_CONTENT, DEFAULT_PARTICIPANT_WAIVER_TITLE, EVENT_NAME_TOKEN, eventWaiverContentForTitle } from "@/lib/events/default-participant-waiver";

type KitItem = { kind: "product" | "inclusion"; name: string; description: string; variants: string[]; variantSlots: Record<string, string>; productImages: UploadValue[]; referenceImage: UploadValue };
type MerchandiseItem = { name: string; description: string; unitPrice: string; variants: string[]; variantSlots: Record<string, string>; images: UploadValue[] };
type Category = {
  // Persisted as the participant-facing category group name when group mode is selected.
  name: string;
  groupId: string | null;
  distance: string;
  capacity: string;
  fee: string;
  earlyBirdEnabled: boolean;
  earlyBirdFee: string;
  earlyBirdDeadline: string;
  registrationOpen: string;
  registrationClose: string;
  gunStart: string;
  cutoff: string;
  kitItems: KitItem[];
};
type CategoryGroup = { id: string; name: string };
type UploadValue = { url: string; file: File | null };
type Sponsor = { name: string; logo: UploadValue };
type RegistrationQuestion = {
  id: string;
  section_key: 'additional' | 'health';
  label: string;
  field_type: 'short_text' | 'long_text' | 'yes_no' | 'dropdown' | 'radio' | 'multi_select';
  is_required: boolean;
  options: string[];
  other_option: boolean;
  optionDraft: string;
};
function RegistrationQuestionPreview({ question }: { question: RegistrationQuestion }) {
  const [answer, setAnswer] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const choices = [...question.options, ...(question.field_type === "multi_select" && question.other_option ? ["Other (please specify)"] : [])];
  const isOtherSelected = selected.includes("Other (please specify)");

  return (
    <fieldset className="min-w-0 text-sm text-slate-800">
      <legend className="font-semibold">{question.label.trim() || "Your question will appear here"}{question.is_required && <span className="text-orange-600"> *</span>}</legend>
      {question.field_type === "short_text" && <input aria-label={`Preview answer for ${question.label || "question"}`} value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="Enter your answer" className={input} />}
      {question.field_type === "long_text" && <textarea aria-label={`Preview answer for ${question.label || "question"}`} value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="Enter your answer" rows={3} className={input} />}
      {question.field_type === "dropdown" && <select aria-label={`Preview answer for ${question.label || "question"}`} value={answer} onChange={(event) => setAnswer(event.target.value)} className={input}><option value="">Select an option</option>{choices.map((choice) => <option key={choice} value={choice}>{choice}</option>)}</select>}
      {(question.field_type === "radio" || question.field_type === "yes_no") && (
        <div className="mt-2 space-y-2">
          {(question.field_type === "yes_no" ? ["Yes", "No"] : choices).map((choice) => (
            <label key={choice} className="flex w-fit cursor-pointer items-center gap-2 font-normal text-slate-700">
              <input type="radio" name={`preview-${question.id}`} value={choice} checked={answer === choice} onChange={() => setAnswer(choice)} className="h-5 w-5 accent-orange-600" />
              <span>{choice}</span>
            </label>
          ))}
        </div>
      )}
      {question.field_type === "multi_select" && (
        <div className="mt-2 flex flex-wrap gap-2">
          {choices.map((choice) => (
            <label key={choice} className="cursor-pointer">
              <input type="checkbox" checked={selected.includes(choice)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, choice] : current.filter((item) => item !== choice))} className="peer sr-only" />
              <span className="inline-flex min-h-10 items-center rounded-lg border border-slate-300 bg-white px-4 py-2 font-medium text-slate-700 transition hover:border-orange-400 peer-checked:border-orange-600 peer-checked:bg-orange-50 peer-checked:text-orange-800 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-orange-500">{choice}</span>
            </label>
          ))}
          {isOtherSelected && <input aria-label="Other preview answer" placeholder="Please specify" className={input} />}
        </div>
      )}
      {["radio", "dropdown", "multi_select"].includes(question.field_type) && choices.length === 0 && <p className="mt-2 text-xs font-normal text-slate-500">Add answer choices above to see them here.</p>}
    </fieldset>
  );
}
type EventPage = {
  id: string;
  title: string;
  type: "system" | "custom";
  visible: boolean;
  content: string;
};
const steps = [
  "Event Profile",
  "Dates & Location",
  "Categories, Pricing & Race Kit",
  "Content & Media",
  "Registration Setup",
  "Sponsors & Review",
];
const input =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 caret-slate-900 outline-none [color-scheme:light] placeholder:text-slate-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-100 disabled:bg-slate-100 disabled:text-slate-500";
const emptyUpload = (): UploadValue => ({ url: "", file: null });
const emptyKitItem = (kind: KitItem["kind"] = "product"): KitItem => ({ kind, name: "", description: "", variants: [], variantSlots: {}, productImages: [], referenceImage: emptyUpload() });
const emptyMerchandiseItem = (): MerchandiseItem => ({ name: "", description: "", unitPrice: "", variants: [], variantSlots: {}, images: [] });
const hasValidOptionalVariantSlots = (variants: string[], variantSlots: Record<string, string>) => variants.every((variant) => {
  const value = variantSlots[variant]?.trim();
  return !value || (Number.isSafeInteger(Number(value)) && Number(value) >= 0 && Number(value) <= 1000000);
});
const hasRichContent = (value: string) => Boolean(value.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim());
const toEventSlug = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const previewPeso = (value: string) => value.trim() && Number.isFinite(Number(value))
  ? new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(Number(value))
  : "Set a price";
const previewDate = (value: string) => {
  if (!value) return "Not set";
  const date = manilaDateTimeToIso(value);
  return date ? new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(new Date(date)) : "Invalid date";
};
const previewEventDate = (value: string) => value
  ? new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "Asia/Manila" }).format(new Date(`${value}T12:00:00+08:00`))
  : "Event date not set";
const emptyCategory = (groupId: string | null = null, name = ""): Category => ({
  name,
  groupId,
  distance: "",
  capacity: "",
  fee: "",
  earlyBirdEnabled: false,
  earlyBirdFee: "",
  earlyBirdDeadline: "",
  registrationOpen: "",
  registrationClose: "",
  gunStart: "",
  cutoff: "",
  kitItems: [],
});

function TextField({
  label,
  value,
  onChange,
  error,
  type = "text",
  required = false,
  min,
  max,
  maxLength,
  step,
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  type?: string;
  required?: boolean;
  min?: string;
  max?: string;
  maxLength?: number;
  step?: string;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <label className="block text-sm font-semibold text-slate-700">
      {label}
      {required && <span className="ml-1 text-orange-600">*</span>}
      <input
        required={required}
        type={type}
        min={min}
        max={max}
        maxLength={maxLength}
        step={step}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        className={`${input} ${error ? "border-red-500 focus:border-red-500 focus:ring-red-100" : ""}`}
      />
      {error && <span role="alert" className="mt-1 block text-xs font-medium text-red-700">{error}</span>}
      {hint && <span className="mt-1.5 block text-xs font-normal leading-5 text-slate-500">{hint}</span>}
    </label>
  );
}
function Upload({
  label,
  value,
  onChange,
  wide = false,
  multiple = false,
  onRemove,
  frame,
  onFrameChange,
  profilePreview = false,
}: {
  label: string;
  value: UploadValue | UploadValue[];
  onChange: (file: File, url: string) => void;
  wide?: boolean;
  multiple?: boolean;
  onRemove?: (index: number) => void;
  frame?: BannerFrame;
  onFrameChange?: (value: BannerFrame) => void;
  profilePreview?: boolean;
}) {
  const [uploadError, setUploadError] = useState("");
  const [originalOpen, setOriginalOpen] = useState(false);
  useEffect(() => {
    if (!originalOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOriginalOpen(false); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [originalOpen]);
  const previews = Array.isArray(value) ? value : [value];
  const containPreview = /chart|guide|logo/i.test(label);
  return (
    <div>
      <label className="block text-sm font-semibold text-slate-700">
        {label}
        <input
          type="file"
          multiple={multiple}
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            const invalid = files.find((file) => !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 10 * 1024 * 1024 || file.size === 0);
            if (invalid) {
              setUploadError(invalid.size > 10 * 1024 * 1024 ? `${invalid.name} is over 10 MB. Choose a smaller image.` : `${invalid.name} must be a JPG, PNG, or WEBP image.`);
              event.currentTarget.value = "";
              return;
            }
            setUploadError("");
            files.forEach((file) => onChange(file, URL.createObjectURL(file)));
            event.currentTarget.value = "";
          }}
          aria-invalid={Boolean(uploadError)}
          className={`${input} file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-slate-700`}
        />
      </label>
      <p className="mt-1 text-xs text-slate-500">JPG, PNG, or WEBP · up to 10 MB{label.toLowerCase().includes("banner") ? " · landscape images work best" : label.toLowerCase().includes("logo") ? " · shown without cropping" : ""}</p>
      {uploadError && <p role="alert" className="mt-1 text-xs font-medium text-red-700">{uploadError}</p>}
      <div className={`mt-2 flex flex-wrap gap-2 ${profilePreview ? "items-center justify-center" : ""}`}>
        {profilePreview && previews[0]?.url && <button type="button" onClick={() => setOriginalOpen(true)} aria-label="View original event logo" className="group relative rounded-full focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-200">
          <Image src={previews[0].url} alt={`${label} circular thumbnail`} width={112} height={112} unoptimized className="h-24 w-24 rounded-full border-2 border-white object-cover shadow-md ring-1 ring-slate-200 transition group-hover:brightness-90" />
          <span className="absolute inset-0 grid place-items-center rounded-full bg-slate-950/0 text-white transition group-hover:bg-slate-950/35"><Maximize2 size={18} className="opacity-0 group-hover:opacity-100" aria-hidden="true" /></span>
        </button>}
        {previews
          .filter((item) => item.url)
          .filter((_, index) => (!profilePreview || index > 0) && !(wide && /banner/i.test(label) && frame && onFrameChange && index === 0))
          .map((item, index) => (
            <div key={`${item.url}-${index}`} className="relative">
              <Image src={item.url} alt={`${label} preview ${index + 1}`} width={wide ? 1200 : 96} height={wide ? 400 : 96} unoptimized className={`rounded-lg border ${containPreview ? "bg-slate-50 object-contain" : "object-cover"} ${wide ? "aspect-[3/1] w-full" : "h-24 w-24"}`} />
              {onRemove && <button type="button" onClick={() => onRemove(index)} aria-label={`Remove ${label.toLowerCase()} ${index + 1}`} className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-white text-sm font-bold text-red-600 shadow ring-1 ring-slate-200">×</button>}
            </div>
          ))}
      </div>
      {profilePreview && originalOpen && previews[0]?.url && <div role="dialog" aria-modal="true" aria-label="Original event logo" className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/85 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setOriginalOpen(false); }}>
        <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col rounded-2xl bg-white p-3 shadow-2xl sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-3"><h2 className="font-bold text-[#071b41]">Original event logo</h2><button type="button" autoFocus onClick={() => setOriginalOpen(false)} aria-label="Close original logo" className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 text-slate-700 hover:bg-slate-100"><X size={18} /></button></div>
          <div className="grid min-h-0 flex-1 place-items-center overflow-auto rounded-lg bg-slate-100 p-2"><Image src={previews[0].url} alt="Original uploaded event logo" width={1600} height={1200} unoptimized className="max-h-[78vh] max-w-full object-contain" /></div>
        </div>
      </div>}
      {wide && /banner/i.test(label) && previews[0]?.url && frame && onFrameChange && <BannerFrameEditor src={previews[0].url} value={frame} onChange={onFrameChange} />}
    </div>
  );
}

function KitItemEditor({ item, onChange, onRemove }: { item: KitItem; onChange: (item: KitItem) => void; onRemove: () => void }) {
  const [variantDraft, setVariantDraft] = useState("");
  const addVariant = () => {
    const variant = variantDraft.trim();
    if (!variant || item.variants.some((value) => value.toLowerCase() === variant.toLowerCase())) return;
    onChange({ ...item, variants: [...item.variants, variant], variantSlots: { ...item.variantSlots, [variant]: "" } });
    setVariantDraft("");
  };
  return <article className="mt-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="mb-3 flex items-center justify-between gap-3"><div><h4 className="font-bold text-[#071b41]">Race kit item</h4><p className="text-xs text-slate-500">Add an informational inclusion or a product with selectable options.</p></div><button type="button" onClick={onRemove} className="rounded-lg px-2 py-1 text-sm font-bold text-red-600 hover:bg-red-50">Remove</button></div>
    <div className="grid gap-3 md:grid-cols-2">
      <label className="block text-sm font-semibold text-slate-700">{item.kind === "inclusion" ? "Inclusion name" : "Product name"}<input value={item.name} onChange={(event) => onChange({ ...item, name: event.target.value })} placeholder={item.kind === "inclusion" ? "e.g. E-certificate or Sports headband" : "e.g. Race singlet"} maxLength={160} className={input} /></label>
      <label className="block text-sm font-semibold text-slate-700">Description <span className="font-normal text-slate-400">(optional)</span><input value={item.description} onChange={(event) => onChange({ ...item, description: event.target.value })} placeholder={item.kind === "inclusion" ? "Add details only if the inclusion needs clarification" : "Add fabric, fit, or other helpful details"} maxLength={1000} className={input} /><span className="mt-1 block text-xs font-normal text-slate-500">You can leave this blank if the name, size options, and photos give participants enough information.</span></label>
    </div>
    {item.kind === "product" && <><div className="mt-4">
      <label className="block text-sm font-semibold text-slate-700">Available variants <span className="font-normal text-slate-400">(sizes, colors, or other options)</span></label>
      <div className="mt-2 space-y-2">{item.variants.map((variant) => <div key={variant} className="grid grid-cols-[minmax(0,1fr)_120px_auto] items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2"><span className="min-w-0 break-words text-sm font-semibold text-slate-700">{variant}</span>{item.name.trim().toLowerCase() !== "race kit claiming" && <label className="text-xs font-semibold text-slate-600">Slots (optional)<input type="number" min="0" max="1000000" step="1" inputMode="numeric" value={item.variantSlots[variant] ?? ""} onChange={(event) => onChange({ ...item, variantSlots: { ...item.variantSlots, [variant]: event.target.value } })} aria-label={`Optional private slot count for ${variant}`} placeholder="No limit" className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm font-normal outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100" /></label>}<button type="button" onClick={() => { const variantSlots = { ...item.variantSlots }; delete variantSlots[variant]; onChange({ ...item, variants: item.variants.filter((value) => value !== variant), variantSlots }); }} className="rounded px-2 py-1 text-slate-600 hover:bg-white" aria-label={`Remove ${variant}`}>×</button></div>)}</div>
      <div className="mt-2 flex gap-2"><input value={variantDraft} onChange={(event) => setVariantDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addVariant(); } }} placeholder="Add a variant, e.g. Kids Small" className={`${input} mt-0`} /><button type="button" onClick={addVariant} disabled={!variantDraft.trim()} className="shrink-0 rounded-lg border border-orange-300 px-3 text-sm font-bold text-orange-700 disabled:opacity-50">Add</button></div>
    </div>
    <div className="mt-4 grid gap-4 lg:grid-cols-2">
      <Upload label="Product photos (front, back, details)" value={item.productImages} multiple onChange={(file, url) => onChange({ ...item, productImages: [...item.productImages, { file, url }] })} onRemove={(imageIndex) => { const image = item.productImages[imageIndex]; if (image?.url.startsWith("blob:")) URL.revokeObjectURL(image.url); onChange({ ...item, productImages: item.productImages.filter((_, index) => index !== imageIndex) }); }} />
      <Upload label="Size chart or reference guide" value={item.referenceImage} onChange={(file, url) => { if (item.referenceImage.url.startsWith("blob:")) URL.revokeObjectURL(item.referenceImage.url); onChange({ ...item, referenceImage: { file, url } }); }} onRemove={() => { if (item.referenceImage.url.startsWith("blob:")) URL.revokeObjectURL(item.referenceImage.url); onChange({ ...item, referenceImage: emptyUpload() }); }} />
    </div>
    <p className="mt-2 text-xs text-slate-500">Use JPG, PNG, or WEBP images up to 10 MB each. Participants can choose a size or option when one is configured.</p></>}
    {item.kind === "inclusion" && <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">This item is shown as a bullet in the selected category’s inclusions. No size selection, product image, or size chart is required.</p>}
  </article>;
}

function MerchandiseEditor({ item, onChange, onRemove }: { item: MerchandiseItem; onChange: (item: MerchandiseItem) => void; onRemove: () => void }) {
  const [variantDraft, setVariantDraft] = useState("");
  const addVariant = () => { const variant = variantDraft.trim(); if (!variant || item.variants.some((value) => value.toLowerCase() === variant.toLowerCase())) return; onChange({ ...item, variants: [...item.variants, variant], variantSlots: { ...item.variantSlots, [variant]: "" } }); setVariantDraft(""); };
  return <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex items-start justify-between gap-3"><div><h4 className="font-bold text-[#071b41]">Additional merchandise</h4><p className="text-xs text-slate-500">Optional paid add-on available to every category.</p></div><button type="button" onClick={onRemove} className="rounded-lg px-2 py-1 text-sm font-bold text-red-600 hover:bg-red-50">Remove</button></div>
    <div className="mt-3 grid gap-3 md:grid-cols-2"><label className="block text-sm font-semibold text-slate-700">Product name<input value={item.name} onChange={(event) => onChange({ ...item, name: event.target.value })} placeholder="e.g. Event finisher shirt" className={input} /></label><label className="block text-sm font-semibold text-slate-700">Price (PHP)<input type="number" min="0.01" step="0.01" value={item.unitPrice} onChange={(event) => onChange({ ...item, unitPrice: event.target.value })} placeholder="450.00" className={input} /></label></div>
    <label className="mt-3 block text-sm font-semibold text-slate-700">Description <span className="font-normal text-slate-400">(optional)</span><input value={item.description} onChange={(event) => onChange({ ...item, description: event.target.value })} placeholder="Add fabric, fit, or other helpful details" className={input} /><span className="mt-1 block text-xs font-normal text-slate-500">Leave blank if the product name, size options, and photos are enough.</span></label>
    <div className="mt-3"><label className="block text-sm font-semibold text-slate-700">Variants <span className="font-normal text-slate-400">(optional, e.g. size or color)</span></label><div className="mt-2 space-y-2">{item.variants.map((variant) => <div key={variant} className="grid grid-cols-[minmax(0,1fr)_120px_auto] items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2"><span className="min-w-0 break-words text-sm font-semibold text-slate-700">{variant}</span><label className="text-xs font-semibold text-slate-600">Slots (optional)<input type="number" min="0" max="1000000" step="1" inputMode="numeric" value={item.variantSlots[variant] ?? ""} onChange={(event) => onChange({ ...item, variantSlots: { ...item.variantSlots, [variant]: event.target.value } })} aria-label={`Optional private slot count for ${variant}`} placeholder="No limit" className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm font-normal outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100" /></label><button type="button" onClick={() => { const variantSlots = { ...item.variantSlots }; delete variantSlots[variant]; onChange({ ...item, variants: item.variants.filter((value) => value !== variant), variantSlots }); }} aria-label={`Remove ${variant}`} className="rounded px-2 py-1 text-slate-600 hover:bg-white">×</button></div>)}</div><div className="mt-2 flex gap-2"><input value={variantDraft} onChange={(event) => setVariantDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addVariant(); } }} placeholder="Add option, e.g. Medium" className={`${input} mt-0`} /><button type="button" onClick={addVariant} disabled={!variantDraft.trim()} className="shrink-0 rounded-lg border border-orange-300 px-3 text-sm font-bold text-orange-700 disabled:opacity-50">Add</button></div></div>
    <div className="mt-4"><Upload label="Merchandise photos" value={item.images} multiple onChange={(file, url) => onChange({ ...item, images: [...item.images, { file, url }] })} onRemove={(imageIndex) => { const image = item.images[imageIndex]; if (image?.url.startsWith("blob:")) URL.revokeObjectURL(image.url); onChange({ ...item, images: item.images.filter((_, index) => index !== imageIndex) }); }} /></div>
  </article>;
}

export default function CreateEventPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [reviewedSteps, setReviewedSteps] = useState<boolean[]>(() => steps.map(() => false));
  const [attemptedSteps, setAttemptedSteps] = useState<boolean[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [draftEventId, setDraftEventId] = useState<string | null>(null);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [organizationSlug, setOrganizationSlug] = useState("");
  const [form, setForm] = useState({
    name: "",
    slug: "",
    tagline: "",
    facebook: "",
    description: "",
    eventDate: "",
    assemblyTime: "",
    registrationOpen: "",
    registrationClose: "",
    venue: "",
    address: "",
    mechanics: "",
    logo: emptyUpload(),
    banner: emptyUpload(),
  });
  const [optionalLinks, setOptionalLinks] = useState<Partial<Record<OptionalEventLinkPlatform, string>>>({});
  const [bannerFrame, setBannerFrame] = useState<BannerFrame>({ x: 50, y: 50, zoom: 1 });
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryMode, setCategoryMode] = useState<"groups" | "distances" | null>(null);
  const [categoryGroups, setCategoryGroups] = useState<CategoryGroup[]>([]);
  const [kitClaimingLocations, setKitClaimingLocations] = useState<string[]>([]);
  const [kitClaimingLocationDraft, setKitClaimingLocationDraft] = useState("");
  const [merchandise, setMerchandise] = useState<MerchandiseItem[]>([]);
  const [registrationQuestions, setRegistrationQuestions] = useState<RegistrationQuestion[]>([]);
  const [waiverTitle, setWaiverTitle] = useState(DEFAULT_PARTICIPANT_WAIVER_TITLE);
  const [waiverContent, setWaiverContent] = useState(DEFAULT_PARTICIPANT_WAIVER_CONTENT);
  const [posters, setPosters] = useState<UploadValue[]>([]);
  const [eventPages, setEventPages] = useState<EventPage[]>([
    {
      id: "event-details",
      title: "Event Details",
      type: "system",
      visible: true,
      content: "",
    },
    {
      id: "race-mechanics",
      title: "Race Mechanics",
      type: "system",
      visible: true,
      content: "",
    },
    { id: "faqs", title: "FAQs", type: "system", visible: true, content: "" },
  ]);
  const [activePage, setActivePage] = useState("event-details");
  const [showCustomTab, setShowCustomTab] = useState(false);
  const [customTabTitle, setCustomTabTitle] = useState("");
  const [sponsors, setSponsors] = useState<Record<string, Sponsor[]>>({
    "Presented By": [],
    "Official Partners": [],
    "Supported By": [],
  });
  useEffect(() => {
    let active = true;
    fetch("/api/organizer/organization", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json() as Promise<{ slug?: string | null; name?: string | null }>;
      })
      .then((organization) => {
        if (!active || !organization) return;
        const slug = organization.slug?.trim() || (organization.name ? toEventSlug(organization.name) : "");
        setOrganizationSlug(slug);
      })
      .catch(() => {
        // Keep the URL preview usable while organization details are unavailable.
      });
    return () => { active = false; };
  }, []);
  const update = <K extends keyof typeof form>(
    key: K,
    value: (typeof form)[K],
  ) => setForm((current) => ({ ...current, [key]: value }));
  const addRegistrationQuestion = (section_key: RegistrationQuestion['section_key']) => setRegistrationQuestions((current) => [...current, {
    id: crypto.randomUUID(), section_key, label: '', field_type: section_key === 'health' ? 'multi_select' : 'radio', is_required: false, options: [], other_option: false, optionDraft: '',
  }]);
  const updateRegistrationQuestion = (id: string, changes: Partial<RegistrationQuestion>) => setRegistrationQuestions((current) => current.map((question) => question.id === id ? { ...question, ...changes } : question));
  const updatePage = (id: string, changes: Partial<EventPage>) =>
    setEventPages((current) =>
      current.map((page) => (page.id === id ? { ...page, ...changes } : page)),
    );
  const addCategoryGroup = () => setCategoryGroups((current) => [...current, { id: crypto.randomUUID(), name: "" }]);
  const addDistanceToGroup = (group: CategoryGroup) => setCategories((current) => [...current, emptyCategory(group.id, group.name)]);
  const updateCategoryGroup = (groupId: string, changes: Partial<CategoryGroup>) => {
    setCategoryGroups((current) => current.map((group) => group.id === groupId ? { ...group, ...changes } : group));
    if (changes.name !== undefined) setCategories((current) => current.map((category) => category.groupId === groupId ? { ...category, name: changes.name! } : category));
  };
  const addCustomTab = () => {
    const title = customTabTitle.trim();
    if (
      !title ||
      eventPages.length >= 12 ||
      eventPages.some(
        (page) => page.title.toLowerCase() === title.toLowerCase(),
      )
    )
      return;
    const id =
      title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || `custom-${Date.now()}`;
    if (id === "announcements" || eventPages.some((page) => page.id === id)) {
      setMessage("A tab with a similar name already exists. Choose a different title.");
      return;
    }
    setEventPages((current) => [
      ...current,
      { id, title, type: "custom", visible: true, content: "" },
    ]);
    setActivePage(id);
    setCustomTabTitle("");
    setShowCustomTab(false);
  };
  const capacity = useMemo(
    () => categories.length > 0 && categories.every((category) => category.capacity.trim())
      ? categories.reduce((sum, category) => sum + Number(category.capacity), 0)
      : null,
    [categories],
  );
  const categoryStarted = (category: Category) => Boolean(category.name.trim() || category.distance.trim() || category.capacity.trim() || category.fee.trim() || category.earlyBirdEnabled || category.earlyBirdFee.trim() || category.earlyBirdDeadline || category.registrationOpen || category.registrationClose || category.gunStart.trim() || category.cutoff.trim() || category.kitItems.some((item) => item.name.trim()));
  const categoryHasRequiredInclusion = (category: Category) => category.kitItems.some((item) => Boolean(item.name.trim()));
  const categoryIsValid = (category: Category) => {
    const opensLocal = category.registrationOpen || (form.registrationOpen ? `${form.registrationOpen}T00:00` : '');
    const closesLocal = category.registrationClose || (form.registrationClose ? `${form.registrationClose}T23:59` : '');
    const categoryHasSchedule = Boolean(category.registrationOpen || category.registrationClose);
    const categoryScheduleValid = !categoryHasSchedule || Boolean(
      category.registrationOpen &&
      category.registrationClose &&
      category.registrationOpen < category.registrationClose &&
      form.eventDate &&
      category.registrationClose.slice(0, 10) <= form.eventDate &&
      manilaDateTimeToIso(category.registrationOpen) &&
      manilaDateTimeToIso(category.registrationClose),
    );
    const earlyBirdPriceValid = !category.earlyBirdEnabled || Boolean(
      category.earlyBirdFee.trim() && Number.isFinite(Number(category.earlyBirdFee)) &&
      Number(category.earlyBirdFee) >= 0 && Number(category.earlyBirdFee) < Number(category.fee) &&
      category.earlyBirdDeadline && manilaDateTimeToIso(category.earlyBirdDeadline),
    );
    const earlyBirdWindowValid = !category.earlyBirdEnabled || Boolean(
      category.earlyBirdDeadline && manilaDateTimeToIso(category.earlyBirdDeadline) &&
      (!opensLocal || category.earlyBirdDeadline > opensLocal) &&
      (!closesLocal || category.earlyBirdDeadline <= closesLocal) &&
      (!form.eventDate || category.earlyBirdDeadline < `${form.eventDate}T23:59`),
    );
    return Boolean(
      category.name.trim().length <= 120 && category.distance.trim() && Number.isFinite(Number(category.distance)) && Number(category.distance) > 0 && Number(category.distance) <= 9999.99 &&
      (!category.capacity.trim() || (Number.isInteger(Number(category.capacity)) && Number(category.capacity) > 0 && Number(category.capacity) <= 2147483647)) &&
      category.fee.trim() && Number.isFinite(Number(category.fee)) && Number(category.fee) >= 0 && Number(category.fee) <= 99999999.99 &&
      categoryHasRequiredInclusion(category) &&
      categoryScheduleValid &&
      earlyBirdPriceValid &&
      earlyBirdWindowValid,
    );
  };
  const categoriesReady = Boolean(categoryMode) && categories.length > 0 && categories.every(categoryIsValid) && (categoryMode !== "groups" || categoryGroups.every((group) => group.name.trim() && categories.some((category) => category.groupId === group.id)));
  const incompleteCategory = categories.some((category) => categoryStarted(category) && !categoryIsValid(category));
  const manilaToday = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const registrationWindowValid = Boolean(form.registrationOpen && form.registrationClose && form.registrationOpen <= form.registrationClose && form.eventDate && form.registrationClose <= form.eventDate);
  const registrationFieldsValid = (!form.registrationOpen && !form.registrationClose) || registrationWindowValid;
  const optionalLinksValid = Object.entries(optionalLinks).every(([key, value]) => eventPlatformLinkIsValid(key as OptionalEventLinkPlatform, value ?? ""));
  const contactFieldsValid = eventPlatformLinkIsValid("facebook", form.facebook) && optionalLinksValid;
  const capacityValid = capacity === null || capacity <= 2147483647;
  const registrationQuestionsReady = registrationQuestions.length <= 30 && registrationQuestions.every((question) => {
    const label = question.label.trim();
    if (!label || label.length > 160) return false;
    if (!["dropdown", "radio", "multi_select"].includes(question.field_type)) return true;
    const choices = [...question.options, ...(question.other_option ? ["Other (please specify)"] : [])];
    return !question.optionDraft.trim() && choices.length >= 2 && choices.every((choice) => Boolean(choice.trim()) && choice.length <= 160) && new Set(choices.map((choice) => choice.trim().toLowerCase())).size === choices.length;
  });
  const normalizedCategoryKeys = categories.map((category) => `${(categoryMode === "groups" ? categoryGroups.find((group) => group.id === category.groupId)?.name : "")?.trim().toLocaleLowerCase() || ""}|${Number(category.distance) || ""}`);
  const hasDuplicateCategoryNames = normalizedCategoryKeys.some((key, index) => key.endsWith("|") ? false : normalizedCategoryKeys.indexOf(key) !== index);
  const categoryEntries = categories.map((category, index) => ({ category, index }));
  const categorySections: Array<{ group: CategoryGroup | null; entries: typeof categoryEntries }> = categoryMode === "groups"
    ? categoryGroups.map((group) => ({ group, entries: categoryEntries.filter(({ category }) => category.groupId === group.id) }))
    : [{ group: null, entries: categoryEntries }];
  const previewCategorySections = categorySections
    .map(({ group, entries }) => ({ group, entries: entries.filter(({ category }) => categoryStarted(category)) }))
    .filter(({ group, entries }) => Boolean(
      entries.length
      || group?.name.trim(),
    ));
  const previewMerchandise = merchandise.filter((item) => Boolean(item.name.trim()));
  const hasParticipantPreviewContent = previewCategorySections.length > 0 || previewMerchandise.length > 0;
  const missing = [
    (!form.name.trim() || form.name.trim().length > 160) && "an event name (up to 160 characters)",
    (!form.slug.trim() || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug) || form.slug.length > 180) && "a valid public event URL slug",
    !form.eventDate && "event date",
    incompleteCategory && "complete or remove the unfinished race category",
    !categoryMode && "choose how to organize race categories",
    categoryMode === "groups" && categoryGroups.some((group) => !group.name.trim() || !categories.some((category) => category.groupId === group.id)) && "add a name and at least one distance to every category group",
    !registrationFieldsValid && "a valid registration date range",
    !eventPlatformLinkIsValid("facebook", form.facebook) && "a valid Facebook URL",
    !optionalLinksValid && "valid optional links",
    !capacityValid && "a total capacity below 2,147,483,647",
    !registrationQuestionsReady && "complete or remove unfinished registration questions",
  ].filter(Boolean) as string[];
  const ready = missing.length === 0;
  const submissionChecks = [
    { label: "Event name", complete: Boolean(form.name.trim() && form.name.trim().length <= 160) },
    { label: "Event date is today or later", complete: Boolean(form.eventDate && form.eventDate >= manilaToday) },
    { label: "Venue and complete address", complete: Boolean(form.venue.trim() && form.address.trim()) },
    { label: "Event description", complete: hasRichContent(eventPages.find((page) => page.id === "event-details")?.content || form.description) },
    { label: "Registration opening and closing dates are valid", complete: registrationWindowValid },
    { label: "Race categories and inclusions are complete", complete: categoriesReady },
    { label: "Facebook link is provided; any extra contact links are valid", complete: contactFieldsValid },
    { label: "Total category capacity is within the supported limit", complete: capacityValid },
    { label: "Registration questions are complete (if added)", complete: registrationQuestionsReady },
  ];
  const submissionReady = submissionChecks.every((check) => check.complete);
  const fieldCompletedSteps = [
    Boolean(form.name.trim() && contactFieldsValid),
    Boolean(form.eventDate && form.venue.trim() && form.address.trim()),
    categoriesReady,
    hasRichContent(eventPages.find((page) => page.id === "event-details")?.content || ""),
    registrationQuestionsReady,
    ready && submissionReady,
  ];
  const validImage = (upload: UploadValue) => !upload.file || (upload.file.size > 0 && upload.file.size <= 10 * 1024 * 1024 && ["image/jpeg", "image/png", "image/webp"].includes(upload.file.type));
  const hasPhysicalRaceKit = categories
    .flatMap((category) => category.kitItems)
    .some((item) => item.kind === "product" && Boolean(item.name.trim()));
  const validateSetupStep = (stepIndex: number): string[] => {
    if (stepIndex === 0) {
      const errors: string[] = [];
      if (!form.name.trim()) errors.push("Enter an event name.");
      else if (form.name.trim().length > 160) errors.push("Event name must be 160 characters or fewer.");
      if (!form.slug.trim() || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug) || form.slug.length > 180) errors.push("Public URL slug must use lowercase letters, numbers, and single hyphens (up to 180 characters).");
      if (!form.facebook.trim()) errors.push("Enter the event Facebook link.");
      else if (!eventPlatformLinkIsValid("facebook", form.facebook)) errors.push("Facebook link must point to Facebook (for example, https://facebook.com/your-page).");
      if (!optionalLinksValid) errors.push("Complete or remove each optional link. The URL must match its selected platform.");
      if (!validImage(form.logo)) errors.push("Event logo must be a JPG, PNG, or WEBP image up to 10 MB.");
      if (!validImage(form.banner)) errors.push("Banner must be a JPG, PNG, or WEBP image up to 10 MB.");
      return errors;
    }
    if (stepIndex === 1) {
      const errors: string[] = [];
      if (!form.eventDate) errors.push("Choose the event date.");
      else if (form.eventDate < manilaToday) errors.push("Event date cannot be in the past.");
      if ((form.registrationOpen || form.registrationClose) && !registrationWindowValid) errors.push("Enter both registration dates, set opening before closing, and close registration no later than the event date.");
      if (Boolean(form.venue.trim()) !== Boolean(form.address.trim())) errors.push("Enter both the venue name and complete address, or leave both blank while saving a draft.");
      return errors;
    }
    if (stepIndex === 2) {
      const errors: string[] = [];
      if (!categoryMode) errors.push("Choose whether to organize this event with category groups or by distance only.");
      if (categoryMode === "groups") categoryGroups.forEach((group, index) => {
        if (!group.name.trim()) errors.push(`Group ${index + 1}: enter a group name.`);
        if (!categories.some((category) => category.groupId === group.id)) errors.push(`Group ${index + 1}: add at least one race distance.`);
      });
      if (!categories.length) errors.push("Add at least one race category.");
      categories.forEach((category, index) => {
        const number = index + 1;
        if (category.name.trim().length > 120) errors.push(`Category ${number}: group name must be 120 characters or fewer.`);
        if (!category.distance.trim() || !Number.isFinite(Number(category.distance)) || Number(category.distance) <= 0 || Number(category.distance) > 9999.99) errors.push(`Category ${number}: enter a distance greater than 0 and no more than 9,999.99 km.`);
        if (category.capacity.trim() && (!Number.isInteger(Number(category.capacity)) || Number(category.capacity) <= 0 || Number(category.capacity) > 2147483647)) errors.push(`Category ${number}: capacity must be a positive whole number or left blank for unlimited slots.`);
        if (!category.fee.trim() || !Number.isFinite(Number(category.fee)) || Number(category.fee) < 0 || Number(category.fee) > 99999999.99) errors.push(`Category ${number}: enter a registration fee from PHP 0 to PHP 99,999,999.99.`);
        if (!categoryHasRequiredInclusion(category)) errors.push(`Category ${number}: add at least one simple inclusion or included product.`);
        if (Boolean(category.registrationOpen) !== Boolean(category.registrationClose)) errors.push(`Category ${number}: enter both distance registration dates, or leave both blank to use the event schedule.`);
        if (category.registrationOpen && category.registrationClose && category.registrationOpen >= category.registrationClose) errors.push(`Category ${number}: distance registration must close after it opens.`);
        if (category.registrationClose && form.eventDate && category.registrationClose.slice(0, 10) > form.eventDate) errors.push(`Category ${number}: registration cannot close after the event date.`);
        if (category.earlyBirdEnabled) {
          if (!category.earlyBirdFee.trim() || !Number.isFinite(Number(category.earlyBirdFee)) || Number(category.earlyBirdFee) < 0 || Number(category.earlyBirdFee) >= Number(category.fee)) errors.push(`Category ${number}: early bird price must be a valid amount lower than the regular price.`);
          const deadline = manilaDateTimeToIso(category.earlyBirdDeadline);
          if (!deadline) errors.push(`Category ${number}: choose a valid early bird deadline.`);
          else {
            const deadlineLocal = category.earlyBirdDeadline;
            const opensAt = category.registrationOpen || (form.registrationOpen ? `${form.registrationOpen}T00:00` : "");
            const closesAt = category.registrationClose || (form.registrationClose ? `${form.registrationClose}T23:59` : "");
            if (opensAt && deadlineLocal <= opensAt) errors.push(`Category ${number}: the early bird deadline must be after its registration opening date.`);
            if (closesAt && deadlineLocal > closesAt) errors.push(`Category ${number}: the early bird deadline cannot be after its registration closing date.`);
            if (form.eventDate && deadlineLocal >= `${form.eventDate}T23:59`) errors.push(`Category ${number}: the early bird deadline must be before the event date ends.`);
          }
        }
        if (category.gunStart && !/^([01]\d|2[0-3]):[0-5]\d$/.test(category.gunStart)) errors.push(`Category ${number}: enter a valid 24-hour start time.`);
        if (category.cutoff && !/^([01]\d|2[0-3]):[0-5]\d$/.test(category.cutoff)) errors.push(`Category ${number}: enter a valid 24-hour cut-off time.`);
      });
      if (hasDuplicateCategoryNames) errors.push(categoryMode === "groups" ? "A race distance is duplicated within its group. Change the distance or group." : "A race distance is duplicated. Change the distance.");
      if (!capacityValid) errors.push("Combined category capacity exceeds the supported maximum. Lower one or more category capacities.");
      const kitItems = categories.flatMap((category) => category.kitItems);
      kitItems.forEach((item, index) => {
        const started = Boolean(item.name.trim() || item.description.trim() || item.variants.length || item.productImages.length || item.referenceImage.file || item.referenceImage.url);
        if (started && !item.name.trim()) errors.push(`Race kit item ${index + 1}: add an inclusion or product name, or remove the incomplete item.`);
        if (item.name.trim().length > 160) errors.push(`Race kit item ${index + 1}: name must be 160 characters or fewer.`);
        if (item.description.trim().length > 1000) errors.push(`Race kit item ${index + 1}: description must be 1,000 characters or fewer.`);
        if (item.kind === "product") {
          if (item.variants.length > 40) errors.push(`Race kit item ${index + 1}: use no more than 40 variants.`);
          if (!hasValidOptionalVariantSlots(item.variants, item.variantSlots)) errors.push(`Race kit item ${index + 1}: any slot count entered must be a whole number from 0 to 1,000,000.`);
          if (item.productImages.length > 8) errors.push(`Race kit item ${index + 1}: upload no more than 8 product photos.`);
          if (!item.productImages.every(validImage) || !validImage(item.referenceImage)) errors.push(`Race kit item ${index + 1}: images must be JPG, PNG, or WEBP and no larger than 10 MB each.`);
        }
      });
      if (hasPhysicalRaceKit && kitClaimingLocationDraft.trim()) errors.push("Race kit claiming: add the typed location to the options list or clear the input.");
      if (hasPhysicalRaceKit && kitClaimingLocations.length > 40) errors.push("Race kit claiming: use no more than 40 pickup locations.");
      if (hasPhysicalRaceKit && kitClaimingLocations.some((location) => location.length > 160)) errors.push("Race kit claiming: each pickup location must be 160 characters or fewer.");
      merchandise.forEach((item, index) => {
        const started = Boolean(item.name.trim() || item.description.trim() || item.unitPrice.trim() || item.variants.length || item.images.length);
        if (started && !item.name.trim()) errors.push(`Merchandise ${index + 1}: enter a product name or remove the incomplete item.`);
        if (item.name.trim().length > 160) errors.push(`Merchandise ${index + 1}: name must be 160 characters or fewer.`);
        if (item.description.trim().length > 1000) errors.push(`Merchandise ${index + 1}: description must be 1,000 characters or fewer.`);
        if (started && (!item.unitPrice.trim() || !Number.isFinite(Number(item.unitPrice)) || Number(item.unitPrice) <= 0 || Number(item.unitPrice) > 1000000)) errors.push(`Merchandise ${index + 1}: enter a price greater than PHP 0 and no more than PHP 1,000,000.`);
        if (item.variants.some((variant) => variant.length > 80)) errors.push(`Merchandise ${index + 1}: each variant must be 80 characters or fewer.`);
        if (item.variants.length > 40) errors.push(`Merchandise ${index + 1}: use no more than 40 variants.`);
        if (!hasValidOptionalVariantSlots(item.variants, item.variantSlots)) errors.push(`Merchandise ${index + 1}: any slot count entered must be a whole number from 0 to 1,000,000.`);
        if (item.images.length > 8) errors.push(`Merchandise ${index + 1}: upload no more than 8 photos.`);
        if (!item.images.every(validImage)) errors.push(`Merchandise ${index + 1}: images must be JPG, PNG, or WEBP and no larger than 10 MB each.`);
      });
      return errors;
    }
    if (stepIndex === 3) {
      const errors: string[] = [];
      if (showCustomTab && !customTabTitle.trim()) errors.push("Enter a title for the custom content tab or cancel adding the tab.");
      if (showCustomTab && customTabTitle.trim() && eventPages.some((page) => page.title.toLowerCase() === customTabTitle.trim().toLowerCase())) errors.push("A content tab with this title already exists. Choose a unique title.");
      if (showCustomTab && customTabTitle.trim().length > 80) errors.push("Custom tab title must be 80 characters or fewer.");
      if (eventPages.length > 12) errors.push("An event can have no more than 12 content tabs.");
      if (eventPages.some((page) => page.title.trim().length === 0 || page.title.trim().length > 80)) errors.push("Each content tab title must be 1 to 80 characters.");
      if (eventPages.some((page) => page.content.length > 50000)) errors.push("Each content page must be 50,000 characters or fewer.");
      if (!posters.every(validImage)) errors.push("Event posters must be JPG, PNG, or WEBP images up to 10 MB each.");
      const contentWithDataImages = eventPages.flatMap((page) => Array.from(page.content.matchAll(/src=[\"'](data:image\/[^\"']+)[\"']/gi), (match) => ({ page: page.title, source: match[1] })));
      for (const item of contentWithDataImages) {
        const match = item.source.match(/^data:image\/(jpeg|png|webp);base64,([a-z0-9+/=]+)$/i);
        if (!match) errors.push(`${item.page}: embedded images must be JPG, PNG, or WEBP. Remove the image and upload it using the event poster field.`);
        else if (Math.floor(match[2].length * 3 / 4) > 10 * 1024 * 1024) errors.push(`${item.page}: embedded images must be 10 MB or smaller.`);
      }
      return errors;
    }
    if (stepIndex === 4) {
      const errors: string[] = [];
      if (Boolean(waiverTitle.trim()) !== Boolean(waiverContent.trim())) errors.push("Complete both the event waiver title and content, or leave both blank to skip the waiver.");
      if (waiverTitle.trim().length > 240) errors.push("Event waiver title must be 240 characters or fewer.");
      if (eventWaiverContentForTitle(waiverContent, form.name).length > 50000) errors.push("Event waiver content must be 50,000 characters or fewer.");
      if (registrationQuestions.length > 30) errors.push("Add no more than 30 registration questions.");
      registrationQuestions.forEach((question, index) => {
        const number = index + 1;
        if (!question.label.trim()) errors.push(`Question ${number}: enter a question label.`);
        if (question.label.trim().length > 160) errors.push(`Question ${number}: keep the label to 160 characters or fewer.`);
        if (['dropdown', 'radio', 'multi_select'].includes(question.field_type)) {
          const choices = [...question.options, ...(question.other_option ? ['Other (please specify)'] : [])];
          if (question.optionDraft.trim()) errors.push(`Question ${number}: save or clear the unfinished answer choice.`);
          if (choices.length < 2) errors.push(`Question ${number}: add at least two answer choices.`);
          if (choices.some((choice) => !choice.trim() || choice.length > 160)) errors.push(`Question ${number}: choices must be 1 to 160 characters long.`);
          if (new Set(choices.map((choice) => choice.trim().toLowerCase())).size !== choices.length) errors.push(`Question ${number}: remove duplicate answer choices.`);
        }
      });
      return errors;
    }
    if (stepIndex === 5) {
      const errors: string[] = [];
      for (const [tier, list] of Object.entries(sponsors)) list.forEach((sponsor, index) => {
        if ((sponsor.logo.file || sponsor.logo.url) && !sponsor.name.trim()) errors.push(`${tier}, sponsor ${index + 1}: enter the sponsor name or remove the logo.`);
        if (sponsor.name.trim().length > 160) errors.push(`${tier}, sponsor ${index + 1}: name must be 160 characters or fewer.`);
        if (!validImage(sponsor.logo)) errors.push(`${tier}, sponsor ${index + 1}: logo must be a JPG, PNG, or WEBP image up to 10 MB.`);
      });
      return errors;
    }
    return [];
  };
  const currentStepErrors = validateSetupStep(step);
  const updateAttemptedStep = (index: number) => setAttemptedSteps((current) => current.map((attempted, currentIndex) => currentIndex === index ? true : attempted).concat(current.length <= index ? [true] : []));
  const navigateToStep = (target: number) => {
    if (busy) return;
    setMessage("");
    setStep(target);
  };
  const continueToNextStep = () => {
    if (busy) return;
    setMessage("");
    const nextStep = Math.min(steps.length - 1, step + 1);
    setReviewedSteps((current) => current.map((reviewed, index) => index === step ? true : reviewed));
    setStep(nextStep);
  };

  async function uploadAsset(
    eventId: string,
    kind: "logo" | "banner" | "poster" | "content_image" | "sponsor_logo" | "size_chart" | "race_kit_image" | "merchandise",
    file: File,
  ) {
    const data = new FormData();
    data.append("file", file);
    data.append("kind", kind);
    const response = await fetch(`/api/organizer/events/${eventId}/assets`, {
      method: "POST",
      body: data,
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error ?? `${kind} upload failed`);
    if (typeof body.url !== "string" || !body.url) throw new Error(`${kind} upload completed without a usable image URL.`);
    return body.url as string;
  }
  async function uploadInlineContentImages(eventId: string, content: string, pageKey: string) {
    const matches = Array.from(content.matchAll(/src=(["'])(data:image\/(jpeg|png|webp);base64,[^"']+)\1/gi));
    let result = content;
    for (let index = 0; index < matches.length; index += 1) {
      const match = matches[index];
      const source = match[2];
      const mime = `image/${match[3].toLowerCase()}`;
      const blob = await fetch(source).then((response) => response.blob());
      if (blob.size > 10 * 1024 * 1024) throw new Error("Images inserted into event content must be 10 MB or smaller.");
      const extension = mime === "image/jpeg" ? "jpg" : match[3].toLowerCase();
      const file = new File([blob], `${pageKey}-inline-${index + 1}.${extension}`, { type: mime });
      const url = await uploadAsset(eventId, "content_image", file);
      result = result.replace(match[0], `src=${match[1]}${url}${match[1]}`);
    }
    if (/src=["']data:image\//i.test(result)) throw new Error("Inline images must be JPG, PNG, or WEBP. Remove the unsupported image and upload it as a poster instead.");
    return result;
  }
  async function saveKit(
    eventId: string,
    categoryId: string | null,
    name: string,
    items: KitItem[],
    uploadedAssets = new Map<File, Promise<string>>(),
  ) {
    const uploadOnce = (upload: UploadValue, kind: Parameters<typeof uploadAsset>[1]) => {
      if (!upload.file) return Promise.resolve(upload.url || null);
      let saved = uploadedAssets.get(upload.file);
      if (!saved) {
        saved = uploadAsset(eventId, kind, upload.file);
        uploadedAssets.set(upload.file, saved);
      }
      return saved;
    };
    const payloadItems = await Promise.all(items.map(async (item, index) => {
      const itemName = item.name.trim();
      const referenceImageUrl = item.kind === "product"
        ? await uploadOnce(item.referenceImage, "size_chart")
        : null;
      const productImageUrls = item.kind === "product"
        ? await Promise.all(item.productImages.map((image) => uploadOnce(image, "race_kit_image")))
        : [];
      return {
        item_code: `${categoryId ?? "shared"}-${index + 1}-${itemName.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30)}`,
        item_name: itemName,
        quantity: 1,
        details: { kind: item.kind === "inclusion" ? "text_inclusion" : "product", description: item.description.trim() || null, variants: item.kind === "product" ? variantOptionsPayload(item.variants, item.variantSlots) : [], product_image_urls: productImageUrls, reference_image_url: referenceImageUrl },
        is_required: item.kind === "product" && item.variants.length > 0,
        is_active: true,
        display_order: index,
      };
    }));
    const configResponse = await fetch(`/api/organizer/events/${eventId}/race-kit-config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category_id: categoryId, name, description: null, status: "active", items: payloadItems }),
    });
    const config = await configResponse.json().catch(() => ({}));
    if (!configResponse.ok || !config.id) throw new Error(config.error ?? "Race kit configuration could not be saved.");
    if ((config.race_kit_items ?? []).length !== payloadItems.length) throw new Error("The database did not confirm all race kit items. Reopen the event and retry saving the kit.");
    const verifyResponse = await fetch(`/api/organizer/events/${eventId}/race-kit-config`);
    const verifyBody = await verifyResponse.json().catch(() => ({}));
    const savedConfig = (verifyBody.configs ?? []).find((entry: { id: string; category_id: string | null }) => entry.id === config.id && entry.category_id === categoryId);
    if (!verifyResponse.ok || !savedConfig || (savedConfig.race_kit_items ?? []).length !== payloadItems.length) {
      throw new Error("Race kit inclusions were not confirmed in the event setup. Reopen Categories & Pricing and save the kit again.");
    }
  }
  async function createEvent() {
    if (draftEventId) {
      router.push(`/organizer/events/${draftEventId}`);
      return;
    }
    const firstInvalidStep = steps.findIndex((_, index) => validateSetupStep(index).length > 0);
    if (firstInvalidStep >= 0) {
      updateAttemptedStep(firstInvalidStep);
      setMessage("");
      setStep(firstInvalidStep);
      return;
    }
    if (!ready) {
      const targetStep = missing.includes("event date") || missing.includes("a valid registration date range") ? 1 : missing.includes("complete or remove the unfinished race category") || missing.some((item) => item.includes("total capacity")) ? 2 : 0;
      updateAttemptedStep(targetStep);
      setMessage("");
      setStep(targetStep);
      return;
    }
    const incompleteMerchandise = merchandise.some((item) => {
      const started = item.name.trim() || item.description.trim() || item.unitPrice.trim() || item.variants.length || item.images.length;
      return Boolean(started && (!item.name.trim() || !Number.isFinite(Number(item.unitPrice)) || Number(item.unitPrice) <= 0 || item.variants.length > 40 || !hasValidOptionalVariantSlots(item.variants, item.variantSlots) || item.images.length > 8));
    });
    if (incompleteMerchandise) {
      updateAttemptedStep(2);
      setMessage("");
      setStep(2);
      return;
    }
    const incompleteKit = categories.flatMap((category) => category.kitItems).some((item) => item.name.trim() && item.kind === "product" && (item.variants.length > 40 || !hasValidOptionalVariantSlots(item.variants, item.variantSlots) || item.productImages.length > 8));
    if (incompleteKit) {
      updateAttemptedStep(2);
      setMessage("");
      setStep(2);
      return;
    }
    setBusy(true);
    setMessage("Creating event...");
    let createdEventId: string | null = null;
    try {
      const response = await fetch("/api/organizer/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          slug: form.slug || `event-${form.eventDate}-${Date.now()}`,
          description: null,
          event_date: form.eventDate,
          assembly_time: form.assemblyTime || null,
          venue: form.venue.trim() || null,
          address: form.address.trim() || null,
          social_links: {
            facebook: form.facebook.trim(),
            ...Object.fromEntries(Object.entries(optionalLinks).map(([key, value]) => [key, value.trim()])),
          },
          registration_opens_at: form.registrationOpen
            ? `${form.registrationOpen}T00:00:00+08:00`
            : null,
          registration_closes_at: form.registrationClose
            ? `${form.registrationClose}T23:59:59+08:00`
            : null,
          overall_capacity: capacity || null,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.event?.id)
        throw new Error(body.error ?? "Event could not be created.");
      const eventId = body.event.id as string;
      createdEventId = eventId;
      setDraftEventId(eventId);
      if (waiverTitle.trim() && waiverContent.trim()) {
        setMessage("Saving event waiver...");
        const waiverResponse = await fetch(`/api/organizer/events/${eventId}/waiver`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: waiverTitle.trim(), content: eventWaiverContentForTitle(waiverContent, form.name).trim() }),
        });
        const waiver = await waiverResponse.json().catch(() => ({}));
        if (!waiverResponse.ok || !waiver.id) throw new Error(waiver.error ?? "Event waiver could not be saved.");
        const publishResponse = await fetch(`/api/organizer/events/${eventId}/waiver`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: waiver.id, action: "publish" }),
        });
        const publishedWaiver = await publishResponse.json().catch(() => ({}));
        if (!publishResponse.ok || publishedWaiver.status !== "published") throw new Error(publishedWaiver.error ?? "Event waiver could not be activated.");
      }
      setMessage("Saving event logo and banner...");
      // Save primary artwork immediately after the draft exists. Later setup
      // failures must not prevent the event logo or banner reaching storage.
      for (const [field, kind] of [["logo", "logo"], ["banner", "banner"]] as const) {
        const asset = form[field];
        if (!asset.file) continue;
        try {
          const url = await uploadAsset(eventId, kind, asset.file);
          if (asset.url.startsWith("blob:")) URL.revokeObjectURL(asset.url);
          update(field, { url, file: null });
        } catch (error) {
          const detail = error instanceof Error ? error.message : "upload failed";
          throw new Error(`${field === "logo" ? "Event logo" : "Banner image"} upload failed: ${detail}`);
        }
      }
      setMessage("Saving event setup...");
      const savedPages = await Promise.all(eventPages.map(async (page) => ({
        ...page,
        content: await uploadInlineContentImages(eventId, page.content, page.id),
      })));
      const detailsPage = savedPages.find((page) => page.id === "event-details")?.content ?? "";
      const descriptionContent = hasRichContent(detailsPage) ? detailsPage : form.description.trim();
      const description = hasRichContent(descriptionContent)
        ? [form.tagline.trim(), descriptionContent].filter(Boolean).join("\n\n")
        : null;
      const detailsResponse = await fetch(`/api/organizer/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description, banner_position_x: bannerFrame.x, banner_position_y: bannerFrame.y, banner_zoom: bannerFrame.zoom }),
      });
      const detailsBody = await detailsResponse.json().catch(() => ({}));
      if (!detailsResponse.ok) throw new Error(detailsBody.error ?? "Event description could not be saved.");
      if (savedPages.some((page) => page.type === "custom" || page.content.trim())) {
        const contentResponse = await fetch(`/api/organizer/events/${eventId}/content-pages`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pages: savedPages }),
        });
        const contentBody = await contentResponse.json().catch(() => ({}));
        if (!contentResponse.ok) throw new Error(contentBody.error ?? "Event content could not be saved.");
      }
      // Reuse uploaded asset URLs when an organizer selects the same local
      // file for more than one category item.
      const uploadedKitAssets = new Map<File, Promise<string>>();
      for (const category of categories) {
        const categoryGroup = categoryMode === "groups" ? categoryGroups.find((group) => group.id === category.groupId) : null;
        const categoryResponse = await fetch(
          `/api/organizer/events/${eventId}/categories`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: category.distance ? `${Number(category.distance)}K` : category.name.trim(),
              category_group_name: categoryGroup?.name.trim() || null,
              distance_km: Number(category.distance),
              registration_fee: Number(category.fee),
              early_bird_fee: category.earlyBirdEnabled ? Number(category.earlyBirdFee) : null,
              early_bird_deadline: category.earlyBirdEnabled ? manilaDateTimeToIso(category.earlyBirdDeadline) : null,
              registration_opens_at: category.registrationOpen ? manilaDateTimeToIso(category.registrationOpen) : null,
              registration_closes_at: category.registrationClose ? manilaDateTimeToIso(category.registrationClose) : null,
              max_slots: category.capacity.trim() ? Number(category.capacity) : null,
              gun_start_time: category.gunStart || null,
              cutoff_time: category.cutoff || null,
              registration_availability: "not_yet_open",
            }),
          },
        );
        const categoryBody = await categoryResponse.json().catch(() => ({}));
        if (!categoryResponse.ok || !categoryBody.id)
          throw new Error(
            categoryBody.error ?? "A category could not be saved.",
          );
        const items = category.kitItems.filter((item) => item.name.trim());
        if (items.length) await saveKit(eventId, categoryBody.id, `${categoryGroup?.name.trim() ? `${categoryGroup.name.trim()} · ` : ""}${Number(category.distance)}K Race Kit`, items, uploadedKitAssets);
      }
      for (let index = 0; index < registrationQuestions.length; index += 1) {
        const question = registrationQuestions[index];
        const fieldResponse = await fetch(`/api/organizer/events/${eventId}/registration-form`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label: question.label.trim(),
            field_type: question.field_type,
            section_key: question.section_key,
            is_required: question.is_required,
            is_active: true,
            display_order: index,
          }),
        });
        const savedField = await fieldResponse.json().catch(() => ({}));
        if (!fieldResponse.ok || !savedField.id) throw new Error(savedField.error ?? `Registration question “${question.label.trim()}” could not be saved.`);
        const optionLabels = [...question.options, ...(question.field_type === 'multi_select' && question.other_option ? ['Other (please specify)'] : [])];
        for (let optionIndex = 0; optionIndex < optionLabels.length; optionIndex += 1) {
          const label = optionLabels[optionIndex];
          const optionResponse = await fetch(`/api/organizer/events/${eventId}/registration-form/${savedField.id}/options`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ label, value: label, display_order: optionIndex }),
          });
          const savedOption = await optionResponse.json().catch(() => ({}));
          if (!optionResponse.ok) throw new Error(savedOption.error ?? `An answer choice for “${question.label.trim()}” could not be saved.`);
        }
      }
      if (hasPhysicalRaceKit && kitClaimingLocations.length) {
        await saveKit(eventId, null, "Race Kit Claiming", [{
          kind: "product",
          name: "Race Kit Claiming",
          description: "Choose where you plan to claim your included race kit.",
          variants: kitClaimingLocations,
          variantSlots: {},
          productImages: [],
          referenceImage: emptyUpload(),
        }]);
      }
      for (const [index, item] of Array.from(merchandise.filter((entry) => entry.name.trim()).entries())) {
        const imageUrls = await Promise.all(item.images.map((image) => image.file ? uploadAsset(eventId, "merchandise", image.file) : image.url));
        const saved = await fetch(`/api/organizer/events/${eventId}/merchandise`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: item.name.trim(), description: item.description.trim() || null, unit_price: Number(item.unitPrice), variants: variantOptionsPayload(item.variants, item.variantSlots), image_urls: imageUrls, display_order: index }) });
        const savedBody = await saved.json().catch(() => ({}));
        if (!saved.ok) throw new Error(savedBody.error ?? "Additional merchandise could not be saved.");
      }
      for (const poster of posters)
        if (poster.file) await uploadAsset(eventId, "poster", poster.file);
      for (const [tier, list] of Object.entries(sponsors))
        for (const sponsor of list.filter((item) => item.name.trim())) {
          const logoUrl = sponsor.logo.file
            ? await uploadAsset(eventId, "sponsor_logo", sponsor.logo.file)
            : null;
          const saved = await fetch(
            `/api/organizer/events/${eventId}/partners`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name: sponsor.name.trim(),
                partner_type: tier,
                logo_url: logoUrl,
              }),
            },
          );
          if (!saved.ok) {
            const body = await saved.json().catch(() => ({}));
            throw new Error(
              `${sponsor.name.trim()} (${tier}) could not be saved: ${body.error ?? "check the event's Sponsors & Partners setup and retry."}`,
            );
          }
        }
      setMessage("Draft created. Review the event, then submit it for RaceDeck approval.");
      router.push(`/organizer/events/${eventId}/preview`);
    } catch (error) {
      const rawDetail = error instanceof Error ? error.message : "Event could not be created.";
      const detail = rawDetail === "Event slug already exists"
        ? "That public event URL is already in use. Change the Public event URL in Event Profile, then try again."
        : rawDetail;
      setMessage(createdEventId ? `Draft event was saved, but setup is incomplete: ${detail} Open the draft to finish setup.` : detail);
    } finally {
      setBusy(false);
    }
  }
  const addSponsor = (tier: string) =>
    setSponsors((current) => ({
      ...current,
      [tier]: [...current[tier], { name: "", logo: emptyUpload() }],
    }));
  const editSponsor = (
    tier: string,
    index: number,
    changes: Partial<Sponsor>,
  ) =>
    setSponsors((current) => ({
      ...current,
      [tier]: current[tier].map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...changes } : item,
      ),
    }));

  return (
    <main className="mx-auto w-full min-w-0 max-w-[1500px] space-y-6 p-4 sm:p-6">
      {message && (
        <p
          role="status"
          className="rounded-lg bg-orange-50 p-3 text-sm text-orange-800"
        >
          {message}
        </p>
      )}
      {draftEventId && <Link href={`/organizer/events/${draftEventId}`} className="inline-block rounded-lg border border-orange-300 bg-white px-3 py-2 text-sm font-bold text-orange-700">Open saved draft</Link>}
      <div className="grid w-full min-w-0 items-start gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="h-fit w-full min-w-0 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm lg:sticky lg:top-24">
          <p className="px-3 pb-3 text-xs font-bold uppercase tracking-widest text-slate-400">
            Event setup
          </p>
          {steps.map((item, index) => {
            const complete = reviewedSteps[index] && fieldCompletedSteps[index] && validateSetupStep(index).length === 0;
            return (
              <button
                key={item}
                disabled={busy}
                onClick={() => navigateToStep(index)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-bold disabled:cursor-wait disabled:opacity-60 ${step === index ? "bg-[#071b41] text-white" : "text-slate-600 hover:bg-slate-50"}`}
              >
                <span
                  className={`grid h-7 w-7 place-items-center rounded-full text-xs ${complete ? "bg-emerald-500 text-white" : step === index ? "bg-orange-500 text-white" : "bg-slate-100 text-slate-500"}`}
                >
                  {complete ? <Check size={15} strokeWidth={3} /> : index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  {item}
                  {index === 4 && registrationQuestions.length === 0 && <span className={`block text-xs font-normal ${step === index ? "text-slate-200" : "text-slate-500"}`}>Optional · no questions added</span>}
                </span>
              </button>
            );
          })}
        </aside>
        <section className="flex w-full min-w-0 max-w-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7 lg:min-h-[700px] [&>*]:min-w-0">
          <p className="text-xs font-bold uppercase tracking-widest text-orange-600">
            Step {step + 1} of {steps.length}
          </p>
          <h2 className="mt-1 text-2xl font-black text-[#071b41]">
            {steps[step]}
          </h2>
          {attemptedSteps[step] && currentStepErrors.length > 0 && <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"><p className="font-bold">Fix these items before continuing:</p><ul className="mt-2 list-disc space-y-1 pl-5">{currentStepErrors.map((error) => <li key={error}>{error}</li>)}</ul></div>}
          {step === 0 && (
            <div className="mt-6 flex-1 space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  label="Event name"
                  value={form.name}
                  onChange={(value) => {
                    update("name", value);
                    if (!slugManuallyEdited) update("slug", toEventSlug(value));
                  }}
                  maxLength={160}
                  required
                  error={attemptedSteps[0] && !form.name.trim() ? "Event name is required." : form.name.trim().length > 160 ? "Event name must be 160 characters or fewer." : undefined}
                />
                <TextField
                  label="Event URL slug"
                  value={form.slug}
                  onChange={(value) => {
                    setSlugManuallyEdited(true);
                    update("slug", toEventSlug(value));
                  }}
                  maxLength={180}
                  error={form.slug && (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug) || form.slug.length > 180) ? "Use lowercase letters, numbers, and single hyphens." : undefined}
                />
                <div className="-mt-3 space-y-1 text-xs text-slate-500 sm:col-span-2">
                  <p>Participant registration URL</p>
                  <p className="break-all rounded-lg bg-slate-50 px-3 py-2 font-medium text-slate-700">/register/{organizationSlug || "your-organization"}/{form.slug || "your-event-name"}</p>
                </div>
                <TextField
                  label="Tagline"
                  value={form.tagline}
                  onChange={(value) => update("tagline", value)}
                />
                <TextField
                  label="Facebook link"
                  type="url"
                  required
                  value={form.facebook}
                  onChange={(value) => update("facebook", value)}
                  maxLength={2048}
                  error={attemptedSteps[0] && !form.facebook.trim() ? "Facebook link is required." : form.facebook.trim() && !eventPlatformLinkIsValid("facebook", form.facebook) ? "Enter a Facebook link starting with https:// or http://." : undefined}
                />
              </div>
              <div className="mt-5"><OptionalEventLinks links={optionalLinks} onChange={setOptionalLinks} /></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Upload
                  label="Event logo / thumbnail"
                  value={form.logo}
                  onChange={(file, url) => {
                    if (form.logo.url.startsWith("blob:")) URL.revokeObjectURL(form.logo.url);
                    update("logo", { file, url });
                  }}
                  onRemove={() => {
                    if (form.logo.url.startsWith("blob:")) URL.revokeObjectURL(form.logo.url);
                    update("logo", emptyUpload());
                  }}
                  profilePreview
                />
                <Upload
                  label="Banner image"
                  value={form.banner}
                  onChange={(file, url) => {
                    if (form.banner.url.startsWith("blob:")) URL.revokeObjectURL(form.banner.url);
                    update("banner", { file, url });
                    setBannerFrame({ x: 50, y: 50, zoom: 1 });
                  }}
                  onRemove={() => {
                    if (form.banner.url.startsWith("blob:")) URL.revokeObjectURL(form.banner.url);
                    update("banner", emptyUpload());
                    setBannerFrame({ x: 50, y: 50, zoom: 1 });
                  }}
                  frame={bannerFrame}
                  onFrameChange={setBannerFrame}
                  wide
                />
              </div>
            </div>
          )}
          {step === 1 && (
            <div className="mt-6 flex-1 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  label="Event date"
                  type="date"
                  value={form.eventDate}
                  onChange={(value) => update("eventDate", value)}
                  min={manilaToday}
                  required
                  error={attemptedSteps[1] && !form.eventDate ? "Event date is required." : attemptedSteps[1] && form.eventDate < manilaToday ? "Choose today or a future date." : undefined}
                />
                <TextField
                  label="Assembly time (optional)"
                  type="time"
                  value={form.assemblyTime}
                  onChange={(value) => update("assemblyTime", value)}
                  hint="Participant arrival time before the race starts."
                />
                <TextField
                  label="Registration open"
                  type="date"
                  value={form.registrationOpen}
                  onChange={(value) => update("registrationOpen", value)}
                  max={form.registrationClose || form.eventDate || undefined}
                />
                <TextField
                  label="Registration close"
                  type="date"
                  value={form.registrationClose}
                  onChange={(value) => update("registrationClose", value)}
                  max={form.eventDate || undefined}
                />
                {form.registrationOpen && form.registrationClose && form.registrationOpen > form.registrationClose && (
                    <p className="sm:col-span-2 rounded bg-red-50 p-3 text-sm text-red-700">
                      Registration must open before it closes.
                    </p>
                  )}
                {form.registrationClose && form.eventDate && form.registrationClose > form.eventDate && <p className="sm:col-span-2 rounded bg-red-50 p-3 text-sm text-red-700">Registration must close no later than the event date.</p>}
              </div>
              <p className="text-xs text-slate-500">Set both registration dates before submitting for review.</p>
              <TextField label="Venue name" value={form.venue} onChange={(value) => update("venue", value)} />
              <label className="block text-sm font-semibold text-slate-700">
                Complete address
                <textarea
                  value={form.address}
                  onChange={(event) => update("address", event.target.value)}
                  placeholder="Enter the complete event location and address"
                  className={`${input} min-h-32 resize-y leading-6`}
                />
              </label>
            </div>
          )}
          {step === 2 && (
            <div className="mt-6 flex-1 space-y-5">
              <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <fieldset className="border-b border-slate-200 pb-4">
                  <legend className="text-base font-semibold text-slate-800">How should participants choose their race option? <span className="text-orange-600">*</span></legend>
                  <div className="mt-3 space-y-3">
                    <label className={`flex w-fit items-center gap-3 text-base text-slate-700 ${categories.length > 0 || categoryGroups.length > 0 ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}>
                      <input type="radio" name="category-mode" value="groups" checked={categoryMode === "groups"} disabled={categories.length > 0 || categoryGroups.length > 0} onChange={() => setCategoryMode("groups")} className="h-5 w-5 shrink-0 accent-orange-600" />
                      <span>Group + distances</span>
                    </label>
                    <label className={`flex w-fit items-center gap-3 text-base text-slate-700 ${categories.length > 0 || categoryGroups.length > 0 ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}>
                      <input type="radio" name="category-mode" value="distances" checked={categoryMode === "distances"} disabled={categories.length > 0 || categoryGroups.length > 0} onChange={() => setCategoryMode("distances")} className="h-5 w-5 shrink-0 accent-orange-600" />
                      <span>Distances only</span>
                    </label>
                  </div>
                  {(categories.length > 0 || categoryGroups.length > 0) && <p className="mt-2 text-xs text-slate-500">The format is locked after you add a group or distance. Remove all options to change it.</p>}
                </fieldset>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-orange-600">Race options</p>
                    <h3 className="mt-1 text-lg font-black text-[#071b41]">Categories &amp; distances</h3>
                    <p className="mt-1 max-w-3xl text-sm text-slate-600">Choose whether to organize options into named groups or list each race distance on its own.</p>
                  </div>
                </div>
              {!categoryMode && <div className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-7 text-center"><p className="font-bold text-[#071b41]">Choose a format to begin</p><p className="mt-1 text-sm text-slate-600">Your race option fields will appear after you choose a format above.</p></div>}
              {categorySections.map(({ group, entries }) => (
                <div key={group?.id ?? "distance-options"} className={group ? "space-y-4 rounded-xl border border-slate-200 bg-white p-4" : "space-y-4"}>
                  {group && <div className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-end gap-3">
                      <div className="min-w-60 flex-1"><TextField label={`Group ${categoryGroups.findIndex((entry) => entry.id === group.id) + 1} name`} value={group.name} maxLength={120} placeholder="e.g. Regular, Student, or VIP" error={attemptedSteps[2] && !group.name.trim() ? "Enter a name for this group." : undefined} onChange={(value) => updateCategoryGroup(group.id, { name: value })} /></div>
                      <button type="button" onClick={() => addDistanceToGroup(group)} className="min-h-10 rounded-lg border border-orange-300 px-4 py-2 text-sm font-bold text-orange-700">+ Add distance</button>
                      <button type="button" onClick={() => { setCategoryGroups((current) => current.filter((entry) => entry.id !== group.id)); setCategories((current) => current.filter((category) => category.groupId !== group.id)); }} className="min-h-10 rounded-lg px-3 py-2 text-sm font-bold text-red-600 hover:bg-red-50">Remove group</button>
                    </div>
                  </div>}
                  {entries.map(({ category, index }) => (
                <div
                  key={index}
                  className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5"
                >
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Race option {index + 1}</p>
                      <p className="mt-0.5 font-bold text-[#071b41]">{group?.name.trim() ? `${group.name.trim()} · ` : ""}{category.distance.trim() ? `${category.distance} km` : "Distance not set"}</p>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <h4 className="text-sm font-bold text-[#071b41]">Race distance and capacity</h4>
                    </div>
                    <TextField
                      label="Distance (km)"
                      type="number"
                      min="0.01"
                      max="9999.99"
                      step="0.01"
                      value={category.distance}
                      onChange={(value) =>
                        setCategories((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, distance: value }
                              : item,
                          ),
                        )
                      }
                      required
                    />
                    <TextField
                      label="Capacity (optional)"
                      type="number"
                      min="1"
                      max="2147483647"
                      step="1"
                      value={category.capacity}
                      onChange={(value) =>
                        setCategories((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, capacity: value }
                              : item,
                          ),
                        )
                      }
                    />
                    <p className="-mt-2 text-xs text-slate-500 sm:col-span-2">Leave capacity blank for unlimited registration slots.</p>
                    <div className="sm:col-span-2 border-t border-slate-200 pt-4">
                      <h4 className="text-sm font-bold text-[#071b41]">Pricing &amp; registration dates</h4>
                      <p className="mt-1 text-xs text-slate-500">Set a regular fee, then optionally add an early-bird price and a distance-specific registration window.</p>
                    </div>
                    <TextField
                      label="Registration Fee (PHP)"
                      type="number"
                      min="0"
                      max="99999999.99"
                      step="0.01"
                      value={category.fee}
                      onChange={(value) =>
                        setCategories((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, fee: value }
                              : item,
                          ),
                        )
                      }
                      required
                    />
                    <TextField label="Distance registration opens" type="datetime-local" value={category.registrationOpen} onChange={(value) => setCategories((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, registrationOpen: value } : item))} error={Boolean(category.registrationOpen) !== Boolean(category.registrationClose) ? "Enter both distance-level dates, or leave both blank to use the event schedule." : undefined} />
                    <TextField label="Distance registration closes" type="datetime-local" value={category.registrationClose} onChange={(value) => setCategories((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, registrationClose: value } : item))} error={Boolean(category.registrationOpen && category.registrationClose && (category.registrationOpen >= category.registrationClose || (form.eventDate && category.registrationClose.slice(0, 10) > form.eventDate))) ? "Closing must be after opening and no later than event day." : undefined} />
                    <p className="-mt-2 text-xs text-slate-500 sm:col-span-2">Set both dates to override this distance&apos;s registration window. Leave both blank to use the event&apos;s dates.</p>
                    <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-white p-4">
                      <label className="flex min-h-6 cursor-pointer items-center gap-2 text-sm font-bold text-[#071b41]">
                        <input type="checkbox" checked={category.earlyBirdEnabled} onChange={(event) => setCategories((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, earlyBirdEnabled: event.target.checked, earlyBirdFee: event.target.checked ? item.earlyBirdFee : "", earlyBirdDeadline: event.target.checked ? item.earlyBirdDeadline : "" } : item))} className="h-4 w-4 accent-orange-600" />
                        Offer optional Early Bird pricing
                      </label>
                      {category.earlyBirdEnabled && <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <TextField label="Early Bird price (PHP)" type="number" min="0" max="99999999.99" step="0.01" value={category.earlyBirdFee} onChange={(value) => setCategories((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, earlyBirdFee: value } : item))} required />
                        <TextField label="Early Bird deadline" type="datetime-local" value={category.earlyBirdDeadline} onChange={(value) => setCategories((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, earlyBirdDeadline: value } : item))} required />
                        <p className="-mt-2 text-xs leading-5 text-slate-600 sm:col-span-2">Participants pay the Early Bird price before the deadline. At the deadline, checkout automatically switches to the regular price. The deadline must fall within this event&apos;s registration window.</p>
                      </div>}
                    </div>
                    <div className="sm:col-span-2 border-t border-slate-200 pt-4">
                      <h4 className="text-sm font-bold text-[#071b41]">Race-day timing <span className="font-normal text-slate-500">(optional)</span></h4>
                    </div>
                    <TextField
                      label="Category start time (optional)"
                      type="time"
                      value={category.gunStart}
                      onChange={(value) => setCategories((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, gunStart: value } : item))}
                      error={category.gunStart && !/^([01]\d|2[0-3]):[0-5]\d$/.test(category.gunStart) ? "Enter a valid 24-hour time." : undefined}
                    />
                    <TextField
                      label="Category course cut-off (optional)"
                      type="time"
                      value={category.cutoff}
                      onChange={(value) => setCategories((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, cutoff: value } : item))}
                      error={category.cutoff && !/^([01]\d|2[0-3]):[0-5]\d$/.test(category.cutoff) ? "Enter a valid 24-hour time." : undefined}
                    />
                    <p className="-mt-2 text-xs text-slate-500 sm:col-span-2">Category start and course cut-off times are optional. Leave them blank when the category follows the event schedule.</p>
                  </div>
                  <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                    <h3 className="font-bold text-[#071b41]">Inclusions for {[group?.name.trim(), category.distance.trim() ? `${category.distance}K` : ""].filter(Boolean).join(" · ") || "this race option"} <span className="text-orange-600">*</span></h3>
                    <p className="mt-1 text-sm text-slate-600">These items are included for this race option. Participants choose product sizes during registration.</p>
                    {category.kitItems.map((item, itemIndex) => <KitItemEditor key={itemIndex} item={item} onChange={(value) => setCategories((current) => current.map((entry, categoryIndex) => categoryIndex === index ? { ...entry, kitItems: entry.kitItems.map((kit, kitIndex) => kitIndex === itemIndex ? value : kit) } : entry))} onRemove={() => setCategories((current) => current.map((entry, categoryIndex) => categoryIndex === index ? { ...entry, kitItems: entry.kitItems.filter((_, kitIndex) => kitIndex !== itemIndex) } : entry))} />)}
                    {attemptedSteps[2] && !categoryHasRequiredInclusion(category) && <p className="mt-3 text-sm font-semibold text-red-600" role="alert">Add at least one simple inclusion or included product.</p>}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" onClick={() => setCategories((current) => current.map((entry, categoryIndex) => categoryIndex === index ? { ...entry, kitItems: [...entry.kitItems, emptyKitItem("inclusion")] } : entry))} className="rounded-lg border border-orange-300 px-3 py-2 text-sm font-bold text-orange-700">+ Add simple inclusion</button>
                      <button type="button" onClick={() => setCategories((current) => current.map((entry, categoryIndex) => categoryIndex === index ? { ...entry, kitItems: [...entry.kitItems, emptyKitItem("product")] } : entry))} className="rounded-lg border border-orange-300 px-3 py-2 text-sm font-bold text-orange-700">+ Add product with choices</button>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setCategories((current) =>
                        current.filter((_, itemIndex) => itemIndex !== index),
                      )
                    }
                    className="mt-4 text-left text-sm font-bold text-red-600"
                  >
                    Remove distance
                  </button>
                </div>
              ))}
                </div>
              ))}
              {categoryMode === "groups" ? <button type="button" onClick={addCategoryGroup} className="rounded-lg border border-orange-300 px-4 py-2 text-sm font-bold text-orange-700">+ {categoryGroups.length === 0 ? "Add first group" : "Add another group"}</button> : categoryMode === "distances" && <button
                type="button"
                onClick={() =>
                  setCategories((current) => [...current, emptyCategory()])
                }
                className="rounded-lg border border-orange-300 px-4 py-2 text-sm font-bold text-orange-700"
              >
                + {categories.length === 0 ? "Add first distance" : "Add another distance"}
              </button>}
              </section>
              {hasPhysicalRaceKit && <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-orange-700">Race kit pickup</p>
                  <h3 className="mt-1 font-bold text-[#071b41]">Race kit claiming locations</h3>
                  <p className="mt-1 max-w-3xl text-sm text-slate-600">Add pickup places participants can choose during registration. Configure included items under each category or group above. Optional merchandise stays separate below.</p>
                </div>
                  <div>
                    <label className="mt-4 block text-sm font-semibold text-slate-700" htmlFor="kit-claiming-location">Claiming place options</label>
                    <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
                      <input
                        id="kit-claiming-location"
                        value={kitClaimingLocationDraft}
                        maxLength={160}
                        onChange={(event) => setKitClaimingLocationDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            const next = kitClaimingLocationDraft.trim();
                            if (next && kitClaimingLocations.length < 40 && !kitClaimingLocations.some((location) => location.toLowerCase() === next.toLowerCase())) {
                              setKitClaimingLocations((current) => [...current, next]);
                              setKitClaimingLocationDraft("");
                            }
                          }
                        }}
                        placeholder="e.g. Bacolod City Government Center ? race day"
                        className={`${input} mt-0 min-h-11 flex-1`}
                      />
                      <button
                        type="button"
                        disabled={!kitClaimingLocationDraft.trim() || kitClaimingLocations.length >= 40 || kitClaimingLocations.some((location) => location.toLowerCase() === kitClaimingLocationDraft.trim().toLowerCase())}
                        onClick={() => {
                          const next = kitClaimingLocationDraft.trim();
                          if (!next) return;
                          setKitClaimingLocations((current) => [...current, next]);
                          setKitClaimingLocationDraft("");
                        }}
                        className="min-h-11 rounded-lg border border-orange-300 bg-white px-4 text-sm font-bold text-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >+ Add place</button>
                    </div>
                    {kitClaimingLocations.length ? (
                      <ul className="mt-3 flex flex-wrap gap-2" aria-label="Race kit claiming place options">
                        {kitClaimingLocations.map((location, index) => (
                          <li key={`${location}-${index}`} className="inline-flex max-w-full items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700">
                            <span className="break-words">{location}</span>
                            <button type="button" onClick={() => setKitClaimingLocations((current) => current.filter((_, optionIndex) => optionIndex !== index))} aria-label={`Remove ${location}`} className="font-bold text-orange-700">?</button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-3 rounded-lg border border-dashed border-slate-200 bg-white p-3 text-sm text-slate-500">No claiming places added. The pickup dropdown will appear in participant registration after you add at least one place.</p>
                    )}
                  </div>
              </section>}

              <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-orange-700">Optional add-ons</p><h3 className="mt-1 text-lg font-black text-[#071b41]">Additional merchandise</h3><p className="mt-1 max-w-2xl text-sm text-slate-600">Optional paid products sold separately from each category’s included race kit. Participants can choose these during registration.</p></div><button type="button" onClick={() => setMerchandise((current) => [...current, emptyMerchandiseItem()])} className="rounded-lg bg-orange-600 px-3 py-2 text-sm font-bold text-white hover:bg-orange-700">+ Add merchandise</button></div>
                {merchandise.length === 0 ? <div className="mt-4 rounded-lg border border-dashed border-slate-200 bg-white p-5 text-center text-sm text-slate-500">No additional merchandise. Your category inclusions remain unchanged.</div> : <div className="mt-4 space-y-3">{merchandise.map((item, index) => <MerchandiseEditor key={index} item={item} onChange={(value) => setMerchandise((current) => current.map((entry, itemIndex) => itemIndex === index ? value : entry))} onRemove={() => setMerchandise((current) => current.filter((_, itemIndex) => itemIndex !== index))} />)}</div>}
              </section>
              <section aria-labelledby="race-options-preview" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="border-b border-slate-200 pb-3">
                  <h3 id="race-options-preview" className="text-lg font-black text-[#071b41]">Participant view</h3>
                </div>
                {!hasParticipantPreviewContent ? (
                  <div className="mt-4 flex min-h-32 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/60" role="status">
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <Eye aria-hidden="true" className="h-7 w-7" strokeWidth={1.75} />
                      <p className="text-sm font-medium text-slate-500">Participant options will appear here</p>
                    </div>
                  </div>
                ) : <div className="mt-4 space-y-3">
                  {previewCategorySections.map(({ group, entries }) => (
                    <div key={group?.id ?? "preview-distances"} className="space-y-3">
                      {group && <h4 className="rounded-lg bg-slate-100 px-3 py-2 font-bold text-[#071b41]">{group.name.trim() || "Untitled group"}</h4>}
                      {entries.map(({ category, index }) => {
                        const included = category.kitItems;
                        return <article key={index} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div><h5 className="font-bold text-[#071b41]">{category.distance.trim() ? `${category.distance}K` : `Distance ${index + 1}`}</h5><p className="mt-1 text-sm text-slate-600">{category.capacity.trim() ? `${category.capacity} registration slots` : "No category slot limit"}</p></div>
                            <div className="text-right"><p className="font-bold text-[#071b41]">{previewPeso(category.fee)} <span className="text-xs font-normal text-slate-500">regular</span></p>{category.earlyBirdEnabled && <p className="mt-1 text-sm text-orange-700">{previewPeso(category.earlyBirdFee)} early bird until {previewDate(category.earlyBirdDeadline)}</p>}</div>
                          </div>
                          <p className="mt-2 text-xs text-slate-600">Registration: {category.registrationOpen ? previewDate(category.registrationOpen) : previewEventDate(form.registrationOpen)} to {category.registrationClose ? previewDate(category.registrationClose) : previewEventDate(form.registrationClose)}</p>
                          {included.length > 0 && <div className="mt-3 border-t border-slate-200 pt-3"><p className="text-xs font-bold uppercase tracking-wide text-slate-600">Included</p><ul className="mt-1 list-inside list-disc text-sm text-slate-700">{included.filter((item) => item.name.trim()).map((item, itemIndex) => <li key={itemIndex}>{item.name.trim()}{item.kind === "product" && item.variants.length > 0 ? ` · choose ${item.variants.join(", ")}` : ""}</li>)}</ul></div>}
                        </article>;
                      })}
                    </div>
                  ))}
                </div>}
                {hasPhysicalRaceKit && kitClaimingLocations.length > 0 && <p className="mt-4 text-sm text-slate-700"><strong>Pickup choices:</strong> {kitClaimingLocations.join(" · ")}</p>}
                {previewMerchandise.some((item) => item.name.trim()) && <div className="mt-4 border-t border-slate-200 pt-3"><p className="text-xs font-bold uppercase tracking-wide text-slate-600">Optional paid add-ons</p><ul className="mt-1 list-inside list-disc text-sm text-slate-700">{previewMerchandise.filter((item) => item.name.trim()).map((item, index) => <li key={index}>{item.name.trim()} · {previewPeso(item.unitPrice)}{item.variants.length > 0 ? ` · ${item.variants.join(", ")}` : ""}</li>)}</ul></div>}
              </section>
            </div>
          )}
          {step === 3 && (
            <div className="mt-6 flex-1 space-y-5">
              <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
                {eventPages.map((page) => (
                  <button
                    type="button"
                    key={page.id}
                    onClick={() => setActivePage(page.id)}
                    className={`rounded-lg border px-3 py-2 text-sm font-bold ${activePage === page.id ? "border-orange-500 bg-orange-50 text-orange-700" : "border-slate-200 text-slate-600"}`}
                  >
                    {page.title}
                    {!page.visible && " (Hidden)"}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={eventPages.length >= 12}
                  onClick={() => setShowCustomTab(true)}
                  className="rounded-lg border border-orange-300 px-3 py-2 text-sm font-bold text-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {eventPages.length >= 12 ? "Maximum tabs reached" : "+ Add Custom Tab"}
                </button>
              </div>
              {showCustomTab && (
                <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
                  <label className="block text-sm font-semibold text-slate-700">
                    Tab Title
                    <input
                      value={customTabTitle}
                      onChange={(event) =>
                        setCustomTabTitle(event.target.value)
                      }
                      placeholder="International Runners' Guide"
                      className={input}
                    />
                  </label>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCustomTab(false);
                        setCustomTabTitle("");
                      }}
                      className="rounded-lg border px-3 py-2 text-sm font-bold"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={!customTabTitle.trim()}
                      onClick={addCustomTab}
                      className="rounded-lg bg-orange-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
                    >
                      Add Tab
                    </button>
                  </div>
                </div>
              )}
              {eventPages
                .filter((page) => page.id === activePage)
                .map((page) => (
                  <div
                    key={page.id}
                    className="rounded-xl border border-slate-200 p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-bold text-[#071b41]">{page.title}</h3>
                      <div className="flex gap-2">
                        {page.type === "custom" && (
                          <button
                            type="button"
                            onClick={() =>
                              setEventPages((current) =>
                                current.filter((item) => item.id !== page.id),
                              )
                            }
                            className="text-xs font-bold text-red-600"
                          >
                            Delete
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            updatePage(page.id, { visible: !page.visible })
                          }
                          className="text-xs font-bold text-slate-600"
                        >
                          {page.visible ? "Hide" : "Show"}
                        </button>
                      </div>
                    </div>
                    <ContentEditor
                      value={page.content}
                      onChange={(value) =>
                        updatePage(page.id, { content: value })
                      }
                    />
                  </div>
                ))}
              <div className="rounded-xl border border-slate-200 p-4">
                <Upload label="Event posters" value={posters} multiple onChange={(file, url) => setPosters((current) => [...current, { file, url }])} onRemove={(index) => setPosters((current) => { const removed = current[index]; if (removed?.url.startsWith("blob:")) URL.revokeObjectURL(removed.url); return current.filter((_, currentIndex) => currentIndex !== index); })} />
                {posters.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{posters.map((poster, index) => <button type="button" key={`${poster.url}-${index}`} onClick={() => setPosters((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="rounded border border-red-200 px-2 py-1 text-xs font-bold text-red-700">Remove poster {index + 1}</button>)}</div>}
              </div>
            </div>
          )}
          {step === 4 && (
            <div className="mt-6 flex-1 space-y-5">
              <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="bg-slate-100 px-4 py-3 text-xs font-bold uppercase tracking-wide text-[#071b41]">Event Participant Waiver <span className="font-normal normal-case text-slate-500">(optional)</span></div>
                <div className="space-y-4 p-4 sm:p-5">
                  <p className="text-sm text-slate-600">A participant waiver is prefilled for this event and can be edited before publishing. The event title updates automatically in the default wording. This is separate from RaceDeck’s Terms and Conditions; clear both fields if you do not want to include an event waiver.</p>
                  <label className="block text-sm font-semibold text-slate-700">Waiver title<input maxLength={240} value={waiverTitle} onChange={(event) => setWaiverTitle(event.target.value)} placeholder="Participant Waiver and Release Agreement" className={input} /></label>
                  <label className="block text-sm font-semibold text-slate-700">Waiver content<textarea maxLength={50000} rows={14} value={eventWaiverContentForTitle(waiverContent, form.name)} onChange={(event) => setWaiverContent(event.target.value.replaceAll(form.name.trim() || "this event", EVENT_NAME_TOKEN))} placeholder="Enter the waiver participants must review and accept." className={`${input} font-normal leading-6`} /></label>
                </div>
              </section>
              <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="bg-slate-100 px-4 py-3 text-xs font-bold uppercase tracking-wide text-[#071b41]">Personal Information</div>
                <div className="p-4 sm:p-5">
                  <p className="text-sm text-slate-600">Collected automatically for every participant. Add event-specific questions below; these standard fields cannot be duplicated.</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {[
                      { label: "First name", required: true },
                      { label: "Middle name", required: false },
                      { label: "Last name", required: true },
                      { label: "Birthdate", required: true },
                      { label: "Gender", required: false },
                      { label: "Email", required: true },
                      { label: "Contact number", required: true },
                      { label: "Address", required: true },
                      { label: "Emergency contact person", required: true },
                      { label: "Emergency contact phone", required: true },
                      { label: "Relationship to participant", required: true },
                    ].map((field) => (
                      <span key={field.label} className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-sm text-slate-700">
                        <span>{field.label}</span>
                        <span className={`text-xs font-semibold ${field.required ? "text-orange-700" : "text-slate-500"}`}>{field.required ? "Required" : "Optional"}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </section>
              {(["health", "additional"] as const).map((sectionKey) => {
                const sectionQuestions = registrationQuestions.filter((question) => question.section_key === sectionKey);
                const sectionTitle = sectionKey === "health" ? "Health Information" : "Additional Information";
                return (
                  <section key={sectionKey} className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="font-bold text-[#071b41]">{sectionTitle}</h3>
                        <p className="mt-1 text-sm text-slate-600">{sectionKey === "health" ? "Add medical or safety questions. Choose how participants answer each one." : "Add event-specific questions. Choose text, single-choice, or multiple-choice answers for each one."}</p>
                      </div>
                      <button type="button" disabled={registrationQuestions.length >= 30} onClick={() => addRegistrationQuestion(sectionKey)} className="min-h-10 rounded-lg border border-orange-300 bg-white px-4 py-2 text-sm font-bold text-orange-700 hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-50">+ Add question</button>
                    </div>
                    <div className="space-y-4">
                      {sectionQuestions.map((question, index) => {
                        const hasChoices = ["dropdown", "radio", "multi_select"].includes(question.field_type);
                        const choices = [...question.options, ...(question.other_option ? ["Other (please specify)"] : [])];
                        return (
                          <article key={question.id} className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <h4 className="font-bold text-[#071b41]">Question {index + 1}</h4>
                              <button type="button" onClick={() => setRegistrationQuestions((current) => current.filter((item) => item.id !== question.id))} className="rounded-lg px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50">Remove</button>
                            </div>
                            <div className="mt-3 grid gap-4 sm:grid-cols-2">
                              <label className="block text-sm font-semibold text-slate-700">Question<input maxLength={160} value={question.label} onChange={(event) => updateRegistrationQuestion(question.id, { label: event.target.value })} placeholder={sectionKey === "health" ? "e.g. Select any medical conditions that apply" : "e.g. Which running club are you part of?"} className={input} /></label>
                              <label className="block text-sm font-semibold text-slate-700">Answer type<select value={question.field_type} onChange={(event) => { const field_type = event.target.value as RegistrationQuestion["field_type"]; updateRegistrationQuestion(question.id, { field_type, ...(!["dropdown", "radio", "multi_select"].includes(field_type) ? { options: [], other_option: false, optionDraft: "" } : field_type !== "multi_select" ? { other_option: false } : {}) }); }} className={input}><option value="short_text">Short answer</option><option value="long_text">Paragraph</option><option value="yes_no">Yes / No</option><option value="dropdown">Dropdown list (choose one)</option><option value="radio">Radio choices (choose one)</option><option value="multi_select">Multiple-choice buttons (choose any)</option></select></label>
                            </div>
                            <label className="mt-4 inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700"><input type="checkbox" checked={question.is_required} onChange={(event) => updateRegistrationQuestion(question.id, { is_required: event.target.checked })} className="h-4 w-4 accent-orange-600" /> Require participants to answer</label>
                            {question.field_type === "yes_no" && <p className="mt-3 text-sm text-slate-600">Yes and No are added automatically. See the participant preview below.</p>}
                            {hasChoices && <div className="mt-4 rounded-lg bg-slate-50 p-3">
                              <p className="text-sm font-bold text-[#071b41]">Answer choices <span className="font-normal text-slate-500">(add at least two)</span></p>
                              {choices.length > 0 && <ul className="mt-2 flex flex-wrap gap-2">{choices.map((choice, choiceIndex) => <li key={`${choice}-${choiceIndex}`} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700">{choice}{question.other_option && choiceIndex === choices.length - 1 ? <span className="text-xs text-slate-400">(opens text answer)</span> : <button type="button" onClick={() => updateRegistrationQuestion(question.id, { options: question.options.filter((_, optionIndex) => optionIndex !== choiceIndex) })} aria-label={`Remove choice ${choice}`} className="font-bold text-red-600">×</button>}</li>)}</ul>}
                              <div className="mt-3 flex flex-col gap-2 sm:flex-row"><input maxLength={160} value={question.optionDraft} onChange={(event) => updateRegistrationQuestion(question.id, { optionDraft: event.target.value })} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); const value = question.optionDraft.trim(); if (value && !choices.some((choice) => choice.toLowerCase() === value.toLowerCase())) updateRegistrationQuestion(question.id, { options: [...question.options, value], optionDraft: "" }); } }} placeholder="Add an answer choice" className={`${input} mt-0`} /><button type="button" disabled={!question.optionDraft.trim() || choices.some((choice) => choice.toLowerCase() === question.optionDraft.trim().toLowerCase())} onClick={() => updateRegistrationQuestion(question.id, { options: [...question.options, question.optionDraft.trim()], optionDraft: "" })} className="min-h-10 shrink-0 rounded-lg border border-orange-300 px-4 text-sm font-bold text-orange-700 disabled:opacity-50">Add choice</button></div>
                              {question.field_type === "multi_select" && <label className="mt-3 inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700"><input type="checkbox" checked={question.other_option} onChange={(event) => updateRegistrationQuestion(question.id, { other_option: event.target.checked })} className="h-4 w-4 accent-orange-600" /> Include ?Other (please specify)? with a text field</label>}
                            </div>}
                          </article>
                        );
                      })}
                    </div>
                    {sectionQuestions.length > 0 && (
                      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                        <div className="bg-slate-100 px-4 py-3 text-xs font-bold uppercase tracking-wide text-[#071b41]">{sectionTitle} · participant preview</div>
                        <div className="grid gap-6 p-4 sm:grid-cols-2 lg:grid-cols-3 sm:p-5">
                          {sectionQuestions.map((question) => <RegistrationQuestionPreview key={`${question.id}-${question.field_type}`} question={question} />)}
                        </div>
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          )}
          {step === 5 && (
            <div className="mt-6 flex-1 space-y-5">
              <div className="grid gap-4 md:grid-cols-3">
                {Object.entries(sponsors).map(([tier, list]) => (
                  <div key={tier} className="rounded-xl border p-4">
                    <h3 className="font-bold text-[#071b41]">{tier}</h3>
                    {list.map((sponsor, index) => (
                      <div
                        key={index}
                        className="mt-3 space-y-2 rounded-lg bg-slate-50 p-3"
                      >
                        <TextField
                          label="Sponsor name"
                          value={sponsor.name}
                          onChange={(value) =>
                            editSponsor(tier, index, { name: value })
                          }
                        />
                        <Upload
                          label="Sponsor logo file"
                          value={sponsor.logo}
                          onChange={(file, url) => {
                            if (sponsor.logo.url.startsWith("blob:")) URL.revokeObjectURL(sponsor.logo.url);
                            editSponsor(tier, index, { logo: { file, url } })
                          }}
                          onRemove={() => {
                            if (sponsor.logo.url.startsWith("blob:")) URL.revokeObjectURL(sponsor.logo.url);
                            editSponsor(tier, index, { logo: emptyUpload() });
                          }}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setSponsors((current) => ({
                              ...current,
                              [tier]: list.filter(
                                (_, itemIndex) => itemIndex !== index,
                              ),
                            }))
                          }
                          className="text-sm font-bold text-red-600"
                        >
                          Remove sponsor
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => addSponsor(tier)}
                      className="mt-3 rounded-lg border border-orange-300 px-3 py-2 text-sm font-bold text-orange-700"
                    >
                      + Add sponsor
                    </button>
                  </div>
                ))}
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm">
                <h3 className="font-bold text-[#071b41]">Ready to submit for review</h3>
                <p className="mt-1 text-slate-600">You can save a draft now and finish these items later. RaceDeck requires all checks before the event can be submitted.</p>
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {submissionChecks.map((check) => <li key={check.label} className={`flex items-center gap-2 ${check.complete ? "text-emerald-700" : "text-slate-600"}`}><span aria-hidden="true" className="font-bold">{check.complete ? "✓" : "○"}</span>{check.label}</li>)}
                </ul>
                <p className={`mt-3 font-semibold ${submissionReady ? "text-emerald-700" : "text-amber-700"}`}>{submissionReady ? "Event details are complete for review." : "Some required event details are still missing."}</p>
                {missing.length > 0 && <p role="alert" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">Fix before creating the draft: {missing.join(", ")}.</p>}
                <p className="mt-2 text-xs leading-5 text-slate-600">RaceDeck can accept the review request only when your organization is approved and active. You can save this as a draft and finish optional setup later.</p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void createEvent()}
                className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-bold text-white disabled:bg-slate-400"
              >
                {busy ? "Creating..." : "Create Draft Event"}
              </button>
            </div>
          )}
          <div className="mt-8 flex justify-between border-t pt-5">
            <button
              type="button"
              disabled={step === 0 || busy}
              onClick={() => setStep((current) => current - 1)}
              className="rounded-lg border px-4 py-2 text-sm font-bold disabled:opacity-40"
            >
              &larr; Back
            </button>
            {step < steps.length - 1 && (
              <button
                type="button"
                onClick={() => {
                  continueToNextStep();
                }}
                className="rounded-lg bg-[#071b41] px-4 py-2 text-sm font-bold text-white"
              >
                Next &rarr;
              </button>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

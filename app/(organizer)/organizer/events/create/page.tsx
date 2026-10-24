"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ContentEditor } from "@/components/organizer/content-editor";
import { Check } from "lucide-react";

type KitItem = { name: string; description: string; variants: string[]; productImages: UploadValue[]; referenceImage: UploadValue };
type MerchandiseItem = { name: string; description: string; unitPrice: string; variants: string[]; images: UploadValue[] };
type Category = {
  name: string;
  distance: string;
  capacity: string;
  fee: string;
  kitItems: KitItem[];
};
type UploadValue = { url: string; file: File | null };
type Sponsor = { name: string; logo: UploadValue };
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
  "Sponsors & Review",
];
const input =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100";
const emptyUpload = (): UploadValue => ({ url: "", file: null });
const emptyKitItem = (): KitItem => ({ name: "", description: "", variants: [], productImages: [], referenceImage: emptyUpload() });
const emptyMerchandiseItem = (): MerchandiseItem => ({ name: "", description: "", unitPrice: "", variants: [], images: [] });
const emptyCategory = (): Category => ({
  name: "",
  distance: "",
  capacity: "",
  fee: "",
  kitItems: [emptyKitItem()],
});

function TextField({
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
    <label className="block text-sm font-semibold text-slate-700">
      {label}
      {required && <span className="ml-1 text-orange-600">*</span>}
      <input
        required={required}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={input}
      />
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
}: {
  label: string;
  value: UploadValue | UploadValue[];
  onChange: (file: File, url: string) => void;
  wide?: boolean;
  multiple?: boolean;
  onRemove?: (index: number) => void;
}) {
  const previews = Array.isArray(value) ? value : [value];
  const containPreview = /chart|guide/i.test(label);
  return (
    <div>
      <label className="block text-sm font-semibold text-slate-700">
        {label}
        <input
          type="file"
          multiple={multiple}
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => {
            Array.from(event.target.files ?? []).forEach((file) =>
              onChange(file, URL.createObjectURL(file)),
            );
            event.currentTarget.value = "";
          }}
          className={input}
        />
      </label>
      <div className="mt-2 flex flex-wrap gap-2">
        {previews
          .filter((item) => item.url)
          .map((item, index) => (
            <div key={`${item.url}-${index}`} className="relative">
              <Image src={item.url} alt={`${label} preview ${index + 1}`} width={wide ? 1200 : 96} height={wide ? 400 : 96} unoptimized className={`rounded-lg border ${containPreview ? "bg-slate-50 object-contain" : "object-cover"} ${wide ? "aspect-[3/1] w-full" : "h-24 w-24"}`} />
              {onRemove && <button type="button" onClick={() => onRemove(index)} aria-label={`Remove ${label.toLowerCase()} ${index + 1}`} className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-white text-sm font-bold text-red-600 shadow ring-1 ring-slate-200">×</button>}
            </div>
          ))}
      </div>
    </div>
  );
}

function KitItemEditor({ item, onChange, onRemove }: { item: KitItem; onChange: (item: KitItem) => void; onRemove: () => void }) {
  const [variantDraft, setVariantDraft] = useState("");
  const addVariant = () => {
    const variant = variantDraft.trim();
    if (!variant || item.variants.some((value) => value.toLowerCase() === variant.toLowerCase())) return;
    onChange({ ...item, variants: [...item.variants, variant] });
    setVariantDraft("");
  };
  return <article className="mt-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="mb-3 flex items-center justify-between gap-3"><div><h4 className="font-bold text-[#071b41]">Product or inclusion</h4><p className="text-xs text-slate-500">Add its available options, photos, and size guide.</p></div><button type="button" onClick={onRemove} className="rounded-lg px-2 py-1 text-sm font-bold text-red-600 hover:bg-red-50">Remove</button></div>
    <div className="grid gap-3 md:grid-cols-2">
      <label className="block text-sm font-semibold text-slate-700">Product name<input value={item.name} onChange={(event) => onChange({ ...item, name: event.target.value })} placeholder="e.g. Race singlet" className={input} /></label>
      <label className="block text-sm font-semibold text-slate-700">Description <span className="font-normal text-slate-400">(optional)</span><input value={item.description} onChange={(event) => onChange({ ...item, description: event.target.value })} placeholder="e.g. Moisture-wicking race singlet" className={input} /></label>
    </div>
    <div className="mt-4">
      <label className="block text-sm font-semibold text-slate-700">Available variants <span className="font-normal text-slate-400">(sizes, colors, or other options)</span></label>
      <div className="mt-2 flex flex-wrap gap-2">{item.variants.map((variant) => <span key={variant} className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-3 py-1 text-sm font-semibold text-orange-800">{variant}<button type="button" onClick={() => onChange({ ...item, variants: item.variants.filter((value) => value !== variant) })} className="ml-1 text-orange-700" aria-label={`Remove ${variant}`}>×</button></span>)}</div>
      <div className="mt-2 flex gap-2"><input value={variantDraft} onChange={(event) => setVariantDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addVariant(); } }} placeholder="Add a variant, e.g. Kids Small" className={`${input} mt-0`} /><button type="button" onClick={addVariant} disabled={!variantDraft.trim()} className="shrink-0 rounded-lg border border-orange-300 px-3 text-sm font-bold text-orange-700 disabled:opacity-50">Add</button></div>
    </div>
    <div className="mt-4 grid gap-4 lg:grid-cols-2">
      <Upload label="Product photos (front, back, details)" value={item.productImages} multiple onChange={(file, url) => onChange({ ...item, productImages: [...item.productImages, { file, url }] })} onRemove={(imageIndex) => { const image = item.productImages[imageIndex]; if (image?.url.startsWith("blob:")) URL.revokeObjectURL(image.url); onChange({ ...item, productImages: item.productImages.filter((_, index) => index !== imageIndex) }); }} />
      <Upload label="Size chart or reference guide" value={item.referenceImage} onChange={(file, url) => onChange({ ...item, referenceImage: { file, url } })} />
    </div>
    <p className="mt-2 text-xs text-slate-500">Use JPG, PNG, or WEBP images up to 10 MB each. Variants and images will be shown with the event race kit.</p>
  </article>;
}

function MerchandiseEditor({ item, onChange, onRemove }: { item: MerchandiseItem; onChange: (item: MerchandiseItem) => void; onRemove: () => void }) {
  const [variantDraft, setVariantDraft] = useState("");
  const addVariant = () => { const variant = variantDraft.trim(); if (!variant || item.variants.some((value) => value.toLowerCase() === variant.toLowerCase())) return; onChange({ ...item, variants: [...item.variants, variant] }); setVariantDraft(""); };
  return <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex items-start justify-between gap-3"><div><h4 className="font-bold text-[#071b41]">Additional merchandise</h4><p className="text-xs text-slate-500">Optional paid add-on available to every category.</p></div><button type="button" onClick={onRemove} className="rounded-lg px-2 py-1 text-sm font-bold text-red-600 hover:bg-red-50">Remove</button></div>
    <div className="mt-3 grid gap-3 md:grid-cols-2"><label className="block text-sm font-semibold text-slate-700">Product name<input value={item.name} onChange={(event) => onChange({ ...item, name: event.target.value })} placeholder="e.g. Event finisher shirt" className={input} /></label><label className="block text-sm font-semibold text-slate-700">Price (PHP)<input type="number" min="0.01" step="0.01" value={item.unitPrice} onChange={(event) => onChange({ ...item, unitPrice: event.target.value })} placeholder="450.00" className={input} /></label></div>
    <label className="mt-3 block text-sm font-semibold text-slate-700">Description <span className="font-normal text-slate-400">(optional)</span><input value={item.description} onChange={(event) => onChange({ ...item, description: event.target.value })} placeholder="A limited edition event shirt" className={input} /></label>
    <div className="mt-3"><label className="block text-sm font-semibold text-slate-700">Variants <span className="font-normal text-slate-400">(optional, e.g. size or color)</span></label><div className="mt-2 flex flex-wrap gap-2">{item.variants.map((variant) => <span key={variant} className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-3 py-1 text-sm font-semibold text-orange-800">{variant}<button type="button" onClick={() => onChange({ ...item, variants: item.variants.filter((value) => value !== variant) })} aria-label={`Remove ${variant}`} className="ml-1 text-orange-700">×</button></span>)}</div><div className="mt-2 flex gap-2"><input value={variantDraft} onChange={(event) => setVariantDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addVariant(); } }} placeholder="Add option, e.g. Medium" className={`${input} mt-0`} /><button type="button" onClick={addVariant} disabled={!variantDraft.trim()} className="shrink-0 rounded-lg border border-orange-300 px-3 text-sm font-bold text-orange-700 disabled:opacity-50">Add</button></div></div>
    <div className="mt-4"><Upload label="Merchandise photos" value={item.images} multiple onChange={(file, url) => onChange({ ...item, images: [...item.images, { file, url }] })} onRemove={(imageIndex) => { const image = item.images[imageIndex]; if (image?.url.startsWith("blob:")) URL.revokeObjectURL(image.url); onChange({ ...item, images: item.images.filter((_, index) => index !== imageIndex) }); }} /></div>
  </article>;
}

export default function CreateEventPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<boolean[]>([
    false,
    false,
    false,
    false,
    false,
  ]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [draftEventId, setDraftEventId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    tagline: "",
    facebook: "",
    instagram: "",
    description: "",
    eventDate: "",
    registrationOpen: "",
    registrationClose: "",
    assembly: "",
    gunStart: "",
    cutoff: "",
    address: "",
    mechanics: "",
    logo: emptyUpload(),
    banner: emptyUpload(),
  });
  const [categories, setCategories] = useState<Category[]>([]);
  const [sameKit, setSameKit] = useState(false);
  const [sharedKit, setSharedKit] = useState<KitItem[]>([emptyKitItem()]);
  const [merchandise, setMerchandise] = useState<MerchandiseItem[]>([]);
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
  const update = <K extends keyof typeof form>(
    key: K,
    value: (typeof form)[K],
  ) => setForm((current) => ({ ...current, [key]: value }));
  const updatePage = (id: string, changes: Partial<EventPage>) =>
    setEventPages((current) =>
      current.map((page) => (page.id === id ? { ...page, ...changes } : page)),
    );
  const addCustomTab = () => {
    const title = customTabTitle.trim();
    if (
      !title ||
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
    setEventPages((current) => [
      ...current,
      { id, title, type: "custom", visible: true, content: "" },
    ]);
    setActivePage(id);
    setCustomTabTitle("");
    setShowCustomTab(false);
  };
  const capacity = useMemo(
    () =>
      categories.reduce(
        (sum, category) => sum + Number(category.capacity || 0),
        0,
      ),
    [categories],
  );
  const categoriesReady = categories.length > 0 && categories.every((category) =>
    category.name.trim() && Number.isFinite(Number(category.distance)) && Number(category.distance) > 0 &&
    Number.isInteger(Number(category.capacity)) && Number(category.capacity) > 0 &&
    Number.isFinite(Number(category.fee)) && Number(category.fee) >= 0,
  );
  const missing = [
    !form.name.trim() && "event name",
    !form.eventDate && "event date",
    !form.facebook.trim() && "Facebook link",
    !categoriesReady && "at least one complete race category",
  ].filter(Boolean) as string[];
  const ready = missing.length === 0;
  const fieldCompletedSteps = [
    form.name.trim().length > 0 && form.facebook.trim().length > 0,
    Boolean(form.eventDate && form.address.trim()),
    categories.length > 0 &&
      categories.every(
        (category) =>
          category.name.trim() &&
          category.distance &&
          category.capacity &&
          category.fee,
      ),
    eventPages.some(
      (page) => page.id === "event-details" && page.content.trim(),
    ),
    Object.values(sponsors).some((list) =>
      list.some((sponsor) => sponsor.name.trim()),
    ),
  ];

  async function uploadAsset(
    eventId: string,
    kind: "logo" | "banner" | "poster" | "sponsor_logo" | "size_chart" | "race_kit_image" | "merchandise",
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
    return body.url as string;
  }
  async function saveKit(eventId: string, categoryId: string | null, name: string, items: KitItem[]) {
    const configResponse = await fetch(`/api/organizer/events/${eventId}/race-kit-config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category_id: categoryId, name, description: null, status: "active" }),
    });
    const config = await configResponse.json().catch(() => ({}));
    if (!configResponse.ok || !config.id) throw new Error(config.error ?? "Race kit configuration could not be saved.");
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      const itemName = item.name.trim();
      const referenceImageUrl = item.referenceImage.file
        ? await uploadAsset(eventId, "size_chart", item.referenceImage.file)
        : item.referenceImage.url || null;
      const productImageUrls = await Promise.all(item.productImages.map((image) => image.file ? uploadAsset(eventId, "race_kit_image", image.file) : image.url));
      const response = await fetch(`/api/organizer/events/${eventId}/race-kit-config/${config.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_code: `${categoryId ?? "shared"}-${index + 1}-${itemName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
          item_name: itemName,
          quantity: 1,
          details: { description: item.description.trim() || null, variants: item.variants, product_image_urls: productImageUrls, reference_image_url: referenceImageUrl },
          is_required: true,
          is_active: true,
          display_order: index,
        }),
      });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error ?? "A race kit item could not be saved.");
    }
  }
  async function createEvent() {
    if (draftEventId) {
      router.push(`/organizer/events/${draftEventId}`);
      return;
    }
    if (!ready) {
      setMessage(`Complete the required ${missing.join(" and ")} first.`);
      setStep(missing.includes("event date") ? 1 : 0);
      return;
    }
    const incompleteMerchandise = merchandise.some((item) => {
      const started = item.name.trim() || item.description.trim() || item.unitPrice.trim() || item.variants.length || item.images.length;
      return Boolean(started && (!item.name.trim() || !Number.isFinite(Number(item.unitPrice)) || Number(item.unitPrice) <= 0 || item.variants.length > 40 || item.images.length > 8));
    });
    if (incompleteMerchandise) {
      setMessage("Finish each additional merchandise item with a name and positive price (up to 40 variants and 8 photos), or remove the empty item.");
      setStep(2);
      return;
    }
    const incompleteKit = [...sharedKit, ...categories.flatMap((category) => category.kitItems)].some((item) => item.name.trim() && (item.variants.length > 40 || item.productImages.length > 8));
    if (incompleteKit) {
      setMessage("Each race-kit item supports up to 40 variants and 8 product photos.");
      setStep(2);
      return;
    }
    setBusy(true);
    setMessage("Creating event...");
    let createdEventId: string | null = null;
    try {
      const detailsPage =
        eventPages
          .find((page) => page.id === "event-details")
          ?.content.trim() || form.description.trim();
      const mechanicsPage =
        eventPages
          .find((page) => page.id === "race-mechanics")
          ?.content.trim() || form.mechanics.trim();
      const description = [
        form.tagline.trim(),
        detailsPage,
        mechanicsPage ? `Race Mechanics\n${mechanicsPage}` : "",
        ...eventPages
          .filter((page) => page.type === "custom" && page.content.trim())
          .map((page) => `${page.title}\n${page.content.trim()}`),
      ]
        .filter(Boolean)
        .join("\n\n");
      const response = await fetch("/api/organizer/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          slug: form.name
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, ""),
          description,
          event_date: form.eventDate,
          address: form.address.trim() || null,
          social_links: {
            facebook: form.facebook.trim(),
            instagram: form.instagram.trim(),
          },
          registration_opens_at: form.registrationOpen
            ? `${form.registrationOpen}T00:00:00+08:00`
            : null,
          registration_closes_at: form.registrationClose
            ? `${form.registrationClose}T23:59:59+08:00`
            : null,
          assembly_time: form.assembly || null,
          gun_start_time: form.gunStart || null,
          cutoff_time: form.cutoff || null,
          overall_capacity: capacity || null,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.event?.id)
        throw new Error(body.error ?? "Event could not be created.");
      const eventId = body.event.id as string;
      createdEventId = eventId;
      setDraftEventId(eventId);
      for (const category of categories.filter((item) => item.name.trim())) {
        const categoryResponse = await fetch(
          `/api/organizer/events/${eventId}/categories`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: category.name.trim(),
              distance_km: Number(category.distance),
              registration_fee: Number(category.fee),
              max_slots: Number(category.capacity),
              gun_start_time: form.gunStart || null,
              cutoff_time: form.cutoff || null,
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
        if (!sameKit && items.length) await saveKit(eventId, categoryBody.id, `${category.name.trim()} Race Kit`, items);
      }
      const sharedItems = sharedKit.filter((item) => item.name.trim());
      if (sameKit && sharedItems.length) await saveKit(eventId, null, "Shared Race Kit", sharedItems);
      for (const [index, item] of Array.from(merchandise.filter((entry) => entry.name.trim()).entries())) {
        const imageUrls = await Promise.all(item.images.map((image) => image.file ? uploadAsset(eventId, "merchandise", image.file) : image.url));
        const saved = await fetch(`/api/organizer/events/${eventId}/merchandise`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: item.name.trim(), description: item.description.trim() || null, unit_price: Number(item.unitPrice), variants: item.variants, image_urls: imageUrls, display_order: index }) });
        const savedBody = await saved.json().catch(() => ({}));
        if (!saved.ok) throw new Error(savedBody.error ?? "Additional merchandise could not be saved.");
      }
      if (form.logo.file) await uploadAsset(eventId, "logo", form.logo.file);
      if (form.banner.file)
        await uploadAsset(eventId, "banner", form.banner.file);
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
          if (!saved.ok)
            throw new Error(
              (await saved.json().catch(() => ({}))).error ??
                "A sponsor could not be saved.",
            );
        }
      setMessage("Draft created. Review the event, then submit it for RaceDeck approval.");
      router.push(`/organizer/events/${eventId}/preview`);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Event could not be created.";
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
    <main className="mx-auto w-full max-w-[1500px] space-y-6 p-4 sm:p-6">
      {message && (
        <p
          role="status"
          className="rounded-lg bg-orange-50 p-3 text-sm text-orange-800"
        >
          {message}
        </p>
      )}
      {draftEventId && <Link href={`/organizer/events/${draftEventId}`} className="inline-block rounded-lg border border-orange-300 bg-white px-3 py-2 text-sm font-bold text-orange-700">Open saved draft</Link>}
      <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-3 shadow-sm lg:sticky lg:top-24">
          <p className="px-3 pb-3 text-xs font-bold uppercase tracking-widest text-slate-400">
            Event setup
          </p>
          {steps.map((item, index) => {
            const complete =
              completedSteps[index] || fieldCompletedSteps[index];
            return (
              <button
                key={item}
                onClick={() => setStep(index)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-bold ${step === index ? "bg-[#071b41] text-white" : "text-slate-600 hover:bg-slate-50"}`}
              >
                <span
                  className={`grid h-7 w-7 place-items-center rounded-full text-xs ${complete ? "bg-emerald-500 text-white" : step === index ? "bg-orange-500 text-white" : "bg-slate-100 text-slate-500"}`}
                >
                  {complete ? <Check size={15} strokeWidth={3} /> : index + 1}
                </span>
                {item}
              </button>
            );
          })}
        </aside>
        <section className="min-w-0 w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <p className="text-xs font-bold uppercase tracking-widest text-orange-600">
            Step {step + 1} of 5
          </p>
          <h2 className="mt-1 text-2xl font-black text-[#071b41]">
            {steps[step]}
          </h2>
          {step === 0 && (
            <div className="mt-6 space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  label="Event name"
                  value={form.name}
                  onChange={(value) => update("name", value)}
                  required
                />
                <TextField
                  label="Tagline"
                  value={form.tagline}
                  onChange={(value) => update("tagline", value)}
                />
                <TextField
                  label="Facebook link"
                  type="url"
                  value={form.facebook}
                  onChange={(value) => update("facebook", value)}
                  required
                />
                <TextField
                  label="Instagram link"
                  type="url"
                  value={form.instagram}
                  onChange={(value) => update("instagram", value)}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Upload
                  label="Event logo / thumbnail"
                  value={form.logo}
                  onChange={(file, url) => update("logo", { file, url })}
                />
                <Upload
                  label="Banner image"
                  value={form.banner}
                  onChange={(file, url) => update("banner", { file, url })}
                  wide
                />
              </div>
              <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">
                Add the event description and poster images in the Content &amp;
                Media step.
              </p>
            </div>
          )}
          {step === 1 && (
            <div className="mt-6 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  label="Event date"
                  type="date"
                  value={form.eventDate}
                  onChange={(value) => update("eventDate", value)}
                  required
                />
                <TextField
                  label="Registration open"
                  type="date"
                  value={form.registrationOpen}
                  onChange={(value) => update("registrationOpen", value)}
                />
                <TextField
                  label="Registration close"
                  type="date"
                  value={form.registrationClose}
                  onChange={(value) => update("registrationClose", value)}
                />
                <TextField
                  label="Assembly time"
                  type="time"
                  value={form.assembly}
                  onChange={(value) => update("assembly", value)}
                />
                <TextField
                  label="Gun start time"
                  type="time"
                  value={form.gunStart}
                  onChange={(value) => update("gunStart", value)}
                />
                <TextField
                  label="Cut-off time"
                  type="time"
                  value={form.cutoff}
                  onChange={(value) => update("cutoff", value)}
                />
                {form.registrationClose &&
                  form.eventDate &&
                  form.registrationClose > form.eventDate && (
                    <p className="sm:col-span-2 rounded bg-red-50 p-3 text-sm text-red-700">
                      Registration close must be before the event date.
                    </p>
                  )}
              </div>
              <label className="block text-sm font-semibold">
                Event location / Complete address
                <textarea
                  value={form.address}
                  onChange={(event) => update("address", event.target.value)}
                  placeholder="Enter the complete event location and address"
                  className={`${input} min-h-28`}
                />
              </label>
            </div>
          )}
          {step === 2 && (
            <div className="mt-6 space-y-5">
              <div className="rounded-lg bg-slate-50 p-3 text-sm">
                {categories.length} categories -{" "}
                <b>{capacity.toLocaleString()} total capacity</b>
              </div>
              <label className="flex items-center gap-3 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={sameKit}
                  onChange={(event) => setSameKit(event.target.checked)}
                  className="h-4 w-4 accent-orange-600"
                />
                Use the same race kit for all categories
              </label>
              {sameKit && (
                <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
                  <h3 className="font-bold text-[#071b41]">Shared race kit products &amp; inclusions</h3>
                  <p className="mt-1 text-sm text-slate-600">These items apply to every category. Add sample photos and variant choices so runners know what they will receive.</p>
                  {sharedKit.map((item, index) => <KitItemEditor key={index} item={item} onChange={(value) => setSharedKit((current) => current.map((entry, itemIndex) => itemIndex === index ? value : entry))} onRemove={() => setSharedKit((current) => current.filter((_, itemIndex) => itemIndex !== index))} />)}
                  <button
                    type="button"
                    onClick={() => setSharedKit((current) => [...current, emptyKitItem()])}
                    className="mt-3 rounded-lg border border-orange-300 px-3 py-2 text-sm font-bold text-orange-700"
                  >
                    + Add product or inclusion
                  </button>
                </div>
              )}
              {categories.map((category, index) => (
                <div
                  key={index}
                  className="rounded-xl border border-slate-200 p-4"
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    <TextField
                      label="Category name"
                      value={category.name}
                      onChange={(value) =>
                        setCategories((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, name: value }
                              : item,
                          ),
                        )
                      }
                      required
                    />
                    <TextField
                      label="Distance (km)"
                      type="number"
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
                      label="Capacity"
                      type="number"
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
                      required
                    />
                    <TextField
                      label="Registration Fee (PHP)"
                      type="number"
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
                  </div>
                  {!sameKit && (
                    <div className="mt-4 rounded-xl border border-orange-100 bg-orange-50/60 p-4">
                      <h3 className="font-bold text-[#071b41]">Race kit products &amp; inclusions</h3>
                      <p className="mt-1 text-sm text-slate-600">Add products such as a singlet or finisher shirt, their available variants, and photos or a size chart.</p>
                      {category.kitItems.map((item, itemIndex) => <KitItemEditor key={itemIndex} item={item} onChange={(value) => setCategories((current) => current.map((entry, categoryIndex) => categoryIndex === index ? { ...entry, kitItems: entry.kitItems.map((kit, kitIndex) => kitIndex === itemIndex ? value : kit) } : entry))} onRemove={() => setCategories((current) => current.map((entry, categoryIndex) => categoryIndex === index ? { ...entry, kitItems: entry.kitItems.filter((_, kitIndex) => kitIndex !== itemIndex) } : entry))} />)}
                      <button
                        type="button"
                        onClick={() =>
                          setCategories((current) =>
                            current.map((entry, categoryIndex) =>
                              categoryIndex === index
                                ? {
                                    ...entry,
                                    kitItems: [...entry.kitItems, emptyKitItem()],
                                  }
                                : entry,
                            ),
                          )
                        }
                        className="mt-3 rounded-lg border border-orange-300 px-3 py-2 text-sm font-bold text-orange-700"
                      >
                        + Add product or inclusion
                      </button>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      setCategories((current) =>
                        current.filter((_, itemIndex) => itemIndex !== index),
                      )
                    }
                    className="mt-4 text-left text-sm font-bold text-red-600"
                  >
                    Delete category
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setCategories((current) => [...current, emptyCategory()])
                }
                className="rounded-lg border border-orange-300 px-4 py-2 text-sm font-bold text-orange-700"
              >
                + Add another category
              </button>
              <section className="rounded-xl border border-orange-200 bg-orange-50/60 p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-black text-[#071b41]">Additional merchandise</h3><p className="mt-1 max-w-2xl text-sm text-slate-600">Optional paid products sold separately from each category’s included race kit. Runners can add these during registration.</p></div><button type="button" onClick={() => setMerchandise((current) => [...current, emptyMerchandiseItem()])} className="rounded-lg bg-orange-600 px-3 py-2 text-sm font-bold text-white hover:bg-orange-700">+ Add merchandise</button></div>
                {merchandise.length === 0 ? <div className="mt-4 rounded-lg border border-dashed border-orange-200 bg-white p-5 text-center text-sm text-slate-500">No additional merchandise. Your category inclusions remain unchanged.</div> : <div className="mt-4 space-y-3">{merchandise.map((item, index) => <MerchandiseEditor key={index} item={item} onChange={(value) => setMerchandise((current) => current.map((entry, itemIndex) => itemIndex === index ? value : entry))} onRemove={() => setMerchandise((current) => current.filter((_, itemIndex) => itemIndex !== index))} />)}</div>}
              </section>
            </div>
          )}
          {step === 3 && (
            <div className="mt-6 space-y-5">
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
                  onClick={() => setShowCustomTab(true)}
                  className="rounded-lg border border-orange-300 px-3 py-2 text-sm font-bold text-orange-700"
                >
                  + Add Custom Tab
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
                <Upload label="Event posters" value={posters} multiple onChange={(file, url) => setPosters((current) => [...current, { file, url }])} />
                {posters.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{posters.map((poster, index) => <button type="button" key={`${poster.url}-${index}`} onClick={() => setPosters((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="rounded border border-red-200 px-2 py-1 text-xs font-bold text-red-700">Remove poster {index + 1}</button>)}</div>}
              </div>
            </div>
          )}
          {step === 4 && (
            <div className="mt-6 space-y-5">
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
                          onChange={(file, url) =>
                            editSponsor(tier, index, { logo: { file, url } })
                          }
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
              <div className="rounded-xl bg-slate-50 p-5 text-sm">
                <p>Event Profile: {form.name ? "Complete" : "Incomplete"}</p>
                <p>Dates: {form.eventDate ? "Complete" : "Incomplete"}</p>
                <p>Location: {form.address ? "Complete" : "Incomplete"}</p>
                <p>
                  Categories: {categories.length ? "Complete" : "Incomplete"}
                </p>
              </div>
              <button
                type="button"
                disabled={busy || !ready}
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
            {step < 4 && (
              <button
                type="button"
                onClick={() => {
                  setCompletedSteps((current) =>
                    current.map((complete, index) =>
                      index === step ? true : complete,
                    ),
                  );
                  setStep((current) => current + 1);
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

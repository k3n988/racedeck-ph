"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Check, Maximize2, Minus, Plus, RotateCcw, X } from "lucide-react";
import { bannerFrameStyle } from "@/lib/events/banner-frame";

export type BannerFrame = { x: number; y: number; zoom: number };

const defaultFrame: BannerFrame = { x: 50, y: 50, zoom: 1 };

export function BannerFrameEditor({
  src,
  value,
  onChange,
  disabled = false,
  title = "Banner framing",
  variant = "banner",
}: {
  src: string;
  value: BannerFrame;
  onChange: (value: BannerFrame) => void;
  disabled?: boolean;
  title?: string;
  variant?: "banner" | "logo";
}) {
  const [originalOpen, setOriginalOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);
  useEffect(() => {
    setEditing(false);
    setDraft(value);
  }, [src, value]);
  useEffect(() => {
    if (!originalOpen) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setOriginalOpen(false); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [originalOpen]);

  const update = (patch: Partial<BannerFrame>) => setDraft((current) => ({ ...current, ...patch }));
  const isLogo = variant === "logo";
  const imageName = isLogo ? "logo" : "banner";
  return <section className={`mt-4 overflow-hidden rounded-xl border border-slate-200 ${editing ? "bg-slate-50 p-4" : isLogo ? "bg-white" : "bg-[#071b41]"}`} aria-label={title}>
    {editing ? <>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div><h3 className="text-sm font-bold text-[#071b41]">Adjust {imageName} image</h3><p className="mt-1 max-w-2xl text-xs leading-5 text-slate-600">Move the framing controls to choose what appears in the {imageName}. The uploaded original stays unchanged.</p></div>
        <button type="button" onClick={() => setOriginalOpen(true)} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100"><Maximize2 size={14} aria-hidden="true" />View original</button>
      </div>
      <div className="overflow-hidden rounded-lg border border-slate-300 bg-[#071b41]">
        <div className={`relative ${isLogo ? "mx-auto aspect-square w-full max-w-sm rounded-full" : "aspect-[3/1] w-full"} overflow-hidden`}>
          <Image src={src} alt={`Adjustable event ${imageName} crop preview`} fill sizes={isLogo ? "(max-width: 640px) 80vw, 384px" : "100vw"} unoptimized className="object-cover" style={bannerFrameStyle(draft)} />
        </div>
      </div>
      <div className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
        <label className="block text-xs font-semibold text-slate-700">Horizontal framing <span className="font-normal text-slate-500">{draft.x}%</span><input type="range" min="0" max="100" step="1" value={draft.x} disabled={disabled} onChange={(event) => update({ x: Number(event.target.value) })} className="mt-2 block w-full accent-orange-600" /></label>
        <label className="block text-xs font-semibold text-slate-700">Vertical framing <span className="font-normal text-slate-500">{draft.y}%</span><input type="range" min="0" max="100" step="1" value={draft.y} disabled={disabled} onChange={(event) => update({ y: Number(event.target.value) })} className="mt-2 block w-full accent-orange-600" /></label>
        <label className="block text-xs font-semibold text-slate-700 sm:col-span-2">Zoom <span className="font-normal text-slate-500">{Math.round(draft.zoom * 100)}%</span><span className="mt-2 flex items-center gap-3"><Minus size={14} aria-hidden="true" /><input type="range" min="1" max="2" step="0.01" value={draft.zoom} disabled={disabled} onChange={(event) => update({ zoom: Number(event.target.value) })} className="block w-full accent-orange-600" /><Plus size={14} aria-hidden="true" /></span></label>
      </div>
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button type="button" disabled={disabled} onClick={() => setDraft(defaultFrame)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"><RotateCcw size={14} aria-hidden="true" />Reset</button>
        <button type="button" disabled={disabled} onClick={() => { setDraft(value); setEditing(false); }} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50">Cancel</button>
        <button type="button" disabled={disabled} onClick={() => { onChange(draft); setEditing(false); }} className="inline-flex items-center gap-1.5 rounded-lg bg-[#0b2b5b] px-4 py-2 text-sm font-bold text-white hover:bg-[#123c78] disabled:opacity-50"><Check size={15} aria-hidden="true" />Save crop</button>
      </div>
    </> : <button type="button" disabled={disabled} onClick={() => { setDraft(value); setEditing(true); }} aria-label={`Click to adjust event ${imageName} crop`} className={`group block w-full overflow-hidden ${isLogo ? "bg-white p-3 text-center" : "bg-[#071b41] text-left"} focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-orange-200 disabled:cursor-default`}>
      <span className={`relative block overflow-hidden ${isLogo ? "mx-auto h-24 w-24 rounded-full" : "aspect-[3/1] w-full"}`}>
        <Image src={src} alt={`Saved event ${imageName} preview. Click to adjust the visible area.`} fill sizes={isLogo ? "96px" : "100vw"} unoptimized className="object-cover" style={bannerFrameStyle(value)} />
        {!disabled && <span className={`absolute inset-0 grid place-items-center text-xs font-bold text-white opacity-0 transition group-hover:bg-slate-950/35 group-hover:opacity-100 group-focus-visible:bg-slate-950/35 group-focus-visible:opacity-100 ${isLogo ? "rounded-full bg-slate-950/0" : "bg-slate-950/0 text-sm"}`}>Click to adjust crop</span>}
      </span>
      {isLogo && <span className="mt-2 block text-xs font-semibold text-slate-600">Click to adjust logo crop</span>}
    </button>}
    {originalOpen && <div role="dialog" aria-modal="true" aria-label={`Original event ${imageName}`} className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/85 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setOriginalOpen(false); }}>
      <div className="relative flex max-h-[92vh] w-full max-w-6xl flex-col rounded-2xl bg-white p-3 shadow-2xl sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-3"><h2 className="font-bold text-[#071b41]">Original event {imageName}</h2><button type="button" autoFocus onClick={() => setOriginalOpen(false)} aria-label="Close original image" className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 text-slate-700 hover:bg-slate-100"><X size={18} /></button></div>
        <div className="relative grid min-h-0 flex-1 place-items-center overflow-auto rounded-lg bg-slate-100 p-2"><Image src={src} alt={`Original uploaded event ${imageName}`} fill sizes="100vw" unoptimized className="object-contain" /></div>
      </div>
    </div>}
  </section>;
}

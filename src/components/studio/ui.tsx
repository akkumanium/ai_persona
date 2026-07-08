"use client";

/* eslint-disable @next/next/no-img-element */

import { Check, ChevronDown, Loader2, Upload, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Asset, Persona } from "@/lib/types";
import { cn } from "@/lib/utils";

export function PanelTitle({ icon: Icon, title }: { icon: LucideIcon; title: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex size-8 items-center justify-center rounded-md bg-emerald-50 text-emerald-800">
        <Icon size={16} />
      </div>
      <h2 className="text-base font-semibold text-stone-950">{title}</h2>
    </div>
  );
}

/**
 * Consistent source-image input used by Videos, Motion Control, and Avatar.
 * When an image is present it shows a preview thumbnail with Replace/Clear
 * actions; otherwise it falls back to a dashed upload box. This replaces the
 * old mix of dropdowns, search pickers, and persona-reference fallbacks so
 * every generation surface loads an image the same way.
 */
export function SourceImageField({
  label,
  image,
  onClear,
  onUpload,
  loading = false,
  accept = "image/*",
  hint,
}: {
  label: string;
  image?: { url: string; name: string };
  onClear: () => void;
  onUpload: (files: FileList | null) => void;
  loading?: boolean;
  accept?: string;
  hint?: string;
}) {
  if (!image) {
    return (
      <UploadBox
        accept={accept}
        icon={Upload}
        label={`Upload ${label.toLowerCase()}`}
        detail={hint}
        loading={loading}
        onChange={onUpload}
      />
    );
  }

  return (
    <div className="mt-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-stone-700">{label}</span>
        <button
          type="button"
          onClick={onClear}
          className="inline-flex h-6 items-center gap-1 rounded-md border border-stone-200 px-2 text-[11px] font-semibold text-stone-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
        >
          <X size={11} strokeWidth={2.5} />
          Clear
        </button>
      </div>
      <div className="mt-1.5 flex items-center gap-3 rounded-md border border-stone-200 bg-stone-50 p-2">
        <div className="size-14 shrink-0 overflow-hidden rounded-md border border-stone-200 bg-stone-100">
          <img src={image.url} alt="" className="h-full w-full object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-stone-950">{image.name}</p>
          {hint ? <p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-stone-500">{hint}</p> : null}
          <label className="mt-1.5 inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md border border-stone-200 bg-white px-2 text-[11px] font-semibold text-stone-700 transition hover:border-emerald-800 hover:text-stone-950">
            {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Upload size={12} />}
            Replace
            <input
              className="sr-only"
              type="file"
              accept={accept}
              onChange={(event) => {
                onUpload(event.target.files);
                event.target.value = "";
              }}
            />
          </label>
        </div>
      </div>
    </div>
  );
}

export function UploadBox({
  accept,
  multiple = false,
  icon: Icon,
  label,
  detail,
  onChange,
  compact = false,
  loading = false,
}: {
  accept: string;
  multiple?: boolean;
  icon: LucideIcon;
  label: string;
  detail?: string;
  onChange: (files: FileList | null) => void;
  compact?: boolean;
  loading?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-2.5 rounded-md border border-dashed border-stone-300 bg-stone-50 px-3 text-left transition hover:border-emerald-800 hover:bg-white",
        loading && "opacity-90",
        compact ? "mt-2.5 h-9" : "mt-3 min-h-11 px-4",
      )}
    >
      {loading ? (
        <Loader2 className="size-4 shrink-0 animate-spin text-emerald-800" />
      ) : (
        <Icon className="size-4 shrink-0 text-emerald-800" />
      )}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-xs font-semibold text-stone-950">{label}</span>
        {loading || detail ? (
          <span className="truncate text-[11px] font-normal text-stone-500">{loading ? "Uploading, you can add more." : detail}</span>
        ) : null}
      </span>
      <input
        className="sr-only"
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={(event) => {
          onChange(event.target.files);
          event.target.value = "";
        }}
      />
    </label>
  );
}

export function MediaLightbox({
  src,
  title,
  kind = "image",
  onClose,
}: {
  src: string;
  title: string;
  kind?: "image" | "video";
  onClose: () => void;
}) {
  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 flex size-10 items-center justify-center rounded-md bg-white text-stone-950 transition hover:bg-stone-100"
        aria-label="Close fullscreen preview"
      >
        <X size={18} />
      </button>
      {kind === "video" ? (
        <video
          src={src}
          className="max-h-[92vh] max-w-[94vw] rounded-md object-contain"
          controls
          autoPlay
          onClick={(event) => event.stopPropagation()}
        />
      ) : (
        <img
          src={src}
          alt={title}
          className="max-h-[92vh] max-w-[94vw] rounded-md object-contain"
          onClick={(event) => event.stopPropagation()}
        />
      )}
    </div>
  );
}

/**
 * Compact, image-led reference picker. Each reference is a square thumbnail tile;
 * selected tiles show a check badge. Clicking a selected tile deselects it.
 * The first tile ("Default") doubles as the toggle-all affordance.
 */
export function ReferencePicker({
  references,
  selectedIds,
  onToggle,
}: {
  references: Asset[];
  selectedIds: string[];
  onToggle: (assetId: string) => void;
}) {
  if (!references.length) {
    return (
      <div className="mt-2.5 rounded-md border border-dashed border-stone-300 bg-stone-50 px-3 py-2.5 text-xs text-stone-600">
        No reference images yet. Add references from the persona manager.
      </div>
    );
  }

  return (
    <div className="mt-2.5 grid grid-cols-3 gap-1.5">
      {references.map((asset) => {
        const isSelected = selectedIds.includes(asset.id);
        return (
          <button
            type="button"
            key={asset.id}
            onClick={() => onToggle(asset.id)}
            title="Reference image"
            className={cn(
              "group relative aspect-square overflow-hidden rounded-md border bg-stone-100 transition",
              isSelected ? "border-emerald-800 ring-1 ring-emerald-800" : "border-stone-200 hover:border-emerald-800",
            )}
          >
            <img src={asset.url} alt="" className="h-full w-full object-cover" />
            <span
              className={cn(
                "absolute right-1 top-1 flex size-5 items-center justify-center rounded-full border transition",
                isSelected
                  ? "border-emerald-800 bg-emerald-800 text-white"
                  : "border-white/60 bg-black/30 text-transparent group-hover:border-white/80",
              )}
            >
              <Check size={12} strokeWidth={3} />
            </span>
            {asset.isDefaultReference ? (
              <span className="absolute bottom-1 left-1 rounded-sm bg-black/55 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white">
                Default
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function ReferenceSummary({
  useReferences,
  allowPromptOnly = true,
  selectedCount,
  totalCount,
}: {
  useReferences: boolean;
  allowPromptOnly?: boolean;
  selectedCount: number;
  totalCount: number;
}) {
  let copy: string;
  if (!useReferences) {
    copy = allowPromptOnly ? "Prompt-only generation enabled. No references will be used." : "No references will be used.";
  } else if (totalCount === 0) {
    copy = "No references available yet. Add references to this persona first.";
  } else if (selectedCount === 0) {
    copy = allowPromptOnly ? "No references selected — generation will be prompt-only." : "Select at least one reference image.";
  } else {
    copy = `${selectedCount} of ${totalCount} reference${totalCount === 1 ? "" : "s"} selected`;
  }

  return (
    <div className="mt-2.5 rounded-md bg-stone-50 px-3 py-2 text-xs leading-5 text-stone-600">
      {copy}
    </div>
  );
}

export function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="mt-2.5 block">
      <span className="text-xs font-medium text-stone-700">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 h-9 w-full rounded-md border border-stone-200 bg-white px-3 text-sm outline-none transition focus:border-emerald-800"
      />
    </label>
  );
}

export function TextArea({
  label,
  value,
  onChange,
  rows = 3,
  action,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  action?: ReactNode;
}) {
  return (
    <label className="mt-2.5 block">
      <span className="flex min-h-6 items-center justify-between gap-2 text-xs font-medium text-stone-700">
        {label}
        {action}
      </span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        className="mt-1.5 w-full resize-y rounded-md border border-stone-200 bg-white px-3 py-2 text-sm leading-5 outline-none transition focus:border-emerald-800"
      />
    </label>
  );
}

export function ModeToggle({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="mt-2.5">
      {label ? <p className="text-xs font-medium text-stone-700">{label}</p> : null}
      <div className="mt-1.5 flex flex-wrap gap-1 rounded-md bg-stone-100 p-1">
        {options.map((option) => (
          <button
            type="button"
            key={option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              "h-8 flex-1 rounded-[5px] px-2 text-xs font-medium transition",
              value === option.value ? "bg-white text-stone-950 shadow-sm" : "text-stone-600 hover:text-stone-950",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function PersonaSelect({
  personas,
  value,
  onChange,
}: {
  personas: Persona[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <label className="mt-2.5 block">
      <span className="text-xs font-medium text-stone-700">Persona</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 h-9 w-full rounded-md border border-stone-200 bg-white px-3 text-sm outline-none transition focus:border-emerald-800"
      >
        {personas.map((persona) => (
          <option key={persona.id} value={persona.id}>
            {persona.name}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ModelSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { id: string; label: string }[];
  onChange: (id: string) => void;
}) {
  return (
    <label className="mt-2.5 block">
      <span className="text-xs font-medium text-stone-700">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 h-9 w-full rounded-md border border-stone-200 bg-white px-3 text-sm outline-none transition focus:border-emerald-800"
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function SubmitButton({
  loading,
  icon: Icon,
  label,
  costLabel,
  disabled,
  disableWhileLoading = true,
}: {
  loading: boolean;
  icon: LucideIcon;
  label: string;
  costLabel?: string;
  disabled?: boolean;
  disableWhileLoading?: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={disabled || (disableWhileLoading && loading)}
      className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-emerald-800 px-4 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:bg-stone-300"
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : <Icon size={16} />}
      {label}
      {costLabel ? (
        <span className="ml-1 rounded-sm bg-white/15 px-1.5 py-0.5 text-[11px] font-semibold">{costLabel}</span>
      ) : null}
    </button>
  );
}

export function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="mt-2.5 block">
      <span className="text-xs font-medium text-stone-700">{label}</span>
      <div className="mt-1.5 flex h-9 items-center rounded-md border border-stone-200 bg-white px-3 focus-within:border-emerald-800">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(event) => onChange(Number(event.target.value))}
          className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
        {suffix ? <span className="ml-2 text-xs text-stone-500">{suffix}</span> : null}
      </div>
    </label>
  );
}

export function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  if (["aspect", "aspect ratio"].includes(label.toLowerCase())) {
    return <AspectRatioSelect label={label} value={value} options={options} onChange={onChange} />;
  }

  return (
    <label className="mt-2.5 block">
      <span className="text-xs font-medium text-stone-700">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 h-9 w-full rounded-md border border-stone-200 bg-white px-3 text-sm outline-none transition focus:border-emerald-800"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function AspectRatioSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function closeOnOutsideClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative mt-2.5">
      <span className="text-xs font-medium text-stone-700">{label}</span>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="mt-1.5 flex h-9 w-full items-center gap-2 rounded-md border border-stone-200 bg-white px-3 text-left text-sm text-stone-950 outline-none transition hover:border-emerald-800 focus:border-emerald-800"
      >
        <AspectRatioGlyph ratio={value} />
        <span className="min-w-0 flex-1 truncate">{value}</span>
        <ChevronDown size={14} className={cn("text-stone-500 transition", open && "rotate-180")} aria-hidden="true" />
      </button>
      {open ? (
        <div
          role="listbox"
          aria-label={label}
          className="aspect-ratio-menu absolute left-0 right-0 top-full z-30 mt-1 grid max-h-64 gap-1 overflow-y-auto rounded-md border border-stone-200 bg-white p-1 shadow-lg"
        >
          {options.map((option) => {
            const selected = option === value;
            return (
              <button
                key={option}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onChange(option);
                  setOpen(false);
                }}
                className={cn(
                  "flex h-9 items-center gap-2 rounded-[5px] px-2 text-left text-sm transition",
                  selected
                    ? "bg-emerald-50 text-stone-950 ring-1 ring-emerald-800"
                    : "text-stone-600 hover:bg-stone-100 hover:text-stone-950",
                )}
              >
                <AspectRatioGlyph ratio={option} />
                <span className="min-w-0 flex-1 truncate">{option}</span>
                {selected ? <Check size={14} className="text-emerald-800" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Visible aspect-ratio glyph. Uses an explicit accent color (emerald) instead of
 * `border-current`/`bg-current`, which was rendering nearly invisibly under the
 * dark reskin in globals.css.
 */
function AspectRatioGlyph({ ratio }: { ratio: string }) {
  const [width, height] = ratio.split(":").map(Number);
  const isAuto = ratio === "auto" || !width || !height;
  const isSquare = width === height;
  const isHorizontal = width > height;
  const className = cn(
    "aspect-ratio-glyph block shrink-0 border border-emerald-800 bg-emerald-800/25",
    isAuto
      ? "h-3.5 w-4 border-dashed opacity-80"
      : isSquare
        ? "size-3.5"
        : isHorizontal
          ? "h-3 w-5"
          : "h-5 w-3",
  );

  return <span className={className} aria-hidden="true" />;
}

export function RangeField({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="mt-2.5 block">
      <span className="flex items-center justify-between gap-3 text-xs font-medium text-stone-700">
        {label}
        <span className="font-mono text-[11px] text-stone-500">{value.toFixed(2)}</span>
      </span>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-1.5 w-full accent-emerald-800"
      />
    </label>
  );
}

export function CheckboxField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="mt-2 flex h-9 cursor-pointer items-center gap-2.5 rounded-md border border-stone-200 bg-stone-50 px-3 text-xs font-medium text-stone-700 transition hover:border-emerald-800">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4 accent-emerald-800"
      />
      {label}
    </label>
  );
}

/**
 * Removable thumbnail strip for uploaded/source images. Used by image-reference
 * uploads, hybrid face sources, and scratch sources.
 */
export function ImageThumbStrip({
  images,
  onRemove,
}: {
  images: { name?: string; data?: string; url?: string; mimeType: string }[];
  onRemove: (index: number) => void;
}) {
  if (!images.length) return null;
  return (
    <div className="mt-2 grid grid-cols-4 gap-1.5">
      {images.map((image, index) => {
        const src = image.url ?? (image.data ? `data:${image.mimeType};base64,${image.data}` : undefined);
        return (
          <div
            key={`${image.name ?? "image"}-${index}`}
            className="relative aspect-square overflow-hidden rounded-md border border-stone-200 bg-stone-100"
          >
            {src ? <img src={src} alt={image.name ?? `Image ${index + 1}`} className="h-full w-full object-cover" /> : null}
            <button
              type="button"
              onClick={() => onRemove(index)}
              className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-black/55 text-white transition hover:bg-red-700"
              aria-label="Remove image"
            >
              <X size={12} strokeWidth={2.5} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

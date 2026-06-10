/* eslint-disable @next/next/no-img-element */

import { Loader2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Asset, Persona } from "@/lib/types";
import { cn } from "@/lib/utils";

export function PanelTitle({ icon: Icon, title }: { icon: LucideIcon; title: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex size-10 items-center justify-center rounded-md bg-emerald-50 text-emerald-800">
        <Icon size={19} />
      </div>
      <h2 className="text-lg font-semibold text-stone-950">{title}</h2>
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
}: {
  accept: string;
  multiple?: boolean;
  icon: LucideIcon;
  label: string;
  detail?: string;
  onChange: (files: FileList | null) => void;
}) {
  return (
    <label className="mt-4 flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-stone-300 bg-stone-50 px-4 text-center text-sm font-medium text-stone-700 transition hover:border-emerald-800 hover:bg-white">
      <span className="inline-flex items-center gap-2">
        <Icon className="text-emerald-800" size={18} />
        {label}
      </span>
      {detail ? <span className="mt-2 max-w-full truncate text-xs font-normal text-stone-500">{detail}</span> : null}
      <input
        className="sr-only"
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={(event) => onChange(event.target.files)}
      />
    </label>
  );
}

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
      <div className="mt-4 rounded-lg border border-dashed border-stone-300 bg-stone-50 px-4 py-3 text-sm text-stone-600">
        No reference images yet. Add references from the persona manager.
      </div>
    );
  }

  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      {references.map((asset) => {
        const isSelected = selectedIds.includes(asset.id);
        return (
          <label
            key={asset.id}
            className={cn(
              "flex cursor-pointer items-center gap-3 rounded-lg border bg-stone-50 p-3 text-sm text-stone-700 transition",
              isSelected ? "border-emerald-800" : "border-stone-200",
            )}
          >
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggle(asset.id)}
              className="size-4 accent-emerald-800"
            />
            <div className="flex size-14 items-center justify-center overflow-hidden rounded-md bg-stone-100 p-2">
              <img src={asset.url} alt={asset.title} className="h-full w-full object-contain" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-stone-950">{asset.title}</p>
              <p className="mt-1 text-xs text-stone-500">
                {asset.isDefaultReference ? "Default" : "Optional"}
              </p>
            </div>
          </label>
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
  return (
    <div className="mt-4 rounded-lg bg-stone-50 px-4 py-3 text-sm text-stone-600">
      {!useReferences
        ? allowPromptOnly
          ? "Prompt-only generation enabled. No references will be used."
          : "No references will be used."
        : totalCount === 0
          ? "No references available yet. Add references to this persona first."
          : selectedCount === 0
            ? allowPromptOnly
              ? "Select at least one reference or switch to prompt-only."
              : "Select at least one reference image."
            : `${selectedCount} of ${totalCount} reference image${totalCount === 1 ? "" : "s"} selected.`}
    </div>
  );
}

export function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="mt-4 block">
      <span className="text-sm font-medium text-stone-700">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-11 w-full rounded-md border border-stone-200 bg-white px-3 text-sm outline-none transition focus:border-emerald-800"
      />
    </label>
  );
}

export function TextArea({
  label,
  value,
  onChange,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  return (
    <label className="mt-4 block">
      <span className="text-sm font-medium text-stone-700">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        className="mt-2 w-full resize-y rounded-md border border-stone-200 bg-white px-3 py-3 text-sm leading-6 outline-none transition focus:border-emerald-800"
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
    <div className="mt-4">
      <p className="text-sm font-medium text-stone-700">{label}</p>
      <div className="mt-2 flex flex-wrap gap-1 rounded-md bg-stone-100 p-1">
        {options.map((option) => (
          <button
            type="button"
            key={option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              "h-10 flex-1 rounded-[5px] px-3 text-sm font-medium transition",
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
    <label className="mt-4 block">
      <span className="text-sm font-medium text-stone-700">Persona</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-11 w-full rounded-md border border-stone-200 bg-white px-3 text-sm outline-none transition focus:border-emerald-800"
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
    <label className="mt-4 block">
      <span className="text-sm font-medium text-stone-700">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-11 w-full rounded-md border border-stone-200 bg-white px-3 text-sm outline-none transition focus:border-emerald-800"
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
}: {
  loading: boolean;
  icon: LucideIcon;
  label: string;
  costLabel?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={loading || disabled}
      className="mt-5 inline-flex h-11 items-center gap-2 rounded-md bg-emerald-800 px-4 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:bg-stone-300"
    >
      {loading ? <Loader2 className="animate-spin" size={18} /> : <Icon size={18} />}
      {label}
      {costLabel ? (
        <span className="rounded-sm bg-white/15 px-2 py-0.5 text-xs font-semibold">{costLabel}</span>
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
    <label className="mt-4 block">
      <span className="text-sm font-medium text-stone-700">{label}</span>
      <div className="mt-2 flex h-11 items-center rounded-md border border-stone-200 bg-white px-3 focus-within:border-emerald-800">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(event) => onChange(Number(event.target.value))}
          className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
        {suffix ? <span className="ml-2 text-sm text-stone-500">{suffix}</span> : null}
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
  return (
    <label className="mt-4 block">
      <span className="text-sm font-medium text-stone-700">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-11 w-full rounded-md border border-stone-200 bg-white px-3 text-sm outline-none transition focus:border-emerald-800"
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
    <label className="mt-4 block">
      <span className="flex items-center justify-between gap-3 text-sm font-medium text-stone-700">
        {label}
        <span className="font-mono text-xs text-stone-500">{value.toFixed(2)}</span>
      </span>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-2 w-full accent-emerald-800"
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
    <label className="mt-4 flex items-center gap-3 rounded-lg bg-stone-50 p-3 text-sm font-medium text-stone-700">
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

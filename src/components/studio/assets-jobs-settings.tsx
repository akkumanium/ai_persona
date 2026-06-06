/* eslint-disable @next/next/no-img-element */

import { Coins, Settings } from "lucide-react";
import { useState } from "react";
import type { AssetFilter } from "@/components/studio/types";
import { ModeToggle, PanelTitle } from "@/components/studio/ui";
import { MODEL_REGISTRY } from "@/lib/model-registry";
import type { Asset, GenerationJob, Persona } from "@/lib/types";
import { formatCredits } from "@/lib/utils";

export function AssetsView({ assets, personas }: { assets: Asset[]; personas: Persona[] }) {
  const [filter, setFilter] = useState<AssetFilter>("all");
  const visibleAssets = assets.filter((asset) => filter === "all" || asset.kind === filter);

  return (
    <section>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <ModeToggle
          label="Asset filter"
          value={filter}
          options={[
            { value: "all", label: "All" },
            { value: "avatar", label: "Avatars" },
            { value: "upload", label: "Uploads" },
            { value: "image", label: "Images" },
            { value: "video", label: "Videos" },
          ]}
          onChange={(value) => setFilter(value as AssetFilter)}
        />
      </div>
      {visibleAssets.length ? (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {visibleAssets.map((asset) => {
          const persona = personas.find((item) => item.id === asset.personaId);
          return (
            <article key={asset.id} className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm">
              <div className="aspect-[4/5] bg-stone-100">
                {asset.kind === "video" ? (
                  <video src={asset.url} className="h-full w-full object-cover" controls />
                ) : (
                  <img src={asset.url} alt={asset.title} className="h-full w-full object-cover" />
                )}
              </div>
              <div className="p-4">
                <p className="text-sm font-semibold text-stone-950">{asset.title}</p>
                <p className="mt-1 text-xs text-stone-500">{persona?.name ?? "Unassigned"} В· {asset.model}</p>
                <a
                  href={asset.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex h-9 items-center rounded-md bg-stone-900 px-3 text-sm font-medium text-white"
                >
                  Open
                </a>
              </div>
            </article>
          );
        })}
      </div>
      ) : (
        <div className="rounded-lg border border-dashed border-stone-300 bg-white/75 p-10 text-center text-sm text-stone-500">
          No assets match this filter yet.
        </div>
      )}
    </section>
  );
}

export function JobsView({ jobs }: { jobs: GenerationJob[] }) {
  if (!jobs.length) {
    return (
      <section className="rounded-lg border border-dashed border-stone-300 bg-white/75 p-10 text-center text-sm text-stone-500">
        Generation jobs will appear here after you create references, images, or videos.
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm">
      <div className="grid grid-cols-[1fr_130px_120px_110px] gap-4 border-b border-stone-200 px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">
        <span>Job</span>
        <span>Provider</span>
        <span>Status</span>
        <span>Cost</span>
      </div>
      {jobs.map((job) => (
        <div
          key={job.id}
          className="grid grid-cols-[1fr_130px_120px_110px] gap-4 border-b border-stone-100 px-4 py-4 text-sm last:border-b-0"
        >
          <div>
            <p className="font-medium text-stone-950">{job.generationType.replaceAll("_", " ")}</p>
            <p className="mt-1 line-clamp-1 text-stone-500">{job.prompt}</p>
          </div>
          <span className="text-stone-600">{job.provider}</span>
          <span className="font-medium text-emerald-800">{job.status}</span>
          <span className="text-stone-600">{formatCredits(job.costEstimateCents)}</span>
        </div>
      ))}
    </section>
  );
}

export function SettingsView({ spentCents }: { spentCents: number }) {
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
        <PanelTitle icon={Settings} title="Provider Environment" />
        <div className="mt-5 grid gap-3">
          {[
            ["NEXT_PUBLIC_SUPABASE_URL", "Supabase app URL"],
            ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "Supabase browser key"],
            ["SUPABASE_SERVICE_ROLE_KEY", "Server-side storage and jobs"],
            ["GEMINI_API_KEY", "Nano Banana Pro image generation"],
            ["OPENAI_API_KEY", "ChatGPT image generation"],
            ["NANO_BANANA_MODEL", "Defaults to gemini-3-pro-image-preview"],
            ["WAN_API_BASE_URL", "Wan-compatible video endpoint"],
            ["WAN_API_KEY", "Wan video provider key"],
            ["KLING_API_BASE_URL", "Kling video endpoint"],
            ["KLING_API_KEY", "Kling video provider key"],
            ["KLING_MODEL", "Defaults to kling-v2-6"],
            ["SEEDANCE_API_BASE_URL", "Seedance video endpoint"],
            ["SEEDANCE_API_KEY", "Seedance video provider key"],
            ["SEEDANCE_MODEL", "Defaults to dreamina-seedance-2-0-260128"],
          ].map(([name, detail]) => (
            <div key={name} className="rounded-lg bg-stone-50 p-4">
              <p className="font-mono text-sm font-semibold text-stone-900">{name}</p>
              <p className="mt-1 text-sm text-stone-500">{detail}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
        <PanelTitle icon={Coins} title="Models And Usage" />
        <p className="mt-5 text-3xl font-semibold text-emerald-900">{formatCredits(spentCents)}</p>
        <div className="mt-5 grid gap-3">
          {MODEL_REGISTRY.map((model) => (
            <div key={model.id} className="rounded-lg border border-stone-200 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold text-stone-950">{model.label}</p>
                <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-800">
                  {model.provider}
                </span>
              </div>
              <p className="mt-1 font-mono text-xs text-stone-500">{model.id}</p>
              <p className="mt-2 text-sm leading-6 text-stone-600">{model.notes}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/* eslint-disable @next/next/no-img-element */

import { Coins, Trash2 } from "lucide-react";
import { useState } from "react";
import type { AssetFilter } from "@/components/studio/types";
import { ModeToggle, PanelTitle } from "@/components/studio/ui";
import type { Asset, GenerationJob, Persona } from "@/lib/types";
import { formatCredits } from "@/lib/utils";

export function AssetsView({
  assets,
  personas,
  onDeleteAsset,
}: {
  assets: Asset[];
  personas: Persona[];
  onDeleteAsset: (assetId: string) => void;
}) {
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
                  <p className="mt-1 text-xs text-stone-500">
                    {persona?.name ?? "Unassigned"} / {asset.kind}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a
                      href={asset.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-9 items-center rounded-md bg-stone-900 px-3 text-sm font-medium text-white"
                    >
                      Open
                    </a>
                    <button
                      type="button"
                      onClick={() => onDeleteAsset(asset.id)}
                      className="inline-flex h-9 items-center gap-2 rounded-md border border-stone-200 px-3 text-sm font-semibold text-stone-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                    >
                      <Trash2 size={15} />
                      Delete
                    </button>
                  </div>
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
      <div className="grid grid-cols-[1fr_120px_110px] gap-4 border-b border-stone-200 px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">
        <span>Job</span>
        <span>Status</span>
        <span>Cost</span>
      </div>
      {jobs.map((job) => (
        <div
          key={job.id}
          className="grid grid-cols-[1fr_120px_110px] gap-4 border-b border-stone-100 px-4 py-4 text-sm last:border-b-0"
        >
          <div>
            <p className="font-medium capitalize text-stone-950">{job.generationType.replaceAll("_", " ")}</p>
            <p className="mt-1 text-stone-500">{new Date(job.createdAt).toLocaleString()}</p>
          </div>
          <span className="font-medium capitalize text-emerald-800">{job.status}</span>
          <span className="text-stone-600">{formatCredits(job.costEstimateCents)}</span>
        </div>
      ))}
    </section>
  );
}

export function SettingsView({ balanceCents }: { balanceCents: number }) {
  return (
    <section className="max-w-xl rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
      <PanelTitle icon={Coins} title="Balance" />
      <p className="mt-5 text-3xl font-semibold text-emerald-900">{formatCredits(balanceCents)}</p>
      <p className="mt-2 text-sm leading-6 text-stone-600">Available credit for new generations.</p>
    </section>
  );
}

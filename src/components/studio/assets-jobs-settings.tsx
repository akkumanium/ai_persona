import { Coins, Copy, Gift, Trash2, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { TokenTopUps } from "@/components/billing-plans";
import { BillingManagement } from "@/components/billing-management";
import { AssetExpiryCaption } from "@/components/studio/asset-expiry-caption";
import type { AssetFilter } from "@/components/studio/types";
import { CardImage, DeferredAudio, DeferredVideo, ModeToggle, PanelTitle } from "@/components/studio/ui";
import type { PublicPaddleConfig } from "@/lib/billing";
import type { Asset, GenerationJob, Persona } from "@/lib/types";
import { formatTokens } from "@/lib/utils";

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
            { value: "audio", label: "Audio" },
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
                  {asset.kind === "audio" ? (
                    <div className="flex h-full flex-col items-center justify-center p-4">
                      <div className="flex size-14 items-center justify-center rounded-md bg-emerald-50 text-emerald-800">
                        <Coins size={24} />
                      </div>
                      <DeferredAudio src={asset.url} title={asset.title} className="mt-5 w-full" />
                    </div>
                  ) : asset.kind === "video" ? (
                    <DeferredVideo src={asset.url} title={asset.title} className="h-full w-full object-cover" />
                  ) : (
                    <CardImage src={asset.url} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="p-4">
                  {asset.kind !== "image" ? (
                    <p className="text-sm font-semibold text-stone-950">{asset.title}</p>
                  ) : null}
                  <p className="mt-1 text-xs text-stone-500">
                    {persona?.name ?? "Unassigned"} / {asset.kind}
                  </p>
                  <AssetExpiryCaption asset={asset} className="mt-1" />
                  {asset.prompt ? (
                    <p className="mt-3 line-clamp-3 text-xs leading-5 text-stone-600">{asset.prompt}</p>
                  ) : null}
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
            {job.prompt ? <p className="mt-2 line-clamp-2 text-xs leading-5 text-stone-600">{job.prompt}</p> : null}
          </div>
          <span className="font-medium capitalize text-emerald-800">{job.status}</span>
          <span className="text-stone-600">{formatTokens(job.costEstimateCents)}</span>
        </div>
      ))}
    </section>
  );
}

export function SettingsView({
  balanceCents,
  supabaseReady,
  userId,
  userEmail,
  paddleConfig,
  hasActiveSubscription,
  onBalanceRefresh,
  onBillingStatusRefresh,
}: {
  balanceCents: number;
  supabaseReady: boolean;
  userId?: string;
  userEmail?: string;
  paddleConfig: PublicPaddleConfig;
  hasActiveSubscription: boolean;
  onBalanceRefresh?: (balanceCents: number) => void;
  onBillingStatusRefresh?: (status: { balanceCents?: number; personaLimit?: number | null; hasActiveSubscription?: boolean }) => void;
}) {
  const [referralCode, setReferralCode] = useState("");
  const [pendingReferrals, setPendingReferrals] = useState(0);
  const [rewardedReferrals, setRewardedReferrals] = useState(0);
  const [rewardedCents, setRewardedCents] = useState(0);
  const [referralMessage, setReferralMessage] = useState("");
  const [accountMessage, setAccountMessage] = useState("");
  const referralLink = useMemo(() => {
    if (!referralCode || typeof window === "undefined") return "";
    const url = new URL("/auth/signin", window.location.origin);
    url.searchParams.set("ref", referralCode);
    url.searchParams.set("next", "/pricing");
    return url.toString();
  }, [referralCode]);

  useEffect(() => {
    if (!supabaseReady || !userId) return;
    let cancelled = false;
    fetch("/api/referrals/me", { cache: "no-store" })
      .then(async (response) => {
        const contentType = response.headers.get("content-type") ?? "";
        if (!contentType.includes("application/json")) throw new Error(`Could not load referral link (server returned ${response.status}).`);
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Could not load referral link.");
        if (cancelled) return;
        setReferralCode(payload.referralCode ?? "");
        setPendingReferrals(payload.pendingCount ?? 0);
        setRewardedReferrals(payload.rewardedCount ?? 0);
        setRewardedCents(payload.rewardedCents ?? 0);
      })
      .catch((error) => {
        if (!cancelled) setReferralMessage(error instanceof Error ? error.message : "Could not load referral link.");
      });
    return () => {
      cancelled = true;
    };
  }, [supabaseReady, userId]);

  async function copyReferralLink() {
    if (!referralLink) return;
    await navigator.clipboard.writeText(referralLink);
    setReferralMessage("Referral link copied.");
  }

  async function copyAccountId() {
    if (!userId) return;
    await navigator.clipboard.writeText(userId);
    setAccountMessage("Account ID copied.");
  }

  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(360px,0.7fr)] xl:items-start">
      <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
        <PanelTitle icon={Coins} title="Balance" />
        <p className="mt-5 text-4xl font-semibold text-emerald-900">{formatTokens(balanceCents)}</p>
      </div>

      <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm xl:row-span-2">
        {hasActiveSubscription ? (
          <TokenTopUps
            userId={userId}
            userEmail={userEmail}
            supabaseReady={supabaseReady}
            config={paddleConfig}
            hasActiveSubscription={hasActiveSubscription}
            onStatusResolved={(status) => {
              onBillingStatusRefresh?.(status);
              if (typeof status.balanceCents === "number") {
                onBalanceRefresh?.(status.balanceCents);
              }
            }}
          />
        ) : (
          <div>
            <p className="text-lg font-semibold text-stone-950">Buy tokens</p>
            <p className="mt-4 text-sm leading-6 text-stone-600">
              Token top-ups are reserved for active subscribers. Subscribe first, then you will be able to add more tokens here.
            </p>
            <a
              href="/pricing"
              className="mt-4 inline-flex h-11 items-center justify-center rounded-md bg-stone-900 px-4 text-sm font-semibold text-white transition hover:bg-stone-800"
            >
              View plans
            </a>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
        <PanelTitle icon={UserRound} title="Account" />
        <div className="mt-5 grid gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Email</p>
            <p className="mt-1 text-sm font-medium text-stone-900">{userEmail ?? "Not available"}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Account ID</p>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
              <code className="min-w-0 flex-1 break-all rounded-md border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm text-stone-700">
                {userId ?? "Not available in preview mode"}
              </code>
              <button
                type="button"
                onClick={() => void copyAccountId()}
                disabled={!userId}
                className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-stone-200 bg-white px-3 text-sm font-semibold text-stone-700 transition hover:border-emerald-700 hover:text-emerald-800 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-400"
              >
                <Copy size={15} />
                Copy ID
              </button>
            </div>
            {accountMessage ? <p className="mt-2 text-sm text-emerald-800">{accountMessage}</p> : null}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
        <PanelTitle icon={Gift} title="Referrals" />
        <p className="mt-4 text-sm leading-6 text-stone-600">
          Invite someone and get {formatTokens(100)} after they subscribe through your link.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
          <input
            readOnly
            value={referralLink || "Sign in with a saved account to get your referral link."}
            className="h-11 min-w-0 rounded-md border border-stone-200 bg-stone-50 px-3 text-sm text-stone-700 outline-none"
          />
          <button
            type="button"
            onClick={() => void copyReferralLink()}
            disabled={!referralLink}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-stone-900 px-4 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:bg-stone-300"
          >
            <Copy size={16} />
            Copy link
          </button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <ReferralStat label="Pending" value={String(pendingReferrals)} />
          <ReferralStat label="Rewarded" value={String(rewardedReferrals)} />
          <ReferralStat label="Earned" value={formatTokens(rewardedCents)} />
        </div>
        {referralMessage ? <p className="mt-3 text-sm text-stone-600">{referralMessage}</p> : null}
      </div>

      <div className="xl:col-span-2">
        <BillingManagement />
      </div>
    </section>
  );
}

function ReferralStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
      <p className="text-xs font-semibold uppercase text-stone-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-stone-950">{value}</p>
    </div>
  );
}

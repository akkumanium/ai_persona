import type { Asset, CreditLedgerEntry, GenerationJob, Persona } from "@/lib/types";

type PersonaRow = {
  id: string;
  name: string;
  description: string;
  style_notes: string;
  status: Persona["status"];
  reference_asset_id: string | null;
  created_at: string;
};

type AssetRow = {
  id: string;
  kind: Asset["kind"];
  public_url: string | null;
  storage_bucket?: string | null;
  storage_path?: string | null;
  title: string;
  prompt: string | null;
  persona_id: string | null;
  reference_asset_ids?: string[] | null;
  reference_slot?: Asset["referenceSlot"] | null;
  is_default_reference?: boolean | null;
  generation_type: Asset["generationType"];
  provider: Asset["provider"];
  provider_job_id?: string | null;
  provider_asset_id?: string | null;
  model: string;
  mime_type: string;
  created_at: string;
};

type JobRow = {
  id: string;
  status: GenerationJob["status"];
  provider: GenerationJob["provider"];
  provider_job_id: string | null;
  model: string;
  generation_type: GenerationJob["generationType"];
  input_params: Record<string, unknown> | null;
  persona_id: string | null;
  cost_estimate_cents: number;
  raw_provider_response?: unknown;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

type LedgerRow = {
  id: string;
  job_id: string;
  amount_cents: number;
  description: string;
  created_at: string;
};

export type StudioInitialData = {
  personas: Persona[];
  assets: Asset[];
  jobs: GenerationJob[];
  ledger: CreditLedgerEntry[];
  balanceCents: number;
};

export const emptyStudioData: StudioInitialData = {
  personas: [],
  assets: [],
  jobs: [],
  ledger: [],
  balanceCents: 0,
};

export function mapPersona(row: PersonaRow): Persona {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    styleNotes: row.style_notes,
    status: row.status,
    referenceAssetId: row.reference_asset_id ?? undefined,
    createdAt: row.created_at,
  };
}

export function mapAsset(row: AssetRow): Asset {
  return {
    id: row.id,
    kind: row.kind,
    url: row.public_url ?? "",
    storageBucket: row.storage_bucket ?? undefined,
    storagePath: row.storage_path ?? undefined,
    title: row.title,
    prompt: row.prompt ?? "",
    personaId: row.persona_id ?? undefined,
    referenceAssetIds: row.reference_asset_ids ?? undefined,
    referenceSlot: row.reference_slot ?? undefined,
    isDefaultReference: Boolean(row.is_default_reference),
    generationType: row.generation_type,
    provider: row.provider,
    providerJobId: row.provider_job_id ?? undefined,
    providerAssetId: row.provider_asset_id ?? undefined,
    model: row.model,
    mimeType: row.mime_type,
    createdAt: row.created_at,
  };
}

export function mapJob(row: JobRow): GenerationJob {
  const inputParams = row.input_params ?? {};
  const visiblePrompt =
    typeof inputParams.additionalPrompt === "string"
      ? inputParams.additionalPrompt
      : typeof inputParams.prompt === "string"
        ? inputParams.prompt
        : "";
  const referenceAssetIds = Array.isArray(inputParams.referenceAssetIds)
    ? inputParams.referenceAssetIds.filter((id): id is string => typeof id === "string")
    : undefined;

  return {
    id: row.id,
    status: row.status,
    provider: row.provider,
    providerJobId: row.provider_job_id ?? undefined,
    model: row.model,
    generationType: row.generation_type,
    prompt: visiblePrompt,
    personaId: row.persona_id ?? undefined,
    referenceAssetIds,
    costEstimateCents: row.cost_estimate_cents,
    rawProviderResponse: row.raw_provider_response,
    errorMessage: row.error_message ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapLedger(row: LedgerRow): CreditLedgerEntry {
  return {
    id: row.id,
    jobId: row.job_id,
    amountCents: row.amount_cents,
    description: row.description,
    createdAt: row.created_at,
  };
}

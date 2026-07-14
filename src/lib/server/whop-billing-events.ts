import type { SupabaseClient } from "@supabase/supabase-js";
import { getBillingOptionByProviderPlanId, mapWhopMembershipStatus } from "@/lib/billing";

export type NormalizedWhopEvent = {
  eventId: string;
  eventType: string;
  occurredAt: string;
  companyId?: string;
  entityId?: string;
  payload: Record<string, unknown>;
};

const SUPPORTED_EVENTS = new Set([
  "payment.succeeded", "payment.failed", "payment.pending",
  "membership.activated", "membership.deactivated", "membership.cancel_at_period_end_changed",
  "refund.created", "refund.updated", "dispute.created", "dispute.updated",
]);

export function normalizeWhopEvent(input: unknown): NormalizedWhopEvent {
  const event = asRecord(input);
  const data = asRecord(event.data);
  const eventId = stringValue(event.id);
  const eventType = stringValue(event.type);
  const occurredAt = dateValue(event.timestamp);
  if (!eventId || !eventType || !occurredAt) throw new Error("Whop webhook is missing its ID, type, or timestamp.");
  const companyId = stringValue(event.company_id) ?? nestedString(data, "company", "id");
  if (!SUPPORTED_EVENTS.has(eventType)) return { eventId, eventType, occurredAt, companyId, entityId: stringValue(data.id), payload: {} };

  if (eventType.startsWith("payment.")) {
    const payload = normalizePayment(data);
    return { eventId, eventType, occurredAt, companyId, entityId: stringValue(data.id), payload };
  }
  if (eventType.startsWith("membership.")) {
    const payload = normalizeMembership(data);
    return { eventId, eventType, occurredAt, companyId, entityId: stringValue(data.id), payload };
  }
  if (eventType.startsWith("refund.")) {
    const payment = asRecord(data.payment);
    const payload = {
      refundId: stringValue(data.id),
      status: stringValue(data.status),
      amountMinor: decimalToMinor(data.amount),
      currency: lowerString(data.currency),
      createdAt: dateValue(data.provider_created_at) ?? dateValue(data.created_at) ?? occurredAt,
      payment: normalizePayment(payment),
    };
    return { eventId, eventType, occurredAt, companyId, entityId: stringValue(data.id), payload };
  }
  const payment = asRecord(data.payment);
  const payload = {
    disputeId: stringValue(data.id),
    status: stringValue(data.status),
    amountMinor: decimalToMinor(data.amount),
    currency: lowerString(data.currency),
    createdAt: dateValue(data.created_at) ?? occurredAt,
    paymentId: stringValue(payment.id),
    membershipId: nestedString(payment, "membership", "id"),
  };
  return { eventId, eventType, occurredAt, companyId, entityId: stringValue(data.id), payload };
}

export async function processStoredWhopEvent(service: SupabaseClient, event: NormalizedWhopEvent) {
  if (!SUPPORTED_EVENTS.has(event.eventType)) return false;
  if (event.eventType === "payment.failed" || event.eventType === "payment.pending") return true;
  if (event.eventType === "payment.succeeded") return processPayment(service, event);
  if (event.eventType.startsWith("membership.")) return processMembership(service, event);
  if (event.eventType.startsWith("refund.")) return processRefund(service, event);
  return processDispute(service, event);
}

async function processPayment(service: SupabaseClient, event: NormalizedWhopEvent) {
  const payload = event.payload;
  const paymentId = stringValue(payload.paymentId);
  const providerPlanId = stringValue(payload.providerPlanId);
  const option = getBillingOptionByProviderPlanId(providerPlanId);
  if (!paymentId || !providerPlanId || !option) throw new Error("Whop payment references an unknown plan or payment.");
  if (lowerString(payload.currency) !== "usd") throw new Error("Whop payment currency does not match the USD catalog.");
  if (stringValue(payload.status) && !["succeeded", "paid"].includes(lowerString(payload.status)!)) throw new Error("Whop payment is not successful.");
  const association = await resolveAssociation(service, payload, option.id, providerPlanId);
  if (!association) throw new Error("Whop payment is not associated with a valid checkout intent or membership.");
  const minimumAmount = Number(option.priceLabel.replace("$", "")) * 100;
  if (numberValue(payload.paidAmountMinor) < minimumAmount) throw new Error("Whop payment amount is below the configured plan price.");
  let membershipId = stringValue(payload.membershipId);
  if (option.kind === "subscription" && !membershipId) {
    const { data: membership, error: membershipError } = await service.from("billing_subscriptions")
      .select("subscription_id").eq("provider", "whop").eq("checkout_intent_id", association.intentId)
      .maybeSingle<{ subscription_id: string }>();
    if (membershipError) throw membershipError;
    membershipId = membership?.subscription_id;
    if (!membershipId) throw new Error("Whop membership is not available yet; retry this payment after activation.");
  }
  let isInitialCheckout = option.kind !== "subscription";
  if (option.kind === "subscription") {
    const { count, error: countError } = await service.from("billing_payments").select("transaction_id", { count: "exact", head: true })
      .eq("provider", "whop").eq("subscription_id", membershipId ?? "");
    if (countError) throw countError;
    isInitialCheckout = (count ?? 0) === 0;
  }
  const { data, error } = await service.rpc("apply_whop_payment_event", {
    p_event_id: event.eventId,
    p_occurred_at: event.occurredAt,
    p_user_id: association.userId,
    p_checkout_intent_id: association.intentId,
    p_payment_id: paymentId,
    p_membership_id: membershipId ?? null,
    p_provider_user_id: stringValue(payload.providerUserId) ?? null,
    p_provider_member_id: stringValue(payload.providerMemberId) ?? null,
    p_membership_status: mapWhopMembershipStatus(stringValue(payload.membershipStatus) ?? "active"),
    p_plan_id: option.id,
    p_provider_plan_id: providerPlanId,
    p_grant_amount_cents: option.creditCents,
    p_paid_amount_minor: numberValue(payload.paidAmountMinor),
    p_is_subscription_payment: option.kind === "subscription",
    p_is_initial_checkout: isInitialCheckout,
    p_payload: payload,
  });
  if (error) throw error;
  return Boolean(data);
}

async function processMembership(service: SupabaseClient, event: NormalizedWhopEvent) {
  const payload = event.payload;
  const membershipId = stringValue(payload.membershipId);
  const providerPlanId = stringValue(payload.providerPlanId);
  const option = getBillingOptionByProviderPlanId(providerPlanId);
  if (!membershipId || !providerPlanId || !option || option.kind !== "subscription") return false;
  const association = await resolveAssociation(service, payload, option.id, providerPlanId, membershipId);
  if (!association) throw new Error("Whop membership is not associated with an Idolborn account.");
  const { data, error } = await service.rpc("apply_whop_membership_event", {
    p_event_id: event.eventId,
    p_user_id: association.userId,
    p_checkout_intent_id: association.intentId,
    p_membership_id: membershipId,
    p_provider_user_id: stringValue(payload.providerUserId) ?? null,
    p_provider_member_id: stringValue(payload.providerMemberId) ?? null,
    p_status: mapWhopMembershipStatus(
      stringValue(payload.status) ?? (event.eventType === "membership.deactivated" ? "canceled" : "active"),
      Boolean(payload.cancelAtPeriodEnd),
    ),
    p_plan_id: option.id,
    p_provider_plan_id: providerPlanId,
    p_manage_url: stringValue(payload.manageUrl) ?? null,
    p_period_starts_at: dateValue(payload.periodStartsAt) ?? null,
    p_period_ends_at: dateValue(payload.periodEndsAt) ?? null,
    p_cancel_at_period_end: Boolean(payload.cancelAtPeriodEnd),
    p_provider_updated_at: dateValue(payload.updatedAt) ?? event.occurredAt,
  });
  if (error) throw error;
  return Boolean(data);
}

async function processRefund(service: SupabaseClient, event: NormalizedWhopEvent) {
  const payment = asRecord(event.payload.payment);
  const refundId = stringValue(event.payload.refundId);
  const paymentId = stringValue(payment.paymentId);
  if (!refundId || !paymentId) throw new Error("Whop refund is missing its refund or payment ID.");
  const { data, error } = await service.rpc("apply_whop_refund_event", {
    p_event_id: event.eventId,
    p_occurred_at: dateValue(event.payload.createdAt) ?? event.occurredAt,
    p_refund_id: refundId,
    p_payment_id: paymentId,
    p_status: stringValue(event.payload.status) ?? "pending",
    p_refunded_amount_minor: numberValue(event.payload.amountMinor),
    p_payload: event.payload,
  });
  if (error) throw error;
  return Boolean(data);
}

async function processDispute(service: SupabaseClient, event: NormalizedWhopEvent) {
  const disputeId = stringValue(event.payload.disputeId);
  const paymentId = stringValue(event.payload.paymentId);
  if (!disputeId || !paymentId) throw new Error("Whop dispute is missing its dispute or payment ID.");
  const { data, error } = await service.rpc("apply_whop_dispute_event", {
    p_event_id: event.eventId,
    p_occurred_at: dateValue(event.payload.createdAt) ?? event.occurredAt,
    p_dispute_id: disputeId,
    p_payment_id: paymentId,
    p_status: stringValue(event.payload.status) ?? "other",
    p_disputed_amount_minor: numberValue(event.payload.amountMinor),
    p_payload: event.payload,
  });
  if (error) throw error;
  return Boolean(data);
}

async function resolveAssociation(service: SupabaseClient, payload: Record<string, unknown>, optionId: string, providerPlanId: string, membershipId?: string) {
  const checkoutSessionId = stringValue(payload.checkoutSessionId);
  const metadata = asRecord(payload.metadata);
  const intentId = stringValue(metadata.checkout_intent_id);
  let query = service.from("billing_checkout_intents").select("id,user_id,option_id,provider_plan_id,provider_checkout_session_id,expires_at");
  if (checkoutSessionId) query = query.eq("provider_checkout_session_id", checkoutSessionId);
  else if (intentId) query = query.eq("id", intentId);
  else if (membershipId ?? stringValue(payload.membershipId)) {
    const id = membershipId ?? stringValue(payload.membershipId)!;
    const { data: subscription } = await service.from("billing_subscriptions").select("user_id,checkout_intent_id").eq("subscription_id", id).maybeSingle<{ user_id: string; checkout_intent_id: string | null }>();
    if (!subscription?.checkout_intent_id) return undefined;
    query = query.eq("id", subscription.checkout_intent_id);
  } else return undefined;
  const { data: intent } = await query.maybeSingle<{ id: string; user_id: string; option_id: string; provider_plan_id: string; provider_checkout_session_id: string | null; expires_at: string }>();
  if (!intent || intent.option_id !== optionId || intent.provider_plan_id !== providerPlanId) return undefined;
  if (checkoutSessionId && intent.provider_checkout_session_id !== checkoutSessionId) return undefined;
  if (stringValue(metadata.app_user_id) && stringValue(metadata.app_user_id) !== intent.user_id) return undefined;
  return { userId: intent.user_id, intentId: intent.id };
}

function normalizePayment(data: Record<string, unknown>) {
  return {
    paymentId: stringValue(data.id),
    status: stringValue(data.status) ?? stringValue(data.substatus),
    billingReason: stringValue(data.billing_reason),
    currency: lowerString(data.currency),
    paidAmountMinor: decimalToMinor(data.total ?? data.subtotal ?? data.settlement_amount),
    paidAt: dateValue(data.paid_at),
    updatedAt: dateValue(data.updated_at),
    providerPlanId: nestedString(data, "plan", "id"),
    membershipId: nestedString(data, "membership", "id"),
    membershipStatus: nestedString(data, "membership", "status"),
    checkoutSessionId: stringValue(data.checkout_configuration_id),
    providerUserId: nestedString(data, "user", "id"),
    providerMemberId: nestedString(data, "member", "id"),
    metadata: sanitizeMetadata(data.metadata),
  };
}

function normalizeMembership(data: Record<string, unknown>) {
  return {
    membershipId: stringValue(data.id), status: stringValue(data.status), updatedAt: dateValue(data.updated_at),
    providerPlanId: nestedString(data, "plan", "id"), checkoutSessionId: stringValue(data.checkout_configuration_id),
    providerUserId: nestedString(data, "user", "id"), providerMemberId: nestedString(data, "member", "id"),
    manageUrl: stringValue(data.manage_url), periodStartsAt: dateValue(data.renewal_period_start), periodEndsAt: dateValue(data.renewal_period_end),
    cancelAtPeriodEnd: Boolean(data.cancel_at_period_end), metadata: sanitizeMetadata(data.metadata),
  };
}

function sanitizeMetadata(value: unknown) {
  const metadata = asRecord(value);
  return Object.fromEntries(["schema_version", "app_user_id", "checkout_intent_id", "option_id", "return_path"].flatMap((key) => {
    const item = stringValue(metadata[key]);
    return item ? [[key, item]] : [];
  }));
}

export function decimalToMinor(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.round((number + Number.EPSILON) * 100);
}

function asRecord(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function stringValue(value: unknown) { return typeof value === "string" && value.trim() ? value.trim() : undefined; }
function lowerString(value: unknown) { return stringValue(value)?.toLowerCase(); }
function numberValue(value: unknown) { const number = typeof value === "number" ? value : Number(value); return Number.isSafeInteger(number) && number >= 0 ? number : 0; }
function dateValue(value: unknown) { const text = stringValue(value); return text && Number.isFinite(Date.parse(text)) ? new Date(text).toISOString() : undefined; }
function nestedString(record: Record<string, unknown>, parent: string, child: string) { return stringValue(asRecord(record[parent])[child]); }

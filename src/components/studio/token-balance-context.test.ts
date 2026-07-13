import { describe, expect, it } from "vitest";
import { reserveOptimisticBalance } from "@/components/studio/token-balance-context";
import { shouldRefundUnsubmittedGeneration } from "@/lib/server/token-billing";

describe("generation token reservations", () => {
  it("allows multiple clicks when the remaining balance covers every job", () => {
    const first = reserveOptimisticBalance(30, 14);
    const second = reserveOptimisticBalance(first.balanceTokens, 14);

    expect(first).toEqual({ accepted: true, balanceTokens: 16 });
    expect(second).toEqual({ accepted: true, balanceTokens: 2 });
  });

  it("rejects only the unaffordable job and still allows a cheaper model", () => {
    const nano = reserveOptimisticBalance(25, 14);
    const secondNano = reserveOptimisticBalance(nano.balanceTokens, 14);
    const wan = reserveOptimisticBalance(nano.balanceTokens, 3);

    expect(nano).toEqual({ accepted: true, balanceTokens: 11 });
    expect(secondNano).toEqual({ accepted: false, balanceTokens: 11 });
    expect(wan).toEqual({ accepted: true, balanceTokens: 8 });
  });

  it("refunds only a reserved job that never attempted provider contact", () => {
    expect(shouldRefundUnsubmittedGeneration(true, false)).toBe(true);
    expect(shouldRefundUnsubmittedGeneration(true, true)).toBe(false);
    expect(shouldRefundUnsubmittedGeneration(false, false)).toBe(false);
  });
});

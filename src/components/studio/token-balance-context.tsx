"use client";

import { createContext, useContext, type ReactNode } from "react";

export type StudioTokenBalance = {
  balanceTokens: number;
  tryReserveTokens: (requiredTokens: number) => boolean;
  reconcileTokenBalance: (balanceTokens?: number) => void;
};

const StudioTokenBalanceContext = createContext<StudioTokenBalance | undefined>(undefined);

export function StudioTokenBalanceProvider({
  value,
  children,
}: {
  value: StudioTokenBalance;
  children: ReactNode;
}) {
  return <StudioTokenBalanceContext.Provider value={value}>{children}</StudioTokenBalanceContext.Provider>;
}

export function useStudioTokenBalance() {
  const context = useContext(StudioTokenBalanceContext);
  if (!context) throw new Error("Studio token balance is unavailable.");
  return context;
}

export function reserveOptimisticBalance(balanceTokens: number, requiredTokens: number) {
  const normalizedBalance = Math.max(0, balanceTokens);
  const normalizedRequired = Math.max(0, requiredTokens);
  if (normalizedBalance < normalizedRequired) {
    return { accepted: false, balanceTokens: normalizedBalance };
  }
  return { accepted: true, balanceTokens: normalizedBalance - normalizedRequired };
}

export function settleOptimisticBalance(
  pendingReservations: number,
  responseBalanceTokens: number | undefined,
  hasAuthoritativeBalanceSource: boolean,
): { pendingReservations: number; shouldRefresh: boolean; balanceTokens?: number } {
  const remainingReservations = Math.max(0, pendingReservations - 1);
  if (remainingReservations > 0) {
    return { pendingReservations: remainingReservations, shouldRefresh: false };
  }
  if (hasAuthoritativeBalanceSource) {
    return { pendingReservations: 0, shouldRefresh: true };
  }
  return {
    pendingReservations: 0,
    shouldRefresh: false,
    balanceTokens: typeof responseBalanceTokens === "number"
      ? Math.max(0, responseBalanceTokens)
      : undefined,
  };
}

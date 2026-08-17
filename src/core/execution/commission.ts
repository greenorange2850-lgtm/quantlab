/**
 * Pure commission helper owned by the execution layer (ADR 0011).
 */
export function calculateCommission(notional: number, commissionPercent: number): number {
  return (notional * commissionPercent) / 100
}

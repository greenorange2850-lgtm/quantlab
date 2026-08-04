/**
 * True when a detection has been applied at least once and the draft config
 * hash no longer matches the applied hash. Never nags before the first run
 * (`appliedConfigHash === null`).
 */
export function hasUnappliedDetectionConfig({
  currentConfigHash,
  appliedConfigHash,
}: {
  currentConfigHash: string
  appliedConfigHash: string | null
}): boolean {
  return appliedConfigHash !== null && appliedConfigHash !== currentConfigHash
}

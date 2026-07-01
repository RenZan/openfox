// Danger zone threshold: auto-compact when < 20K tokens remaining
export const DANGER_ZONE_THRESHOLD = 20000

// Minimum context usage before allowing compaction (20% of max)
export const MIN_COMPACT_THRESHOLD_RATIO = 0.2

/**
 * Check if context is in danger zone (< 20K tokens remaining).
 */
export function isInDangerZone(currentTokens: number, maxTokens: number): boolean {
  return maxTokens - currentTokens < DANGER_ZONE_THRESHOLD
}

/**
 * Check if session has enough context to warrant compaction.
 */
export function canCompact(currentTokens: number, maxTokens: number): boolean {
  return currentTokens > maxTokens * MIN_COMPACT_THRESHOLD_RATIO
}

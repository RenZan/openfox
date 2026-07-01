import { describe, expect, it } from 'vitest'
import { DANGER_ZONE_THRESHOLD, MIN_COMPACT_THRESHOLD_RATIO, canCompact, isInDangerZone } from './tokenizer.js'

describe('tokenizer helpers', () => {
  it('identifies danger zone and compaction thresholds', () => {
    expect(DANGER_ZONE_THRESHOLD).toBe(20000)
    expect(MIN_COMPACT_THRESHOLD_RATIO).toBe(0.2)
    expect(isInDangerZone(181000, 200000)).toBe(true)
    expect(isInDangerZone(180000, 200000)).toBe(false)
    expect(canCompact(50000, 200000)).toBe(true)
    expect(canCompact(40000, 200000)).toBe(false)
  })
})

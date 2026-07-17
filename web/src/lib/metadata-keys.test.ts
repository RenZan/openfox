import { describe, it, expect } from 'vitest'
import { metadataKeyLabels, formatMetadataKeyLabel } from './metadata-keys'

describe('metadataKeyLabels', () => {
  it('contains known keys', () => {
    expect(metadataKeyLabels['criteria']).toBe('Acceptance Criteria')
    expect(metadataKeyLabels['review_findings']).toBe('Review Findings')
    expect(metadataKeyLabels['todos']).toBe('Tasks')
  })
})

describe('formatMetadataKeyLabel', () => {
  it('returns known label for known keys', () => {
    expect(formatMetadataKeyLabel('criteria')).toBe('Acceptance Criteria')
    expect(formatMetadataKeyLabel('review_findings')).toBe('Review Findings')
    expect(formatMetadataKeyLabel('todos')).toBe('Tasks')
  })

  it('formats unknown keys by capitalizing words', () => {
    expect(formatMetadataKeyLabel('qa_findings')).toBe('QA Findings')
    expect(formatMetadataKeyLabel('custom_key')).toBe('Custom Key')
    expect(formatMetadataKeyLabel('single')).toBe('Single')
    expect(formatMetadataKeyLabel('ui_tests')).toBe('UI Tests')
  })
})

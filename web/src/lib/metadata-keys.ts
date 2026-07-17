export const metadataKeyLabels: Record<string, string> = {
  criteria: 'Acceptance Criteria',
  review_findings: 'Review Findings',
  todos: 'Tasks',
}

export function formatMetadataKeyLabel(key: string): string {
  return (
    metadataKeyLabels[key] ??
    key
      .split('_')
      .map((word) => (word.length <= 2 ? word.toUpperCase() : word.charAt(0).toUpperCase() + word.slice(1)))
      .join(' ')
  )
}

// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { MetadataStatusIcon, getStatusConfig } from './MetadataStatusIcon'

describe('MetadataStatusIcon', () => {
  describe('getStatusConfig', () => {
    it('returns ✓ icon for validated status', () => {
      const config = getStatusConfig('validated')
      expect(config).toEqual({ icon: '✓', color: 'text-accent-success' })
    })

    it('returns ◉ icon with purple color for completed status', () => {
      const config = getStatusConfig('completed')
      expect(config).toEqual({ icon: '◉', color: 'text-purple-400' })
    })

    it('does not alter completed config when validated is added', () => {
      const completed = getStatusConfig('completed')
      expect(completed.icon).toBe('◉')
      expect(completed.color).toBe('text-purple-400')
    })

    it('returns default config for unknown status', () => {
      const config = getStatusConfig('unknown_status')
      expect(config).toEqual({ icon: '○', color: 'text-text-muted' })
    })
  })

  describe('component rendering', () => {
    it('renders ✓ for validated status', () => {
      const { container } = render(<MetadataStatusIcon status="validated" />)
      expect(container.textContent).toBe('✓')
    })

    it('renders ◉ for completed status', () => {
      const { container } = render(<MetadataStatusIcon status="completed" />)
      expect(container.textContent).toBe('◉')
    })
  })
})

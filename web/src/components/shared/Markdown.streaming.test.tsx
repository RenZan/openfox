// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Markdown } from './Markdown'

const highlightCodeMock = vi.hoisted(() => vi.fn())

vi.mock('../../lib/syntax-highlighter', () => ({
  highlightCode: highlightCodeMock,
  useShikiTheme: () => 'github-dark-default',
}))

vi.mock('../../stores/settings', () => ({
  useDisplaySettings: () => ({ showSyntaxHighlighting: true }),
}))

vi.mock('../../hooks/useCopyToClipboard', () => ({
  useCopyToClipboard: () => ({ copied: false, copy: vi.fn() }),
}))

describe('Markdown streaming highlight deferral', () => {
  beforeEach(() => {
    highlightCodeMock.mockReset()
    highlightCodeMock.mockImplementation(async (code: string) => `<pre data-testid="highlighted">${code}</pre>`)
  })

  afterEach(cleanup)

  it('does not call highlightCode while streaming with an open code block', () => {
    const { getByText } = render(<Markdown content={'```js\nconst x = 1'} isStreaming />)

    expect(highlightCodeMock).not.toHaveBeenCalled()
    expect(getByText('const x = 1')).toBeInTheDocument()
  })

  it('highlights the code block exactly once when it closes during streaming', async () => {
    const { rerender, container } = render(<Markdown content={'```js\nconst x = 1'} isStreaming />)
    expect(highlightCodeMock).not.toHaveBeenCalled()

    rerender(<Markdown content={'```js\nconst x = 1\n```'} isStreaming />)
    await waitFor(() => expect(highlightCodeMock).toHaveBeenCalledTimes(1))
    expect(container.querySelector('[data-testid="highlighted"]')).toBeTruthy()

    rerender(<Markdown content={'```js\nconst x = 1\n```'} isStreaming />)
    await waitFor(() => expect(highlightCodeMock).toHaveBeenCalledTimes(1))
  })

  it('highlights a closed code block when streaming ends', async () => {
    const { rerender } = render(<Markdown content={'```js\nconst x = 1'} isStreaming />)
    expect(highlightCodeMock).not.toHaveBeenCalled()

    rerender(<Markdown content={'```js\nconst x = 1'} />)
    await waitFor(() => expect(highlightCodeMock).toHaveBeenCalledTimes(1))
  })

  it('keeps highlighting closed blocks when not streaming (default behavior)', async () => {
    const { container } = render(<Markdown content={'```js\nconst x = 1\n```'} />)

    await waitFor(() => expect(highlightCodeMock).toHaveBeenCalledTimes(1))
    expect(container.querySelector('[data-testid="highlighted"]')).toBeTruthy()
  })

  it('does not re-highlight stable closed blocks across renders', async () => {
    const { rerender } = render(<Markdown content={'```js\nconst x = 1\n```'} />)
    await waitFor(() => expect(highlightCodeMock).toHaveBeenCalledTimes(1))

    rerender(<Markdown content={'```js\nconst x = 1\n```'} />)
    await waitFor(() => expect(highlightCodeMock).toHaveBeenCalledTimes(1))
  })

  it('skips highlighting for plain text blocks', async () => {
    render(<Markdown content={'```text\nplain output\n```'} />)
    await waitFor(() => expect(highlightCodeMock).not.toHaveBeenCalled())
  })

  it('skips highlighting for very large blocks (tool outputs)', async () => {
    const big = 'line of code\n'.repeat(400) // > 5000 chars
    const { container } = render(<Markdown content={`\`\`\`bash\n${big}\`\`\``} />)

    await waitFor(() => expect(highlightCodeMock).not.toHaveBeenCalled())
    expect(container.textContent).toContain('line of code')
  })
})

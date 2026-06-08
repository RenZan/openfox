import { memo, useEffect, useState } from 'react'
import { highlightCode, useShikiTheme } from '../../lib/syntax-highlighter'

interface CodeHighlightProps {
  code: string
  language: string
  variant: 'block' | 'block-nowrap' | 'inline'
  showLineNumbers?: boolean
  startLine?: number
}

export const CodeHighlight = memo(function CodeHighlight({ code, language, variant, showLineNumbers = false, startLine = 1 }: CodeHighlightProps) {
  const [html, setHtml] = useState<string | null>(null)
  const shikiTheme = useShikiTheme()

  useEffect(() => {
    let cancelled = false
    highlightCode(code, language, shikiTheme).then((result) => {
      if (!cancelled) setHtml(result)
    })
    return () => {
      cancelled = true
    }
  }, [code, language, shikiTheme])

  if (!html) {
    const Tag = variant === 'inline' ? 'span' : variant === 'block-nowrap' ? 'div' : 'pre'
    return (
      <Tag className="language-">
        <code className="language-">{code}</code>
      </Tag>
    )
  }

  if (variant === 'inline') {
    return <span dangerouslySetInnerHTML={{ __html: html }} />
  }

  const className = showLineNumbers ? '' : 'shiki-plain'
  return <div className={className} style={{ '--shiki-start': startLine } as React.CSSProperties} dangerouslySetInnerHTML={{ __html: html }} />
})

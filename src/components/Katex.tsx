import katex from 'katex'
// KaTeX styles travel with the component, so they load with the lazy routes that render math.
import 'katex/dist/katex.min.css'
import { useMemo } from 'react'

type Props = {
  tex: string
  display?: boolean
  className?: string
  /** Optional accessible name; the MathML KaTeX emits is what screen readers read by default. */
  ariaLabel?: string
}

/**
 * KaTeX renderer. Uses the default `htmlAndMathml` output so assistive tech reads the MathML
 * (UX-05). Never put aria-live on a preview that re-renders per keystroke.
 */
export function Katex({ tex, display = false, className, ariaLabel }: Props) {
  const html = useMemo(
    () =>
      katex.renderToString(tex || '\\,', {
        throwOnError: false,
        displayMode: display,
        strict: 'ignore',
      }),
    [tex, display],
  )
  return (
    <span
      className={`${display ? 'block overflow-x-auto py-1' : 'inline'} ${className ?? ''}`}
      aria-label={ariaLabel}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

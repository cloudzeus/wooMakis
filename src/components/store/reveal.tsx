'use client'

import { useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'

gsap.registerPlugin(ScrollTrigger, useGSAP)

/**
 * Scroll-triggered entrance. Fade + rise, staggered across direct children.
 *
 * Motion here is orientation, not decoration: it tells you a new band of content
 * has entered. Everything is behind a prefers-reduced-motion check — when the
 * user asks for less motion the content is simply present, never hidden.
 *
 * Only opacity and transform animate, so nothing triggers layout.
 */
export function Reveal({
  children,
  stagger = 0.06,
  y = 22,
  className,
  as: Tag = 'div',
}: {
  children: React.ReactNode
  stagger?: number
  y?: number
  className?: string
  as?: 'div' | 'section' | 'ul'
}) {
  const scope = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

      const targets = scope.current?.children
      if (!targets?.length) return

      gsap.from(targets, {
        opacity: 0,
        y,
        duration: 0.62,
        ease: 'power2.out',
        stagger,
        scrollTrigger: {
          trigger: scope.current,
          // Fire a little before the band is fully visible so it never
          // completes off-screen.
          start: 'top 88%',
          once: true,
        },
      })
    },
    { scope },
  )

  return (
    // @ts-expect-error — polymorphic tag, ref shape is compatible
    <Tag ref={scope} className={className}>
      {children}
    </Tag>
  )
}

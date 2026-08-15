'use client'

import { useRef } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'

/**
 * Hero entrance. Runs once on mount — no scroll trigger, because the hero is
 * already in view and waiting for a scroll would just look broken.
 *
 * Elements opt in with data-hero="1|2|3"; the number is the order. Anything
 * without the attribute is untouched, so adding markup can't silently break it.
 */
export function HeroMotion({ children }: { children: React.ReactNode }) {
  const scope = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

      const items = gsap.utils.toArray<HTMLElement>('[data-hero]', scope.current)
      if (!items.length) return

      items.sort(
        (a, b) => Number(a.dataset.hero ?? 0) - Number(b.dataset.hero ?? 0),
      )

      gsap
        .timeline({ defaults: { ease: 'power3.out' } })
        .from(items, { opacity: 0, y: 26, duration: 0.7, stagger: 0.08 })
    },
    { scope },
  )

  return <div ref={scope}>{children}</div>
}

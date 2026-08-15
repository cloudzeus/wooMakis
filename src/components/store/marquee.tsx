'use client'

import { useRef } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'

/**
 * Infinite horizontal marquee.
 *
 * The track holds the items twice and is translated by exactly -50%, so the
 * second copy lands where the first started and the loop is seamless. Driving
 * it with GSAP rather than a CSS keyframe means it can be paused on hover and
 * killed outright under prefers-reduced-motion.
 */
export function Marquee({
  items,
  speed = 28,
  className,
  itemClassName,
}: {
  items: React.ReactNode[]
  /** Seconds for one full pass. Higher is slower. */
  speed?: number
  className?: string
  itemClassName?: string
}) {
  const scope = useRef<HTMLDivElement>(null)
  const tween = useRef<gsap.core.Tween | null>(null)

  useGSAP(
    () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
      const track = scope.current?.querySelector('[data-track]')
      if (!track) return

      tween.current = gsap.to(track, {
        xPercent: -50,
        duration: speed,
        ease: 'none',
        repeat: -1,
      })
    },
    { scope, dependencies: [speed] },
  )

  return (
    <div
      ref={scope}
      className={`relative overflow-hidden ${className ?? ''}`}
      onMouseEnter={() => tween.current?.pause()}
      onMouseLeave={() => tween.current?.play()}
    >
      <div data-track className="flex w-max gap-3">
        {/* Duplicated for the seamless wrap; the copy is decorative. */}
        {[...items, ...items].map((item, i) => (
          <div key={i} className={itemClassName} aria-hidden={i >= items.length}>
            {item}
          </div>
        ))}
      </div>
    </div>
  )
}

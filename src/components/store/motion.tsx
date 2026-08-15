'use client'

import { useEffect } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'

/**
 * Storefront motion: smooth scrolling, entrance reveals, and parallax.
 *
 *   smooth  Lenis drives the scroll position; ScrollTrigger reads from it
 *   .ht     hero items — staggered rise on load
 *   .ga     everything else — rise once when scrolled into view
 *   .px     parallax layers — drift by `data-speed` while their section passes
 *
 * Class-driven rather than a wrapper component per element: the design marks
 * around forty elements, and wrapping each would ship the whole page to the
 * browser. The sections stay server-rendered and only this island is client.
 *
 * WHY LENIS AND NOT GSAP. ScrollSmoother is GSAP's own answer and would be the
 * obvious choice, but it is a Club GreenSock plugin and is not in this
 * project's licence. Lenis is the standard free equivalent, is about 3 KB, and
 * hands its position to ScrollTrigger so the parallax stays in step instead of
 * fighting a second scroll model.
 *
 * WHY .ga USES IntersectionObserver. The first attempt drove the reveals with
 * ScrollTrigger too and left 18 of 27 elements permanently invisible: triggers
 * are measured at init, the product and category images then load and push
 * everything down, and any element whose start point moved past the viewport
 * in that reflow never fired. IntersectionObserver asks the browser "is it
 * visible now?" and cannot fall out of step with layout. ScrollTrigger is kept
 * for the parallax, where scrubbing genuinely needs it and a missed frame is
 * invisible rather than fatal.
 *
 * Reduced motion turns off all three — smoothing included, since hijacking the
 * scroll is itself motion — and shows every element immediately.
 */
export function StoreMotion() {
  useEffect(() => {
    const reveal = (el: Element) => {
      const node = el as HTMLElement
      node.style.opacity = '1'
      node.style.transform = 'none'
    }

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      document.querySelectorAll('.ht, .ga').forEach(reveal)
      return
    }

    gsap.registerPlugin(ScrollTrigger)

    const lenis = new Lenis({
      // Slightly quicker than the library default: the design's pages are long
      // and a heavy glide makes a catalogue feel unresponsive.
      duration: 0.9,
      // Touch devices already smooth their own scrolling in hardware, and
      // layering a second model on top is what makes hijacked pages feel
      // broken on a phone.
      syncTouch: false,
      // Anchor links must still land, so wheel/touch smoothing only.
      easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    })

    // One clock for both libraries. Left on separate rafs they drift, and the
    // parallax visibly lags the content it is supposed to sit behind.
    lenis.on('scroll', ScrollTrigger.update)
    const tick = (time: number) => lenis.raf(time * 1000)
    gsap.ticker.add(tick)
    gsap.ticker.lagSmoothing(0)

    const ctx = gsap.context(() => {
      gsap.fromTo('.ht',
        { y: 46, opacity: 0 },
        { y: 0, opacity: 1, duration: 1.1, stagger: 0.12, ease: 'power3.out', delay: 0.15 })

      gsap.utils.toArray<HTMLElement>('.px').forEach(el => {
        const speed = parseFloat(el.dataset.speed ?? '10')
        gsap.fromTo(el,
          { yPercent: -speed / 2 },
          {
            yPercent: speed / 2,
            ease: 'none',
            scrollTrigger: {
              trigger: el.parentElement ?? el,
              start: 'top bottom',
              end: 'bottom top',
              scrub: true,
            },
          })
      })
    })

    const targets = Array.from(document.querySelectorAll<HTMLElement>('.ga'))

    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          gsap.fromTo(entry.target,
            { y: 40, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.9, ease: 'power3.out' })
          // Once only: this is an entrance, and replaying it on every pass
          // makes a long page feel unstable.
          observer.unobserve(entry.target)
        }
      },
      // Matches the design's 'top 88%' — fire just before the element is fully
      // in view, so the motion reads as arrival rather than a late correction.
      { rootMargin: '0px 0px -12% 0px', threshold: 0.01 },
    )
    targets.forEach(el => observer.observe(el))

    // Last-resort guard. If anything is still hidden well after load — an
    // observer that never fired, a clipping container, a browser quirk —
    // showing it unanimated beats leaving a blank section on the page.
    const failsafe = window.setTimeout(() => {
      targets.forEach(el => {
        if (getComputedStyle(el).opacity === '0') reveal(el)
      })
    }, 3000)

    // Images settle after first paint and move every trigger below them.
    const refresh = () => ScrollTrigger.refresh()
    window.addEventListener('load', refresh)

    return () => {
      observer.disconnect()
      window.clearTimeout(failsafe)
      window.removeEventListener('load', refresh)
      gsap.ticker.remove(tick)
      lenis.destroy()
      ctx.revert()
    }
  }, [])

  return null
}

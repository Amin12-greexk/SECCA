'use client';

import { useEffect, useRef, useCallback } from 'react';
import { gsap } from 'gsap';
import { prefersReducedMotion } from '@/lib/motion';

/* ─── Reduced-motion detection ────────────────────────────────── */


/* ─── useStaggerReveal ────────────────────────────────────────── */

interface StaggerRevealOptions {
    /** CSS selector for elements to stagger */
    selector: string;
    /** Delay before sequence starts (seconds) */
    delay?: number;
    /** Duration per element (seconds) */
    duration?: number;
    /** Stagger gap between elements (seconds) */
    stagger?: number;
    /** Y offset to animate from */
    y?: number;
    /** Start scale */
    fromScale?: number;
    /** GSAP ease string */
    ease?: string;
}

export function useStaggerReveal(
    containerRef: React.RefObject<HTMLElement | null>,
    options: StaggerRevealOptions,
) {
    const ctxRef = useRef<gsap.Context | null>(null);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        const targets = el.querySelectorAll(options.selector);
        if (targets.length === 0) return;

        // Reduced motion — make visible instantly, skip animation
        if (prefersReducedMotion()) {
            targets.forEach((t) => {
                (t as HTMLElement).style.opacity = '1';
                (t as HTMLElement).style.transform = 'none';
            });
            return;
        }

        ctxRef.current = gsap.context(() => {
            gsap.fromTo(
                targets,
                {
                    opacity: 0,
                    y: options.y ?? 20,
                    scale: options.fromScale ?? 1,
                },
                {
                    opacity: 1,
                    y: 0,
                    scale: 1,
                    duration: options.duration ?? 0.6,
                    stagger: options.stagger ?? 0.08,
                    delay: options.delay ?? 0,
                    ease: options.ease ?? 'power3.out',
                },
            );
        }, el);

        return () => {
            ctxRef.current?.revert();
        };
    }, [containerRef, options.selector, options.delay, options.duration, options.stagger, options.y, options.fromScale, options.ease]);
}

/* ─── useLogoReveal ───────────────────────────────────────────── */

interface LogoRevealOptions {
    /** Delay before animation (seconds) */
    delay?: number;
    /** Duration (seconds) */
    duration?: number;
}

export function useLogoReveal(
    ref: React.RefObject<HTMLElement | null>,
    options?: LogoRevealOptions,
) {
    const ctxRef = useRef<gsap.Context | null>(null);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        if (prefersReducedMotion()) {
            el.style.opacity = '1';
            el.style.transform = 'none';
            return;
        }

        ctxRef.current = gsap.context(() => {
            gsap.fromTo(
                el,
                {
                    opacity: 0,
                    scale: 0.85,
                    y: 24,
                    rotation: -2,
                },
                {
                    opacity: 1,
                    scale: 1,
                    y: 0,
                    rotation: 0,
                    duration: options?.duration ?? 0.9,
                    delay: options?.delay ?? 0,
                    ease: 'back.out(1.4)',
                },
            );
        });

        return () => {
            ctxRef.current?.revert();
        };
    }, [ref, options?.delay, options?.duration]);
}

/* ─── useFloatIdle ────────────────────────────────────────────── */

/** Adds a subtle continuous floating motion to an element */
export function useFloatIdle(
    ref: React.RefObject<HTMLElement | null>,
    { delay = 1 }: { delay?: number } = {},
) {
    const tweenRef = useRef<gsap.core.Tween | null>(null);

    useEffect(() => {
        const el = ref.current;
        if (!el || prefersReducedMotion()) return;

        tweenRef.current = gsap.to(el, {
            y: -6,
            duration: 2.8,
            delay,
            ease: 'sine.inOut',
            repeat: -1,
            yoyo: true,
        });

        return () => {
            tweenRef.current?.kill();
        };
    }, [ref, delay]);
}

/* ─── useSequenceReveal ───────────────────────────────────────── */

/**
 * Runs a GSAP timeline with precise sequencing.
 * Provide an array of step configs; each step targets a selector within the container.
 */
interface SequenceStep {
    selector: string;
    from: gsap.TweenVars;
    to: gsap.TweenVars;
    /** Position parameter (e.g. '-=0.3', '+=0.1', number) */
    position?: string | number;
}

export function useSequenceReveal(
    containerRef: React.RefObject<HTMLElement | null>,
    steps: SequenceStep[],
    deps: unknown[] = [],
) {
    const ctxRef = useRef<gsap.Context | null>(null);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const stableSteps = useCallback(() => steps, deps);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        const s = stableSteps();

        if (prefersReducedMotion()) {
            s.forEach((step) => {
                const targets = el.querySelectorAll(step.selector);
                targets.forEach((t) => {
                    (t as HTMLElement).style.opacity = '1';
                    (t as HTMLElement).style.transform = 'none';
                });
            });
            return;
        }

        ctxRef.current = gsap.context(() => {
            const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

            s.forEach((step) => {
                const targets = el.querySelectorAll(step.selector);
                if (targets.length > 0) {
                    tl.fromTo(targets, step.from, step.to, step.position);
                }
            });
        }, el);

        return () => {
            ctxRef.current?.revert();
        };
    }, [containerRef, stableSteps]);
}

'use client';

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { prefersReducedMotion } from '@/lib/motion';


interface StaggerCardsProps {
    children: React.ReactNode;
    className?: string;
    /** Max items to animate (prevents jank on large lists). Default: 20 */
    maxItems?: number;
    /** Re-trigger animation when this key changes */
    triggerKey?: string | number;
}

/**
 * Animates child cards/items with a stagger reveal.
 * Capped at maxItems to avoid performance issues with long lists.
 */
export default function StaggerCards({
    children,
    className = '',
    maxItems = 20,
    triggerKey,
}: StaggerCardsProps) {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = ref.current;
        if (!el || prefersReducedMotion()) return;

        const targets = Array.from(el.children).slice(0, maxItems);
        if (targets.length === 0) return;

        const ctx = gsap.context(() => {
            gsap.fromTo(
                targets,
                { opacity: 0, y: 12, scale: 0.97 },
                {
                    opacity: 1,
                    y: 0,
                    scale: 1,
                    duration: 0.35,
                    stagger: 0.05,
                    ease: 'power2.out',
                },
            );
        }, el);

        return () => ctx.revert();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [maxItems, triggerKey]);

    return (
        <div ref={ref} className={className}>
            {children}
        </div>
    );
}

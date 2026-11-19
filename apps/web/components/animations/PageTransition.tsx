'use client';

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { prefersReducedMotion } from '@/lib/motion';


interface PageTransitionProps {
    children: React.ReactNode;
    className?: string;
}

/**
 * Wraps page content with a fade + slide-up entry animation.
 * Staggers direct children for a polished reveal.
 * Disabled when reduce-motion is enabled per device (lib/motion).
 */
export default function PageTransition({
    children,
    className = '',
}: PageTransitionProps) {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = ref.current;
        if (!el || prefersReducedMotion()) return;

        const targets = Array.from(el.children);
        if (targets.length === 0) return;

        const ctx = gsap.context(() => {
            gsap.fromTo(
                targets,
                { opacity: 0, y: 16 },
                {
                    opacity: 1,
                    y: 0,
                    duration: 0.45,
                    stagger: 0.06,
                    ease: 'power2.out',
                },
            );
        }, el);

        return () => ctx.revert();
    }, []);

    return (
        <div ref={ref} className={className}>
            {children}
        </div>
    );
}

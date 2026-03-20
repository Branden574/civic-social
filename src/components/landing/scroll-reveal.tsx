'use client';

import { useEffect } from 'react';

/**
 * Intersection Observer fallback for browsers that don't support
 * CSS scroll-driven animations (animation-timeline: view()).
 * Adds `.in-view` to `.scroll-reveal` elements when they enter the viewport.
 */
export function ScrollRevealObserver() {
  useEffect(() => {
    if (CSS.supports('animation-timeline: view()')) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 },
    );

    document.querySelectorAll('.scroll-reveal, .feature-card, .pricing-card').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return null;
}

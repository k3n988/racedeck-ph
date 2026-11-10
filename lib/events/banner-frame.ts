import type { CSSProperties } from 'react';

type BannerFrame = { x?: number | null; y?: number | null; zoom?: number | null };

/** Keep the saved focal point visible even when object-fit has no horizontal crop. */
export function bannerFrameStyle(frame: BannerFrame): CSSProperties {
  const x = Math.min(100, Math.max(0, frame.x ?? 50));
  const y = Math.min(100, Math.max(0, frame.y ?? 50));
  const zoom = Math.min(2, Math.max(1, frame.zoom ?? 1));
  // At 100% zoom a wide banner may fit exactly across its container. Add only
  // the small amount of overscan needed as the focal point moves off-center.
  const horizontalOverscan = Math.abs(x - 50) / 50 * 0.12;

  return {
    objectPosition: `${x}% ${y}%`,
    transformOrigin: `${x}% ${y}%`,
    transform: `scale(${Math.min(2, zoom + horizontalOverscan)})`,
  };
}

import type { SVGProps } from 'react';

const base = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

export const LayersIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}><path d="M12 3 2 8l10 5 10-5-10-5Z" /><path d="m2 13 10 5 10-5" /><path d="m2 17.5 10 5 10-5" opacity=".55" /></svg>
);
export const OfflineIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}><path d="M7 18a5 5 0 1 1 1-9.9A6 6 0 0 1 19 10a4 4 0 0 1-1 7.9" /><path d="M12 12v8" /><path d="m8.5 16.5 3.5 3.5 3.5-3.5" /></svg>
);
export const ToolsIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}><rect x="3" y="9" width="18" height="7" rx="3.5" /><path d="M7 9V5.5l3 3.5" /><path d="M14 9l3-4.5V9" /><circle cx="17.5" cy="12.5" r="1" fill="currentColor" /></svg>
);
export const LocateIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}><path d="M3 11 21 3l-8 18-2-8-8-2Z" /></svg>
);
export const LocateFilledIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}><path d="M3 11 21 3l-8 18-2-8-8-2Z" fill="currentColor" /></svg>
);
export const CompassIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" fill="currentColor" /></svg>
);
export const BasemapIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z" /><path d="M9 4v14M15 6v14" /></svg>
);
export const CloseIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}><path d="M6 6l12 12M18 6 6 18" /></svg>
);
export const TrashIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>
);

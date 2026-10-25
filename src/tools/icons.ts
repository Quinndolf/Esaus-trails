import type { WaypointIcon } from './types';

/** Inline SVG bodies (24x24 viewBox) for waypoint markers and the icon picker. */
const GLYPHS: Record<WaypointIcon, string> = {
  x: '<path d="M6 6l12 12M18 6 6 18" stroke-width="4"/>',
  stand: '<path d="M8 21V9h8v12M8 13h8M8 17h8M6 9h12V5H6z"/>',
  blind: '<path d="M3 20 12 5l9 15z"/><path d="M9 15h6"/>',
  bed: '<ellipse cx="12" cy="14" rx="8" ry="5"/><path d="M8 14c2-2 6-2 8 0"/>',
  food: '<path d="M12 21V9M12 9c-3 0-5-2-5-5 3 0 5 2 5 5zM12 13c3 0 5-2 5-5-3 0-5 2-5 5z"/>',
  water: '<path d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z"/>',
  rub: '<path d="M12 22V2M9 8l3 2 3-2M9 13l3 2 3-2"/>',
  scrape: '<path d="M4 17c4-3 12-3 16 0M7 12l2 3M12 10v4M17 12l-2 3"/>',
  trail: '<path d="M7 21c0-5 10-6 10-11S13 3 9 3"/><circle cx="7" cy="21" r="1"/><circle cx="9" cy="3" r="1"/>',
  camera: '<rect x="3" y="7" width="18" height="13" rx="2"/><circle cx="12" cy="13.5" r="3.5"/><path d="M8 7l2-3h4l2 3"/>',
  truck: '<path d="M2 16V7h11v9M13 10h4l4 4v2h-8"/><circle cx="6" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>',
  flag: '<path d="M5 22V3M5 4h12l-3 4 3 4H5"/>',
};

export const ICON_LABELS: Record<WaypointIcon, string> = {
  x: 'Marked spot',
  stand: 'Tree stand',
  blind: 'Ground blind',
  bed: 'Bedding',
  food: 'Food',
  water: 'Water',
  rub: 'Rub',
  scrape: 'Scrape',
  trail: 'Trail',
  camera: 'Trail camera',
  truck: 'Parking',
  flag: 'Waypoint',
};

export const ICON_COLORS: Record<WaypointIcon, string> = {
  x: '#e53935',
  stand: '#f28c28',
  blind: '#8d6e63',
  bed: '#7e57c2',
  food: '#7cb342',
  water: '#29b6f6',
  rub: '#a1887f',
  scrape: '#ff7043',
  trail: '#fdd835',
  camera: '#90a4ae',
  truck: '#eceff1',
  flag: '#ef5350',
};

export function iconSvg(icon: WaypointIcon, color = icon === 'x' ? '#e53935' : '#fff'): string {
  return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${GLYPHS[icon]}</svg>`;
}

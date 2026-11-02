/**
 * What to bring when looking for ginseng. Practical gear only: no seasons, limits or other rules here,
 * which come from the rules sheet and KDFWR.
 */
export interface GearItem {
  name: string;
  why: string;
}

export const GINSENG_GEAR: GearItem[] = [
  { name: 'Digging tool', why: 'A narrow trowel or small spade loosens soil in a ring so the whole root lifts out unbroken.' },
  { name: 'Breathable bag', why: 'Mesh, cloth or paper keeps the roots from sweating. Plastic spoils them.' },
  { name: 'Gloves', why: 'For digging and for nettles and briars on the slopes.' },
  { name: 'Ripe berries', why: 'Plant the seeds in the hole you dug as you go. See the rules sheet for how.' },
  { name: 'Marker flags or ribbon', why: 'Mark plants you find and are not ready to harvest, so you can find them again.' },
  { name: 'Phone, charged', why: 'Mark each spot on the map, and keep service for emergencies. Turn on Airplane mode to save battery if you have no signal.' },
  { name: 'Water and a snack', why: 'Steep hardwood slopes take more out of you than they look.' },
  { name: 'Blaze orange', why: 'In gun season, wear it. Hunters are in the same woods.' },
  { name: 'Printed or saved rules', why: 'Check the current KDFWR guide and carry it with you.' },
];

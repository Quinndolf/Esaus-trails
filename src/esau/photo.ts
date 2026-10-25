import type { LatLng, SpotPhoto, SpotQuery } from "./types";

/**
 * The photo module's EsauPhotoInput (src/photos/esauPhotoInput.ts), described structurally
 * so this module does not depend on it.
 */
export interface PhotoInputLike {
  name: string;
  notes: string;
  tags: string[];
  /** [lng, lat] */
  position: [number, number];
  altitude: number | null;
  takenAt: string | null;
  heading: number | null;
  locationSource: "exif" | "device-gps" | "manual";
  image: SpotPhoto["image"];
}

/**
 * Turn a photo pin into a question for Esau. The map supplies the rest: the ground grid
 * around the pin, the species, and the hunter's position. The hour defaults to the one
 * nearest when the photo was taken, if that hour is in the grid's forecast.
 */
export function photoQuery(
  input: PhotoInputLike,
  ctx: Omit<SpotQuery, "spot" | "photo"> & { hunter?: SpotQuery["hunter"] },
): SpotQuery {
  const spot: LatLng = { lat: input.position[1], lng: input.position[0] };
  let hourIndex = ctx.hourIndex;
  if (hourIndex === undefined && input.takenAt) {
    const t = new Date(input.takenAt).getTime();
    const hours = ctx.grid.weather.hours;
    const k = hours.findIndex((h) => Math.abs(new Date(h.at).getTime() - t) <= 30 * 60e3);
    if (k >= 0) hourIndex = k;
  }
  return {
    ...ctx,
    hourIndex,
    spot,
    question: ctx.question ?? "Here's a photo from this spot. What do you make of it?",
    photo: {
      image: input.image,
      name: input.name || undefined,
      notes: input.notes || undefined,
      tags: input.tags,
      takenAt: input.takenAt,
      headingDeg: input.heading,
      altitudeM: input.altitude,
      locationSource: input.locationSource,
    },
  };
}

import { seasonStatus } from "../ginseng/rules";
import type { SpeciesId } from "../esau/types";
import type { HarvestSteps, Legal, LegalQuery, Weapon } from "./types";

/**
 * Kentucky rules Esau may state, for Monroe County (deer zone 2), 2026-27.
 * Every date was read from KDFWR on VERIFIED. Anything not in here comes back "unknown" and Esau
 * says to check the guide. Update this file each season from the new Hunting & Trapping Guide.
 */
export const VERIFIED = "2026-11-01";
export const GUIDE_URL = "https://fw.ky.gov/Hunt/Documents/huntingguideentire.pdf";
const SQUIRREL_URL = "https://fw.ky.gov/Hunt/Pages/Squirrel-Hunting.aspx";
const CHECK_URL = "https://fw.ky.gov/Hunt/Pages/Recording,-Checking,-Tagging-and-Transporting.aspx";
const TABLE_FROM = "2026-05-01";
const TABLE_TO = "2027-03-31";
const CHECK = "Check the KDFWR guide to be sure.";

export const SQUIRREL_AIR_GUN_CALIBERS = [".177", ".20", ".22", ".25"];

type Window = { from: string; to: string; label: string; unconfirmed?: boolean };

/** Deer seasons by weapon, from the KDFWR guide (Aug 2026 to Mar 2027, "Deer Hunting Zones and Seasons"). */
const DEER: Partial<Record<Weapon, Window[]>> = {
  bow: [{ from: "2026-09-05", to: "2027-01-18", label: "archery season (Sept 5, 2026 on)", unconfirmed: true }],
  crossbow: [{ from: "2026-09-19", to: "2027-01-18", label: "crossbow season (Sept 19, 2026 to Jan 18, 2027)" }],
  rifle: [{ from: "2026-11-14", to: "2026-11-29", label: "modern gun season (Nov 14 to 29, 2026)" }],
  muzzleloader: [
    { from: "2026-10-17", to: "2026-10-18", label: "early muzzleloader season (Oct 17 to 18, 2026)" },
    { from: "2026-12-12", to: "2026-12-20", label: "late muzzleloader season (Dec 12 to 20, 2026)" },
  ],
};

/** Squirrel seasons, from KDFWR's squirrel page. The fall season pauses the first weekend of deer gun season. */
const SQUIRREL: Window[] = [
  { from: "2026-05-16", to: "2026-06-21", label: "spring squirrel season (May 16 to June 21, 2026)" },
  { from: "2026-08-15", to: "2026-11-13", label: "fall squirrel season (Aug 15 to Nov 13, 2026)" },
  { from: "2026-11-16", to: "2027-02-28", label: "fall squirrel season (Nov 16, 2026 to Feb 28, 2027)" },
];
const SQUIRREL_WEAPONS: Weapon[] = ["pellet", "bow", "crossbow", "shotgun", "muzzleloader"];

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const within = (day: string, w: Window) => day >= w.from && day <= w.to;

const unknown = (why: string): Legal => ({ status: "unknown", note: `${why} ${CHECK}` });

export function legalToday(q: LegalQuery): Legal {
  const day = iso(q.at);
  if (q.species === "ginseng") {
    const s = seasonStatus(q.at);
    return { status: s.open ? "open" : "closed", note: s.text, seasonLabel: "Kentucky ginseng season (Sept 1 to Dec 1)", source: "src/ginseng/rules", verified: VERIFIED };
  }
  if (day < TABLE_FROM || day > TABLE_TO) return unknown("The season dates I have are for 2026-27 and today is outside them.");
  if (!q.weapon) return unknown("Pick a weapon and I can tell you if it is in season.");

  if (q.species === "whitetail" || q.species === "mule_deer") {
    const wins = DEER[q.weapon];
    if (!wins) return unknown(`I don't have deer dates for a ${q.weapon}.`);
    const hit = wins.find((w) => within(day, w));
    if (hit) {
      return {
        status: "open",
        note: `It is ${hit.label}.`,
        seasonLabel: hit.label,
        source: GUIDE_URL,
        verified: VERIFIED,
        ...(hit.unconfirmed ? { unconfirmed: true } : {}),
      };
    }
    const next = wins.map((w) => w.from).filter((f) => f > day).sort()[0];
    const first = wins[0]!;
    const note =
      q.weapon === "crossbow" && day < first.from && day >= "2026-09-05"
        ? "Crossbow deer season does not open until September 19, 2026 (archery opens September 5). Hunters with a physician-signed exemption are the exception."
        : next
          ? `A ${q.weapon} is out of season for deer today. It opens ${next}.`
          : `A ${q.weapon} is out of season for deer today.`;
    return { status: "closed", note, source: GUIDE_URL, verified: VERIFIED };
  }

  if (q.species === "squirrel") {
    if (!SQUIRREL_WEAPONS.includes(q.weapon)) return unknown(`I don't have squirrel rules for a ${q.weapon}.`);
    const hit = SQUIRREL.find((w) => within(day, w));
    if (hit) {
      return {
        status: "open",
        note: `It is ${hit.label}. Six a day. Shooting hours run 30 minutes before sunrise to 30 minutes after sunset.${
          q.weapon === "pellet" ? ` Air guns must be ${SQUIRREL_AIR_GUN_CALIBERS.join(", ")} caliber.` : ""
        }`,
        seasonLabel: hit.label,
        source: SQUIRREL_URL,
        verified: VERIFIED,
      };
    }
    const pause = day === "2026-11-14" || day === "2026-11-15";
    return {
      status: "closed",
      note: pause ? "Squirrel season pauses the first weekend of deer gun season and opens again November 16." : "Squirrel season is closed today.",
      source: SQUIRREL_URL,
      verified: VERIFIED,
    };
  }
  return unknown("I don't have Kentucky dates for this animal.");
}

/** What the law asks after a deer is down. Only deer; everything else comes back null. */
export function harvestSteps(species: SpeciesId): HarvestSteps | null {
  if (species !== "whitetail" && species !== "mule_deer") return null;
  return {
    steps: [
      "Fill out your harvest log right after the deer is down and before you move it: species, sex, date and county.",
      "Telecheck by midnight on the day you recover the deer, and before you take off the hide or head. It takes about five minutes.",
      "Have your county code, the equipment you used, whether the land was private or public, and your license type ready.",
      "Write the confirmation number on your harvest log and keep it all season.",
      "A carcass tag is only needed if the carcass leaves your hands (processor, taxidermist, a friend). Put your name, phone number and confirmation number on it.",
      "If you can't get a confirmation number, keep trying, then call KDFWR the next business day.",
    ],
    phones: ["Telecheck 1-800-245-4263 (1-800-CHK-GAME), 24 hours in season", "KDFWR 1-800-858-1549 (8 a.m. to 4:30 p.m. Eastern, Monday to Friday)"],
    source: CHECK_URL,
    verified: VERIFIED,
  };
}

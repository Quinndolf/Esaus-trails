import type { SpotQuery } from "../types";
import { cell, hollowGrid } from "./hollow";

const grid = hollowGrid();

/** Hand-picked taps on the synthetic hollow, each testing one part of Esau's read. Hours count from 5 am Central, Nov 8. */
export const SAMPLE_SPOTS: { name: string; expect: string; query: SpotQuery }[] = [
  {
    name: "Bench at first light, hunter in the bottom",
    expect: "Reads the bench as likely buck bedding; hunter's NW wind carries scent SE, away from it.",
    query: { species: "whitetail", spot: cell(11, 24), hunter: cell(27, 22), grid, hourIndex: 2, timeZone: "America/Chicago" },
  },
  {
    name: "Same bench, hunter upwind on the ridge",
    expect: "Warns first that the hunter's scent is blowing right into the bench.",
    query: { species: "whitetail", spot: cell(11, 24), hunter: cell(8, 20), grid, hourIndex: 2, timeZone: "America/Chicago" },
  },
  {
    name: "Ridge saddle mid-morning, seeking phase",
    expect: "Calls the saddle a travel funnel for cruising bucks and says to sit it through midday.",
    query: { species: "whitetail", spot: cell(6, 16), hunter: cell(6, 10), grid, hourIndex: 4, timeZone: "America/Chicago" },
  },
  {
    name: "Field edge, last hour of light",
    expect: "Edge where deer stage before the beans; notes evening thermals sinking toward the bottom.",
    query: { species: "whitetail", spot: cell(25, 18), hunter: cell(22, 26), grid, hourIndex: 11, timeZone: "America/Chicago" },
  },
  {
    name: "Middle of the bean field at noon",
    expect: "Open ground; nothing there at midday; come back at dusk.",
    query: { species: "whitetail", spot: cell(27, 24), grid, hourIndex: 7, timeZone: "America/Chicago" },
  },
  {
    name: "Hunter asks where to hang a stand",
    expect: "Answers the question with a stand spot and an approach that keeps the wind off the bench.",
    query: {
      species: "whitetail",
      spot: cell(6, 16),
      hunter: cell(27, 20),
      grid,
      hourIndex: 0,
      timeZone: "America/Chicago",
      question: "Where would you hang a stand for an all-day sit tomorrow, and how do I walk in?",
      pins: [{ id: "p1", kind: "sign", lat: cell(7, 18).lat, lng: cell(7, 18).lng, name: "Rub line", tags: ["rub"], note: "Six fresh rubs heading toward the saddle" }],
    },
  },
];

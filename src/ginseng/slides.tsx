import type { ReactNode } from 'react';

/**
 * "How to harvest ginseng": drawn, animated slides. They are illustrations, not photos, and the
 * steps marked "law" come from 302 KAR 45:010 and the Kentucky Department of Agriculture page
 * (see rules.ts). Steps marked "field practice" are common digger practice, not law. Steps marked
 * "habitat" are where-to-look clues from University of Kentucky Extension FOR91 (see rules.ts); they are
 * clues, never proof that a plant is there.
 */

export interface Slide {
  id: string;
  title: string;
  kind: 'law' | 'field practice' | 'habitat';
  caption: string[];
  art: ReactNode;
}

const GREEN = 'var(--gs-leaf)';
const LEAF = (
  <>
    <ellipse cx="0" cy="-22" rx="7" ry="15" />
    <ellipse cx="-14" cy="-14" rx="6" ry="12" transform="rotate(-50 -14 -14)" />
    <ellipse cx="14" cy="-14" rx="6" ry="12" transform="rotate(50 14 -14)" />
    <ellipse cx="-9" cy="-3" rx="4" ry="8" transform="rotate(-105 -9 -3)" />
    <ellipse cx="9" cy="-3" rx="4" ry="8" transform="rotate(105 9 -3)" />
  </>
);

/** One prong: a stalk topped by five leaflets. */
function Prong({ x, y, rot, delay = 0, scale = 1, pulse = false }: { x: number; y: number; rot: number; delay?: number; scale?: number; pulse?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${scale})`}>
      <line x1="0" y1="0" x2="0" y2="-26" stroke="var(--gs-stem)" strokeWidth="3" />
      <g className={pulse ? 'gs-pulse' : undefined} style={{ ['--d' as string]: `${delay}s` }} fill={GREEN}>
        <g transform="translate(0 -26)">{LEAF}</g>
      </g>
    </g>
  );
}

const Ground = ({ y = 150 }: { y?: number }) => (
  <>
    <rect x="0" y={y} width="320" height={200 - y} fill="var(--gs-soil)" />
    <path d={`M0 ${y} q20 -6 40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0`} fill="var(--gs-litter)" />
  </>
);

const Check = ({ x, y, delay }: { x: number; y: number; delay: number }) => (
  <g transform={`translate(${x} ${y})`}>
    <g className="gs-pop" style={{ ['--d' as string]: `${delay}s` }}>
      <circle r="11" fill="var(--gs-ok)" />
      <path d="M-5 0l4 4 7-8" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  </g>
);

const Cross = ({ x, y, delay }: { x: number; y: number; delay: number }) => (
  <g transform={`translate(${x} ${y})`}>
    <g className="gs-pop" style={{ ['--d' as string]: `${delay}s` }}>
      <circle r="11" fill="var(--gs-no)" />
      <path d="M-5 -5l10 10M5 -5l-10 10" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
    </g>
  </g>
);

const Label = ({ x, y, children, size = 12, anchor = 'middle' }: { x: number; y: number; children: ReactNode; size?: number; anchor?: 'start' | 'middle' | 'end' }) => (
  <text x={x} y={y} fontSize={size} textAnchor={anchor} fill="var(--gs-ink)" fontWeight="600">
    {children}
  </text>
);

function Card({ x, title, line, children, delay }: { x: number; title: string; line: string; children: ReactNode; delay: number }) {
  return (
    <g className="gs-rise" style={{ ['--d' as string]: `${delay}s` }}>
      <rect x={x} y="28" width="92" height="140" rx="10" fill="var(--gs-card)" stroke="var(--gs-line)" />
      <g transform={`translate(${x + 46} 70)`}>{children}</g>
      <Label x={x + 46} y={118} size={11}>
        {title}
      </Label>
      <text x={x + 46} y={134} fontSize="9.5" textAnchor="middle" fill="var(--gs-sub)">
        {line}
      </text>
    </g>
  );
}

export const SLIDES: Slide[] = [
  {
    id: 'slope',
    title: 'Look on the right slope',
    kind: 'habitat',
    caption: [
      'Mid-slope and the base of a slope beat hilltops and ridges.',
      'North- and east-facing slopes are cooler and moister, which is what ginseng likes.',
      'Clue, not proof: good ground still has to hold a plant.',
    ],
    art: (
      <svg viewBox="0 0 320 200" role="img" aria-label="A hillside: ridge top poor, mid-slope and base good, north face cooler">
        <rect width="320" height="200" fill="var(--gs-card)" />
        <path d="M0 170 L70 70 L130 60 L250 150 L320 170 L320 200 L0 200Z" fill="var(--gs-soil)" opacity="0.35" />
        <path d="M70 70 L130 60" stroke="var(--gs-no)" strokeWidth="5" strokeLinecap="round" />
        <path d="M150 85 L250 150" stroke={GREEN} strokeWidth="6" strokeLinecap="round" className="gs-rise" />
        <Label x={100} y={50} size={11}>
          Ridge: skip
        </Label>
        <Label x={235} y={176} size={11}>
          Mid-slope and base
        </Label>
        <Label x={90} y={190} size={11}>
          Face north or east
        </Label>
      </svg>
    ),
  },
  {
    id: 'shade',
    title: 'Heavy shade, the right trees',
    kind: 'habitat',
    caption: [
      'Ginseng likes deep shade, often close to 90 percent.',
      'Dense tulip-poplar or black walnut shade works well.',
      'It does well near sugar maple, which can supply calcium.',
    ],
    art: (
      <svg viewBox="0 0 320 200" role="img" aria-label="Tall trees casting dense shade over the forest floor">
        <rect width="320" height="200" fill="var(--gs-card)" />
        <rect y="150" width="320" height="50" fill="var(--gs-soil)" opacity="0.35" />
        {[60, 130, 200, 270].map((x, i) => (
          <g key={x} className="gs-rise" style={{ ['--d' as string]: `${i * 0.25}s` }}>
            <rect x={x - 4} y="80" width="8" height="75" fill="var(--gs-stem)" />
            <circle cx={x} cy="62" r="34" fill={GREEN} opacity="0.85" />
          </g>
        ))}
        <Label x={160} y={188} size={11}>
          About 90 percent shade
        </Label>
      </svg>
    ),
  },
  {
    id: 'soil',
    title: 'Moist but well-drained',
    kind: 'habitat',
    caption: [
      'Look for moist, well-drained ground with plenty of leaf litter and organic matter.',
      'Heavy clay and sandy soils do worse.',
      'Ginseng also needs calcium, one reason sugar maple is a good neighbor.',
    ],
    art: (
      <svg viewBox="0 0 320 200" role="img" aria-label="Dark leafy soil that drains, with water draining downhill">
        <rect width="320" height="200" fill="var(--gs-card)" />
        <rect y="110" width="320" height="90" fill="var(--gs-soil)" />
        <rect y="100" width="320" height="14" fill="#5b4a2a" opacity="0.8" />
        {[40, 100, 160, 220, 280].map((x, i) => (
          <path key={x} className="gs-air" style={{ ['--d' as string]: `${i * 0.4}s` }} d={`M${x} 40v40`} stroke="var(--gs-hint)" strokeWidth="3" strokeLinecap="round" />
        ))}
        <Label x={160} y={30} size={11}>
          Water moves through, it does not pool
        </Label>
        <Label x={160} y={160} size={11}>
          Dark, crumbly, leafy
        </Label>
      </svg>
    ),
  },
  {
    id: 'companions',
    title: 'Plants that grow with it',
    kind: 'habitat',
    caption: [
      'If you see goldenseal, ginseng may be nearby. Mayapple and wild ginger grow in the same kind of woods.',
      'These are neighbors worth a closer look, not proof. Count the prongs before you decide anything.',
      'Remember the season and the land rules before you dig.',
    ],
    art: (
      <svg viewBox="0 0 320 200" role="img" aria-label="Three woodland plants that often grow with ginseng">
        <Card x={10} title="Goldenseal" line="May be near" delay={0}>
          <g fill={GREEN}>{LEAF}</g>
        </Card>
        <Card x={114} title="Mayapple" line="Same woods" delay={0.3}>
          <circle cy="-4" r="24" fill={GREEN} opacity="0.85" />
          <rect x="-2" y="-4" width="4" height="30" fill="var(--gs-stem)" />
        </Card>
        <Card x={218} title="Wild ginger" line="Same woods" delay={0.6}>
          <path d="M0 22c-30-6-30-40 0-40 30 0 30 34 0 40z" fill={GREEN} />
        </Card>
      </svg>
    ),
  },
  {
    id: 'legal',
    title: 'Check three things before you dig',
    kind: 'law',
    caption: [
      'The date: Kentucky wild ginseng may only be dug September 1 through December 1.',
      "The landowner: get permission first. Kentucky issues no digging permit, but without the owner's say-so it is trespass.",
      'The ground: no digging on state land, state parks or federal management areas.',
    ],
    art: (
      <svg viewBox="0 0 320 200" role="img" aria-label="Three checks: the date, the landowner, the ground">
        <Card x={10} title="Sep 1 to Dec 1" line="Season is open" delay={0}>
          <rect x="-24" y="-26" width="48" height="46" rx="5" fill="#fff" stroke="var(--gs-line)" />
          <rect x="-24" y="-26" width="48" height="12" rx="5" fill="var(--gs-no)" />
          <text y="12" fontSize="22" textAnchor="middle" fontWeight="700" fill="var(--gs-ink)">
            1
          </text>
        </Card>
        <Card x={114} title="Owner says yes" line="Ask first" delay={0.3}>
          <path d="M-26 20v-30l26-16 26 16v30z" fill="#fff" stroke="var(--gs-line)" />
          <rect x="-7" y="2" width="14" height="18" fill="var(--gs-soil)" />
        </Card>
        <Card x={218} title="Private land" line="Not parks or federal" delay={0.6}>
          <path d="M-20 22l20-44 20 44z" fill={GREEN} />
          <rect x="-3" y="22" width="6" height="8" fill="var(--gs-stem)" />
        </Card>
        <Check x={56} y={40} delay={1.0} />
        <Check x={160} y={40} delay={1.4} />
        <Check x={264} y={40} delay={1.8} />
      </svg>
    ),
  },
  {
    id: 'know',
    title: 'Know a mature plant',
    kind: 'law',
    caption: [
      'A plant worth digging has three or more prongs, and each prong has five leaflets.',
      'It must also be at least five years old. Fall is easiest: the leaves turn yellow and the berries are red.',
    ],
    art: (
      <svg viewBox="0 0 320 200" role="img" aria-label="A ginseng plant with three prongs of five leaflets and a red berry cluster">
        <rect width="320" height="200" fill="var(--gs-shade)" />
        <Ground />
        <line x1="160" y1="150" x2="160" y2="110" stroke="var(--gs-stem)" strokeWidth="4" />
        <Prong x={160} y={110} rot={-62} pulse delay={0} />
        <Prong x={160} y={110} rot={0} pulse delay={1} />
        <Prong x={160} y={110} rot={62} pulse delay={2} />
        <g className="gs-pop" style={{ ['--d' as string]: '3s' }}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <circle key={i} cx={152 + (i % 3) * 8} cy={80 + Math.floor(i / 3) * 8} r="4" fill="var(--gs-berry)" />
          ))}
        </g>
        <line x1="160" y1="110" x2="160" y2="88" stroke="var(--gs-stem)" strokeWidth="2" />
        <Label x={108} y={58} size={16}>1</Label>
        <Label x={160} y={34} size={16}>2</Label>
        <Label x={212} y={58} size={16}>3</Label>
        <Label x={160} y={188} size={11}>
          3 prongs x 5 leaflets
        </Label>
      </svg>
    ),
  },
  {
    id: 'count',
    title: 'Count first, then decide',
    kind: 'law',
    caption: [
      'Fewer than three prongs, or younger than five years: leave it. It will be worth more and make seed.',
      'Do not pull a plant to check its age. The count of prongs is your check.',
    ],
    art: (
      <svg viewBox="0 0 320 200" role="img" aria-label="A two-prong plant is left; a three-prong plant may be dug">
        <rect width="320" height="200" fill="var(--gs-shade)" />
        <Ground />
        <g>
          <line x1="90" y1="150" x2="90" y2="112" stroke="var(--gs-stem)" strokeWidth="3" />
          <Prong x={90} y={112} rot={-40} scale={0.8} />
          <Prong x={90} y={112} rot={40} scale={0.8} />
          <Cross x={90} y={52} delay={0.4} />
          <Label x={90} y={186} size={11}>
            2 prongs: leave it
          </Label>
        </g>
        <g>
          <line x1="230" y1="150" x2="230" y2="100" stroke="var(--gs-stem)" strokeWidth="4" />
          <Prong x={230} y={100} rot={-58} scale={0.9} />
          <Prong x={230} y={100} rot={0} scale={0.9} />
          <Prong x={230} y={100} rot={58} scale={0.9} />
          <Check x={230} y={34} delay={0.8} />
          <Label x={230} y={186} size={11}>
            3 prongs: may dig
          </Label>
        </g>
      </svg>
    ),
  },
  {
    id: 'dig',
    title: 'Dig wide, then lift slowly',
    kind: 'field practice',
    caption: [
      'Start a hand-width or more out from the stem and loosen the soil in a ring, working in.',
      'Ease the whole root up with its neck and fine hairs. A snapped root is worth much less.',
    ],
    art: (
      <svg viewBox="0 0 320 200" role="img" aria-label="Cross-section: a trowel loosens soil in a ring, then the root lifts out whole">
        <rect width="320" height="200" fill="var(--gs-shade)" />
        <rect x="0" y="90" width="320" height="110" fill="var(--gs-soil)" />
        <path d="M0 90 q20 -8 40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0" fill="var(--gs-litter)" />
        <ellipse cx="160" cy="90" rx="78" ry="6" fill="none" stroke="var(--gs-hint)" strokeWidth="1.5" strokeDasharray="4 4" />
        <g className="gs-lift">
          <line x1="160" y1="90" x2="160" y2="50" stroke="var(--gs-stem)" strokeWidth="3" />
          <Prong x={160} y={50} rot={-55} scale={0.7} />
          <Prong x={160} y={50} rot={0} scale={0.7} />
          <Prong x={160} y={50} rot={55} scale={0.7} />
          <path d="M160 90c-3 0 -5 6 -5 14 -2 14 -4 26 -9 38 M160 104c4 12 8 24 12 32 M158 112c-8 8 -14 14 -18 20" stroke="#e6d3a3" strokeWidth="8" strokeLinecap="round" fill="none" />
          <path d="M158 112l-18 22M160 120l14 18" stroke="#c9b27c" strokeWidth="2" strokeLinecap="round" />
        </g>
        <g className="gs-trowel">
          <path d="M0 0l8 -30 8 30-8 8z" fill="#9aa3a8" stroke="#6b7378" />
          <rect x="4" y="-58" width="8" height="30" rx="3" fill="#8b5a2b" />
        </g>
        <Label x={160} y={188} size={11}>
          Loosen the ring, then lift
        </Label>
      </svg>
    ),
  },
  {
    id: 'seed',
    title: 'Plant the seed right there',
    kind: 'law',
    caption: [
      'If the plant carries seed, plant it within 50 feet of where it grew.',
      'By hand only: press each seed into the soil with a finger, no tool.',
    ],
    art: (
      <svg viewBox="0 0 320 200" role="img" aria-label="Berries drop seed that a finger presses into the soil within fifty feet">
        <rect width="320" height="200" fill="var(--gs-shade)" />
        <Ground y={140} />
        <circle cx="120" cy="140" r="86" fill="none" stroke="var(--gs-hint)" strokeDasharray="5 5" strokeWidth="1.5" />
        <Label x={120} y={54} size={11}>
          within 50 feet
        </Label>
        <g>
          {[0, 1, 2, 3, 4].map((i) => (
            <circle key={i} cx={104 + i * 9} cy={72 + (i % 2) * 7} r="5" fill="var(--gs-berry)" />
          ))}
        </g>
        <circle className="gs-fall" cx="125" cy="96" r="3" fill="#f4e7c1" stroke="#c9b27c" />
        <g className="gs-press">
          <path d="M214 56c0 -10 14 -10 14 0v44c0 6 -14 6 -14 0z" fill="#e8b98f" stroke="#b98a62" />
          <path d="M214 100c0 8 14 8 14 0" fill="#e8b98f" />
        </g>
        <ellipse cx="221" cy="144" rx="9" ry="3" fill="var(--gs-hole)" />
        <Label x={221} y={178} size={11}>
          Press it in
        </Label>
      </svg>
    ),
  },
  {
    id: 'leave',
    title: 'Leave the patch standing',
    kind: 'field practice',
    caption: [
      'Take only what the rules allow and leave the rest, so the patch seeds itself.',
      'Fill the hole, spread the leaf litter back over it, and keep the spot to yourself.',
    ],
    art: (
      <svg viewBox="0 0 320 200" role="img" aria-label="A patch with one plant dug, the hole covered with leaf litter, and the others left standing">
        <rect width="320" height="200" fill="var(--gs-shade)" />
        <Ground y={140} />
        {[60, 120, 250].map((x, i) => (
          <g key={x}>
            <line x1={x} y1="140" x2={x} y2="108" stroke="var(--gs-stem)" strokeWidth="3" />
            <Prong x={x} y={108} rot={-50} scale={0.7} pulse delay={i * 0.4} />
            <Prong x={x} y={108} rot={0} scale={0.7} pulse delay={i * 0.4} />
            <Prong x={x} y={108} rot={50} scale={0.7} pulse delay={i * 0.4} />
          </g>
        ))}
        <ellipse cx="185" cy="146" rx="18" ry="5" fill="var(--gs-hole)" />
        <g className="gs-cover">
          <path d="M168 144q10 -8 18 -2t16 -2q-6 10 -16 8t-18 -4z" fill="var(--gs-litter)" />
        </g>
        <Label x={185} y={178} size={11}>
          Hole filled and covered
        </Label>
        <Check x={90} y={60} delay={0.5} />
      </svg>
    ),
  },
  {
    id: 'sell',
    title: 'Dry it whole, sell it legally',
    kind: 'law',
    caption: [
      'Field practice: dry roots whole, spread in one layer with air moving, not in an oven or in the sun.',
      'Law: sell only to licensed Kentucky dealers (fresh from Sep 1, dried Sep 15 to Mar 31). Ginseng sold out of state must be certified by the Department of Agriculture first.',
    ],
    art: (
      <svg viewBox="0 0 320 200" role="img" aria-label="Roots drying on a screen rack with air moving over them">
        <rect width="320" height="200" fill="var(--gs-card)" />
        <rect x="60" y="112" width="200" height="8" rx="3" fill="#8b5a2b" />
        <path d="M70 120v50M250 120v50" stroke="#8b5a2b" strokeWidth="6" />
        {[96, 140, 184, 228].map((x, i) => (
          <path key={x} d={`M${x} 106c-2 0 -3 2 -3 6 -1 6 -3 10 -6 14`} stroke="#e6d3a3" strokeWidth="8" strokeLinecap="round" fill="none" transform={`translate(0 ${i % 2 ? -2 : 0})`} />
        ))}
        {[0, 1, 2].map((i) => (
          <path key={i} className="gs-air" style={{ ['--d' as string]: `${i * 0.6}s` }} d={`M40 ${70 + i * 14}h36m10 0h24`} stroke="var(--gs-hint)" strokeWidth="3" strokeLinecap="round" />
        ))}
        <Label x={160} y={30} size={11}>
          One layer, air moving, out of the sun
        </Label>
        <Label x={160} y={190} size={11}>
          Then a licensed dealer
        </Label>
      </svg>
    ),
  },
];

import { BottomSheet } from '../ui/BottomSheet';
import { useEsau } from '../esau/ui/store';
import { harvestSteps } from '../rules/kentucky';

const KDFWR_GUIDE = 'https://fw.ky.gov/Hunt/Pages/Recording,-Checking,-Tagging-and-Transporting.aspx';

/** First phone number in a line, as a tel: link. */
export function telHref(line: string): string | null {
  const m = /1-\d{3}-\d{3}-\d{4}/.exec(line);
  return m ? `tel:+${m[0].replace(/-/g, '')}` : null;
}

/** "Got one": what Kentucky asks after a deer is down. Every line comes from the dated rules table; nothing is added here. */
export function HarvestSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const species = useEsau((s) => s.species);
  const h = species ? harvestSteps(species) : null;
  return (
    <BottomSheet title="Got one" open={open} onClose={onClose}>
      {h ? (
        <>
          <p className="hint">Kentucky's steps after a deer is down. Checked {h.verified}; the KDFWR guide has the last word.</p>
          <ol className="harvest-steps">
            {h.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          <ul className="harvest-phones">
            {h.phones.map((p) => {
              const href = telHref(p);
              return <li key={p}>{href ? <a href={href}>{p}</a> : p}</li>;
            })}
          </ul>
          <p>
            <a href={h.source} target="_blank" rel="noreferrer">
              KDFWR: recording, checking and tagging
            </a>
          </p>
        </>
      ) : (
        <>
          <p>I don't have after-harvest steps on file for this animal, so I won't guess.</p>
          <p>
            <a href={KDFWR_GUIDE} target="_blank" rel="noreferrer">
              Check the KDFWR guide
            </a>{' '}
            for tagging and check-in rules, or call KDFWR at <a href="tel:+18008581549">1-800-858-1549</a>.
          </p>
        </>
      )}
    </BottomSheet>
  );
}

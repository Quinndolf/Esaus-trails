import { useEffect, useMemo, useState } from 'react';
import { safetyLines } from '../safety';
import { localTime } from '../conditions';
import type { EsauReply } from '../types';
import { CloseIcon } from '../../ui/icons';
import { quickBrief, useEsau } from './store';
import './esau.css';

/** Battery percent, or null where the browser can't say (iOS Safari). Never throws. */
function useBatteryPct(): number | null {
  const [pct, setPct] = useState<number | null>(null);
  useEffect(() => {
    let off = false;
    const nav = navigator as Navigator & { getBattery?: () => Promise<{ level: number }> };
    nav.getBattery?.().then((b) => !off && setPct(Math.round(b.level * 100))).catch(() => {});
    return () => {
      off = true;
    };
  }, []);
  return pct;
}

const ROLE_LABEL: Record<EsauReply['spotRole'], string> = {
  bedding: 'Bedding',
  feeding: 'Feeding',
  travel: 'Travel',
  staging: 'Staging',
  'security cover': 'Security cover',
  'open ground': 'Open ground',
  unlikely: 'Unlikely',
  'good ground': 'Good ground',
  'fair ground': 'Fair ground',
  'poor ground': 'Poor ground',
};

/** The spot card: what's here, and what Esau makes of it. Sits low so the map stays visible. */
export function EsauPanel() {
  const s = useEsau();
  const [expanded, setExpanded] = useState(false);
  const [teach, setTeach] = useState<string | null>(null);
  const [safetyShown, setSafetyShown] = useState<Set<string>>(new Set());
  const battery = useBatteryPct();

  const brief = useMemo(
    () => quickBrief(s),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [s.species, s.spot, s.grid, s.hourIndex, s.hunter],
  );

  const sun = brief?.conditions.sun.phase ?? 'midday';
  // Once-per-hunt lines are kept in state when first produced, so they stay on screen until the card closes.
  const [safetyText, setSafetyText] = useState<string[]>([]);
  useEffect(() => {
    if (!s.open) {
      setSafetyText([]);
      return;
    }
    if (!s.analysis || !s.species) return;
    const r = safetyLines({ species: s.species, weapon: s.weapon, legal: s.analysis.legal, sunPhase: sun, batteryPct: battery, saddle: false, alreadyShown: safetyShown });
    if (!r.lines.length) return;
    setSafetyShown((prev) => new Set([...prev, ...r.shown]));
    setSafetyText((prev) => [...prev, ...r.lines]);
  }, [s.open, s.analysis, s.species, s.weapon, sun, battery, safetyShown]);

  if (!s.open || !s.spot) return null;

  const hour = s.grid?.weather.hours[s.hourIndex];
  const hourLabel = hour ? localTime(hour.at).replace(/^\w+, \w+ \d+, /, '') : null;
  const replyHourLabel =
    s.replyHour != null && s.grid?.weather.hours[s.replyHour]
      ? localTime(s.grid.weather.hours[s.replyHour]!.at).replace(/^\w+, \w+ \d+, /, '')
      : null;
  const stale = s.reply && s.replyHour !== s.hourIndex;
  const busy = s.status === 'loading-ground' || s.status === 'asking';
  const offline = s.reply?.meta.servedBy === 'offline-rules';

  return (
    <section className={`esau-panel ${expanded ? 'is-expanded' : ''}`} role="dialog" aria-label="Esau's read of this spot">
      <header className="esau-head">
        <button className="esau-grip" aria-label={expanded ? 'Shrink' : 'Expand'} onClick={() => setExpanded((e) => !e)} />
        <div className="esau-spot">
          {brief ? (
            <>
              <strong>
                {cap(brief.spot.landform)} · {brief.spot.elevationFt.toLocaleString()} ft
              </strong>
              <span>
                {brief.spot.slopeDeg}° {brief.spot.aspectName ?? 'flat'} · {cap(brief.spot.cover.name)}
                {brief.spot.fromHunter && ` · ${brief.spot.fromHunter.yards.toLocaleString()} yd ${brief.spot.fromHunter.compass} of you`}
              </span>
            </>
          ) : (
            <strong>Reading this spot…</strong>
          )}
        </div>
        <button className="icon-btn" aria-label="Close" onClick={s.close}>
          <CloseIcon />
        </button>
      </header>

      <div className="esau-body">
        {s.analysis?.advisories.map((a) => (
          <div key={a.kind} className={`esau-advisory is-${a.kind}`} role="alert" data-testid={`advisory-${a.kind}`}>
            <strong>{a.title}</strong>
            <span>{a.detail}</span>
          </div>
        ))}
        {safetyText.map((l) => (
          <p key={l} className="esau-safety">
            {l}
          </p>
        ))}

        {brief && (
          <p className="esau-air">
            {hourLabel} · wind {brief.conditions.windMph} mph {brief.conditions.windFromCompass} · scent to {brief.conditions.scentTowardCompass} ·
            thermal {brief.conditions.thermal.state}
          </p>
        )}

        {s.status === 'loading-ground' && <p className="esau-wait">Reading the ground…</p>}
        {s.status === 'asking' && <p className="esau-wait">Esau's looking it over…</p>}
        {s.status === 'error' && <p className="hint warn">{s.error}</p>}

        {s.reply && (
          <article className="esau-reply" aria-live="polite">
            <div className="esau-reply-head">
              <strong>{s.reply.headline}</strong>
              <span className={`badge conf-${s.reply.confidence}`}>{ROLE_LABEL[s.reply.spotRole]} · {s.reply.confidence}</span>
            </div>
            <p>{s.reply.say}</p>
            {s.reply.more && teach !== s.reply.say && (
              <button className="link-btn" data-testid="teach-more" onClick={() => setTeach(s.reply!.say)}>
                Teach me more
              </button>
            )}
            {s.reply.more && teach === s.reply.say && <p data-testid="more-body">{s.reply.more}</p>}
            {s.reply.wouldChangeMyMind.length > 0 && (
              <p className="esau-mind">
                <span>Would change my mind:</span> {s.reply.wouldChangeMyMind.join(' · ')}
              </p>
            )}
            <p className="esau-meta">
              {offline ? "Short read from the map alone. Esau couldn't be reached, so try again with service." : `Esau's read for ${replyHourLabel}`}
            </p>
          </article>
        )}

        {stale && !busy && (
          <button className="primary-btn" onClick={() => void s.ask()}>
            Ask Esau about {hourLabel}
          </button>
        )}

      </div>
    </section>
  );
}

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

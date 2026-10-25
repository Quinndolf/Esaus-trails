import { useMemo, useState } from 'react';
import { localTime } from '../conditions';
import { SPECIES } from '../species';
import type { EsauReply } from '../types';
import { CloseIcon } from '../../ui/icons';
import { quickBrief, useEsau } from './store';
import './esau.css';

const ROLE_LABEL: Record<EsauReply['spotRole'], string> = {
  bedding: 'Bedding',
  feeding: 'Feeding',
  travel: 'Travel',
  staging: 'Staging',
  'security cover': 'Security cover',
  'open ground': 'Open ground',
  unlikely: 'Unlikely',
};

/** The spot card: what's here, and what Esau makes of it. Sits low so the map stays visible. */
export function EsauPanel() {
  const s = useEsau();
  const [question, setQuestion] = useState('');
  const [expanded, setExpanded] = useState(false);

  const brief = useMemo(
    () => quickBrief(s),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [s.species, s.spot, s.grid, s.hourIndex, s.hunter, s.pins],
  );

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

  const send = () => {
    const q = question.trim();
    if (!q || busy) return;
    setQuestion('');
    void s.ask(q);
  };

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
            <strong>{s.photo ? s.photo.name || 'Photo pin' : 'Reading this spot…'}</strong>
          )}
        </div>
        <button className="icon-btn" aria-label="Close" onClick={s.close}>
          <CloseIcon />
        </button>
      </header>

      <div className="esau-body">
        <div className="species-row" role="radiogroup" aria-label="Animal">
          {SPECIES.map((sp) => (
            <button
              key={sp.id}
              role="radio"
              aria-checked={s.species === sp.id}
              className={`chip ${s.species === sp.id ? 'is-active' : ''}`}
              disabled={!sp.ready || busy}
              onClick={() => s.setSpecies(sp.id)}
            >
              {sp.name}
              {!sp.ready && <small> soon</small>}
            </button>
          ))}
        </div>

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
            {s.reply.wouldChangeMyMind.length > 0 && (
              <p className="esau-mind">
                <span>Would change my mind:</span> {s.reply.wouldChangeMyMind.join(' · ')}
              </p>
            )}
            <p className="esau-meta">
              {offline ? 'Short read without service' : `Esau's read for ${replyHourLabel}`}
            </p>
          </article>
        )}

        {stale && !busy && (
          <button className="primary-btn" onClick={() => void s.ask()}>
            Ask Esau about {hourLabel}
          </button>
        )}

        {s.grid && (
          <form
            className="esau-ask"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <input
              className="text-input"
              value={question}
              placeholder="Ask Esau about this spot"
              onChange={(e) => setQuestion(e.target.value)}
              maxLength={500}
              enterKeyHint="send"
            />
            <button className="text-btn" disabled={busy || !question.trim()} type="submit">
              Ask
            </button>
          </form>
        )}
      </div>
    </section>
  );
}

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

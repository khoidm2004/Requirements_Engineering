import { useState } from 'react';

/**
 * Small, dependency-free SVG charts for the progress dashboard (FR-PRG-02).
 * One series per chart (small multiples), so color never carries identity; every chart has
 * a hover tooltip and the dashboard offers a table view of the same numbers.
 */

const W = 300;
const H = 140;
const PAD = { l: 34, r: 10, t: 12, b: 24 };
const IW = W - PAD.l - PAD.r;
const IH = H - PAD.t - PAD.b;

interface Point {
  label: string; // x label (e.g. week start)
  value: number | null;
}

function shortDate(iso: string) {
  const d = new Date(iso + 'T00:00:00Z');
  return `${d.getUTCDate()}.${d.getUTCMonth() + 1}.`;
}

function Tooltip({ x, y, children }: { x: number; y: number; children: React.ReactNode }) {
  const left = Math.min(Math.max((x / W) * 100, 15), 85);
  return (
    <div className="chart-tip" style={{ left: `${left}%`, top: `${(y / H) * 100}%` }} role="status">
      {children}
    </div>
  );
}

/** 12-week line chart, y = 0–100 %. Gaps where there is no data. */
export function LineMini({ title, points, format }: { title: string; points: Point[]; format: (v: number) => string }) {
  const [hover, setHover] = useState<number | null>(null);
  const n = points.length;
  const x = (i: number) => PAD.l + (n === 1 ? IW / 2 : (i / (n - 1)) * IW);
  const y = (v: number) => PAD.t + IH - v * IH;
  // Segments of consecutive non-null points
  const segs: Array<Array<[number, number]>> = [];
  let cur: Array<[number, number]> = [];
  points.forEach((p, i) => {
    if (p.value === null) {
      if (cur.length) segs.push(cur);
      cur = [];
    } else cur.push([x(i), y(p.value)]);
  });
  if (cur.length) segs.push(cur);
  const hasData = points.some((p) => p.value !== null);

  return (
    <figure className="chart">
      <figcaption className="chart__title">{title}</figcaption>
      <div className="chart__box">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title} onMouseLeave={() => setHover(null)}>
          {[0, 0.5, 1].map((g) => (
            <g key={g}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(g)} y2={y(g)} className={g === 0 ? 'chart__axis' : 'chart__grid'} />
              <text x={PAD.l - 6} y={y(g) + 4} className="chart__tick" textAnchor="end">{g * 100}%</text>
            </g>
          ))}
          {[0, n - 1].map((i) => (
            <text key={i} x={x(i)} y={H - 6} className="chart__tick" textAnchor={i === 0 ? 'start' : 'end'}>{shortDate(points[i].label)}</text>
          ))}
          {segs.map((s, i) =>
            s.length > 1 ? <polyline key={i} points={s.map((p) => p.join(',')).join(' ')} className="chart__line" /> : null,
          )}
          {points.map((p, i) =>
            p.value === null ? null : <circle key={i} cx={x(i)} cy={y(p.value)} r={hover === i ? 5 : 4} className="chart__dot" />,
          )}
          {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={PAD.t + IH} className="chart__cross" />}
          {points.map((_, i) => (
            <rect key={i} x={x(i) - IW / (2 * Math.max(1, n - 1))} y={PAD.t} width={IW / Math.max(1, n - 1)} height={IH} fill="transparent" onMouseEnter={() => setHover(i)} />
          ))}
          {!hasData && <text x={PAD.l + IW / 2} y={PAD.t + IH / 2} textAnchor="middle" className="chart__empty">–</text>}
        </svg>
        {hover !== null && (
          <Tooltip x={x(hover)} y={points[hover].value === null ? PAD.t + IH / 2 : y(points[hover].value!)}>
            <strong>{shortDate(points[hover].label)}</strong> {points[hover].value === null ? '–' : format(points[hover].value!)}
          </Tooltip>
        )}
      </div>
    </figure>
  );
}

/** 12-week bar chart of a count (minutes or exercises). */
export function BarMini({ title, points, format }: { title: string; points: Point[]; format: (v: number) => string }) {
  const [hover, setHover] = useState<number | null>(null);
  const n = points.length;
  const max = Math.max(1, ...points.map((p) => p.value ?? 0));
  const nice = max <= 5 ? 5 : Math.ceil(max / 10) * 10;
  const band = IW / n;
  const bw = Math.max(4, band - 6);
  const y = (v: number) => PAD.t + IH - (v / nice) * IH;
  const bx = (i: number) => PAD.l + i * band + (band - bw) / 2;
  return (
    <figure className="chart">
      <figcaption className="chart__title">{title}</figcaption>
      <div className="chart__box">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title} onMouseLeave={() => setHover(null)}>
          {[0, 0.5, 1].map((g) => (
            <g key={g}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(g * nice)} y2={y(g * nice)} className={g === 0 ? 'chart__axis' : 'chart__grid'} />
              <text x={PAD.l - 6} y={y(g * nice) + 4} className="chart__tick" textAnchor="end">{Math.round(g * nice)}</text>
            </g>
          ))}
          {[0, n - 1].map((i) => (
            <text key={i} x={bx(i) + (i === 0 ? 0 : bw)} y={H - 6} className="chart__tick" textAnchor={i === 0 ? 'start' : 'end'}>{shortDate(points[i].label)}</text>
          ))}
          {points.map((p, i) => {
            const v = p.value ?? 0;
            if (v <= 0) return null;
            const top = y(v);
            const h = PAD.t + IH - top;
            const r = Math.min(4, h, bw / 2);
            // Rounded top corners only; square at the baseline.
            const d = `M${bx(i)},${PAD.t + IH} V${top + r} Q${bx(i)},${top} ${bx(i) + r},${top} H${bx(i) + bw - r} Q${bx(i) + bw},${top} ${bx(i) + bw},${top + r} V${PAD.t + IH} Z`;
            return <path key={i} d={d} className={`chart__bar ${hover === i ? 'chart__bar--hover' : ''}`} />;
          })}
          {points.map((_, i) => (
            <rect key={i} x={PAD.l + i * band} y={PAD.t} width={band} height={IH} fill="transparent" onMouseEnter={() => setHover(i)} />
          ))}
        </svg>
        {hover !== null && (
          <Tooltip x={bx(hover) + bw / 2} y={y(points[hover].value ?? 0)}>
            <strong>{shortDate(points[hover].label)}</strong> {format(points[hover].value ?? 0)}
          </Tooltip>
        )}
      </div>
    </figure>
  );
}

"use client";

import { createContext, useContext, useEffect, useId, useRef, useState, type PointerEvent } from "react";
import { ChevronDown } from "lucide-react";
import { evolutionDomain, evolutionInterval, evolutionSeries, type EvolutionChart, type EvolutionMode, type EvolutionRange } from "@/lib/platform-evolution";

export type EvolutionControls = {
  today: string;
  range: EvolutionRange;
  mode: EvolutionMode;
  onRangeChange: (range: EvolutionRange) => void;
  onModeChange: (mode: EvolutionMode) => void;
  state?: "ready" | "loading" | "error";
};
export const EvolutionContext = createContext<EvolutionControls | null>(null);

export function PlatformEvolutionPanel({ charts, label = "Platform Evolution graphs", description = "Recorded observations only.", footer }: { charts: EvolutionChart[]; label?: string; description?: string; footer?: string }) {
  const controls = useContext(EvolutionContext);
  if (!controls) return null;
  return <EvolutionPanel {...controls} charts={charts} label={label} description={description} footer={footer} />;
}

const number = (value: number) => value.toLocaleString("en-GB", { maximumFractionDigits: 2 });
const signed = (value: number) => `${value > 0 ? "+" : ""}${number(value)}`;
const dateLabel = (date: string, full = false) => new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", ...(full ? { year: "numeric" } : {}), timeZone: "UTC" });

export function EvolutionPanel({ charts, range, mode, onRangeChange, onModeChange, today, state = "ready", label, description, footer }: EvolutionControls & { charts: EvolutionChart[]; label: string; description: string; footer?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const interval = evolutionInterval(charts, range, today);
  return <section className="platform-trend-panel platform-evolution" aria-label={label}>
    <button type="button" className="platform-trend-toggle" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
      <span>Evolution graphs</span><ChevronDown size={16} aria-hidden className={open ? "platform-trend-toggle-icon-open" : undefined} />
    </button>
    {open ? <div id={id}>
      {state !== "ready" ? <p role={state === "error" ? "alert" : "status"} className="platform-evolution-caption">{state === "error" ? "Unable to load history. Reopen Platforms or collect stats to retry." : "Loading history…"}</p> : null}
      <div className="platform-evolution-controls">
        <div role="group" aria-label="History period">{(["30D", "90D", "1Y", "All"] as const).map((value) => <button key={value} type="button" aria-pressed={range === value} onClick={() => onRangeChange(value)}>{value}</button>)}</div>
        <div role="group" aria-label="Chart display mode">{(["absolute", "growth"] as const).map((value) => <button key={value} type="button" aria-pressed={mode === value} onClick={() => onModeChange(value)}>{value === "absolute" ? "Absolute" : "Growth"}</button>)}</div>
      </div>
      <p className="platform-evolution-caption">{dateLabel(interval.start, true)} – {dateLabel(interval.end, true)} · {description} {mode === "growth" ? "Growth uses each metric’s first available observation in this period." : "Lines connect recorded observations; missing dates are not estimated."}</p>
      {state === "ready" ? <div className="platform-evolution-grid">{charts.map((chart) => <EvolutionChartView key={`${chart.label}-${range}-${mode}`} chart={chart} start={interval.start} end={interval.end} mode={mode} />)}</div> : null}
      {footer ? <p className="platform-evolution-caption">{footer}</p> : null}
    </div> : null}
  </section>;
}

function EvolutionChartView({ chart, start, end, mode }: { chart: EvolutionChart; start: string; end: string; mode: EvolutionMode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(360);
  const [selected, setSelected] = useState<number | null>(null);
  const tooltipId = useId();
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(180, entry.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const points = evolutionSeries(chart.points, start, end, mode);
  const comparison = evolutionSeries(chart.comparison?.points ?? [], start, end, mode);
  const comparisonLast = comparison.at(-1);
  const first = points[0], last = points.at(-1);
  const change = points.length > 1 && last ? last.value - first.value : null;
  const domain = evolutionDomain([...points, ...comparison].map((point) => point.plottedValue));
  const left = 48, right = width - 14, top = 16, bottom = 166;
  const timeStart = Date.parse(`${start}T00:00:00Z`), timeEnd = Date.parse(`${end}T00:00:00Z`);
  const x = (date: string) => left + (Date.parse(`${date}T00:00:00Z`) - timeStart) / Math.max(timeEnd - timeStart, 86400000) * (right - left);
  const y = (value: number) => bottom - (value - domain.min) / (domain.max - domain.min) * (bottom - top);
  const line = points.map((point) => `${x(point.date)},${y(point.plottedValue)}`).join(" ");
  const active = selected === null ? undefined : points[selected];
  const activeComparison = active ? comparison.find((point) => point.date === active.date) : undefined;
  const middle = new Date((timeStart + timeEnd) / 2).toISOString().slice(0, 10);
  const ticks = width < 300 || start === end ? [start, end] : [start, middle, end];
  function inspectPointer(event: PointerEvent<SVGSVGElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const pointerX = (event.clientX - box.left) / box.width * width;
    let nearest = 0;
    points.forEach((point, index) => {
      if (Math.abs(x(point.date) - pointerX) < Math.abs(x(points[nearest].date) - pointerX)) nearest = index;
    });
    setSelected(nearest);
  }
  return <article className="platform-evolution-chart" style={{ "--evolution-color": chart.color } as React.CSSProperties}>
    <header><h3><i aria-hidden />{chart.label}</h3><div><strong>{last ? (mode === "growth" ? signed(last.plottedValue) : number(last.value)) : "Unavailable"}</strong><span>{change === null ? "Change unavailable" : `${signed(change)} in period`}</span></div></header>
    {chart.comparison ? <p className="platform-evolution-comparison" style={{ color: chart.comparison.color }}><i aria-hidden />{chart.comparison.label}: {comparisonLast ? (mode === "growth" ? signed(comparisonLast.plottedValue) : number(comparisonLast.value)) : "Unavailable"}</p> : null}
    <p className="platform-evolution-observation">{last ? `${mode === "growth" ? `Baseline ${dateLabel(first.date, true)} · ` : ""}Latest observation ${dateLabel(last.date, true)}` : "No recorded observations in this period."}</p>
    <div ref={ref} className="platform-evolution-plot">
      {points.length ? <svg viewBox={`0 0 ${width} 202`} role="img" tabIndex={0} aria-label={`${chart.label}${chart.comparison ? ` and ${chart.comparison.label}` : ""}, ${mode} mode. ${points.length} observations. Use left and right arrows to inspect; Home and End jump to first and last.`} aria-describedby={tooltipId}
        onPointerMove={inspectPointer}
        onPointerDown={inspectPointer}
        onPointerLeave={(event) => { if (event.pointerType === "mouse") setSelected(null); }}
        onFocus={() => setSelected((current) => current ?? 0)}
        onBlur={() => setSelected(null)}
        onKeyDown={(event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End", "Escape"].includes(event.key)) return;
          event.preventDefault();
          if (event.key === "Escape") setSelected(null);
          else if (event.key === "Home") setSelected(0);
          else if (event.key === "End") setSelected(points.length - 1);
          else setSelected((current) => Math.max(0, Math.min(points.length - 1, (current ?? 0) + (event.key === "ArrowRight" ? 1 : -1))));
        }}>
        {[0, 1, 2, 3].map((index) => {
          const value = domain.min + (domain.max - domain.min) * index / 3;
          return <g key={index}><line x1={left} x2={right} y1={y(value)} y2={y(value)} className="platform-evolution-gridline" /><text x={left - 8} y={y(value) + 4} textAnchor="end">{Intl.NumberFormat("en-GB", { notation: "compact", maximumFractionDigits: 1 }).format(value)}</text></g>;
        })}
        {points.length > 1 ? <polyline points={line} fill="none" stroke={chart.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" /> : null}
        {comparison.length > 1 ? <polyline points={comparison.map((point) => `${x(point.date)},${y(point.plottedValue)}`).join(" ")} fill="none" stroke={chart.comparison?.color} strokeWidth={2} strokeDasharray="5 3" strokeLinejoin="round" /> : null}
        {comparison.map((point) => comparison.length <= 60 || point.date === active?.date ? <circle key={`comparison-${point.date}`} cx={x(point.date)} cy={y(point.plottedValue)} r={2.5} fill={chart.comparison?.color} stroke="white" strokeWidth={1.5} /> : null)}
        {points.map((point, index) => points.length <= 60 || index === selected ? <circle key={point.date} cx={x(point.date)} cy={y(point.plottedValue)} r={index === selected ? 5 : points.length > 60 ? 1.5 : 2.5} fill={chart.color} stroke="white" strokeWidth={1.5} /> : null)}
        {active ? <line x1={x(active.date)} x2={x(active.date)} y1={top} y2={bottom} stroke={chart.color} strokeOpacity={0.35} strokeDasharray="3 3" /> : null}
        {[...new Set(ticks)].map((date, index, dates) => <text key={date} x={x(date)} y={193} textAnchor={index === 0 ? "start" : index === dates.length - 1 ? "end" : "middle"}>{dateLabel(date)}</text>)}
      </svg> : <div className="platform-evolution-empty">No history for this period. Try a longer range.</div>}
    </div>
    <div id={tooltipId} className="platform-evolution-tooltip" aria-live="polite">
      {active ? <><strong>{dateLabel(active.date, true)} · {chart.label}: {number(active.value)}</strong><span>{active.previousChange === null ? "Previous observation unavailable" : `${signed(active.previousChange)} from previous observation`}{mode === "growth" ? ` · Growth: ${signed(active.plottedValue)}` : ""}</span>{activeComparison ? <span className="platform-evolution-comparison-detail">{chart.comparison?.label}: {number(activeComparison.value)} · {activeComparison.previousChange === null ? "Previous observation unavailable" : `${signed(activeComparison.previousChange)} from previous observation`}{mode === "growth" ? ` · Growth: ${signed(activeComparison.plottedValue)}` : ""}</span> : null}</> : <span>{points.length ? "Hover, touch, or focus the chart and use arrow keys to inspect." : "Missing observations are not shown as zero."}</span>}
    </div>
  </article>;
}

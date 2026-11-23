import { useTranslator } from "@/i18n";
import { COMPLETENESS_COLORS, COMPLETENESS_THRESHOLDS, completenessLevel, presentPercent } from "@/utilities/data-completeness";

// A radius of 100 / 2π gives a circumference of 100, so stroke lengths can be written directly in percent.
const RADIUS = 15.91549430918954;
const TRACK = "#e5e7eb";
const SIZE = 64;

const formatPercent = (value: number, digits: number) => `${value.toLocaleString("en", { maximumFractionDigits: digits })}%`;
const formatCount = (value: number) => value.toLocaleString("en");

// Built from the thresholds so the legend always matches the colouring.
const { good, poor } = COMPLETENESS_THRESHOLDS;
const LEGEND = [
  { level: "good", range: `≥${good}%` },
  { level: "fair", range: `${poor}–${good}%` },
  { level: "poor", range: `≤${poor}%` },
] as const;

type Health ={ missing_pct: number; missing_cells: number; total_cells: number };

/** The share of present cells as a donut, coloured by the completeness rating. */
export function DataCompletenessChart({ health }: { health: Health }) {
  const { translator } = useTranslator();
  const present = presentPercent(health.missing_pct);
  const level = completenessLevel(present);
  const color = COMPLETENESS_COLORS[level];
  const presentCells = Math.max(0, health.total_cells - health.missing_cells);
  const label = translator("explorePreview.completeness");
  // The percentage is shown only inside the ring; the caption gives the cell counts.
  const figures = present === null ? "—"
    : `${formatCount(presentCells)} ${translator("explorePreview.completenessOf")} ${formatCount(health.total_cells)}`;
  const ringText = present === null ? "—" : formatPercent(present, 1);

  return (
    <section className="min-w-0 flex-1 text-sm" data-testid="data-completeness" data-level={level} aria-labelledby="data-completeness-title">
      <figure className="m-0 flex w-full items-center gap-3">
        <figcaption>
          <span id="data-completeness-title" className="block font-semibold">{label}</span>
          <span className="tabular-nums">{figures}</span>
        </figcaption>
        {/* ml-auto here and mr-auto on the legend centre the ring + legend between the caption and the download button. */}
        <svg viewBox="0 0 36 36" width={SIZE} height={SIZE} role="img" className="ml-auto shrink-0"
          aria-label={`${label}: ${present === null ? "—" : formatPercent(present, 2)}, ${figures} (${translator(`explorePreview.completenessLevel_${level}`)})`}>
          <circle cx="18" cy="18" r={RADIUS} fill="none" stroke={TRACK} strokeWidth="4" />
          {present !== null && present > 0 && (
            // Starts at 12 o'clock and runs clockwise.
            <circle cx="18" cy="18" r={RADIUS} fill="none" stroke={color} strokeWidth="4"
              strokeDasharray={`${present} ${100 - present}`} strokeDashoffset="25" />
          )}
          <text x="18" y="18" textAnchor="middle" dominantBaseline="central" fontSize="7.5" fontWeight="600" fill="#111827">
            {ringText}
          </text>
        </svg>
        {/* Legend: what each colour means. The dataset's own rating is emphasised. */}
        <ul className="m-0 mr-auto list-none space-y-0.5 p-0 text-xs" aria-label={translator("explorePreview.completenessLegend")}>
          {LEGEND.map(({ level: item, range }) => (
            <li key={item} className={`flex items-center gap-1.5 ${item === level ? "font-semibold text-gray-900" : "text-gray-500"}`}
              data-current={item === level || undefined}>
              <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: COMPLETENESS_COLORS[item] }} aria-hidden="true" />
              <span className="tabular-nums">{range}</span>
              <span>{translator(`explorePreview.completenessLevel_${item}`)}</span>
            </li>
          ))}
        </ul>
      </figure>
    </section>
  );
}

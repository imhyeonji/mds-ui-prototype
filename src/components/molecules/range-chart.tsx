import { T } from "@/i18n";
import type { CategoricalRange, ColumnType, DateRange, NumericRange } from "@/utilities/explore-types";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const fmt = (v: number | null) => v === null ? "—" : v.toLocaleString("en", { maximumFractionDigits: 4 });
const ACCENT = "#7c3aed";

function BoxPlot({ range }: { range: NumericRange }) {
  const { min, q1, median, q3, max } = range;
  if (min === null || max === null || q1 === null || q3 === null || median === null) {
    return <p className="text-xs text-gray-500"><T string="explorePreview.noValues" /></p>;
  }
  const span = max - min || 1;
  const x = (v: number) => 8 + ((v - min) / span) * 284;
  return (
    <figure className="m-0">
      <svg viewBox="0 0 300 44" className="h-11 w-full" role="img" aria-label={`min ${fmt(min)}, q1 ${fmt(q1)}, median ${fmt(median)}, q3 ${fmt(q3)}, max ${fmt(max)}`}>
        <line x1={x(min)} x2={x(max)} y1={22} y2={22} stroke="#9ca3af" />
        <line x1={x(min)} x2={x(min)} y1={14} y2={30} stroke="#9ca3af" />
        <line x1={x(max)} x2={x(max)} y1={14} y2={30} stroke="#9ca3af" />
        <rect x={x(q1)} y={10} width={Math.max(1, x(q3) - x(q1))} height={24} fill="#ede9fe" stroke={ACCENT} />
        <line x1={x(median)} x2={x(median)} y1={10} y2={34} stroke={ACCENT} strokeWidth={2} />
      </svg>
      <figcaption className="flex justify-between text-xs tabular-nums text-gray-500">
        <span>{fmt(min)}</span><span>Q1 {fmt(q1)}</span><span>Med {fmt(median)}</span><span>Q3 {fmt(q3)}</span><span>{fmt(max)}</span>
      </figcaption>
    </figure>
  );
}

function TopValues({ range }: { range: CategoricalRange }) {
  const data = range.top.map((item) => ({ name: item.label, count: item.count }));
  if (range.other_count > 0) data.push({ name: "Other", count: range.other_count });
  if (!data.length) return <p className="text-xs text-gray-500"><T string="explorePreview.noValues" /></p>;
  return (
    <div style={{ height: Math.min(28 * data.length + 16, 420) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 4 }}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} interval={0} />
          <Tooltip />
          <Bar dataKey="count" fill={ACCENT} radius={[0, 3, 3, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function DateSpan({ range }: { range: DateRange }) {
  if (!range.min || !range.max) return <p className="text-xs text-gray-500"><T string="explorePreview.noValues" /></p>;
  return (
    <div className="space-y-1">
      <div className="h-3 rounded bg-violet-200" style={{ borderLeft: `3px solid ${ACCENT}`, borderRight: `3px solid ${ACCENT}` }} />
      <div className="flex justify-between text-xs tabular-nums text-gray-500"><span>{range.min}</span><span>{range.max}</span></div>
    </div>
  );
}

interface RangeChartProps {
  type: ColumnType;
  range: NumericRange | CategoricalRange | DateRange | undefined;
  /** Unique count when a categorical column is mostly unique: replaces the chart with a note. */
  uniqueCount?: number;
}

export function RangeChart({ type, range, uniqueCount }: RangeChartProps) {
  if (!range) return <p className="text-xs text-gray-500"><T string="explorePreview.noValues" /></p>;
  if (type === "numeric") return <BoxPlot range={range as NumericRange} />;
  if (type === "date") return <DateSpan range={range as DateRange} />;
  if (uniqueCount !== undefined) {
    return <p className="text-sm text-gray-600"><T string="explorePreview.mostlyUnique" /> ({uniqueCount.toLocaleString("en")} <T string="explorePreview.uniqueValues" />)</p>;
  }
  return <TopValues range={range as CategoricalRange} />;
}

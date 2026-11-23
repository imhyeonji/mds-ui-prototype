import { T, useTranslator } from "@/i18n";
import { formatCell, type ExploreView, type Row } from "@/utilities/explore-types";
import { MenuItem, Tab, Tabs, TextField } from "@mui/material";
import { useState, type ReactNode } from "react";

const ROW_OPTIONS = [5, 10, 25, 50];
const STAT_ORDER = ["count", "unique", "top", "freq", "mean", "std", "min", "25%", "50%", "75%", "max"];
const cellClass = "whitespace-nowrap border-b border-r border-gray-100 px-3 py-2";
const headClass = "sticky top-0 whitespace-nowrap border-b border-r border-gray-200 bg-gray-50 px-3 py-2 text-left font-semibold";

// Table height: header + 5 rows by default; choosing more shows 10 rows, the rest scroll.
const rowsHeight = (rows: number) => rows > 5 ? "max-h-[417px]" : "max-h-[232px]";

function Section({ title, note, control, children, height = "max-h-[50vh]" }: { title: string; note?: string; control?: ReactNode; children: ReactNode; height?: string }) {
  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-semibold"><T string={title} /></h3>
        {control}
      </div>
      {note && <p className="text-xs text-gray-500">{note}</p>}
      <div className={`${height} overflow-auto rounded-lg border border-gray-200`}>{children}</div>
    </section>
  );
}

function RowsTable({ rows }: { rows: Row[] }) {
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  if (!rows.length) return <p className="p-4 text-sm text-gray-500"><T string="explorePreview.noRows" /></p>;
  return (
    <table className="w-full border-collapse text-sm">
      <thead><tr>{columns.map((column) => <th key={column} scope="col" className={headClass}>{column}</th>)}</tr></thead>
      <tbody>{rows.map((row, index) => <tr key={index} className="even:bg-gray-50">
        {columns.map((column) => <td key={column} className={`${cellClass} ${typeof row[column] === "number" ? "text-right tabular-nums" : "text-gray-700"}`}>{formatCell(row[column])}</td>)}
      </tr>)}</tbody>
    </table>
  );
}

function RowCount({ value, max, onChange, label }: { value: number; max: number; onChange: (value: number) => void; label: string }) {
  const options = ROW_OPTIONS.filter((option) => option < max).concat(max).filter((option, i, all) => all.indexOf(option) === i);
  return (
    <TextField select size="small" color="secondary" label={label} value={Math.min(value, max)} onChange={(event) => onChange(Number(event.target.value))} sx={{ minWidth: 120 }}>
      {options.map((option) => <MenuItem key={option} value={option}>{option}</MenuItem>)}
    </TextField>
  );
}

export function ExploreDataTab({ view, totalRows }: { view: ExploreView; totalRows: number }) {
  const { translator } = useTranslator();
  const [headRows, setHeadRows] = useState(5);
  const [tailRows, setTailRows] = useState(5);
  const stats = view.describe.stats;
  const statColumns = Object.keys(stats);
  const statNames = [...new Set([...STAT_ORDER, ...statColumns.flatMap((column) => Object.keys(stats[column]))])]
    .filter((name) => statColumns.some((column) => name in stats[column]));
  const rowsLabel = translator("explorePreview.rowsShown");
  const tail = view.tail ?? [];
  // Tail only when the dataset is big enough that head doesn't already show every row.
  const sections = totalRows >= 40 && tail.length > 0 ? ["head", "tail", "info", "describe"] : ["head", "info", "describe"];
  const [picked, setPicked] = useState("head");
  const section = sections.includes(picked) ? picked : "head";

  return (
    <div className="space-y-5 p-5">
      <Tabs value={section} onChange={(_, value: string) => setPicked(value)} textColor="secondary" indicatorColor="secondary" variant="scrollable"
        aria-label={translator("explorePreview.dataSections")} sx={{ minHeight: 36, borderBottom: 1, borderColor: "divider", "& .MuiTab-root": { minHeight: 36, py: 0.5, textTransform: "none" } }}>
        {sections.map((item) => <Tab key={item} value={item} id={`explore-data-tab-${item}`} aria-controls={`explore-data-panel-${item}`} label={translator(`explorePreview.${item}`)} />)}
      </Tabs>

      <div role="tabpanel" id={`explore-data-panel-${section}`} aria-labelledby={`explore-data-tab-${section}`}>
      {section === "info" && <Section title="explorePreview.info" note={view.info.note}>
        <table className="w-full border-collapse text-sm">
          <thead><tr>{["column", "dtype", "type", "nonNull", "nullPct", "leadingZeros", "coerced"].map((key) => <th key={key} scope="col" className={headClass}><T string={`explorePreview.${key}`} /></th>)}</tr></thead>
          <tbody>{view.info.columns.map((column) => <tr key={column.column} className="even:bg-gray-50">
            <td className={`${cellClass} font-medium`}>{column.column}</td>
            <td className={cellClass}><code>{column.dtype}</code></td>
            <td className={cellClass}>{column.type}</td>
            <td className={`${cellClass} text-right tabular-nums`}>{column.non_null.toLocaleString("en")}</td>
            <td className={`${cellClass} text-right tabular-nums`}>{column.null_pct}%</td>
            <td className={cellClass}>{column.leading_zeros ? "✓" : ""}</td>
            <td className={`${cellClass} text-right tabular-nums`}>{column.coerced || ""}</td>
          </tr>)}</tbody>
        </table>
      </Section>}

      {section === "head" && <Section title="explorePreview.head" height={rowsHeight(headRows)} control={<RowCount value={headRows} max={view.head.length || 5} onChange={setHeadRows} label={rowsLabel} />}>
        <RowsTable rows={view.head.slice(0, headRows)} />
      </Section>}

      {section === "describe" && <Section title="explorePreview.describe" note={view.describe.note}>
        {statColumns.length ? (
          <table className="w-full border-collapse text-sm">
            <thead><tr><th scope="col" className={headClass} />{statColumns.map((column) => <th key={column} scope="col" className={headClass}>{column}</th>)}</tr></thead>
            <tbody>{statNames.map((name) => <tr key={name} className="even:bg-gray-50">
              <th scope="row" className={`${cellClass} text-left font-semibold`}>{name}</th>
              {statColumns.map((column) => <td key={column} className={`${cellClass} ${typeof stats[column][name] === "number" ? "text-right tabular-nums" : "text-gray-700"}`}>{name in stats[column] ? formatCell(stats[column][name]) : ""}</td>)}
            </tr>)}</tbody>
          </table>
        ) : <p className="p-4 text-sm text-gray-500"><T string="explorePreview.noRows" /></p>}
      </Section>}

      {section === "tail" && (
        <Section title="explorePreview.tail" height={rowsHeight(tailRows)} control={<RowCount value={tailRows} max={tail.length} onChange={setTailRows} label={rowsLabel} />}>
          <RowsTable rows={tail.slice(-tailRows)} />
        </Section>
      )}
      </div>
    </div>
  );
}

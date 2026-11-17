import { RangeChart } from "@/components/molecules/range-chart";
import { T } from "@/i18n";
import { COLUMN_TYPES, mostlyUnique, type ColumnType, type ExploreView } from "@/utilities/explore-types";
import { Alert, Chip } from "@mui/material";
import { useState } from "react";

export function ExploreChartsTab({ view }: { view: ExploreView }) {
  const counts = Object.fromEntries(COLUMN_TYPES.map((type) => [type, view.info.columns.filter((column) => column.type === type).length])) as Record<ColumnType, number>;
  const [selected, setSelected] = useState<ColumnType>(COLUMN_TYPES.find((type) => counts[type] > 0) || "numeric");
  const type = counts[selected] ? selected : COLUMN_TYPES.find((item) => counts[item] > 0) || selected;
  const columns = view.info.columns.filter((column) => column.type === type);

  return (
    <div className="space-y-4 p-5">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Column types">
        {COLUMN_TYPES.map((item) => <Chip key={item} clickable disabled={!counts[item]}
          color={item === type ? "secondary" : "default"} variant={item === type ? "filled" : "outlined"}
          label={<span><T string={`explorePreview.type_${item}`} /> {counts[item]}</span>}
          onClick={() => setSelected(item)} aria-pressed={item === type} />)}
      </div>
      {!columns.length ? <Alert severity="info"><T string="explorePreview.noColumns" /></Alert> : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {columns.map((column) => <section key={column.column} className="space-y-3 rounded-lg border border-gray-200 p-4">
            <div><h3 className="font-semibold">{column.column}</h3><code className="text-xs text-gray-500">{column.dtype}</code></div>
            <RangeChart type={column.type} range={view.ranges[column.type]?.[column.column]}
              uniqueCount={column.type === "categorical" ? mostlyUnique(view.describe.stats, column.column) : undefined} />
          </section>)}
        </div>
      )}
    </div>
  );
}

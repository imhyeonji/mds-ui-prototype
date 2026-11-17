import { RangeChart } from "@/components/molecules/range-chart";
import { T } from "@/i18n";
import { COLUMN_TYPES, formatCell, mostlyUnique, type ExploreView } from "@/utilities/explore-types";
import { Alert, Button, Checkbox, Divider, FormControlLabel, Menu, MenuItem } from "@mui/material";
import { useState } from "react";

export function ExploreColumnsTab({ view }: { view: ExploreView }) {
  const all = view.info.columns.map((column) => column.column);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const shown = view.info.columns.filter((column) => !hidden.has(column.column));
  const toggle = (name: string, show: boolean) => setHidden((previous) => {
    const next = new Set(previous);
    if (show) next.delete(name); else next.add(name);
    return next;
  });
  const onlyType = (type: string) => setHidden(new Set(view.info.columns.filter((column) => column.type !== type).map((column) => column.column)));

  return (
    <div className="space-y-4 p-5">
      <div className="flex justify-end">
        <Button color="secondary" variant="outlined" onClick={(event) => setAnchor(event.currentTarget)} aria-haspopup="menu" aria-expanded={!!anchor}>
          {shown.length}/{all.length} <span className="ml-1"><T string="explorePreview.columnsShown" /></span>
        </Button>
        <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)} slotProps={{ paper: { sx: { maxHeight: 480 } } }}>
          <div className="flex flex-wrap gap-1 px-3 pb-2">
            <Button size="small" color="secondary" onClick={() => setHidden(new Set())}><T string="explorePreview.selectAll" /></Button>
            <Button size="small" color="secondary" onClick={() => setHidden(new Set(all))}><T string="explorePreview.selectNone" /></Button>
            {COLUMN_TYPES.map((type) => <Button key={type} size="small" color="secondary" onClick={() => onlyType(type)}><T string={`explorePreview.type_${type}`} /></Button>)}
          </div>
          <Divider />
          {view.info.columns.map((column) => <MenuItem key={column.column} dense>
            <FormControlLabel label={<span>{column.column} <span className="text-xs text-gray-500">· {column.type}</span></span>}
              control={<Checkbox size="small" color="secondary" checked={!hidden.has(column.column)} onChange={(_, checked) => toggle(column.column, checked)} />} />
          </MenuItem>)}
        </Menu>
      </div>

      {!shown.length ? <Alert severity="info"><T string="explorePreview.noColumns" /></Alert> : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((column) => {
            const stats = view.describe.stats[column.column] || {};
            return <section key={column.column} className="space-y-4 rounded-lg border border-gray-200 p-5">
              <div>
                <h3 className="font-semibold">{column.column}</h3>
                <code className="text-xs text-gray-500">{column.type} · {column.dtype}</code>
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <dt className="text-gray-500"><T string="explorePreview.nonNull" /></dt><dd className="text-right tabular-nums">{column.non_null.toLocaleString("en")}</dd>
                <dt className="text-gray-500"><T string="explorePreview.nullPct" /></dt><dd className="text-right tabular-nums">{column.null_pct}%</dd>
                {column.leading_zeros && <><dt className="text-gray-500"><T string="explorePreview.leadingZeros" /></dt><dd className="text-right">✓</dd></>}
                {column.coerced > 0 && <><dt className="text-gray-500"><T string="explorePreview.coerced" /></dt><dd className="text-right tabular-nums">{column.coerced}</dd></>}
                {Object.entries(stats).map(([name, value]) => <div key={name} className="contents">
                  <dt className="text-gray-500">{name}</dt><dd className="truncate text-right tabular-nums" title={String(value)}>{formatCell(value)}</dd>
                </div>)}
              </dl>
              <div className="border-t border-gray-100 pt-3">
                <RangeChart type={column.type} range={view.ranges[column.type]?.[column.column]}
                  uniqueCount={column.type === "categorical" ? mostlyUnique(view.describe.stats, column.column) : undefined} />
              </div>
            </section>;
          })}
        </div>
      )}
    </div>
  );
}

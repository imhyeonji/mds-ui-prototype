import { T } from "@/i18n";
import { columnProfile, type DatasetColumn, type DatasetRow } from "@/utilities/dataset-preview";

export function DatasetColumnProfile({ rows, column }: { rows: DatasetRow[]; column: DatasetColumn }) {
  const profile = columnProfile(rows, column);
  if (!rows.length) return <span className="text-xs text-gray-500">—</span>;

  if (column.type === "number") {
    const highest = Math.max(...profile.bins.map((bin) => bin.count), 1);
    return (
      <div className="space-y-2 font-normal">
        <div className="flex h-16 items-end gap-0.5" role="img" aria-label={`${column.label}: ${profile.bins.map((bin) => `${bin.label}: ${bin.count}`).join(", ")}`}>
          {profile.bins.map((bin) => (
            <div key={bin.label} className="flex-1 bg-blue-400 hover:bg-blue-600" style={{ height: `${bin.count / highest * 100}%` }} title={`${bin.label}: ${bin.count}`} />
          ))}
        </div>
        <div className="flex justify-between text-xs text-gray-500"><span>{profile.min}</span><span>{profile.max}</span></div>
        <p className="text-xs text-gray-600"><T string="datasetExplorer.mean" /> <strong>{profile.mean.toFixed(1)}</strong> {column.unit}</p>
      </div>
    );
  }

  if (column.type === "datetime") {
    return (
      <div className="flex h-24 flex-col justify-center text-center font-normal">
        <strong className="text-2xl text-gray-800">{profile.unique}</strong>
        <span className="text-xs text-gray-500"><T string="datasetExplorer.uniqueTimes" /></span>
      </div>
    );
  }

  const top = profile.categories.slice(0, 3);
  const remaining = profile.categories.slice(3).reduce((sum, category) => sum + category.count, 0);
  return (
    <div className="space-y-2 text-xs font-normal">
      {top.map((category) => (
        <div key={category.label}>
          <div className="flex justify-between gap-2"><span className="truncate">{category.label}</span><span>{Math.round(category.count / rows.length * 100)}%</span></div>
          <div className="mt-1 h-1 rounded bg-gray-100"><div className="h-1 rounded bg-blue-400" style={{ width: `${category.count / rows.length * 100}%` }} /></div>
        </div>
      ))}
      {remaining > 0 && <p className="text-gray-500"><T string="datasetExplorer.other" /> · {Math.round(remaining / rows.length * 100)}%</p>}
    </div>
  );
}

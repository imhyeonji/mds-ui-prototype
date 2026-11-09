import { T } from "@/i18n";
import { catalogMetadata } from "@/utilities/catalog-metadata";

export function CatalogMetadataSummary({ dataset, participantId }: { dataset: unknown; participantId: string }) {
  const metadata = catalogMetadata(dataset, participantId);
  const fields = [
    ["catalog.provider", metadata.provider], ["catalog.format", metadata.format],
    ["catalog.model", metadata.model], ["catalog.category", metadata.category],
    ["catalog.terms", metadata.terms], ["catalog.methods", metadata.methods.join(", ")],
  ];
  return <div className="space-y-3">
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
      {fields.map(([label, value]) => <div key={label} className="min-w-0">
        <dt className="text-xs font-medium text-gray-500"><T string={label} /></dt>
        <dd className="mt-1 break-words text-gray-800">{value || <span className="text-gray-400"><T string="catalog.notProvided" /></span>}</dd>
      </div>)}
    </dl>
    {metadata.methods.length > 0 && <p className="text-xs text-gray-500"><T string="catalog.advertisedNotice" /></p>}
  </div>;
}

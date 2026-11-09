const DCT = "http://purl.org/dc/terms/";
const DCAT = "http://www.w3.org/ns/dcat#";
const MOBILITY = "https://w3id.org/mobilitydcat-ap/";
type RecordValue = Record<string, unknown>;
const record = (value: unknown): RecordValue => value && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : {};

export function metadataText(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(metadataText);
  if (typeof value === "string") return value.trim() ? [value] : [];
  if (!value || typeof value !== "object") return [];
  const object = record(value);
  const nested = object["@value"] ?? object["@id"];
  return nested === undefined ? [] : metadataText(nested);
}

function field(object: RecordValue, namespace: string, prefix: string, name: string) {
  return object[`${namespace}${name}`] ?? object[`${prefix}:${name}`] ?? object[name];
}

export function catalogMetadata(dataset: unknown, participantId = "") {
  const item = record(dataset);
  const props = { ...item, ...record(item.properties) };
  const text = (ns: string, prefix: string, name: string) => metadataText(field(props, ns, prefix, name)).join(", ");
  const distribution = field(props, DCAT, "dcat", "distribution");
  const distributions = Array.isArray(distribution) ? distribution : distribution ? [distribution] : [];
  const methods = [...new Set(distributions.flatMap((entry) => metadataText(field(record(entry), DCT, "dct", "format"))))];
  return {
    id: String(item["@id"] ?? item.id ?? ""),
    title: text(DCT, "dct", "title"),
    description: text(DCT, "dct", "description"),
    provider: text(DCT, "dct", "publisher") || participantId,
    format: text(DCAT, "dcat", "mediaType"),
    model: text(MOBILITY, "mobilitydcatap", "mobilityDataStandard"),
    category: text(MOBILITY, "mobilitydcatap", "mobilityTheme"),
    terms: text(DCT, "dct", "license") || text(DCT, "dct", "accessRights"),
    methods,
  };
}

export function matchesCatalogFilters(metadata: ReturnType<typeof catalogMetadata>, query: string, format: string) {
  return (!format || metadata.format === format || metadata.methods.includes(format)) &&
    [metadata.title, metadata.id, metadata.description].some((value) => value.toLowerCase().includes(query.trim().toLowerCase()));
}

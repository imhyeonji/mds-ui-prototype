/** Download the complete received JSON, without normalizing or fetching it again. */
export function jsonDownload(body: string, assetId: string, saved = false) {
  try { JSON.parse(body); } catch { return undefined; }
  const name = assetId.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 100) || "dataset";
  return { body, filename: `${name}${saved ? "-saved-sample" : ""}.json`, type: "application/json;charset=utf-8" };
}

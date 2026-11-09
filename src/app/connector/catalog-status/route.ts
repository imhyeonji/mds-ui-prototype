import { NextResponse } from "next/server";
import { getConnectorConfig } from "@/utilities/connector-config";
import { buildCatalogStatuses } from "@/utilities/catalog-status";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, private" };
export async function GET() {
  try {
    const config = getConnectorConfig();
    const signal = AbortSignal.timeout(15000);
    const query = async (resource: string) => {
      const items: unknown[] = [];
      for (let offset = 0; offset < 10000; offset += 100) {
        const response = await fetch(`${config.managementUrl.replace(/\/$/, "")}/v3/${resource}/request`, {
          method: "POST", redirect: "error", cache: "no-store", signal,
          headers: { "Content-Type": "application/json", "x-api-key": config.apiKey },
          body: JSON.stringify({ "@context": { "@vocab": "https://w3id.org/edc/v0.0.1/ns/" }, "@type": "QuerySpec", offset, limit: 100 }),
        });
        if (!response.ok) throw new Error("Status lookup failed");
        const page: unknown = await response.json();
        if (!Array.isArray(page)) throw new Error("Invalid status response");
        items.push(...page);
        if (page.length < 100) return items;
      }
      throw new Error("Status lookup exceeds limit");
    };
    const [agreements, negotiations, retirements] = await Promise.all([
      query("contractagreements"), query("contractnegotiations"), query("contractagreements/retirements"),
    ]);
    return NextResponse.json({ statuses: buildCatalogStatuses(agreements, negotiations, retirements, config.id) }, { headers });
  } catch {
    return NextResponse.json({ error: "Contract and request status is unavailable. Please retry." }, { status: 502, headers });
  }
}

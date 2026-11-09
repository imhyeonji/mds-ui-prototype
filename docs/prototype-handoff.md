# MDS prototype handoff — 2026-11-09

Repository: `/Users/hyeonji/Documents/mds/mds-edc-ui`
Branch: `codex/mds-catalog-preview`

Existing uncommitted preview/explorer work was preserved and extended. No Docker,
Vault, certificates, credentials, connector settings or dependency versions were
changed by this task. Existing edits to package.json and next.config.mjs predate
this task. Nothing has been committed or published.

## Implemented

- Catalogue opens directly to a saved portal response, with 132 real offers from
  34 providers, obtained across 14 pages. Search, provider/category filters,
  title sorting, pagination, detail dialog and explicit snapshot labelling.
- The supplied login cookies successfully authenticated a one-time catalogue
  retrieval. They were read only from the user's attachment, sent only to the
  exact HTTPS portal API, never printed, and never saved in the app. Redirects
  were disabled. This is a saved snapshot, not a persistent live integration.
- Connector catalogue remains available as a second tab, preserving endpoint
  selection, EDC title search, pagination and contract negotiation. New list
  cards and detail summaries show available metadata; local filters clearly
  apply only to the loaded page. Advertised methods are not proof of retrieval.
- Existing server-side HTTP PULL preview was retained. It now requires an EDR
  matched to the selected Transfer Process; EDR failures no longer fall back to
  old transfer credentials. The user-supplied Copenhagen hostname was added to
  the explicit endpoint allowlist without relaxing DNS, HTTPS or path checks.
- Original JSON download preserves the complete fetched body and its envelope,
  does not fetch again, and works for any valid JSON root. Existing table/CSV/
  chart components were preserved, with raw JSON as the initial tab.
- A separately labelled Copenhagen saved sample uses the real 84,023-byte
  response: 100 records, with 47,415 reported total. It is never substituted
  automatically for a failed live request. Sample labels do not claim live data.
- Transfer loading failures now show a visible retry message.

## Indicator investigation — not implemented

User decision: only `Agreement exists` and `Request in progress`. No failure or
cancellation badges. A valid agreement takes precedence over an in-progress
request. Failed status queries must never mean "no agreement".

| Evidence | Reuse / implication |
|---|---|
| `src/pages/contract-agreements/index.tsx` and `client.management.contractAgreements.queryAll` | Existing POST `/v3/contractagreements/request` |
| `src/types/enriched-contract-agreement.ts` | `assetId`, `providerId`, `consumerId`, `isTerminated` support agreement matching and retirement checks |
| `src/utilities/contract-agreement-enrichment.ts` | Existing retirement lookup. Enrichment also fetches transfers and remote catalogues; avoid invoking it per card |
| `src/pages/contract-negotiations/index.tsx` and `client.management.contractNegotiations.queryAll` | Existing POST `/v3/contractnegotiations/request` |
| Installed `ContractNegotiation` type | Exposes state/agreement ID but no typed assetId getter; actual response mapping remains unverified |
| `src/utilities/contract-negotiations.ts` | Initiation supplies `policy.target = assetId`, but this does not prove query responses retain that field |
| Portal response | Has assetId, connectorId and organizationId. organizationId is not interchangeable with EDC provider identity |

Agreement matching should use current consumer identity + provider identity +
asset ID. First verify that the portal connectorId equals the agreement's
providerId in actual responses; do not infer identity from a title, hostname or
organization name. Ignore retired agreements. If several agreements match, any
valid matching agreement wins; the latest failed negotiation must not override it.

For requests, require a consumer negotiation with an explicit, verified asset
target and provider match, and an observed active backend state. Do not classify
every non-TERMINATED state as active. Do not invent a negotiation.assetId field,
decode arbitrary offer IDs, or use localStorage as proof of server state.

Fetch status in a batch with bounded pagination and cache per connector/provider;
avoid card-by-card requests. A truncated/failed query leaves status unknown, not
absent. Reset cached mappings when the current connector changes. Badges belong
next to the dataset title; colours alone are insufficient. No badge can guarantee
that a provider GET succeeds.

Blocking evidence: the configured local connector refused connections during
verification. Negotiation response fields and active state values could not be
verified. Therefore indicator code remains intentionally absent.

## Demo

Validation completed:

- Focused tests: 11/11 passed.
- TypeScript check and production build passed. Existing Next.js i18n/App Router
  configuration warning remains; configuration was not changed.
- Targeted ESLint passed, including the modified layout and preview components.
- Browser: default catalogue, title/provider search, next-page navigation,
  dataset details, connector-tab handoff, raw JSON sample and download checked.
- Downloaded JSON in Downloads is exactly equal to the saved source: 84,023 bytes.
- Authenticated portal catalogue retrieval returned HTTP 200; all 132 unique
  offers were collected. Unauthenticated request returned 401.
- Live connector calls failed with connection refused (the local UI proxy
  returned 500). No live provider response was claimed or substituted.
- Full Docker-backed E2E suite was not run: its setup creates connector resources
  and its teardown stops services. Existing infrastructure was left untouched.

Files changed in this task (in addition to preserving earlier working changes):

- Catalogue: `src/pages/catalog-browser/index.tsx`,
  `src/components/organisms/{catalog-results,portal-catalog,data-offer-dialog}.tsx`,
  `src/components/molecules/catalog-metadata-summary.tsx`,
  `src/utilities/{catalog-metadata,portal-catalog}.ts`,
  `src/data/portal-catalog-snapshot.json`.
- Preview: `src/app/connector/data-preview/route.ts`,
  `src/app/connector/data-preview/sample/route.ts`,
  `src/components/organisms/{data-preview-dialog,dataset-explorer}.tsx`,
  `src/pages/transfer-processes/index.tsx`,
  `src/utilities/{data-preview-policy,normalize-preview,preview-download}.ts`,
  `src/data/copenhagen-bicycle-parking.json`.
- Supporting changes: English translations, focused unit tests, README and this
  handoff. `side-drawer.tsx` adds `minWidth: 0` so the content can shrink within
  the existing flex layout.

Use the already-installed Node 24 rather than the system Node 18:

```sh
cd /Users/hyeonji/Documents/mds/mds-edc-ui
PATH='/Users/hyeonji/.nvm/versions/node/v24.21.0/bin':"$PATH" ./node_modules/.bin/next dev --hostname 127.0.0.1
```

1. Open `http://127.0.0.1:3000/catalog-browser`. Browse without an endpoint.
2. Search Copenhagen or another provider; select an offer and inspect metadata.
3. Connector catalogue shows the existing EDC flow. The portal snapshot contains
   no DSP endpoints or contract policies, so it cannot directly initiate a contract.
4. Open Transfer Processes → Open Copenhagen saved sample.
5. Inspect Raw response and Download original JSON. The download includes the
   response metadata and all 100 saved records, regardless of table filtering.
6. For live retrieval, the existing connector must already be running. Select a
   STARTED consumer HttpData-PULL transfer and Preview Data. No new agreements or
   transfers were initiated during this task.

## Follow-up Codex prompts

### 1 — Verify live preview when the existing connector is reachable

Work in `/Users/hyeonji/Documents/mds/mds-edc-ui` on the current branch. Read this
handoff, applicable AGENTS.md and git status first. Preserve all existing changes.
Do not modify Docker, Vault, certificates, credentials, environment values or
connector settings. Do not start new contracts or transfers. Use an existing
STARTED consumer HttpData-PULL transfer and the current matching EDR to verify the
server-side GET, JSON viewer and original download. Confirm downloaded bytes match
the displayed response and credentials never appear in UI, logs or downloads.
Check unavailable EDR, 401/403/500 and timeout outcomes with isolated mocks. Keep
saved sample mode explicit. Report live evidence separately from mocked tests.

### 2 — Connect portal discovery to the real EDC offer

Continue in the same repository. Preserve the saved portal catalogue and existing
connector tab. Locate an authorized source mapping portal connectorId to its DSP
endpoint; do not guess API routes or manufacture endpoints. Once that mapping is
verified, fetch the live provider catalogue through the existing integration,
select the exact assetId, and present the real current policies in the existing
DataOfferDialog. A saved card is never a contract offer. Preserve explicit errors
for offline providers or missing offers. Do not embed session cookies or create
an arbitrary URL proxy. If mapping cannot be established, report the missing
field/API and leave the existing manual connector flow intact.

### 3 — Investigate the two status indicators

Investigate only; do not add indicator UI yet. Reuse existing agreement and
negotiation APIs. Verify identity and asset matching with sanitized actual field
names and state values. Use the two approved labels above, exclude failed/cancelled
history, account for retired agreements and multiple agreements, and distinguish
unknown from absent. Show a concrete mapping table, pagination/caching approach,
and minimal file-change proposal. Never use portal availability or ONLINE status
as a substitute for the current user's agreement/request status.

### 4 — Final validation

Run targeted lint, type checking, production build and focused tests. Check the
browser journey from Catalogue search to metadata, then an existing transfer to
Preview and download. Verify saved/live labels and errors. Keep existing features
and infrastructure intact. Report precisely what was tested, what remains blocked
and whether data came from live HTTP PULL or a saved response.

## Meeting evidence

The 75-minute recording was transcribed locally. Automatic transcription can
contain mistakes. Around 15–17 minutes the group discusses bringing the external
catalogue into the connector UI; around 58–61 minutes it discusses identifying
already-contracted datasets in Catalogue and checking API reuse. These support the
revised discovery entry point and indicator investigation; broader scoring,
page consolidation and additional chart work were not added.

## Transfer page UX follow-up

Replaced the nine-column table with responsive cards: dataset/provider names,
receiving/providing direction, friendly state, next-step explanation, updated
 time and Preview/Details actions. Names from the saved portal are used only when
both assetId and provider connectorId match; unavailable names are explicit.
Technical IDs and original state are disclosed inside Details, with no raw EDR or
credential payload. Preview eligibility remains limited to active consumer HTTP
Pull transfers without a reported error. Paused/ended/preparing states explain
why Preview is unavailable. Load errors no longer also claim there are no transfers.
Existing search and pagination remain, and tests no longer depend on table cells.

Validation: 13 focused tests passed (including rendered-card credential exclusion
and status/action cases); TypeScript, targeted ESLint and production build passed.
The live connector remains unreachable, so populated live-browser verification
is outstanding. No infrastructure configuration was changed.


## Direct catalogue lookup follow-up — 2026-11-09

The saved catalogue now includes connectorEndpoint for all 132 offers (36 connector
identities across 34 organizations). Addresses were obtained from the portal
`data-offer-detail-page` API using one representative asset per connector. Only
public endpoint metadata was retained; supplied session credentials are absent
from source, docs and tests.

Card → saved dataset details → View current terms now queries the existing local
management proxy with the selected connector identity, linked DSP address and
exact asset ID filter. It opens the existing negotiation dialog only after the
returned provider identity and dataset match. It does not negotiate automatically.
Closing a pending dialog invalidates its result. Failures remain in the same
window with Retry; the manual endpoint tab remains available separately.

The list and endpoint mapping are still saved snapshots, not a persistent portal
login or live portal integration. Current terms are requested from the provider
via the local connector when clicked; stale/missing assets are handled explicitly.

Validation: 14 focused tests, targeted lint, TypeScript (during build) and the
production build passed. Browser verified direct lookup and retry without an
endpoint input. Successful live terms retrieval remains unverified because the
configured local connector is unreachable. No connector configuration changed.


## Preview provider-address correction — 2026-11-09

Actual EDC transfer responses omit counterPartyAddress. Preview now resolves it
through the transfer's contractId and the existing agreement negotiation API.
EDR credentials remain server-side and existing provider/host checks remain.
Provider HTTP 5xx responses are explicitly identified in the preview UI.

Live validation: bike-counter-province-bozen-bolzano returned provider HTTP 200
and 45,941 bytes; mobility-comunidadvalenciana and pedestrian-flow-estimation-alc-1.0
returned provider HTTP 500. These are not successful dataset previews.
Regression tests: 15 passed, including absent transfer address and missing
negotiation address; targeted lint and TypeScript passed.


## Catalogue status badges and density — 2026-11-09

Implemented live local contract/request badges via a server-only catalogue status
route. Reuses raw agreement, negotiation and retirement APIs with pagination,
timeout, no-store and no per-card requests or remote catalogue enrichment.
Consumer/provider and asset identity must match; non-retired contracts override
active consumer negotiations. Failed, terminating and cancelled requests do not
produce badges. Lookup failures clear statuses and offer Retry, rather than claim
no contract exists. Refreshes on entry, manual refresh and negotiation completion.
Live lookup returned six contract identities and eight pending identities; saved
catalogue cards display only exact provider/asset matches.

Cards now use 16px padding, two-line normalized descriptions and a compact metadata
footer; absent metadata fields are omitted. Green check and amber clock badges
appear beside titles and in details. Browser confirmed real BMW contract badges.
Validation: 16 tests, TypeScript and targeted lint passed.

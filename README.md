# MDS Data Preview Layer

A prototype layer on top of the [Mobility Data Space (MDS)](https://mobility-dataspace.eu) connector UI that lets non-technical users **judge a mobility dataset before they invest time in it**: a quality score before requesting, a one-click preview after the contract, and no code at either step.

Built by team *A Little Late* (Team 2) for the Mobility Data Space challenge, module M10 Digital Product Development. It is a fork of the MDS EDC connector UI (`edc-connector-ui-mds`).

## The problem

Looking at MDS from a newcomer's side, the costly effort comes first and the information needed to justify it arrives last:

- Catalogue listings give too little information to judge whether a dataset is relevant.
- After a contract is agreed, users must find the endpoint and access token in a raw transfer JSON of about 20 fields and query it with tools such as Postman.

In our interviews, five of six students could not judge relevance from the listing, and five of six struggled with the technical setup.

## What it does

The prototype is a layer inside the existing connector UI. It replaces nothing: the catalogue, the contract and the connector stay as they are.

| Moment | Feature |
| --- | --- |
| **Before requesting** | **Metadata Score (0–100)** on every catalogue offer, rating how complete the provider's published information is. Sortable, so users can compare offers without access or set-up. A low score never blocks publishing. |
| **After the contract** | **Dataset Explorer**, a one-click preview with sample rows (head and tail), column types and statistics, missing-value indicators, charts and a map for geographic data. No endpoints, tokens or API calls for the user. |
| **Once the data looks useful** | **Export** to CSV, TSV, JSON, Parquet, Excel (where size allows) or the original format. The Download button appears only after the preview summary has loaded. |

The browser receives only a compact summary (50 head and tail rows, column statistics, at most 5,000 map points). Only a deliberate download puts the full dataset on the user's machine. Data is read through the consumer's own authorised transfer, and no copy is kept.

### How it fits together

```
Browser ──► Next.js UI server ──► EDC connector (contracts, transfers, EDR)
                  │
                  └─► Explore / Export pipelines (FastAPI on Google Cloud Run)
                              │
                              └─► Provider data endpoint (HTTP PULL)
```

1. The catalogue shows saved portal listings and descriptions, and reads request and contract status from the organisation's connector.
2. When a user opens Dataset Explorer, the UI server reads the data endpoint and access token for the authorised transfer and passes them to the **Explore pipeline**. Credentials stay on the server.
3. The pipeline fetches the provider's data and returns sample rows, column statistics, missing-value information and geographic data.
4. When a user picks a download format, the **Export pipeline** prepares the file.

### Scope and limits

- Previews work for active consumer-side **HTTP PULL** transfers only. Streaming transfers (Kafka, S3) would need separate infrastructure.
- The catalogue's default tab shows a **saved snapshot** of the portal (132 offers, 34 providers, retrieved 2026-11-09), not a live portal query. Saved cards cannot start contract negotiations. The **Connector catalogue** tab keeps the existing endpoint-based EDC catalogue and negotiation flow.
- A labelled Copenhagen sample dataset (100 saved records) is available for offline demos. Live failures never silently fall back to it.
- The Metadata Score has not yet been tested with new users choosing a dataset. Preview and export were tested with three users.
- Production use would need testing across more providers and a named owner for maintenance.

## Tech stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · MUI · Recharts · Playwright. Backend integration through `@think-it-labs/edc-connector-client`.

> This repo uses a version of Next.js with breaking changes. Check `node_modules/next/dist/docs/` before changing framework-level code.

## Running the project

### Prerequisites

- Node.js 26 (the version used by the Dockerfile) and [Yarn](https://yarnpkg.com) 1.x
- An EDC connector the UI can reach (management API, default API, protocol and public URLs)
- For live previews and exports: the URL and API key of the Explore/Export pipeline service

No connector at hand? Use the E2E connector described under [Docker](#docker) or the saved Copenhagen sample.

### 1. Install dependencies

```bash
yarn install
```

### 2. Configure the environment

Copy the example file and fill in the values for your connector:

```bash
cp .envrc.example .envrc
```

Load it into your shell (with [direnv](https://direnv.net) via `direnv allow`, or `source .envrc`).

| Variable | Purpose |
| --- | --- |
| `EDC_ID`, `EDC_NAME`, `EDC_DESCRIPTION` | Identity of your connector |
| `EDC_MANAGEMENT_URL` | EDC management API, e.g. `http://edc:8182/api/management` |
| `EDC_DEFAULT_URL` | EDC default API, e.g. `http://edc:8181/api` |
| `EDC_PROTOCOL_URL` | Dataspace protocol endpoint, e.g. `http://edc:8184/api/dsp` |
| `EDC_PUBLIC_URL` | Public data plane endpoint, e.g. `http://edc:8183/public` |
| `EDC_MANAGEMENT_API_KEY` | API key for the management API |
| `EDC_CURATOR_*`, `EDC_MAINTAINER_*` | Connector metadata shown in the UI |
| `MDS_DAPS_URL`, `MDS_DAPS_JWKS_URL` | MDS DAPS and its JWKS endpoint |
| `APP_URL` | URL the app is served on, `http://localhost:3000` locally |
| `PIPELINES_URL` | Base URL of the Explore/Export pipeline service |
| `PIPELINES_API_KEY` | API key for the pipeline service |
| `TEST_API_KEY` | Management API key used by the E2E tests |

`PIPELINES_URL` and `PIPELINES_API_KEY` are not in `.envrc.example`, so add them yourself. They are read only on the server and must never be exposed to the browser. Without them, the live Dataset Explorer cannot load data.

### 3. Start the development server

```bash
yarn dev
```

Open <http://127.0.0.1:3000>.

### Production build

```bash
yarn build
yarn start
```

### Docker

```bash
docker build -t mds-connector-ui .
```

`docker-compose.e2e.yml` starts in-memory MDS EDC connectors that you can use as a local counterpart for development and tests.

## Testing

Playwright end-to-end tests live in `tests/`. They need a running connector (see `docker-compose.e2e.yml`) and `TEST_API_KEY` set.

```bash
yarn test                              # all tests
yarn test tests/catalog-browser.spec.ts   # a single spec
yarn test:ui                           # Playwright UI mode
yarn test:acceptance                   # acceptance suite
```

Data-preview parser and request-policy unit tests run without starting the app or contacting a provider:

```bash
node --test tests/unit/data-preview.cjs
```

## Other scripts

| Command | What it does |
| --- | --- |
| `yarn lint` | Run ESLint |
| `yarn security-scan` | Trivy scan for vulnerabilities and secrets (needs [Trivy](https://trivy.dev)) |
| `yarn image-scan` | Build the Docker image and scan it with Trivy |

## Project layout

```
src/app/          Next.js routes, including the server-side data-preview route
src/components/   UI components (atoms, molecules, organisms, templates)
src/data/         Saved portal catalogue snapshot and Copenhagen sample data
src/domain/       Domain logic, including the Metadata Score (metadata-quality/)
src/utilities/    Preview policy, portal catalogue and EDC helpers
tests/            Playwright and unit tests
docs/             Design notes and the prototype handoff
```

## Further reading

- [`docs/prototype-handoff.md`](docs/prototype-handoff.md): state of the prototype and known gaps
- [`docs/dev/search-and-pagination.md`](docs/dev/search-and-pagination.md): catalogue search and pagination design

## Team

Julian Bartsch, Tarek Bder, Dimitrij Chistenkin, Hyeonji Im, Sameeksha Mehta, Víctor Felipe dos Santos.

## License

See [License](License).

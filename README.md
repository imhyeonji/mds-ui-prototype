## Getting Started

### Provider data preview

`Preview Data` on a STARTED consumer `HttpData-PULL` transfer now retrieves a real
provider response. The browser submits only the transfer ID to the Next.js server.
The server verifies the current transfer and uses its current EDR. If the EDR
cannot be retrieved, it reports an error rather than using old transfer credentials.
Credentials stay on the server and are sent exactly as supplied by EDC.

This first version supports GET requests to HTTPS `/public` endpoints on the four
explicitly listed provider hosts in `src/utilities/data-preview-policy.ts`, matching
the transfer's counterparty hostname. Other hosts, internal IPs, redirects, custom
ports, binary/compressed responses, arbitrary URLs and caller-supplied credentials
are rejected. Public IPv4 DNS results are pinned for the provider request. The route
uses the deployment's existing UI/connector access boundary; it does not introduce
a new login system. Same-origin POST validation is additional request protection,
not user authentication.

Requests have a 25-second overall timeout and a 2 MiB response limit. The explorer
displays up to 2,000 rows and 80 columns from the selected array. It does not fetch
additional provider pages. Raw responses remain available, including HTTP errors.
JSON fields are inferred without coercing numeric-looking strings; CSV values stay
as text. Mixed/missing fields are retained. Charts operate on the currently loaded,
filtered rows and identify excluded values and omitted groups. CSV exports escape
spreadsheet formula prefixes in string values.

The initial view is raw JSON. Download original JSON saves the full received
response (including metadata), without another provider request. The existing
CSV explorer remains available. A separate, explicitly labelled Copenhagen
saved sample contains 100 records captured on 2026-09-24; the original response
reports 47,415 total records. Live failures never silently switch to this sample.

### Catalogue prototype

The default Browse datasets tab opens without an endpoint. It displays a saved
portal catalogue: 132 offers across 34 providers retrieved from 14 pages on
2026-11-09. Search, provider/category filters, sorting and pagination operate on
that saved response, not a live portal query. The portal requires login session
cookies; no such cookies are stored in the app or repository.

Connector catalogue keeps the existing endpoint-based EDC catalogue and contract
negotiation flow. Portal metadata does not contain DSP endpoints or contract
offers, so saved cards cannot initiate contracts. Request/agreement indicators
remain investigation-only; see docs/prototype-handoff.md.

Run focused parser, request-policy and mocked transport/route tests without starting
the application or contacting a provider:

```bash
node --test tests/unit/data-preview.cjs
```

### Local Development

1. Copy `.envrc.example` to `.envrc` and fill in the required environment variables for your EDC connector.

2. Run the development server:
   ```bash
   yarn dev
   ```


### Run E2E tests 

To run the tests in the app use the following command

```bash

yarn playwright test [test-file-path]

# eg

yarn playwright test kafka-data-offer.spec.ts
```


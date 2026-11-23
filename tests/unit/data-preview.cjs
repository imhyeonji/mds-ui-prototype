// Run without starting Next.js: node --test tests/unit/data-preview.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { PassThrough } = require('node:stream');
const { EventEmitter } = require('node:events');
const root = path.resolve(__dirname, '../..');
// Source imports name modules with or without their .ts/.tsx extension, or by their folder's index file.
const withExtension = (file) => {
  if (/\.tsx?$/.test(file)) return file;
  return [file + '.ts', file + '.tsx', file + '/index.ts', file + '/index.tsx']
    .find((candidate) => fs.existsSync(path.join(root, candidate))) ?? file + '.ts';
};
function load(file, mocks = {}) {
  const filename = path.join(root, file);
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2021, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports = {};
  vm.runInNewContext(output, {
    exports, Buffer, URL, Response, Request, AbortSignal, AbortController, TextDecoder, setTimeout, clearTimeout,
    fetch: mocks.fetch || (() => { throw new Error('Unexpected network access'); }),
    require(name) {
      if (name in mocks) return mocks[name];
      if (name === 'server-only') return {};
      if (name.startsWith('@/')) return load(withExtension('src/' + name.slice(2)), mocks);
      if (name.startsWith('.')) return load(withExtension(path.relative(root, path.resolve(path.dirname(filename), name))), mocks);
      return require(name);
    },
  }, { filename });
  return exports;
}
const normal = load('src/utilities/normalize-preview.ts');
const helpers = load('src/utilities/dataset-preview.ts');
const policy = load('src/utilities/data-preview-policy.ts');
const host = 'opendatahub-prod-1.connector.mds.think-it.io';
test('transfer card renders actions and hides technical identifiers and credentials from the summary', () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const Card = load('src/components/organisms/transfer-process-table-row.tsx', {
    '@/components/organisms/asset-dialog.tsx': { default: () => null },
    '@/components/organisms/data-preview-dialog': { DataPreviewDialog: () => null },
    '@/i18n': { T: () => 'Preview data' },
    '@/utilities/catalog.ts': { removeJsonLdSchemaFromProperties: x => x },
    '@/utilities/date.ts': { formatDateTime: () => 'Today', formatDateTimeAgo: () => 'a moment ago' },
    '@/data/portal-catalog-snapshot.json': { default: { dataOffers: [] } },
    '@think-it-labs/edc-connector-ui/use-edc-connector': { useEdcConnectorClient: () => ({}) },
    '@think-it-labs/edc-connector-ui/json-ld': { readValue: (x,k) => x[k] },
  }).default;
  const transfer = {id:'technical-transfer-id',assetId:'dataset-1',contractId:'hidden-contract-id',state:'STARTED',type:'CONSUMER',transferType:'HttpData-PULL',dataDestination:{authorization:'must-not-render'}};
  const html = renderToStaticMarkup(React.createElement(Card, {transferProcess:transfer,managementUrl:'/test',connectorEndpoint:'',participantId:'consumer'}));
  assert.match(html, /Transfer active/);
  assert.match(html, /Preview data/);
  assert.match(html, /Dataset name unavailable/);
  assert.ok(!html.includes('hidden-contract-id'));
  assert.ok(!html.includes('must-not-render'));
  assert.ok(!html.includes('<table'));
});
test('transfer wording separates active access, provider direction and actual preview eligibility', () => {
  const { transferPresentation } = load('src/utilities/transfer-presentation.ts');
  assert.equal(transferPresentation('STARTED', 'CONSUMER', 'HttpData-PULL').canPreview, true);
  for (const [state,type,method,error] of [
    ['STARTED','PROVIDER','HttpData-PULL',false],
    ['STARTED','CONSUMER','Kafka',false],
    ['STARTED','CONSUMER','HttpData-PULL',true],
    ['COMPLETED','CONSUMER','HttpData-PULL',false],
    ['SUSPENDED','CONSUMER','HttpData-PULL',false],
    ['UNRECOGNISED','CONSUMER','HttpData-PULL',false],
  ]) assert.equal(transferPresentation(state,type,method,error).canPreview, false);
  assert.match(transferPresentation('STARTED','CONSUMER','HttpData-PULL').description, /does not guarantee/);
  assert.equal(transferPresentation('REQUESTED','CONSUMER','HttpData-PULL').label, 'Preparing access');
  assert.equal(transferPresentation('UNRECOGNISED','CONSUMER','HttpData-PULL').label, 'Status unavailable');
});
const endpoint = `https://${host}/public`;
const provider = `https://${host}/api/dsp/2025-1`;

test('normalizes nested heterogeneous records without inventing numeric values', () => {
  const parsed = normal.parsePreview(JSON.stringify({ offset: 0, limit: 200, data: [
    { sname: 'A', smetadata: { city: 'Bolzano' }, scoordinate: { x: 11.3, y: 46.4 }, sactive: true, count: 7, mixed: 1, tags: ['a', 'b'] },
    { sname: 'B', smetadata: { city: 'Bolzano' }, sactive: false, count: null, mixed: '2' },
  ] }), 'application/json');
  assert.equal(parsed.candidates[0].path, '/data');
  assert.equal(parsed.warnings.length, 1);
  const dataset = normal.normalizeDataset(parsed.candidates[0], 'asset');
  assert.equal(dataset.rows[0]['/smetadata/city'], 'Bolzano');
  assert.equal(dataset.rows[1]['/scoordinate/x'], null);
  assert.equal(dataset.columns.find(c => c.key === '/mixed').type, 'mixed');
  assert.equal(dataset.columns.find(c => c.key === '/sactive').type, 'boolean');
  assert.equal(dataset.columns.find(c => c.key === '/tags').type, 'json');
  assert.equal(dataset.rows[1]['/mixed'], '2');
  const groups = helpers.chartGroups(dataset.rows, '/sactive');
  assert.equal(groups.data.reduce((sum, entry) => sum + entry.value, 0), 2);
  const totals = helpers.chartGroups(dataset.rows, '/smetadata/city', '/count', 'sum');
  assert.equal(totals.excluded, 1);
  assert.equal(totals.data[0].value, 7);
  assert.equal(helpers.filterDataset(dataset.rows, '', '/sactive', 'false').length, 1);
});

test('CSV quoting, duplicate columns, empty values and formula-safe export', () => {
  const csv = 'id,id,note\r\n001,4,"line one\nline ""two"""\r\n002,,x';
  const parsed = normal.parsePreview(csv, 'text/csv');
  const dataset = normal.normalizeDataset(parsed.candidates[0], 'csv');
  assert.equal(dataset.rows[0]['/id'], '001');
  assert.equal(dataset.rows[0]['/id_2'], '4');
  assert.equal(dataset.rows[0]['/note'], 'line one\nline "two"');
  assert.equal(helpers.columnProfile(dataset.rows, dataset.columns[1]).missing, 1);
  assert.match(helpers.datasetCsv([{ value: '=1+2' }], [{ key: 'value' }]), /'=/);
  assert.throws(() => normal.parseCsv('x\n"unclosed'));
});

test('empty, scalar, malformed, multiple arrays, capped tables and hostile keys', () => {
  assert.equal(normal.parsePreview('', '').candidates.length, 0);
  assert.equal(normal.parsePreview('not JSON', 'application/json').warnings.length, 1);
  assert.equal(normal.parsePreview('42', 'application/json').candidates.length, 0);
  assert.equal(normal.parsePreview('{"meta":[],"data":[]}', 'application/json').candidates[0].path, '/data');
  const candidate = normal.parsePreview('[{"__proto__":{"polluted":true},"a/b":1,"a":{"b":2}}]', 'application/json').candidates[0];
  const row = normal.normalizeDataset(candidate, 'x').rows[0];
  assert.equal(row['/a~1b'], 1);
  assert.equal(row['/a/b'], 2);
  assert.equal({}.polluted, undefined);
  const limited = normal.normalizeDataset({ path: '/', values: Array.from({length: 2010}, (_, value) => ({ value })) }, 'x');
  assert.equal(limited.rows.length, 2000);
  assert.ok(limited.warnings.length);
});

test('profiles and chart totals stay consistent; omitted groups are explicit', () => {
  const rows = Array.from({ length: 50 }, (_, index) => ({ category: String(index), count: index }));
  const profile = helpers.columnProfile(rows, { key: 'count', type: 'number' });
  assert.equal(profile.bins.reduce((sum, bin) => sum + bin.count, 0), 50);
  assert.equal(profile.mean, 24.5);
  assert.equal(helpers.chartGroups(rows, 'category').omittedGroups, 30);
  const constant = helpers.columnProfile([{n:3}, {n:3}], {key:'n', type:'number'});
  assert.equal(constant.bins[0].count, 2);
});

test('endpoint policy rejects arbitrary hosts, private routes, redirects by URL, ports and credentials', () => {
  assert.equal(policy.approvedEndpoint(endpoint, provider).hostname, host);
  for (const url of ['http://' + host + '/public', 'https://127.0.0.1/public', 'https://evil.example/public', endpoint + '/../management', 'https://' + host + ':444/public', 'https://user:pass@' + host + '/public', endpoint + '/%2fadmin']) {
    assert.throws(() => policy.approvedEndpoint(url, provider));
  }
  assert.throws(() => policy.approvedEndpoint(endpoint, 'https://ua-mds-prod-1.connector.mds.think-it.io/api/dsp'));
  for (const ip of ['127.0.0.1', '10.1.2.3', '169.254.169.254', '192.168.1.1', '172.16.0.1', '100.64.0.1', '::1', '198.51.100.1', '224.1.1.1']) assert.equal(policy.isPublicIPv4(ip), false);
  assert.equal(policy.isPublicIPv4('8.8.8.8'), true);
  assert.equal(policy.authorizationHeaders({ authorization: 'exact-token' }).Authorization, 'exact-token');
  assert.throws(() => policy.authorizationHeaders({ authKey: 'Host', authCode: 'evil' }));
  assert.throws(() => policy.authorizationHeaders({ authorization: 'x\r\ny' }));
  assert.equal(policy.edcValue({ 'https://w3id.org/edc/v0.0.1/ns/state': [{ '@value': 'STARTED' }] }, 'state'), 'STARTED');
});

function providerMock({ ips = ['8.8.8.8'], status = 200, body = '{"data":[]}', headers = { 'content-type': 'application/json' } } = {}) {
  let calls = 0;
  const result = load('src/utilities/provider-data-preview.ts', {
    'node:dns/promises': { Resolver: class { async resolve4() { return ips; } cancel() {} } },
    'node:https': { request(url, options, receive) {
      calls++;
      assert.equal(url.hostname, host);
      assert.equal(options.method, 'GET');
      assert.equal(options.agent, false);
      assert.equal(options.headers.Authorization, 'exact-token');
      options.lookup(host, {}, (error, address, family) => { assert.equal(address, ips[0]); assert.equal(family, 4); });
      const req = new EventEmitter();
      req.end = () => {
        const res = new PassThrough();
        res.statusCode = status; res.statusMessage = 'Test'; res.headers = headers;
        receive(res);
        if (!res.destroyed) res.end(body);
      };
      return req;
    } },
  });
  return { result, calls: () => calls };
}

test('provider transport pins DNS, redacts echoed credentials and blocks unsafe responses', async () => {
  const successful = providerMock({ body: 'exact-token {"x":1}' });
  const response = await successful.result.fetchProviderPreview(endpoint, provider, {authorization:'exact-token'}, new AbortController().signal);
  assert.equal(response.body, '[REDACTED] {"x":1}');
  for (const scenario of [
    { ips: ['127.0.0.1'] }, { status: 302 }, { headers: {'content-type':'application/octet-stream'} },
    { headers: {'content-type':'application/json','content-length':String(3*1024*1024)} },
    { body: 'a'.repeat(2*1024*1024+1) }, { headers: {'content-type':'application/json','content-encoding':'gzip'} },
  ]) {
    const mocked = providerMock(scenario);
    await assert.rejects(mocked.result.fetchProviderPreview(endpoint, provider, {authorization:'exact-token'}, new AbortController().signal));
    if (scenario.ips) assert.equal(mocked.calls(), 0);
  }
});

function routeMock({ state = 'STARTED', edrError = false, transferAddress = true, missingProvider = false, missingNegotiationAddress = false } = {}) {
  const calls = [];
  const transfer = { type: 'CONSUMER', state, transferType: 'HttpData-PULL', counterPartyAddress: missingProvider ? undefined : provider, contractId: 'agreement-1', dataDestination: transferAddress ? { endpoint, authorization: 'transfer-token' } : {} };
  const route = load('src/app/connector/data-preview/route.ts', {
    'next/server': { NextResponse: { json: (body, init) => new Response(JSON.stringify(body), init) } },
    '@/utilities/connector-config': { getConnectorConfig: () => ({ managementUrl: 'https://management.example/api', apiKey: 'management-secret' }) },
    '@/utilities/provider-data-preview': { fetchProviderPreview: async (url, counterparty, address) => {
      calls.push({ url, counterparty, address });
      return { status: 200, statusText: 'OK', contentType: 'application/json', body: '{"data":[{"x":1}]}', bytes: 18 };
    } },
    fetch: async (url, options) => {
      assert.equal(options.headers['x-api-key'], 'management-secret');
      assert.equal(options.redirect, 'error');
      if (url.includes('/transferprocesses/')) return Response.json(transfer);
      if (url.endsWith('/contractagreements/agreement-1/negotiation')) return Response.json(missingNegotiationAddress ? {} : {counterPartyAddress: provider});
      if (edrError) return new Response('', {status:404});
      if (url.endsWith('/edrs/request')) return Response.json([{ '@id': 'edr-1', transferProcessId: 'transfer-1' }]);
      return Response.json({ endpoint, authorization: 'fresh-edr-token' });
    },
  });
  function request(body = { transferProcessId: 'transfer-1' }, origin = 'https://ui.example') {
    const req = new Request('https://ui.example/connector/data-preview', {method:'POST', headers:{origin, host:'ui.example', 'content-type':'application/json', 'sec-fetch-site':'same-origin'}, body:JSON.stringify(body)});
    req.nextUrl = new URL(req.url);
    return req;
  }
  return { route, calls, request };
}

test('route validates same-origin input and transfer eligibility, and uses current EDR', async () => {
  const mocked = routeMock();
  assert.equal((await mocked.route.POST(mocked.request({}, 'https://other.example'))).status, 403);
  assert.equal((await mocked.route.POST(mocked.request({transferProcessId:'transfer-1',url:'https://evil.example'}))).status, 400);
  const success = await mocked.route.POST(mocked.request());
  assert.equal(success.headers.get('cache-control'), 'no-store, private');
  const body = await success.json();
  assert.equal(body.addressSource, 'edr');
  assert.equal(mocked.calls[0].address.authorization, 'fresh-edr-token');
  assert.ok(!JSON.stringify(body).includes('token'));
  const inactive = routeMock({state:'TERMINATED'});
  assert.equal((await inactive.route.POST(inactive.request())).status, 409);
  assert.equal(inactive.calls.length, 0);
});

test('route reports unavailable EDR without using old transfer credentials', async () => {
  const fallback = routeMock({edrError:true});
  const response = await fallback.route.POST(fallback.request());
  assert.equal(response.status, 404);
  assert.equal(fallback.calls.length, 0);
  const missing = routeMock({edrError:true, transferAddress:false});
  assert.equal((await missing.route.POST(missing.request())).status, 404);
  assert.equal(missing.calls.length, 0);
});

test('raw JSON download preserves envelope, scalar roots and original bytes', () => {
  const { jsonDownload } = load('src/utilities/preview-download.ts');
  const body = '{ "result": {"records":[{"id":"001"}], "total":47415} }\n';
  assert.equal(jsonDownload(body, '../unsafe/name').body, body);
  assert.ok(!jsonDownload(body, '../unsafe/name').filename.includes('/'));
  assert.equal(jsonDownload('null', 'sample', true).filename, 'sample-saved-sample.json');
  assert.equal(jsonDownload('false', 'sample').body, 'false');
  assert.equal(jsonDownload('<html>Error</html>', 'sample'), undefined);
  const saved = fs.readFileSync(path.join(root, 'src/data/copenhagen-bicycle-parking.json'), 'utf8');
  assert.equal(JSON.parse(jsonDownload(saved, 'sample').body).result.records.length, 100);
  assert.equal(normal.parsePreview(saved, 'application/json').candidates[0].path, '/result/records');
});

test('catalogue metadata handles expanded and compact JSON-LD without fabricating methods', () => {
  const { catalogMetadata, matchesCatalogFilters } = load('src/utilities/catalog-metadata.ts');
  const item = catalogMetadata({'@id':'bike-1', 'dct:title':[{'@value':'Bikes'}], 'dcat:distribution':[{'dct:format':{'@id':'HttpData-PULL'}}]}, 'provider-1');
  assert.equal(item.title, 'Bikes');
  assert.equal(item.provider, 'provider-1');
  assert.equal(item.methods[0], 'HttpData-PULL');
  assert.equal(item.terms, '');
  assert.ok(matchesCatalogFilters(item, 'bike-1', 'HttpData-PULL'));
  assert.ok(!matchesCatalogFilters(item, 'bike-1', 'Kafka'));
  assert.equal(catalogMetadata({}).methods.length, 0);
});

test('portal filters operate only on saved offers and do not mutate source order', () => {
  const { filterPortalOffers } = load('src/utilities/portal-catalog.ts');
  const snapshot = JSON.parse(fs.readFileSync(path.join(root, 'src/data/portal-catalog-snapshot.json'), 'utf8'));
  const offers = snapshot.dataOffers;
  assert.equal(offers.length, snapshot.snapshotMetadata.totalAtCapture);
  assert.equal(new Set(offers.map(o => `${o.connectorId}:${o.assetId}`)).size, offers.length);
  assert.equal(filterPortalOffers(offers, '', '', '', 'source').length, offers.length);
  assert.equal(filterPortalOffers(offers, '', 'MDSLW30JNM', '', 'source').length, 7);
  assert.equal(filterPortalOffers(offers, 'mobilithek', 'MDSLTL4VU9', '', 'title').length, 1);
  assert.equal(filterPortalOffers(offers, 'zz-not-found', '', '', 'source').length, 0);
  const first = offers[0].assetId;
  filterPortalOffers(offers, '', '', '', 'title');
  assert.equal(offers[0].assetId, first);
});


test('saved portal offers are scored with the asset form rules from the metadata they carry', () => {
  const { assessPortalOffer } = load('src/domain/metadata-quality/portal-offer.ts');
  const snapshot = JSON.parse(fs.readFileSync(path.join(root, 'src/data/portal-catalog-snapshot.json'), 'utf8'));
  // 108-word description 19 + title 5 + version 2; no keywords or data category saved.
  const accident = snapshot.dataOffers.find(o => o.assetTitle === 'BMW Accident');
  assert.deepEqual([assessPortalOffer(accident).score, assessPortalOffer(accident).band], [26, 'Fair']);
  assert.ok(snapshot.dataOffers.every(o => { const { score } = assessPortalOffer(o); return Number.isInteger(score) && score >= 0 && score <= 100; }));

  const words = n => Array.from({ length: n }, (_, i) => `word${i}`).join(' ');
  const offer = { assetId: 'parking-berlin', assetTitle: 'Parking occupancy Berlin', descriptionShortText: '', keywords: [], version: '', dataCategory: '' };
  assert.equal(assessPortalOffer(offer).score, 5);
  // A title that is only the asset ID earns nothing; the category "Other" earns 1 point.
  assert.equal(assessPortalOffer({ ...offer, assetTitle: 'parking-berlin', dataCategory: 'OTHER' }).score, 1);
  // Saved line breaks are the two characters "\n"; read as line breaks, a structured description earns its bonus.
  assert.equal(assessPortalOffer({ ...offer, descriptionShortText: words(30) }).score, 5 + 14);
  assert.equal(assessPortalOffer({ ...offer, descriptionShortText: `## Overview\\n${words(30)}` }).score, 5 + 14 + 3);
});

test('demo scores show every band in the saved catalogue', () => {
  const { assessPortalOffer, DEMO_SCORES } = load('src/domain/metadata-quality/portal-offer.ts');
  const offers = JSON.parse(fs.readFileSync(path.join(root, 'src/data/portal-catalog-snapshot.json'), 'utf8')).dataOffers;
  const demo = offers.filter(o => `${o.connectorId}:${o.assetId}` in DEMO_SCORES);
  assert.equal(demo.length, Object.keys(DEMO_SCORES).length);
  assert.deepEqual(demo.map(o => [o.assetTitle, assessPortalOffer(o).score, assessPortalOffer(o).band]), [
    ['BMW SRTI feed for DFRS', 86, 'Excellent'],
    ['Mobito Anonymized Aggregated Vehicle Probe Data', 64, 'Good'],
    ['Korean flex parking usage transactions', 70, 'Good'],
  ]);
  assert.deepEqual([...new Set(offers.map(o => assessPortalOffer(o).band))].sort(), ['Basic', 'Excellent', 'Fair', 'Good']);
});

test('portal offers sort by metadata quality, highest first, keeping saved order for equal scores', () => {
  const { filterPortalOffers } = load('src/utilities/portal-catalog.ts');
  const { assessPortalOffer } = load('src/domain/metadata-quality/portal-offer.ts');
  const snapshot = JSON.parse(fs.readFileSync(path.join(root, 'src/data/portal-catalog-snapshot.json'), 'utf8'));
  const offers = snapshot.dataOffers;
  const first = offers[0].assetId;
  const sorted = filterPortalOffers(offers, '', '', '', 'quality');
  assert.equal(sorted.length, offers.length);
  assert.equal(offers[0].assetId, first);
  for (let i = 1; i < sorted.length; i++) {
    const [previous, current] = [assessPortalOffer(sorted[i - 1]).score, assessPortalOffer(sorted[i]).score];
    assert.ok(previous >= current);
    if (previous === current) assert.ok(offers.indexOf(sorted[i - 1]) < offers.indexOf(sorted[i]));
  }
  // Sorting applies after the filters.
  const bmw = filterPortalOffers(offers, '', 'MDSLW30JNM', '', 'quality');
  assert.equal(bmw.length, 7);
  assert.ok(bmw.every(o => o.organizationId === 'MDSLW30JNM'));
});

test('portal direct lookup accepts only the selected provider and asset', () => {
  const { resolvePortalDataset } = load('src/utilities/portal-catalog.ts');
  const offer = { connectorId: 'provider-a', assetId: 'asset-a' };
  const dataset = { id: 'asset-a' };
  assert.equal(resolvePortalDataset({participantId: 'provider-a', datasets: [dataset]}, offer).dataset, dataset);
  assert.ok(resolvePortalDataset({participantId: 'provider-b', datasets: [dataset]}, offer).error);
  assert.ok(resolvePortalDataset({datasets: [dataset]}, offer).error);
  assert.ok(resolvePortalDataset({participantId: 'provider-a', datasets: [{id:'asset-b'}]}, offer).error);
  assert.equal(resolvePortalDataset({'https://w3id.org/dspace/2025/1/participantId': [{'@id':'provider-a'}], datasets: [dataset]}, offer).dataset, dataset);
  const saved = JSON.parse(fs.readFileSync(path.join(root, 'src/data/portal-catalog-snapshot.json'), 'utf8'));
  assert.ok(saved.dataOffers.every(o => {
    const endpoint = new URL(o.connectorEndpoint);
    return endpoint.protocol === 'https:' && !endpoint.username && !endpoint.password && !endpoint.search;
  }));
});


test('preview resolves provider through linked negotiation when transfer omits it', async () => {
  const mocked = routeMock({ missingProvider: true });
  assert.equal((await mocked.route.POST(mocked.request())).status, 200);
  assert.equal(mocked.calls[0].counterparty, provider);
  assert.equal(mocked.calls[0].address.authorization, 'fresh-edr-token');
  const missing = routeMock({ missingProvider: true, missingNegotiationAddress: true });
  assert.equal((await missing.route.POST(missing.request())).status, 409);
  assert.equal(missing.calls.length, 0);
});


test('catalogue status matches provider and asset, prioritizes contracts and excludes retired or failed records', () => {
  const {buildCatalogStatuses, catalogStatusKey} = load('src/utilities/catalog-status.ts');
  const agreement = {'@id':'a',assetId:'x',providerId:'p',consumerId:'me'};
  const negotiation = {type:'CONSUMER',assetId:'x',counterPartyId:'p',state:'REQUESTED'};
  let result = buildCatalogStatuses([agreement],[negotiation],[],'me');
  assert.equal(result[catalogStatusKey('p','x')], 'contract');
  assert.equal(result[catalogStatusKey('other','x')], undefined);
  result = buildCatalogStatuses([agreement],[negotiation],[{agreementId:'a'}],'me');
  assert.equal(result[catalogStatusKey('p','x')], 'pending');
  for (const state of ['TERMINATED','TERMINATING','FINALIZED','ERROR','CANCELLED']) {
    assert.equal(Object.keys(buildCatalogStatuses([], [{...negotiation,state}], [], 'me')).length, 0);
  }
  assert.equal(Object.keys(buildCatalogStatuses([{...agreement,consumerId:'other'}],[],[],'me')).length,0);
});

test('map tab appears only for a geo block with points', () => {
  const { geoOf } = load('src/utilities/geo-map.ts');
  const geo = { points: [[55.67, 12.56, 0, 1]] };
  assert.equal(geoOf({ geo }), geo);
  assert.equal(geoOf({ geo: null }), null);
  assert.equal(geoOf({}), null);
  assert.equal(geoOf({ geo: { points: [] } }), null);
});

test('map markers grow with count and bounds keep the [lat, lon] order', () => {
  const { markerRadius, maxCountOf, leafletBounds, MARKER_RADIUS } = load('src/utilities/geo-map.ts');
  assert.equal(markerRadius(1, 1), MARKER_RADIUS.min);
  assert.equal(markerRadius(1, 400), MARKER_RADIUS.min);
  assert.equal(markerRadius(400, 400), MARKER_RADIUS.max);
  assert.ok(markerRadius(100, 400) > MARKER_RADIUS.min && markerRadius(100, 400) < MARKER_RADIUS.max);
  assert.equal(markerRadius(9999, 400), MARKER_RADIUS.max);
  assert.equal(maxCountOf({ points: [[0, 0, 0, 3], [0, 0, 1, 412], [0, 0, 2, 58]] }), 412);
  assert.equal(JSON.stringify(leafletBounds({ bounds: { min_lat: 27.6, max_lat: 27.7, min_lon: 85.2, max_lon: 85.4 } })), '[[27.6,85.2],[27.7,85.4]]');
});

test('saved Copenhagen sample carries a plottable geo block', () => {
  const sample = JSON.parse(fs.readFileSync(path.join(root, 'src/data/copenhagen-explore.json'), 'utf8'));
  const { geoOf } = load('src/utilities/geo-map.ts');
  const geo = geoOf(sample);
  assert.ok(geo);
  assert.equal(geo.points.length, geo.point_count);
  assert.equal(geo.sampled, false);
  for (const [lat, lon] of geo.points) {
    assert.ok(lat >= geo.bounds.min_lat && lat <= geo.bounds.max_lat && lon >= geo.bounds.min_lon && lon <= geo.bounds.max_lon);
    assert.ok(lat > 55 && lat < 56 && lon > 12 && lon < 13, 'Copenhagen, with latitude first');
  }
});

test('map tab labels the source columns and notes sampling', () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const translate = (key) => key;
  const mocks = {
    '@/i18n': { useTranslator: () => ({ translator: translate }), T: ({ string }) => string },
    'next/dynamic': () => () => null,
    '@/components/atoms/loading-spinner': { LoadingSpinner: () => null },
  };
  const { ExploreMapTab } = load('src/components/molecules/explore-map-tab.tsx', mocks);
  const base = { source: 'columns', lat_column: 'gps_lat', lon_column: 'gps_lng', points: [[1, 2, 0, 1]], cell_deg: null, bounds: { min_lat: 1, max_lat: 1, min_lon: 2, max_lon: 2 } };
  const small = renderToStaticMarkup(React.createElement(ExploreMapTab, { geo: { ...base, point_count: 100, total_valid: 100, sampled: false } }));
  assert.match(small, /<code>gps_lat<\/code> \/ <code>gps_lng<\/code>/);
  assert.match(small, />100 explorePreview.mapPoints</);
  assert.doesNotMatch(small, /explorePreview.mapSampled/);
  const big = renderToStaticMarkup(React.createElement(ExploreMapTab, { geo: { ...base, point_count: 5000, total_valid: 337020, sampled: true, cell_deg: 0.0021 } }));
  assert.match(big, /explorePreview.mapShowing 5,000 explorePreview.mapOf 337,020 explorePreview.mapPoints/);
  assert.match(big, /explorePreview.mapSampled/);
  const geojson = renderToStaticMarkup(React.createElement(ExploreMapTab, { geo: { ...base, source: 'geojson', lat_column: null, lon_column: null, point_count: 1, total_valid: 1, sampled: false } }));
  assert.match(geojson, /explorePreview.mapGeojson/);
});

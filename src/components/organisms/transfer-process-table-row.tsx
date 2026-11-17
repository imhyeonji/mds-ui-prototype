import { JsonLdDialog } from "@/components/molecules/JsonLdDialog";
import { useTransferProcessJsonLd } from "@/hooks/use-transfer-process-json-ld";
import { edcValue } from "@/utilities/data-preview-policy";
import AssetDialog from "@/components/organisms/asset-dialog.tsx";
import { DataPreviewDialog } from "@/components/organisms/data-preview-dialog";
import { T } from "@/i18n";
import { removeJsonLdSchemaFromProperties } from "@/utilities/catalog.ts";
import { formatDateTime, formatDateTimeAgo } from "@/utilities/date.ts";
import { Button, Chip, Dialog, DialogTitle, DialogContent, DialogActions } from "@mui/material";
import snapshot from "@/data/portal-catalog-snapshot.json";
import { catalogMetadata } from "@/utilities/catalog-metadata";
import { transferPresentation } from "@/utilities/transfer-presentation";
import {
  Asset,
  ContractAgreement,
  ContractNegotiation,
} from "@think-it-labs/edc-connector-client";
import { TransferProcess } from "@think-it-labs/edc-connector-client/dist/src/entities";
import { useEdcConnectorClient } from "@think-it-labs/edc-connector-ui/use-edc-connector";
import { readValue } from "@think-it-labs/edc-connector-ui/json-ld";
import { useEffect, useState } from "react";

interface AssetDetailsProps {
  transferProcess: TransferProcess;
  managementUrl: string;
  connectorEndpoint: string;
  participantId: string;
}

export default function TransferProcessTableRow({
  transferProcess,
  managementUrl,
  connectorEndpoint,
  participantId,
}: AssetDetailsProps) {
  const cleanedTransferProcess =
    removeJsonLdSchemaFromProperties(transferProcess);
  const stateTimestamp = readValue(cleanedTransferProcess, "stateTimestamp");
  const method = readValue(cleanedTransferProcess, "transferType") || "";
  const presentation = transferPresentation(transferProcess.state, transferProcess.type, method, !!transferProcess.errorDetail);
  const canPreviewData = presentation.canPreview;
  const edcClient = useEdcConnectorClient({ management: managementUrl });
  const [assetDialogIsOpen, setAssetDialogIsOpen] = useState(false);
  const [dataPreviewIsOpen, setDataPreviewIsOpen] = useState(false);
  const [transferProcessDialogIsOpen, setTransferProcessDialogIsOpen] =
    useState(false);
  const [contractNegotiation, setContractNegotiation] = useState(
    {} as ContractNegotiation,
  );
  const [contractAgreement, setContractAgreement] = useState(
    {} as ContractAgreement,
  );
  const [asset, setAsset] = useState({} as Asset);

  useEffect(() => {
    if (!transferProcess.contractId) {
      return;
    }

    edcClient.management.contractAgreements
      .getNegotiation(transferProcess.contractId)
      .then((negotiation) => {
        const cleanNegotiation = removeJsonLdSchemaFromProperties(negotiation);
        setContractNegotiation({
          ...negotiation,
          counterPartyId: readValue(cleanNegotiation, "counterPartyId"),
          counterPartyAddress: readValue(
            cleanNegotiation,
            "counterPartyAddress",
          ),
        } as unknown as ContractNegotiation);
      })
      .catch(() => setContractNegotiation({} as ContractNegotiation));

    edcClient.management.contractAgreements
      .get(transferProcess.contractId)
      .then(setContractAgreement)
      .catch(() => setContractAgreement({} as ContractAgreement));
  }, [edcClient, transferProcess.contractId]);

  useEffect(() => {
    if (!transferProcess.assetId) {
      return;
    }

    edcClient.management.assets
      .get(transferProcess.assetId)
      .then(setAsset)
      .catch(() => setAsset({} as Asset));
  }, [edcClient, transferProcess.assetId]);

  const providerId = contractAgreement.providerId || (transferProcess.type === "CONSUMER" ? contractNegotiation.counterPartyId : participantId);
  const matchedOffer = snapshot.dataOffers.find((offer) => offer.assetId === transferProcess.assetId && offer.connectorId === providerId);
  const title = catalogMetadata(asset).title || matchedOffer?.assetTitle || "Dataset name unavailable";
  const provider = matchedOffer?.organizationName || "Provider name unavailable";
  const updated = typeof stateTimestamp === "number" && Number.isFinite(stateTimestamp) && stateTimestamp > 0 ? stateTimestamp : undefined;
  const jsonLdObject = useTransferProcessJsonLd(transferProcess, contractNegotiation);
  const [rawDetailsOpen, setRawDetailsOpen] = useState(false);
  const [tokenVisible, setTokenVisible] = useState(false);
  const [copyMessage, setCopyMessage] = useState("");
  const address = edcValue(transferProcess, "dataDestination");
  const endpoint = edcValue(address, "endpoint");
  const token = edcValue(address, "authorization") ?? edcValue(address, "authCode");
  const copyValue = async (value: string) => {
    try { await navigator.clipboard.writeText(value); setCopyMessage("Copied"); }
    catch { setCopyMessage("Could not copy. Select and copy the value manually."); }
  };
  const technicalFields = [
    ["Transfer ID", transferProcess.id], ["Dataset ID", transferProcess.assetId],
    ["Contract ID", transferProcess.contractId], ["Provider ID", providerId],
    ["Consumer ID", contractAgreement.consumerId], ["Connector state", transferProcess.state],
    ["Transfer method", method], ["Direction", transferProcess.type],
    ["Provider Connector ID", contractNegotiation.counterPartyId],
    ["Provider Connector address", contractNegotiation.counterPartyAddress],
    ["Updated", updated ? formatDateTime(updated, { showSeconds: true }) : ""],
    ["Error details", transferProcess.errorDetail],
  ];

  return <>
    <AssetDialog asset={asset} participantId={participantId} connectorEndpoint={connectorEndpoint} open={assetDialogIsOpen} onClose={() => setAssetDialogIsOpen(false)} />
    <article className="transfer-process-row min-w-0 rounded-xl border border-gray-200 bg-white p-4" data-testid="transfer-process-row" data-asset-id={transferProcess.assetId}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1" style={{ flexBasis: 260 }}>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">{transferProcess.type === "CONSUMER" ? "Receiving data" : transferProcess.type === "PROVIDER" ? "Providing data" : "Data transfer"}</p>
          <h2 className="text-lg font-semibold text-gray-900 break-words">{title}</h2>
          <p className="mt-1 text-sm text-gray-600">{provider}</p>
          {!matchedOffer && !catalogMetadata(asset).title && <p className="mt-1 break-all text-xs text-gray-500">Dataset reference: {transferProcess.assetId}</p>}
        </div>
        <Chip label={presentation.label} color={presentation.tone} size="small" />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
          <span>{method === "HttpData-PULL" ? "HTTP Pull · retrieve on demand" : "Other transfer method"}</span>
          <p title={updated ? formatDateTime(updated, { showSeconds: true }) : undefined}>Updated {updated ? formatDateTimeAgo(updated) : "time unavailable"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="small" color="secondary" data-testid="show-transfer-process-details" onClick={() => setTransferProcessDialogIsOpen(true)}>Details</Button>
          {asset.id && <Button size="small" color="secondary" onClick={() => setAssetDialogIsOpen(true)}>Dataset info</Button>}
          <Button size="small" variant="contained" color="primary" disabled={!canPreviewData} data-testid="preview-transfer-data" onClick={() => setDataPreviewIsOpen(true)} sx={{ textTransform: "none", fontWeight: 600 }}><T string="dataPreview.action" /></Button>
        </div>
      </div>
    </article>
    <Dialog open={transferProcessDialogIsOpen} onClose={() => setTransferProcessDialogIsOpen(false)} fullWidth maxWidth="sm" data-testid="transfer-process-details-dialog" aria-labelledby={`transfer-title-${transferProcess.id}`}>
      <DialogTitle id={`transfer-title-${transferProcess.id}`}>{title}</DialogTitle>
      <DialogContent>
        <Chip label={presentation.label} color={presentation.tone} size="small" />
        <p className="my-4 text-sm leading-6 text-gray-600">{presentation.description}</p>
        <section className="mb-4 space-y-3 rounded-lg border border-gray-200 p-4">
          <h3 className="font-semibold">Data access</h3>
          <div><p className="text-sm text-gray-500">Data endpoint</p><p className="break-all font-mono text-xs">{typeof endpoint === "string" ? endpoint : "Not provided in this transfer"}</p>{typeof endpoint === "string" && <Button size="small" color="secondary" onClick={() => void copyValue(endpoint)}>Copy endpoint</Button>}</div>
          <div><p className="text-sm text-gray-500">Access token</p>{typeof token === "string" ? <><p className="max-h-32 overflow-auto break-all font-mono text-xs">{tokenVisible ? token : "••••••••"}</p><Button size="small" color="secondary" onClick={() => setTokenVisible(v => !v)}>{tokenVisible ? "Hide token" : "Show token"}</Button><Button size="small" color="secondary" onClick={() => void copyValue(token)}>Copy token</Button></> : <p className="text-xs">Not provided in this transfer</p>}</div>
          <p role="status" className="text-xs text-gray-500">{copyMessage}</p>
        </section>
        <details className="rounded-lg border border-gray-200 p-4">
          <summary className="cursor-pointer font-medium">Technical details</summary>
          <dl className="mt-4 space-y-4 text-sm">{technicalFields.map(([label, value]) => <div key={label}><dt className="font-medium text-gray-500">{label}</dt><dd className="mt-1 break-all font-mono text-xs">{value || "Not available"}</dd></div>)}</dl>
        </details>
      </DialogContent>
      <DialogActions><Button color="secondary" onClick={() => setRawDetailsOpen(true)}>Show full JSON</Button><Button color="secondary" onClick={() => { setTransferProcessDialogIsOpen(false); setTokenVisible(false); setCopyMessage(""); }}>Close</Button></DialogActions>
    </Dialog>
    {rawDetailsOpen && <JsonLdDialog title="Transfer — full JSON" isOpen onClose={() => setRawDetailsOpen(false)} jsonLdObject={jsonLdObject} />}
    {canPreviewData && dataPreviewIsOpen && <DataPreviewDialog title={title} assetId={transferProcess.assetId} transferProcessId={transferProcess.id} onClose={() => setDataPreviewIsOpen(false)} />}
  </>;
}

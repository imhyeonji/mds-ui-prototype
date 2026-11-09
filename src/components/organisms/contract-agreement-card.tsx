import { proxyConnectorManagement } from "@/constants/proxy";
import { useParticipantConnectorState } from "@/hooks/use-participant-connector-state";
import { T } from "@/i18n";
import { EnrichedContractAgreement } from "@/types/enriched-contract-agreement";
import { formatDateTimeAgo } from "@/utilities/date.ts";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import FileDownloadOffIcon from "@mui/icons-material/FileDownloadOff";
import FileUploadIcon from "@mui/icons-material/FileUpload";
import FileUploadOffIcon from "@mui/icons-material/FileUploadOff";
import { Card, CardActionArea, CardContent, Chip, LinearProgress, Skeleton } from "@mui/material";
import { ContractAgreement } from "@think-it-labs/edc-connector-client";
import { ContractAgreementView } from "@think-it-labs/edc-connector-ui/contract-agreement-view";

export interface ContractAgreementCard {
  contractAgreement: ContractAgreement;
  onClick: () => void;
}

const contractIcons = {
  terminated: {
    consumer: FileDownloadOffIcon,
    provider: FileUploadOffIcon,
  },
  active: {
    consumer: FileDownloadIcon,
    provider: FileUploadIcon,
  },
} as const;

export default function ContractAgreementCard({
  contractAgreement: _contractAgreement,
  onClick,
}: ContractAgreementCard) {
  const { connector } = useParticipantConnectorState();
  const contractAgreement = Object.assign(
    new EnrichedContractAgreement(),
    _contractAgreement,
  );
  const assetTitle = contractAgreement.assetTitle || contractAgreement.assetId;

  const isConsumer = contractAgreement.consumerId === connector.id;
  const Icon =
    contractIcons[contractAgreement.isTerminated ? "terminated" : "active"][
    isConsumer ? "consumer" : "provider"
    ];

  return (
    <ContractAgreementView
      id={contractAgreement.id}
      managementUrl={proxyConnectorManagement}
    >
      <ContractAgreementView.Loading
        fallback={<Card variant="outlined" className="contract-agreement-card w-full" sx={{ borderRadius: 3 }}><CardContent className="!p-4"><Skeleton width="55%" height={28} /><Skeleton width="80%" /><Skeleton width="65%" /></CardContent></Card>}
      >
        <Card variant="outlined" className="contract-agreement-card w-full min-w-0" sx={{ borderRadius: 3 }}>
          <CardActionArea onClick={onClick} aria-label={`View agreement: ${assetTitle}`}>
            <CardContent className="space-y-3 !p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100">
                  <Icon fontSize="small" color={contractAgreement.isTerminated ? "error" : "inherit"} />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 data-testid="asset-id" className="break-words text-lg font-semibold leading-6 text-gray-900">{assetTitle}</h2>
                  <p className="mt-1 break-all text-xs text-gray-500"><ContractAgreementView.ProviderId /></p>
                </div>
                <Chip size="small" label={<T string={`contractAgreements.[id].status${contractAgreement.isTerminated ? "Terminated" : "Active"}`} />} sx={{ flexShrink: 0, fontWeight: 600, bgcolor: contractAgreement.isTerminated ? "#fee2e2" : "#dcfce7", color: contractAgreement.isTerminated ? "#991b1b" : "#166534" }} />
              </div>
              {contractAgreement.isRunning && <LinearProgress />}
              <dl className="grid gap-x-6 gap-y-2 text-xs sm:grid-cols-2">
                <div className="min-w-0"><dt className="text-gray-500"><T string="contractAgreements.headingId" /></dt><dd className="mt-0.5 break-all text-gray-700"><ContractAgreementView.Id /></dd></div>
                <div className="min-w-0"><dt className="text-gray-500"><T string="contractAgreements.headingConsumer" /> → <T string="contractAgreements.headingProvider" /></dt><dd className="mt-0.5 break-words text-gray-700"><ContractAgreementView.ConsumerId /> → <ContractAgreementView.ProviderId /></dd></div>
              </dl>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-gray-100 pt-2 text-xs text-gray-600">
                <span><T string="contractAgreements.signed" /> · {formatDateTimeAgo(contractAgreement.contractSigningDate * 1000)}</span>
                <span><T string="contractAgreements.transfers" /> · <strong>{contractAgreement.transferCount}</strong></span>
                <span className="ml-auto font-medium text-gray-900">View details →</span>
              </div>
            </CardContent>
          </CardActionArea>
        </Card>
      </ContractAgreementView.Loading>
    </ContractAgreementView>
  );
}

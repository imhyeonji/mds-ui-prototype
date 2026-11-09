import PaginationControls from "@/components/molecules/pagination-controls";
import SearchBar from "@/components/molecules/search-bar";
import SideDrawer from "@/components/organisms/side-drawer";
import TransferProcessTableRow from "@/components/organisms/transfer-process-table-row.tsx";
import { useParticipantConnectorState } from "@/hooks/use-participant-connector-state";
import { T, useTranslator } from "@/i18n";
import { TransferProcessesList } from "@think-it-labs/edc-connector-ui/transfer-processes-list";
import { useRouter } from "next/router";
import { useCallback, useState } from "react";
import { Alert, Button } from "@mui/material";
import { DataPreviewDialog } from "@/components/organisms/data-preview-dialog";
import { MAX_ITEMS } from "../../constants/lists";
import { proxyConnectorManagement } from "@/constants/proxy";
import { useListContext } from "@think-it-labs/edc-connector-ui/list";

function TransferEmptyState() {
  const { errors, isLoading } = useListContext();
  if (isLoading || errors?.length) return <></>;
  return <p className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-gray-500">No transfers found. Try another dataset ID or start a transfer from an existing agreement.</p>;
}

export default function TransferProcessesListPage() {
  const router = useRouter();
  const { connector } = useParticipantConnectorState();
  const { translator } = useTranslator();
  const [sampleOpen, setSampleOpen] = useState(false);

  const currentPage = parseInt(router.query.page as string) || 0;

  const navigate = useCallback(
    (newPage: number) => {
      router.push({
        href: window.location.href,
        query: {
          ...router.query,
          page: newPage,
        },
      });
    },
    [router],
  );

  return (
    <SideDrawer title="Data transfers">
      <div className="mb-6"><h1 className="text-2xl font-semibold text-gray-900">Your data transfers</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">See which datasets are ready to retrieve, check progress, and open a preview. Technical references are available in Details.</p></div>
      <div className="mb-4 flex flex-wrap justify-end gap-2">
        <Button color="secondary" onClick={() => window.dispatchEvent(new Event("transfer-processes-list-refetch"))}>Refresh transfers</Button>
        <Button color="secondary" variant="outlined" onClick={() => setSampleOpen(true)}><T string="dataPreview.openSample" /></Button>
      </div>
      {sampleOpen && <DataPreviewDialog saved assetId="counts,-bicycle-parking-1.1" transferProcessId="" onClose={() => setSampleOpen(false)} />}
      <TransferProcessesList
        managementUrl={proxyConnectorManagement}
        usePagination
        navigate={navigate}
        currentPage={currentPage}
        firstPage={0}
      >
        <TransferProcessesList.Error>
          {({ errors }) => errors?.length ? <Alert severity="error" className="mb-4" action={<Button color="inherit" onClick={() => router.reload()}>Retry</Button>}>
            Could not load transfers from the connector. Check that the existing connector is running, then retry. The saved sample is available separately.
          </Alert> : <></>}
        </TransferProcessesList.Error>
        <div className="flex flex-wrap items-center justify-between gap-4 pb-6">
          <div className="min-w-0 flex-1">
            <div className="w-full max-w-xl">
              <SearchBar
                searchTarget="assetId"
                placeholder={translator("transferProcesses.searchPlaceholder")}
                searchOperator="ilike"
              />
            </div>
          </div>
          <div className="flex justify-end items-center">
            <TransferProcessesList.Pagination>
              {({
                decrementPage,
                hasPrev,
                hasNext,
                incrementPage,
                page,
                itemsCount,
              }) => (
                <PaginationControls
                  page={page}
                  hasPrev={hasPrev}
                  hasNext={hasNext}
                  decrementPage={decrementPage}
                  incrementPage={incrementPage}
                  maxItems={MAX_ITEMS}
                  dataTestIdPrefix="pagination"
                  itemsCount={itemsCount}
                />
              )}
            </TransferProcessesList.Pagination>
          </div>
        </div>

        <div className="space-y-4" data-testid="transfer-processes-list">
              <TransferProcessesList.Items
                emptyMessage={<TransferEmptyState />}
                limit={MAX_ITEMS}
                sortOrder="DESC"
                sortField="stateTimestamp"
              >
                {({ item }) => (
                  <TransferProcessTableRow
                    key={item.id}
                    transferProcess={item}
                    managementUrl={proxyConnectorManagement}
                    connectorEndpoint={connector.protocolUrl}
                    participantId={connector.id}
                    data-testid="transfer-process-row"
                  />
                )}
              </TransferProcessesList.Items>
        </div>

        <TransferProcessesList.Loading>
          <div className="max-w-20 mx-auto mt-4 flex flex-col bg-white border shadow-sm rounded-xl p-4 md:p-5">
            <span
              className="animate-spin mx-auto inline-block size-8 border-[3px] border-current border-t-transparent text-blue-600 rounded-full"
              role="status"
              aria-label="loading"
            >
              <span className="sr-only">Loading...</span>
            </span>
          </div>
        </TransferProcessesList.Loading>
      </TransferProcessesList>
    </SideDrawer>
  );
}

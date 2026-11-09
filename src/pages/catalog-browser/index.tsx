import { Input } from "@/components/atoms/input";
import { CounterPartyAddressDialog } from "@/components/molecules/counter-party-address-dialog";
import PaginationControls from "@/components/molecules/pagination-controls";
import SearchBar from "@/components/molecules/search-bar";
import { CatalogResults } from "@/components/organisms/catalog-results";
import { PortalCatalog } from "@/components/organisms/portal-catalog";
import DataOfferDialog from "@/components/organisms/data-offer-dialog";
import SideDrawer from "@/components/organisms/side-drawer";
import { proxyConnectorManagement } from "@/constants/proxy";
import { useDebounce } from "@/hooks/use-debounce";
import { useParticipantConnectorState } from "@/hooks/use-participant-connector-state";
import { useSessionState } from "@/hooks/use-session-state";
import { useUpdateQueryParams } from "@/hooks/use-update-query-params";
import { T, useTranslator } from "@/i18n";
import { Icon, IconButton, Tooltip, Typography, Tabs, Tab } from "@mui/material";
import {
  Dataset,
  EdcConnectorClientError,
  EdcConnectorClientErrorType,
} from "@think-it-labs/edc-connector-client";
import { ContractOffersList } from "@think-it-labs/edc-connector-ui/contract-offers-list";
import { useEdcConnectorClient } from "@think-it-labs/edc-connector-ui/use-edc-connector";
import { useRouter } from "next/router";

import { useCallback, useEffect, useState } from "react";
import { MAX_ITEMS } from "../../constants/lists";
import { counterPartyAddressWithDsp2025_1 } from "@/utilities/catalog";
import { useAppSnackbar } from "@/hooks/use-app-snackbar";

export default function CatalogPage() {
  const { connector } = useParticipantConnectorState();
  const { translator } = useTranslator();
  const { query } = useRouter();
  const updateQueryParams = useUpdateQueryParams();
  const [hasBadUrlError, setHasBadUrlError] = useState(false);
  const [catalogMode, setCatalogMode] = useState("browse");

  const [listKey, setListKey] = useState(1);
  const [isDataOfferDialogOpen, setIsDataOfferDialogOpen] = useState(false);
  const [isCounterPartyAddressDialogOpen, setIsCounterPartyAddressDialogOpen] =
    useState(false);

  const { showSnackbar } = useAppSnackbar();
  const [counterPartyAddress, setCounterPartyAddress] = useSessionState(
    "counterPartyAddress",
    "",
  );
  const [counterPartyAddressToSearch, setCounterPartyAddressToSearch] =
    useState(counterPartyAddress);

  useEffect(() => {
    setCounterPartyAddressToSearch(counterPartyAddress);
  }, [counterPartyAddress]);

  const { debounce: debouncedSetCounterPartyAddress } = useDebounce((url) => {
    updateQueryParams({ page: String(0) });
    setCounterPartyAddress(url);
    setHasBadUrlError(false);
  }, 1_200);

  useEffect(() => {
    const handleBeforeUnload = () => {
      sessionStorage.removeItem("counterPartyAddress");
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  const [catalogParticipantId, setCatalogParticipantId] = useState("");
  const [datasetToNegotiate, setDatasetToNegotiate] = useState<Dataset>(
    {} as Dataset,
  );

  // Temporarily dummy counterparty ID
  const DUMMY_COUNTERPARTY_ID = "MDS_ID";

  const client = useEdcConnectorClient({
    management: proxyConnectorManagement,
  });

  useEffect(() => {
    let active = true;
    setCatalogParticipantId("");
    async function showCatalog(counterPartyAddress: string) {
      try {
        const catalog = await client.management.catalog.request({
          counterPartyId: DUMMY_COUNTERPARTY_ID,
          counterPartyAddress:
            counterPartyAddressWithDsp2025_1(counterPartyAddress),
        });
        if (!active) return;
        const identity = catalog["https://w3id.org/dspace/2025/1/participantId"]?.[0]?.["@id"];
        setCatalogParticipantId(typeof identity === "string" ? identity : "");
        setHasBadUrlError(false);
      } catch (error) {
        if (!active) return;
        const connectorError = error as EdcConnectorClientError;

        if (connectorError.type === EdcConnectorClientErrorType.BadGateway) {
          setHasBadUrlError(true);
        }

        const message = translator("common.catalogLoadError");
        showSnackbar({
          type: "error",
          message,
          persist: true,
        });
      }
    }

    if (counterPartyAddress) {
      showCatalog(counterPartyAddress);
    }
    return () => { active = false; };
  }, [counterPartyAddress, client, translator, showSnackbar]);

  const openDataOfferDialog = (dataset: Dataset) => {
    setIsDataOfferDialogOpen(true);
    setDatasetToNegotiate(dataset);
  };

  const navigateToPage = useCallback(
    (newPage: number) => {
      updateQueryParams({ page: String(newPage) });
    },
    [updateQueryParams],
  );

  return (
    <>
      <DataOfferDialog
        open={isDataOfferDialogOpen}
        dataset={datasetToNegotiate}
        participantId={catalogParticipantId}
        counterPartyAddress={counterPartyAddressWithDsp2025_1(
          counterPartyAddress,
        )}
        assetIsOwned={counterPartyAddress === connector.protocolUrl}
        onClose={() => setIsDataOfferDialogOpen(false)}
        contentStyle={{ maxWidth: "90vw", width: "1000px" }}
        onNegotiateSuccess={() => setListKey((key) => key + 1)}
      />

      <CounterPartyAddressDialog
        open={isCounterPartyAddressDialogOpen}
        onClose={() => setIsCounterPartyAddressDialogOpen(false)}
        content={counterPartyAddress}
      />

      <SideDrawer title={<T string="catalog.title" />}>
        <Tabs value={catalogMode} onChange={(_, value: string) => setCatalogMode(value)} textColor="secondary" indicatorColor="secondary" aria-label="Catalogue source" sx={{ mb: 4, borderBottom: "1px solid #e5e7eb" }}>
          <Tab value="browse" label="Browse datasets" />
          <Tab value="connector" label="Connector catalogue" />
        </Tabs>
        {catalogMode === "browse" ? <PortalCatalog /> : <div className="min-h-[70vh] space-y-5">
          <p className="max-w-3xl text-sm leading-6 text-gray-500"><T string="catalog.browseIntro" /></p>
          <ContractOffersList
            managementUrl={proxyConnectorManagement}
            counterPartyAddress={counterPartyAddressWithDsp2025_1(
              counterPartyAddress,
            )}
            counterPartyId={DUMMY_COUNTERPARTY_ID}
            usePagination
            navigate={navigateToPage}
            currentPage={parseInt(query.page as string) || 0}
            firstPage={0}
            shouldFetch={!!counterPartyAddress}
          >
            <div className="w-full grid grid-cols-1 gap-4 py-4 items-end xl:grid-cols-5">
              <div className="xl:col-span-2">
                <Input
                  id="catalog-url"
                  fullWidth
                  data-testid="catalog-url"
                  type="text"
                  label={<T string="catalog.connectorEndpoints" />}
                  placeholder="https://other-connector.com/api/dsp"
                  value={counterPartyAddressToSearch || null}
                  slotProps={{
                    inputLabel: {
                      shrink: true,
                    },
                    input: {
                      classes: { root: "flex-grow" },
                      startAdornment: <Icon className="mr-2">link</Icon>,
                      endAdornment: hasBadUrlError ? (
                        <Icon color="error">warning</Icon>
                      ) : (
                        <Tooltip title={translator("catalog.clickForDetails")}>
                          <IconButton
                            onClick={() =>
                              setIsCounterPartyAddressDialogOpen(true)
                            }
                          >
                            <Icon color="primary">info</Icon>
                          </IconButton>
                        </Tooltip>
                      ),
                    },
                  }}
                  onChange={(event) => {
                    setCounterPartyAddressToSearch(event.target.value);
                    debouncedSetCounterPartyAddress(event.target.value);
                  }}
                />
              </div>
              <div className="xl:col-span-2">
                <SearchBar
                  searchTarget="http://purl.org/dc/terms/title"
                  placeholder={translator("catalog.searchPlaceholder")}
                  searchOperator="ilike"
                />
              </div>
              <div className="xl:justify-self-end">
                <ContractOffersList.Pagination>
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
                      itemsCount={itemsCount}
                    />
                  )}
                </ContractOffersList.Pagination>
              </div>
            </div>

            {counterPartyAddress ? (
              <CatalogResults key={`${counterPartyAddress}-${query.page || 0}-${listKey}`} participantId={catalogParticipantId} onSelect={openDataOfferDialog} />
            ) : (
              <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-6 py-16 text-center">
                <Typography color="textSecondary"><T string="catalog.emptyCounterPartyUrl" /></Typography>
              </div>
            )}
          </ContractOffersList>
        </div>}
      </SideDrawer>
    </>
  );
}

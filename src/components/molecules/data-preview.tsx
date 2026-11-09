import { LoadingSpinner } from "@/components/atoms/loading-spinner";
import { T } from "@/i18n";
import { Alert } from "@mui/material";
import dynamic from "next/dynamic";

const ReactJson = dynamic(() => import("react-json-view"), {
  ssr: false,
  loading: () => <LoadingSpinner />,
});

// Display-only provider response; retrieval remains on the server.
// Endpoint and authentication information do not belong in the preview payload.
export interface DataPreviewResponse {
  status: number;
  statusText: string;
  contentType: string;
  body: string;
}

export type DataPreviewState =
  | { kind: "loading" }
  | { kind: "response"; response: DataPreviewResponse }
  | { kind: "error"; message: string; response?: DataPreviewResponse };

function ResponseBody({ response }: { response: DataPreviewResponse }) {
  if (!response.body.trim()) {
    return <Alert severity="info"><T string="dataPreview.empty" /></Alert>;
  }

  const mimeType = response.contentType.split(";")[0].trim().toLowerCase();
  let invalidJson = false;
  let value: unknown;
  if (mimeType === "application/json" || mimeType.endsWith("+json")) {
    try {
      value = JSON.parse(response.body);
    } catch {
      invalidJson = true;
    }
  }

  if (value !== null && typeof value === "object") {
    return (
      <ReactJson
        src={value}
        name={false}
        collapsed={response.body.length > 100000 ? true : 2}
        displayDataTypes={false}
        enableClipboard={false}
      />
    );
  }

  return (
    <>
      {invalidJson && (
        <Alert severity="warning"><T string="dataPreview.invalidJson" /></Alert>
      )}
      <pre className="text-sm whitespace-pre-wrap break-words font-mono">
        {response.body}
      </pre>
    </>
  );
}

export function DataPreview({ state }: { state: DataPreviewState }) {
  if (state.kind === "loading") {
    return (
      <div className="py-8 text-center" aria-live="polite" aria-busy="true">
        <LoadingSpinner />
        <p className="mt-4"><T string="dataPreview.loading" /></p>
      </div>
    );
  }

  const response = state.response;
  const httpError = response && (response.status < 200 || response.status >= 300);

  return (
    <div className="space-y-4" aria-live="polite">
      {response && (
        <dl className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
          <div>
            <dt className="font-semibold"><T string="dataPreview.httpStatus" /></dt>
            <dd>{response.status} {response.statusText}</dd>
          </div>
          <div>
            <dt className="font-semibold">Content-Type</dt>
            <dd>{response.contentType || <T string="dataPreview.notProvided" />}</dd>
          </div>
        </dl>
      )}
      {(state.kind === "error" || httpError) && (
        <Alert severity="error">
          {state.kind === "error" ? state.message : <T string="dataPreview.requestFailed" />}
        </Alert>
      )}
      {response && (
        <div className="max-h-[50vh] overflow-auto rounded-lg border border-gray-200 bg-white p-4">
          <ResponseBody response={response} />
        </div>
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";

import { useTheme } from "@mui/material";

import { assessMetadataQuality, type ScoreItem } from "@/domain/metadata-quality/assessment";
import {
  type AssetFormView,
  followSuggestion,
  initialAssetFormView,
  isReadyForInput,
  SCORE_ITEM_FIELDS,
  toggleAdvancedFields,
} from "@/domain/metadata-quality/form-guidance";
import type { AssetProperties } from "@/utilities/asset";

const FOCUSABLE = "input:not([type=hidden]), textarea, [role=combobox]";
const HIGHLIGHT_DURATION_MS = 2500;

type HighlightColors = { fill: string; edge: string };

// A ring around the field that fades out, so the provider sees where a suggestion took them: a focused button
// shows no focus ring after a mouse click. The ring has a dark edge, as a light theme colour alone (the MDS
// yellow) hardly shows on the light page.
const highlight = (area: HTMLElement, { fill, edge }: HighlightColors) => {
  const ring = (fillColor: string, edgeColor: string) => ({
    outline: `4px solid ${fillColor}`,
    outlineOffset: "0px",
    boxShadow: `0 0 0 6px ${edgeColor}`,
  });
  area.animate?.([ring(fill, edge), { ...ring(fill, edge), offset: 0.6 }, ring("transparent", "transparent")], {
    duration: HIGHLIGHT_DURATION_MS,
    easing: "ease-out",
  });
};

// Scrolls to a field, puts the cursor in it and highlights it. List fields carry their id only on their
// label (for=…) and selects put it on their label as well as on the select, so a label stands for its container.
const focusField = (elementId: string, highlightColors: HighlightColors) => {
  const byId = document.getElementById(elementId);
  const element =
    byId && byId.tagName !== "LABEL"
      ? byId
      : (byId ?? document.querySelector(`label[for="${elementId}"]`))?.parentElement;
  if (!element) return;
  element.scrollIntoView({ behavior: "smooth", block: "center" });
  const target = element.matches(FOCUSABLE)
    ? element
    : (element.querySelector<HTMLElement>(FOCUSABLE) ??
      Array.from(element.querySelectorAll<HTMLElement>("button")).find((button) => !button.closest("label")));
  target?.focus({ preventScroll: true });
  // The input box for text fields and selects, the whole field for lists
  highlight(target?.closest<HTMLElement>(".MuiInputBase-root") ?? element, highlightColors);
};

// The live metadata quality of the asset being described on the create-data-offer and edit-asset pages,
// whether the form shows its advanced fields, and following a suggestion to the field it is about.
export function useMetadataQualityGuidance(properties: AssetProperties) {
  const { palette } = useTheme();
  const highlightFill = palette.primary.main;
  const highlightEdge = palette.secondary.main;
  const [view, setView] = useState<AssetFormView>(initialAssetFormView);
  const quality = useMemo(() => assessMetadataQuality(properties), [properties]);

  useEffect(() => {
    const item = view.focusedItem;
    if (item && isReadyForInput(view, item)) {
      focusField(SCORE_ITEM_FIELDS[item].elementId, { fill: highlightFill, edge: highlightEdge });
    }
  }, [view, highlightFill, highlightEdge]);

  return {
    quality,
    showAdvancedFields: view.showAdvancedFields,
    onToggleAdvancedFields: () => setView(toggleAdvancedFields),
    onFollowSuggestion: (item: ScoreItem) => setView((current) => followSuggestion(current, item)),
  };
}

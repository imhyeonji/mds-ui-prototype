import React from "react";

import { Box, Button, ButtonBase, CircularProgress, Fade, Paper } from "@mui/material";

import { formatPoints } from "@/components/organisms/metadata-quality-panel";
import type { MetadataQuality, ScoreItem } from "@/domain/metadata-quality/assessment";
import { useTranslator } from "@/i18n";

interface MetadataQualityIndicatorProps {
  quality: MetadataQuality;
  /** Shown once the provider has scrolled past the score in the panel. */
  visible: boolean;
  onShowPanel: () => void;
  onFollowSuggestion: (item: ScoreItem) => void;
}

// The theme squares every button with an inline style (the MDS look); the rounded pill overrides it inline too.
const ROUND = { borderRadius: 999 };
const RING_SIZE = 30;

const ScoreRing = ({ score }: { score: number }) => (
  <Box component="span" aria-hidden sx={{ position: "relative", display: "inline-flex", width: RING_SIZE, height: RING_SIZE }}>
    <CircularProgress
      variant="determinate"
      value={100}
      size={RING_SIZE}
      thickness={4}
      sx={{ color: "rgba(255,255,255,0.2)", position: "absolute" }}
    />
    <CircularProgress
      variant="determinate"
      value={score}
      size={RING_SIZE}
      thickness={4}
      sx={{ color: "primary.main", position: "absolute" }}
    />
  </Box>
);

// A compact copy of the score that stays at the bottom of the screen once the provider has scrolled past the
// panel: a black pill with the score and its ring in the theme colour, which brings back the full panel, and
// the suggestion worth the most points.
export function MetadataQualityIndicator({
  quality,
  visible,
  onShowPanel,
  onFollowSuggestion,
}: MetadataQualityIndicatorProps): React.ReactElement {
  const { translator } = useTranslator();
  const t = (key: string, values?: Record<string, string>) => translator(`assets.metadataQuality.${key}`, values);
  const score = String(quality.score);
  const band = t(`bands.${quality.band}`);
  const [topSuggestion] = quality.suggestions;

  return (
    <Fade in={visible} unmountOnExit>
      <Paper
        component="aside"
        aria-label={t("title")}
        data-testid="metadata-quality-indicator"
        elevation={8}
        className="mb-4 flex items-center gap-1 p-1"
        sx={{ borderRadius: 999, bgcolor: "secondary.main", color: "common.white" }}
      >
        <ButtonBase
          onClick={onShowPanel}
          aria-label={t("indicator.showPanel", { score, band })}
          style={ROUND}
          sx={{ gap: 1, py: 0.5, pl: 0.5, pr: 1.5 }}
        >
          <ScoreRing score={quality.score} />
          <span className="whitespace-nowrap text-sm">
            <Box component="b" sx={{ color: "primary.main" }}>
              {score}
            </Box>
            <span className="opacity-70">/100 · {band}</span>
          </span>
        </ButtonBase>
        {topSuggestion && (
          <Button
            size="small"
            data-testid="metadata-quality-indicator-suggestion"
            data-item={topSuggestion.item}
            data-action={topSuggestion.action}
            onClick={() => onFollowSuggestion(topSuggestion.item)}
            style={ROUND}
            sx={{ color: "primary.main", whiteSpace: "nowrap", px: 1.5 }}
          >
            {t(`suggestion.${topSuggestion.action}`, { item: t(`items.${topSuggestion.item}`) })}
            <b className="ml-2">{t("points", { points: formatPoints(topSuggestion.points) })}</b>
            <span className="ml-1" aria-hidden>
              →
            </span>
          </Button>
        )}
      </Paper>
    </Fade>
  );
}

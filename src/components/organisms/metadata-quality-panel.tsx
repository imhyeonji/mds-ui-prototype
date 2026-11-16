import React from "react";

import { Button, LinearProgress, Typography } from "@mui/material";

import {
  itemsToFix,
  type MetadataQuality,
  type MetadataQualityBand,
  type ScoreItem,
} from "@/domain/metadata-quality/assessment";
import { useTranslator } from "@/i18n";

/** The colour of each band, from the MDS red to the MDS green. */
export const BAND_COLORS: Record<MetadataQualityBand, string> = {
  Basic: "error.main",
  Fair: "warning.main",
  // Amber: the MDS yellow hardly shows on the light track of a progress bar
  Good: "#F4B400",
  Excellent: "success.main",
};

interface MetadataQualityPanelProps {
  quality: MetadataQuality;
  onFollowSuggestion: (item: ScoreItem) => void;
  /** The row with the title and the score, to tell whether the score is on screen. */
  headlineRef?: React.Ref<HTMLDivElement>;
}

export const formatPoints = (points: number) => (Number.isInteger(points) ? String(points) : points.toFixed(1));

// The live metadata quality score of the offer being described, what would raise it most, and the
// values that earn nothing as entered. It informs the provider; it never blocks publishing.
export function MetadataQualityPanel({ quality, onFollowSuggestion, headlineRef }: MetadataQualityPanelProps): React.ReactElement {
  const { translator } = useTranslator();
  const t = (key: string, values?: Record<string, string>) => translator(`assets.metadataQuality.${key}`, values);
  const toFix = itemsToFix(quality);

  return (
    <section
      aria-labelledby="metadata-quality-title"
      data-testid="metadata-quality-panel"
      className="flex flex-col gap-3 rounded border border-gray-300 p-4"
    >
      <div ref={headlineRef} className="flex flex-wrap items-baseline justify-between gap-2">
        <Typography id="metadata-quality-title" variant="h6" component="h2">
          {t("title")}
        </Typography>
        <Typography variant="h6" component="p" aria-live="polite">
          <span data-testid="metadata-quality-score">{t("score", { score: String(quality.score) })}</span>
          {" · "}
          <span data-testid="metadata-quality-band">{t(`bands.${quality.band}`)}</span>
        </Typography>
      </div>
      {/* In the band's colour on a light grey track; the colour fades over when the band changes */}
      <LinearProgress
        variant="determinate"
        value={quality.score}
        aria-label={t("title")}
        sx={{
          height: 8,
          borderRadius: 4,
          bgcolor: "grey.200",
          "& .MuiLinearProgress-bar": {
            borderRadius: 4,
            bgcolor: BAND_COLORS[quality.band],
            transition: "transform .4s linear, background-color .4s",
          },
        }}
      />
      <Typography variant="body2" color="textSecondary">
        {t("description")}
      </Typography>

      <div>
        <Typography variant="subtitle2" component="h3">
          {t("suggestionsTitle")}
        </Typography>
        {quality.suggestions.length === 0 ? (
          <Typography variant="body2" data-testid="metadata-quality-no-suggestions">
            {t("noSuggestions")}
          </Typography>
        ) : (
          <ol className="mt-1 flex flex-wrap gap-2">
            {quality.suggestions.map(({ action, item, points }) => (
              <li key={item}>
                <Button
                  size="small"
                  variant="outlined"
                  color="secondary"
                  data-testid="metadata-quality-suggestion"
                  data-item={item}
                  data-action={action}
                  onClick={() => onFollowSuggestion(item)}
                >
                  {t(`suggestion.${action}`, { item: t(`items.${item}`) })}
                  <span className="ml-2 font-semibold">{t("points", { points: formatPoints(points) })}</span>
                </Button>
              </li>
            ))}
          </ol>
        )}
      </div>

      {toFix.length > 0 && (
        <div>
          <Typography variant="subtitle2" component="h3">
            {t("notCountedTitle")}
          </Typography>
          <ul className="mt-1 list-disc pl-5">
            {toFix.map(({ item, reason }) => (
              <li key={item} data-testid="metadata-quality-reason" data-item={item} data-reason={reason}>
                <Typography variant="body2" component="span">
                  {t(`reasons.${reason}`, { item: t(`fieldNames.${item}`) })}
                </Typography>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

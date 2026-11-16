import React, { useRef } from "react";

import { MetadataQualityIndicator } from "@/components/organisms/metadata-quality-indicator";
import { MetadataQualityPanel } from "@/components/organisms/metadata-quality-panel";
import type { MetadataQuality, ScoreItem } from "@/domain/metadata-quality/assessment";
import { useScrolledPast } from "@/hooks/use-scrolled-past";

// The app bar (side drawer toolbar) is fixed at the top and 64px high: the score behind it is out of sight.
const APP_BAR_HEIGHT = 64;

interface AssetFormMetadataQualityProps {
  quality: MetadataQuality;
  onFollowSuggestion: (item: ScoreItem) => void;
}

// The metadata quality panel above the asset form on the create-data-offer and edit-asset pages, and the compact
// copy of the score that stays at the bottom of the screen once the provider has scrolled past it.
export function AssetFormMetadataQuality({ quality, onFollowSuggestion }: AssetFormMetadataQualityProps): React.ReactElement {
  const panelRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLDivElement>(null);
  const scrolledPastScore = useScrolledPast(headlineRef, APP_BAR_HEIGHT);

  const showPanel = () => {
    panelRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    panelRef.current?.focus({ preventScroll: true });
  };

  return (
    <>
      <div ref={panelRef} tabIndex={-1}>
        <MetadataQualityPanel quality={quality} headlineRef={headlineRef} onFollowSuggestion={onFollowSuggestion} />
      </div>

      {/* Fixed to the bottom of the screen, down to the end of the page. With no left or right set, it keeps the
          left edge it would have in the page, the edge of the form, so it stays clear of the page's buttons on the
          right. Fixed elements take no space in the layout. */}
      <div className="fixed bottom-0 z-[1050]">
        <MetadataQualityIndicator
          quality={quality}
          visible={scrolledPastScore}
          onShowPanel={showPanel}
          onFollowSuggestion={onFollowSuggestion}
        />
      </div>
    </>
  );
}

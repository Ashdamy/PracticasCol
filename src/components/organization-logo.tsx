"use client";

import { useState } from "react";
import type { OpportunityCard } from "@/lib/contracts";

export function OrganizationLogo({
  organization,
  type,
}: {
  organization: OpportunityCard["organization"];
  type: OpportunityCard["type"];
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const { name, logoUrl } = organization;
  const showImage = Boolean(logoUrl && logoUrl !== failedUrl);
  const initials = name.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join("");

  return (
    <span
      className={`organization-initials ${showImage ? "organization-logo-image" : `tone-${type}`}`}
      aria-hidden="true"
    >
      {showImage ? (
        // Brandfetch requires direct browser loading and the default Referer header.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl!}
          width={46}
          height={46}
          loading="lazy"
          alt=""
          onError={() => setFailedUrl(logoUrl)}
          ref={image => {
            // A cached error can occur before React hydrates the server HTML.
            if (image?.complete && image.naturalWidth === 0) setFailedUrl(logoUrl);
          }}
        />
      ) : initials}
    </span>
  );
}

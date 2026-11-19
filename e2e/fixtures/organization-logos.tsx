import { useState } from "react";
import { createRoot } from "react-dom/client";
import { mockCards } from "../../src/lib/mocks";
import { OpportunityCard } from "../../src/components/opportunity-card";
import { OpportunityListItem } from "../../src/components/opportunity-list";

// Browser-only fixture: does not change server mocks or add a public test route.
function Fixture() {
  const [logoUrl, setLogoUrl] = useState<string | null>("https://logos.example.test/valid.svg");
  const opportunity = {
    ...mockCards[0],
    organization: { ...mockCards[0].organization, logoUrl },
  };
  return (
    <main className="content">
      <button onClick={() => setLogoUrl("https://logos.example.test/missing.svg")}>Logo con error</button>
      <button onClick={() => setLogoUrl("https://logos.example.test/recovered.svg")}>Cambiar logo</button>
      <button onClick={() => setLogoUrl(null)}>Sin logo</button>
      <div className="opportunity-list">
        <OpportunityListItem opportunity={opportunity} />
        <OpportunityCard opportunity={opportunity} />
      </div>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<Fixture />);

import type { RagQueryResult } from "@arac/types";

// search-mfe remote. Mounted at /search by the shell host (basePath: /search).
// Imports the shared @arac/types DTO to exercise cross-package wiring.
const SAMPLE: RagQueryResult = {
  answer: "Wire me to /api/rag/query through the gateway.",
  citations: [],
};

export default function SearchHome() {
  return (
    <main style={{ maxWidth: 720, margin: "4rem auto", padding: "0 1rem", fontFamily: "system-ui" }}>
      <h1>ARAC — Search (remote)</h1>
      <p>This page is served by the search-mfe zone and composed into the shell.</p>
      <pre style={{ background: "#f4f4f4", padding: "1rem", borderRadius: 8 }}>
        {JSON.stringify(SAMPLE, null, 2)}
      </pre>
      <p>
        {/* plain <a>: cross-zone nav is a hard navigation, and this escapes
            search-mfe's basePath so it targets the shell host root, not /search */}
        <a href="/">← Back to shell</a>
      </p>
    </main>
  );
}

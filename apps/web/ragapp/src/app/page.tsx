import type { RagQueryResult } from "@arac/types";

// ragapp remote. Mounted at /rag by the mainapp host (basePath: /rag).
// Owns all RAG / LLM / AI surfaces. Imports the shared @arac/types DTO to
// exercise cross-package wiring.
const SAMPLE: RagQueryResult = {
  answer: "Wire me to /api/rag/query through the gateway.",
  citations: [],
};

export default function RagHome() {
  return (
    <main style={{ maxWidth: 720, margin: "4rem auto", padding: "0 1rem", fontFamily: "system-ui" }}>
      <h1>ARAC — RAG (remote)</h1>
      <p>This page is served by the ragapp zone and composed into the main app.</p>
      <pre style={{ background: "#f4f4f4", padding: "1rem", borderRadius: 8 }}>
        {JSON.stringify(SAMPLE, null, 2)}
      </pre>
      <p>
        {/* plain <a>: cross-zone nav is a hard navigation, and this escapes
            ragapp's basePath so it targets the main app host root, not /rag */}
        <a href="/">← Back to main app</a>
      </p>
    </main>
  );
}

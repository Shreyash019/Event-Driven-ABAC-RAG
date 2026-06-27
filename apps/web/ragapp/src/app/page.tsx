import type { RagQueryResult } from "@arac/types";

// ragapp remote. Mounted at /rag by the mainapp host (basePath: /rag).
// Header/Footer come from <AppShell> in layout.tsx — page only renders content.
const SAMPLE: RagQueryResult = {
  answer: "Wire me to /api/rag/query through the gateway.",
  citations: [],
};

export default function RagHome() {
  return (
    <section>
      <h1 className="text-2xl font-bold">ARAC — RAG (remote)</h1>
      <p className="mt-2 text-foreground/70">
        This page is served by the ragapp zone and composed into the main app.
      </p>
      <pre className="mt-4 rounded-lg bg-black/5 p-4 text-sm dark:bg-white/10">
        {JSON.stringify(SAMPLE, null, 2)}
      </pre>
      <p className="mt-4">
        {/* plain <a>: cross-zone nav is a hard navigation, escapes basePath */}
        <a href="/" className="text-blue-600 hover:underline">
          ← Back to main app
        </a>
      </p>
    </section>
  );
}

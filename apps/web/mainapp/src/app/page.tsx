import Header from "../component/Header";
export default function Home() {
  return (
    <main style={{ fontFamily: "system-ui" }}>
      <Header />
      <h1>ARAC — Main App</h1>
      <p>Microfrontend host. RAG / LLM / AI lives in a separate zone (ragapp).</p>
      <p>
        {/* plain <a>: /rag is a separate zone, so force a hard navigation
            (no client-side routing / prefetch into the proxied remote) */}
        <a href="/rag">Go to RAG →</a>
      </p>
    </main>
  );
}

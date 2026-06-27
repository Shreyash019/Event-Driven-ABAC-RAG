// Header/Footer come from <AppShell> in layout.tsx — page only renders content.
export default function Home() {
  return (
    <section>
      <h1 className="text-2xl font-bold">ARAC — Main App</h1>
      <p className="mt-2 text-foreground/70">
        Microfrontend host. RAG / LLM / AI lives in a separate zone (ragapp).
      </p>
      <p className="mt-4">
        {/* plain <a>: /rag is a separate zone → hard navigation */}
        <a href="/rag" className="text-blue-600 hover:underline">
          Go to RAG →
        </a>
      </p>
    </section>
  );
}

// Shared footer chrome. Presentational → Server Component.
export function Footer() {
  return (
    <footer className="border-t border-black/10 dark:border-white/10">
      <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-foreground/60">
        © ARAC — Agentic RAG. All rights reserved.
      </div>
    </footer>
  );
}

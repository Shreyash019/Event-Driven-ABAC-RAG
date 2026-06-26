import Link from "next/link";

// Shell host (Multi-Zones). The /search route is served by the search-mfe
// remote, composed in via rewrites in next.config.ts.
export default function Home() {
  return (
    <main style={{ maxWidth: 720, margin: "4rem auto", padding: "0 1rem", fontFamily: "system-ui" }}>
      <h1>ARAC — Shell</h1>
      <p>Microfrontend host. The search experience is a separate zone (search-mfe).</p>
      <p>
        <Link href="/search">Go to Search →</Link>
      </p>
    </main>
  );
}

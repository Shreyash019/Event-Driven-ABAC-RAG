export interface NavItem {
  label: string;
  href: string;
}

/** Default cross-zone nav shared by every app (single source of truth). */
export const DEFAULT_NAV: NavItem[] = [
  { label: "Home", href: "/" },
  { label: "RAG", href: "/rag" },
];

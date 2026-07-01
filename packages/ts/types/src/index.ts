// Shared cross-service DTOs for @arac/* consumers (mainapp, ragapp, auth-service).

/** Authenticated user surfaced to the frontend (from the verified session). */
export interface SessionUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  department?: string;
  /** Distinct role names the user holds (for display). Populated by `/auth/me`. */
  roles?: string[];
  /** True if the user may manage other users (gates the admin nav). From `/auth/me`. */
  canManageUsers?: boolean;
}


/**
 * Canonical document classification scale (ordinal). A user may read a document when the
 * document's `classification` ≤ the user's clearance ("no read up"). See loc-doc/OrgModel.md.
 */
export const Classification = {
  PUBLIC: 0,
  INTERNAL: 1,
  CONFIDENTIAL: 2,
  RESTRICTED: 3,
} as const;
export type ClassificationLevel = (typeof Classification)[keyof typeof Classification];

/**
 * Company-wide seniority ladder (ordinal). L3 = intern is the floor; higher = more senior.
 * Distinct from `Classification` (which grades a document's sensitivity): this grades a
 * *person*. A user may read a document when the document's `minLevel` ≤ the user's `level`
 * ("no read up" on seniority), and may exercise a permission when `level` ≥ its `minLevel`.
 */
export const CompanyLevel = {
  L3: 3, // Intern (floor)
  L4: 4,
  L5: 5,
  L6: 6,
  L7: 7,
  L8: 8,
} as const;
export type CompanyLevelValue = (typeof CompanyLevel)[keyof typeof CompanyLevel];

/**
 * Distribution scope of a document — which STRUCTURAL restrictions (tenant, department)
 * apply. Orthogonal to `classification` (which grades sensitivity): audience controls the
 * intended reader set, sensitivity controls how secret it is. Ordinal by openness. Default
 * PRIVATE is the fail-closed value (GUARDRAILS §1.1 — absence must not mean public).
 *
 *  PRIVATE — normal ABAC: tenant + department both enforced.
 *  ORG     — any employee in the tenant (department bypassed); still tenant-scoped.
 *  WORLD   — anyone, including unassigned signups / outside the org (tenant + dept bypassed).
 *
 * The sensitivity axes (classification/minLevel/compartments) ALWAYS apply; a public
 * document must therefore be stamped at the floor (PUBLIC, L3, no compartments) — enforce
 * this at ingestion so an ORG/WORLD doc can never also be CONFIDENTIAL or compartmented.
 */
export const Audience = {
  PRIVATE: 0,
  ORG: 1,
  WORLD: 2,
} as const;
export type AudienceLevel = (typeof Audience)[keyof typeof Audience];

/**
 * The security matrix stamped on every ingested document/chunk (GUARDRAILS §1.1) and the
 * basis of the Qdrant ABAC pre-filter. Cross-service contract — a vector without it is a
 * bug; never default to public. (Proto/Go/Python mirror is added with the RAG services.)
 */
export interface SecurityMatrix {
  tenant: string;
  /** Department slugs the document belongs to (ignored when `audience` bypasses departments). */
  departments: string[];
  /** ClassificationLevel of the document. */
  classification: number;
  /** Minimum company seniority level required to view (CompanyLevel; default L3 = open). */
  minLevel: number;
  /** Distribution scope (Audience) — which structural gates apply. Default PRIVATE. */
  audience: number;
  /** Need-to-know compartment tags required to view (empty = none). */
  compartments: string[];
}

/**
 * Verified identity claims carried in the access JWT and propagated by the gateway as
 * trusted X-Identity-* headers. `departments` is expanded with descendants for managed
 * departments at token-mint, so downstream services just match arrays (no tree-walking).
 */
export interface IdentityClaims {
  sub: string;
  tenant: string;
  departments: string[];
  clearance: number;
  /** Company-wide seniority level (CompanyLevel); gates document `minLevel` and permissions. */
  level: number;
  compartments: string[];
}

/** A single citation-backed chunk returned by the RAG retrieval path. */
export interface RetrievedChunk {
  documentId: string;
  chunkId: string;
  content: string;
  score: number;
  metadata?: Record<string, string>;
}

/** Response shape for a grounded RAG query, surfaced to the frontend. */
export interface RagQueryResult {
  answer: string;
  citations: RetrievedChunk[];
}

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
 * The security matrix stamped on every ingested document/chunk (GUARDRAILS §1.1) and the
 * basis of the Qdrant ABAC pre-filter. Cross-service contract — a vector without it is a
 * bug; never default to public. (Proto/Go/Python mirror is added with the RAG services.)
 */
export interface SecurityMatrix {
  tenant: string;
  /** Department slugs the document belongs to. */
  departments: string[];
  /** ClassificationLevel of the document. */
  classification: number;
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

// Shared cross-service DTOs for @arac/* consumers (mainapp, ragapp, auth-service).

/** Authenticated user surfaced to the frontend (from the verified session). */
export interface SessionUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  department?: string;
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

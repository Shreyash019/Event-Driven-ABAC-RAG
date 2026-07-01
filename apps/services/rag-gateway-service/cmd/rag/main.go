// Command rag is the entrypoint for rag-gateway-service: it builds the ABAC
// security matrix from gateway-verified claims, orchestrates retrieval against
// ingestion-retrieval-service, and calls the LLM for grounded, cited answers.
//
// This is a scaffold HTTP server: it exposes /healthz and a stub /rag/query so
// the gateway has a live backend to route to.
package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
)

func main() {
	addr := ":" + envOr("PORT", "8081")

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})
	mux.HandleFunc("/rag/query", func(w http.ResponseWriter, r *http.Request) {
		// Trusted identity is injected by the gateway as X-Identity-* headers. These are
		// the ONLY source of ABAC scope; the Qdrant pre-filter is built from them (see
		// loc-doc/OrgModel.md §3): tenant match AND department ∈ departments AND
		// classification <= clearance AND minLevel <= level AND compartments ⊆ compartments.
		resp := map[string]any{
			"answer":    "rag-gateway-service scaffold: wire ABAC matrix + retrieval + LLM here",
			"citations": []any{},
			"identity": map[string]string{
				"subject":      r.Header.Get("X-Identity-Subject"),
				"tenant":       r.Header.Get("X-Identity-Tenant"),
				"departments":  r.Header.Get("X-Identity-Departments"),
				"clearance":    r.Header.Get("X-Identity-Clearance"),
				"level":        r.Header.Get("X-Identity-Level"),
				"compartments": r.Header.Get("X-Identity-Compartments"),
			},
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(resp)
	})

	log.Printf("rag-gateway-service: listening on %s", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatal(err)
	}
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

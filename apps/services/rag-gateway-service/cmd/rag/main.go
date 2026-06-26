// Command rag is the entrypoint for rag-gateway-service: it builds the ABAC
// security matrix from gateway-verified claims, orchestrates retrieval against
// ingestion-retrieval-service, and calls the LLM for grounded, cited answers.
package main

import "log"

func main() {
	log.Println("rag-gateway-service: starting (scaffold)")
}

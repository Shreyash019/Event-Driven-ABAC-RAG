"""Entrypoint for ingestion-retrieval-service.

Consumes Redis ingestion events (chunk + embed + upsert to Qdrant with the ABAC
matrix) and serves hybrid search with the ABAC filter applied at the Qdrant query
level. This is a scaffold entrypoint.
"""


def main() -> None:
    print("ingestion-retrieval-service: starting (scaffold)")


if __name__ == "__main__":
    main()

"""Entrypoint for ingestion-retrieval-service.

Consumes Redis ingestion events (chunk + embed + upsert to Qdrant with the ABAC
matrix) and serves hybrid search with the ABAC filter applied at the Qdrant query
level. This is a scaffold: it connects to Redis and blocks on the ingestion queue,
logging events so the worker stays alive in the stack.
"""

import logging
import os
import time

import redis

logging.basicConfig(level=logging.INFO, format="%(asctime)s ingestion %(message)s")
log = logging.getLogger(__name__)

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379")
INGEST_QUEUE = os.environ.get("INGEST_QUEUE", "arac:ingest")


def main() -> None:
    log.info("starting (scaffold); redis=%s queue=%s", REDIS_URL, INGEST_QUEUE)
    client = redis.from_url(REDIS_URL, decode_responses=True)

    while True:
        try:
            client.ping()
            log.info("connected to redis; waiting for ingestion events on %s", INGEST_QUEUE)
            while True:
                # Block for an event; on timeout, loop to keep the healthcheck alive.
                item = client.blpop(INGEST_QUEUE, timeout=30)
                if item is None:
                    continue
                _, payload = item
                # TODO: chunk + embed + upsert to Qdrant with the ABAC matrix.
                log.info("received ingestion event: %s", payload)
        except redis.exceptions.RedisError as exc:
            log.warning("redis unavailable (%s); retrying in 3s", exc)
            time.sleep(3)


if __name__ == "__main__":
    main()

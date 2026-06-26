# Go RAG orchestration service. Build context = this service dir (standalone;
# does not import the shared packages/go module yet, so go.work isn't needed).
FROM golang:1.26-alpine AS build
WORKDIR /src
COPY go.mod ./
COPY . .
RUN CGO_ENABLED=0 go build -o /out/rag ./cmd/rag

FROM gcr.io/distroless/static-debian12 AS run
COPY --from=build /out/rag /rag
ENV PORT=8081
EXPOSE 8081
ENTRYPOINT ["/rag"]

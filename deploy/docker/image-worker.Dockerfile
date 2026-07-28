# Build context must be backend/, e.g.:
#   docker build -f deploy/docker/image-worker.Dockerfile backend

FROM golang:1.26-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /out/image-worker ./cmd/image-worker

FROM alpine:3.20
RUN apk add --no-cache ca-certificates && \
    adduser -D -u 10001 worker
COPY --from=build /out/image-worker /usr/local/bin/image-worker
USER worker
ENTRYPOINT ["/usr/local/bin/image-worker"]

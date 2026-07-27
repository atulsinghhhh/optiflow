# Build context must be backend/, e.g.:
#   docker build -f deploy/docker/video-worker.Dockerfile backend

FROM golang:1.26-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /out/video-worker ./cmd/video-worker

FROM alpine:3.20
RUN apk add --no-cache ffmpeg ca-certificates && \
    adduser -D -u 10001 worker
COPY --from=build /out/video-worker /usr/local/bin/video-worker
USER worker
ENTRYPOINT ["/usr/local/bin/video-worker"]

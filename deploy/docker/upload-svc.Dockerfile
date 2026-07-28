# Build context must be backend/, e.g.:
#   docker build -f deploy/docker/upload-svc.Dockerfile backend

FROM golang:1.26-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /out/upload-svc ./cmd/upload-svc

FROM alpine:3.20
RUN apk add --no-cache ca-certificates && \
    adduser -D -u 10001 svc
COPY --from=build /out/upload-svc /usr/local/bin/upload-svc
USER svc
ENTRYPOINT ["/usr/local/bin/upload-svc"]

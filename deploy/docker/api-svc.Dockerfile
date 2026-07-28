# Build context must be backend/, e.g.:
#   docker build -f deploy/docker/api-svc.Dockerfile backend

FROM golang:1.26-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /out/api-svc ./cmd/api-svc

FROM alpine:3.20
RUN apk add --no-cache ca-certificates && \
    adduser -D -u 10001 svc
COPY --from=build /out/api-svc /usr/local/bin/api-svc
USER svc
ENTRYPOINT ["/usr/local/bin/api-svc"]

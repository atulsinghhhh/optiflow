package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"strconv"
	"time"

	"github.com/hibiken/asynq"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"

	"github.com/atulsinghhhh/optiflow/internal/db"
	"github.com/atulsinghhhh/optiflow/internal/models"
	"github.com/atulsinghhhh/optiflow/internal/notify"
	"github.com/atulsinghhhh/optiflow/internal/queue"
	"github.com/atulsinghhhh/optiflow/internal/storage"
)

func main() {
	zerolog.TimeFieldFormat = time.RFC3339
	log.Logger = log.Output(os.Stdout).With().Timestamp().Str("service", "video-worker").Logger()

	if _, err := exec.LookPath("ffmpeg"); err != nil {
		log.Fatal().Msg("ffmpeg not found on PATH — required to transcode video")
	}
	if _, err := exec.LookPath("ffprobe"); err != nil {
		log.Fatal().Msg("ffprobe not found on PATH — required to transcode video")
	}

	cfg, err := loadConfig()
	if err != nil {
		log.Fatal().Err(err).Msg("loading config")
	}

	gormDB, err := db.Connect(cfg.DatabaseURL, &models.User{}, &models.Folder{}, &models.File{})
	if err != nil {
		log.Fatal().Err(err).Msg("connecting to database")
	}

	storageClient, err := storage.NewClient(context.Background(), storage.Config{
		Endpoint:  cfg.MinioEndpoint,
		AccessKey: cfg.MinioAccessKey,
		SecretKey: cfg.MinioSecretKey,
		UseSSL:    cfg.MinioUseSSL,
		Bucket:    cfg.MinioBucket,
	})
	if err != nil {
		log.Fatal().Err(err).Msg("connecting to minio")
	}

	h := &handler{db: gormDB, storage: storageClient}

	go func() {
		mux := http.NewServeMux()
		mux.Handle("/metrics", promhttp.Handler())
		mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
			w.Write([]byte("ok"))
		})
		addr := ":" + cfg.MetricsPort
		log.Info().Str("addr", addr).Msg("video-worker metrics listening")
		if err := http.ListenAndServe(addr, mux); err != nil {
			log.Fatal().Err(err).Msg("metrics server stopped")
		}
	}()

	srv := asynq.NewServer(
		asynq.RedisClientOpt{Addr: cfg.RedisAddr},
		asynq.Config{
			Concurrency:  cfg.Concurrency,
			Queues:       map[string]int{"default": 1},
			ErrorHandler: asynq.ErrorHandlerFunc(h.handleTaskError),
		},
	)

	mux := asynq.NewServeMux()
	mux.HandleFunc(queue.TypeVideoTranscode, h.handleVideoTranscode)

	log.Info().Msg("video-worker consuming queue")
	if err := srv.Run(mux); err != nil {
		log.Fatal().Err(err).Msg("video-worker stopped")
	}
}

type config struct {
	DatabaseURL    string
	MinioEndpoint  string
	MinioAccessKey string
	MinioSecretKey string
	MinioUseSSL    bool
	MinioBucket    string
	RedisAddr      string
	MetricsPort    string
	Concurrency    int
}

func loadConfig() (config, error) {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		return config{}, fmt.Errorf("DATABASE_URL is required")
	}

	endpoint := os.Getenv("MINIO_ENDPOINT")
	if endpoint == "" {
		return config{}, fmt.Errorf("MINIO_ENDPOINT is required")
	}

	accessKey := os.Getenv("MINIO_ACCESS_KEY")
	if accessKey == "" {
		return config{}, fmt.Errorf("MINIO_ACCESS_KEY is required")
	}

	secretKey := os.Getenv("MINIO_SECRET_KEY")
	if secretKey == "" {
		return config{}, fmt.Errorf("MINIO_SECRET_KEY is required")
	}

	bucket := os.Getenv("MINIO_BUCKET")
	if bucket == "" {
		bucket = "streamvault"
	}

	useSSL, _ := strconv.ParseBool(os.Getenv("MINIO_USE_SSL"))

	redisAddr := os.Getenv("REDIS_ADDR")
	if redisAddr == "" {
		return config{}, fmt.Errorf("REDIS_ADDR is required")
	}

	metricsPort := os.Getenv("VIDEO_WORKER_METRICS_PORT")
	if metricsPort == "" {
		metricsPort = "9092"
	}

	// Video transcoding is CPU-heavy — default concurrency is much lower than
	// image-worker's, so a handful of large uploads don't starve the machine.
	concurrency, err := strconv.Atoi(os.Getenv("VIDEO_WORKER_CONCURRENCY"))
	if err != nil || concurrency <= 0 {
		concurrency = 2
	}

	return config{
		DatabaseURL:    dbURL,
		MinioEndpoint:  endpoint,
		MinioAccessKey: accessKey,
		MinioSecretKey: secretKey,
		MinioUseSSL:    useSSL,
		MinioBucket:    bucket,
		RedisAddr:      redisAddr,
		MetricsPort:    metricsPort,
		Concurrency:    concurrency,
	}, nil
}

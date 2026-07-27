package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
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
	log.Logger = log.Output(os.Stdout).With().Timestamp().Str("service", "image-worker").Logger()

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

	var notifyClient *notify.Client
	if cfg.NotifySvcURL != "" {
		notifyClient = notify.NewClient(cfg.NotifySvcURL, cfg.InternalSecret)
	} else {
		log.Warn().Msg("NOTIFY_SVC_URL not set — job completion notifications disabled")
	}

	h := &handler{db: gormDB, storage: storageClient, notify: notifyClient}

	go func() {
		mux := http.NewServeMux()
		mux.Handle("/metrics", promhttp.Handler())
		mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
			w.Write([]byte("ok"))
		})
		addr := ":" + cfg.MetricsPort
		log.Info().Str("addr", addr).Msg("image-worker metrics listening")
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
	mux.HandleFunc(queue.TypeImageThumbnail, h.handleImageThumbnail)

	log.Info().Msg("image-worker consuming queue")
	if err := srv.Run(mux); err != nil {
		log.Fatal().Err(err).Msg("image-worker stopped")
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
	NotifySvcURL   string
	InternalSecret string
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

	metricsPort := os.Getenv("IMAGE_WORKER_METRICS_PORT")
	if metricsPort == "" {
		metricsPort = "9091"
	}

	concurrency, err := strconv.Atoi(os.Getenv("IMAGE_WORKER_CONCURRENCY"))
	if err != nil || concurrency <= 0 {
		concurrency = 5
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
		// Optional: leave NOTIFY_SVC_URL unset to run without job-completion
		// notifications (e.g. notify-svc isn't deployed yet).
		NotifySvcURL:   os.Getenv("NOTIFY_SVC_URL"),
		InternalSecret: os.Getenv("INTERNAL_SECRET"),
	}, nil
}

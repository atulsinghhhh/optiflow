package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/hibiken/asynq"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"

	"github.com/atulsinghhhh/optiflow/internal/db"
	"github.com/atulsinghhhh/optiflow/internal/middleware"
	"github.com/atulsinghhhh/optiflow/internal/models"
	"github.com/atulsinghhhh/optiflow/internal/storage"
)

func main() {
	zerolog.TimeFieldFormat = time.RFC3339
	log.Logger = log.Output(os.Stdout).With().Timestamp().Str("service", "upload-svc").Logger()

	cfg, err := loadConfig()
	if err != nil {
		log.Fatal().Err(err).Msg("loading config")
	}

	gormDB, err := db.Connect(cfg.DatabaseURL, &models.User{}, &models.Folder{}, &models.File{}, &models.Share{})
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

	queueClient := asynq.NewClient(asynq.RedisClientOpt{Addr: cfg.RedisAddr})
	defer queueClient.Close()

	h := &handler{db: gormDB, storage: storageClient, queue: queueClient}

	tusHandler, err := h.newTusHandler(cfg.TusDataDir)
	if err != nil {
		log.Fatal().Err(err).Msg("setting up tus resumable-upload handler")
	}

	r := chi.NewRouter()
	r.Use(chimw.RequestID)
	r.Use(chimw.Logger)
	r.Use(chimw.Recoverer)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins: []string{cfg.FrontendOrigin},
		AllowedMethods: []string{"GET", "POST", "PATCH", "DELETE", "HEAD", "OPTIONS"},
		// The tus protocol headers (Tus-Resumable, Upload-*) are needed on top
		// of the usual Content-Type/Authorization pair since tusd's own CORS
		// handling is disabled in favor of this single outer layer.
		AllowedHeaders: []string{
			"Content-Type", "Authorization",
			"Tus-Resumable", "Upload-Length", "Upload-Metadata", "Upload-Offset",
			"Upload-Concat", "Upload-Defer-Length",
		},
		ExposedHeaders: []string{
			"Location", "Upload-Offset", "Upload-Length", "Tus-Resumable",
			"Upload-Metadata", "Upload-Expires", "Upload-Concat",
		},
		AllowCredentials: false,
		MaxAge:           300,
	}))

	r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	})

	// Public — resolving a share token deliberately requires no auth.
	r.Post("/shares/{token}/download-url", h.shareDownloadURL)

	r.Group(func(r chi.Router) {
		r.Use(middleware.RequireAuth([]byte(cfg.JWTSecret)))

		r.Route("/uploads", func(r chi.Router) {
			r.Post("/presign", h.presign)
			r.Post("/{id}/versions/presign", h.presignVersion)
			r.Post("/{id}/complete", h.complete)
			r.Get("/{id}/download-url", h.downloadURL)
			r.Get("/{id}/hls/*", h.hlsAsset)
			// tusHandler's own router expects paths relative to BasePath
			// ("/uploads/tus/"), which is why the prefix is stripped here
			// rather than relying on chi's mount semantics.
			r.Handle("/tus", http.StripPrefix("/uploads/tus", tusHandler))
			r.Handle("/tus/*", http.StripPrefix("/uploads/tus", tusHandler))
		})
	})

	addr := ":" + cfg.Port
	log.Info().Str("addr", addr).Msg("upload-svc listening")
	if err := http.ListenAndServe(addr, r); err != nil {
		log.Fatal().Err(err).Msg("upload-svc stopped")
	}
}

type config struct {
	Port           string
	DatabaseURL    string
	JWTSecret      string
	MinioEndpoint  string
	MinioAccessKey string
	MinioSecretKey string
	MinioUseSSL    bool
	MinioBucket    string
	RedisAddr      string
	FrontendOrigin string
	TusDataDir     string
}

func loadConfig() (config, error) {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		return config{}, fmt.Errorf("DATABASE_URL is required")
	}

	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		return config{}, fmt.Errorf("JWT_SECRET is required")
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

	port := os.Getenv("UPLOAD_SVC_PORT")
	if port == "" {
		port = "8083"
	}

	frontendOrigin := os.Getenv("FRONTEND_ORIGIN")
	if frontendOrigin == "" {
		frontendOrigin = "http://localhost:3000"
	}

	tusDataDir := os.Getenv("TUS_DATA_DIR")
	if tusDataDir == "" {
		tusDataDir = filepath.Join(os.TempDir(), "streamvault-tus-uploads")
	}

	return config{
		Port:           port,
		DatabaseURL:    dbURL,
		JWTSecret:      secret,
		MinioEndpoint:  endpoint,
		MinioAccessKey: accessKey,
		MinioSecretKey: secretKey,
		MinioUseSSL:    useSSL,
		MinioBucket:    bucket,
		TusDataDir:     tusDataDir,
		RedisAddr:      redisAddr,
		FrontendOrigin: frontendOrigin,
	}, nil
}

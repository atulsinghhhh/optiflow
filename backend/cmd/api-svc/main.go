package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"

	"github.com/atulsinghhhh/optiflow/internal/db"
	"github.com/atulsinghhhh/optiflow/internal/middleware"
	"github.com/atulsinghhhh/optiflow/internal/models"
	"github.com/atulsinghhhh/optiflow/internal/storage"
)

func main() {
	zerolog.TimeFieldFormat = time.RFC3339
	log.Logger = log.Output(os.Stdout).With().Timestamp().Str("service", "api-svc").Logger()

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

	h := &handler{db: gormDB, storage: storageClient}

	r := chi.NewRouter()
	r.Use(chimw.RequestID)
	r.Use(chimw.Logger)
	r.Use(chimw.Recoverer)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{cfg.FrontendOrigin},
		AllowedMethods:   []string{"GET", "POST", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Content-Type", "Authorization"},
		AllowCredentials: false,
		MaxAge:           300,
	}))

	r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	})

	// Public — resolving a share token is the entire point of a share link, so
	// this deliberately sits outside the RequireAuth group below.
	r.Get("/shares/{token}", h.getPublicShare)

	r.Group(func(r chi.Router) {
		r.Use(middleware.RequireAuth([]byte(cfg.JWTSecret)))

		r.Route("/folders", func(r chi.Router) {
			r.Post("/", h.createFolder)
			r.Get("/", h.listFolders)
			r.Get("/{id}", h.getFolder)
			r.Patch("/{id}", h.updateFolder)
			r.Delete("/{id}", h.deleteFolder)
		})

		r.Route("/files", func(r chi.Router) {
			r.Get("/", h.listFiles)
			r.Get("/stats", h.fileStats)
			r.Get("/{id}", h.getFile)
			r.Patch("/{id}", h.updateFile)
			r.Delete("/{id}", h.deleteFile)
			r.Post("/{id}/shares", h.createShare)
			r.Get("/{id}/shares", h.listFileShares)
		})

		r.Route("/shares", func(r chi.Router) {
			r.Get("/", h.listShares)
			r.Delete("/{id}", h.deleteShare)
		})
	})

	addr := ":" + cfg.Port
	log.Info().Str("addr", addr).Msg("api-svc listening")
	if err := http.ListenAndServe(addr, r); err != nil {
		log.Fatal().Err(err).Msg("api-svc stopped")
	}
}

type config struct {
	Port           string
	DatabaseURL    string
	JWTSecret      string
	FrontendOrigin string
	MinioEndpoint  string
	MinioAccessKey string
	MinioSecretKey string
	MinioUseSSL    bool
	MinioBucket    string
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

	port := os.Getenv("API_SVC_PORT")
	if port == "" {
		port = "8082"
	}

	frontendOrigin := os.Getenv("FRONTEND_ORIGIN")
	if frontendOrigin == "" {
		frontendOrigin = "http://localhost:3000"
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

	return config{
		Port:           port,
		DatabaseURL:    dbURL,
		JWTSecret:      secret,
		FrontendOrigin: frontendOrigin,
		MinioEndpoint:  endpoint,
		MinioAccessKey: accessKey,
		MinioSecretKey: secretKey,
		MinioUseSSL:    useSSL,
		MinioBucket:    bucket,
	}, nil
}

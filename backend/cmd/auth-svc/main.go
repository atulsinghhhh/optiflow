package main

import (
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"

	"github.com/atulsinghhhh/optiflow/internal/db"
	"github.com/atulsinghhhh/optiflow/internal/models"
)

func main() {
	zerolog.TimeFieldFormat = time.RFC3339
	log.Logger = log.Output(os.Stdout).With().Timestamp().Str("service", "auth-svc").Logger()

	cfg, err := loadConfig()
	if err != nil {
		log.Fatal().Err(err).Msg("loading config")
	}

	gormDB, err := db.Connect(cfg.DatabaseURL, &models.User{})
	if err != nil {
		log.Fatal().Err(err).Msg("connecting to database")
	}

	h := &handler{db: gormDB, jwtSecret: []byte(cfg.JWTSecret)}

	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	})

	r.Post("/signup", h.signup)
	r.Post("/login", h.login)
	r.Post("/refresh", h.refresh)

	addr := ":" + cfg.Port
	log.Info().Str("addr", addr).Msg("auth-svc listening")
	if err := http.ListenAndServe(addr, r); err != nil {
		log.Fatal().Err(err).Msg("auth-svc stopped")
	}
}

type config struct {
	Port        string
	DatabaseURL string
	JWTSecret   string
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

	port := os.Getenv("AUTH_SVC_PORT")
	if port == "" {
		port = "8081"
	}

	return config{Port: port, DatabaseURL: dbURL, JWTSecret: secret}, nil
}

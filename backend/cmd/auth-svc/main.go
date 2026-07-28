package main

import (
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"

	"github.com/atulsinghhhh/optiflow/internal/db"
	authmw "github.com/atulsinghhhh/optiflow/internal/middleware"
	"github.com/atulsinghhhh/optiflow/internal/models"
)

func main() {
	zerolog.TimeFieldFormat = time.RFC3339
	log.Logger = log.Output(os.Stdout).With().Timestamp().Str("service", "auth-svc").Logger()

	cfg, err := loadConfig()
	if err != nil {
		log.Fatal().Err(err).Msg("loading config")
	}

	gormDB, err := db.Connect(cfg.DatabaseURL, &models.User{}, &models.PasswordResetToken{})
	if err != nil {
		log.Fatal().Err(err).Msg("connecting to database")
	}

	h := &handler{db: gormDB, jwtSecret: []byte(cfg.JWTSecret)}

	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{cfg.FrontendOrigin},
		AllowedMethods:   []string{"GET", "POST", "PATCH", "OPTIONS"},
		AllowedHeaders:   []string{"Content-Type", "Authorization"},
		AllowCredentials: false,
		MaxAge:           300,
	}))

	r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	})

	r.Post("/signup", h.signup)
	r.Post("/login", h.login)
	r.Post("/refresh", h.refresh)
	r.Post("/password-reset/request", h.requestPasswordReset)
	r.Post("/password-reset/confirm", h.confirmPasswordReset)

	r.Group(func(r chi.Router) {
		r.Use(authmw.RequireAuth([]byte(cfg.JWTSecret)))
		r.Get("/me", h.getMe)
		r.Patch("/me", h.updateMe)
	})

	addr := ":" + cfg.Port
	log.Info().Str("addr", addr).Msg("auth-svc listening")
	if err := http.ListenAndServe(addr, r); err != nil {
		log.Fatal().Err(err).Msg("auth-svc stopped")
	}
}

type config struct {
	Port           string
	DatabaseURL    string
	JWTSecret      string
	FrontendOrigin string
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

	frontendOrigin := os.Getenv("FRONTEND_ORIGIN")
	if frontendOrigin == "" {
		frontendOrigin = "http://localhost:3000"
	}

	return config{Port: port, DatabaseURL: dbURL, JWTSecret: secret, FrontendOrigin: frontendOrigin}, nil
}

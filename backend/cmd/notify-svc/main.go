package main

import (
	"fmt"
	"net/http"
	"net/url"
	"os"
	"time"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"

	"github.com/atulsinghhhh/optiflow/internal/db"
	"github.com/atulsinghhhh/optiflow/internal/middleware"
	"github.com/atulsinghhhh/optiflow/internal/models"
)

func main() {
	zerolog.TimeFieldFormat = time.RFC3339
	log.Logger = log.Output(os.Stdout).With().Timestamp().Str("service", "notify-svc").Logger()

	cfg, err := loadConfig()
	if err != nil {
		log.Fatal().Err(err).Msg("loading config")
	}

	gormDB, err := db.Connect(cfg.DatabaseURL, &models.User{}, &models.Notification{})
	if err != nil {
		log.Fatal().Err(err).Msg("connecting to database")
	}

	h := &handler{
		db:             gormDB,
		hub:            newHub(),
		jwtSecret:      []byte(cfg.JWTSecret),
		internalSecret: cfg.InternalSecret,
		originPattern:  originHost(cfg.FrontendOrigin),
	}

	r := chi.NewRouter()
	r.Use(chimw.RequestID)
	r.Use(chimw.Logger)
	r.Use(chimw.Recoverer)
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

	r.Post("/internal/notify", h.internalNotify)

	r.Group(func(r chi.Router) {
		r.Use(middleware.RequireAuth([]byte(cfg.JWTSecret)))
		r.Get("/notifications", h.listNotifications)
		r.Patch("/notifications/{id}/read", h.markRead)
	})

	// Not in the RequireAuth group above — the browser WebSocket API can't set
	// an Authorization header, so this route authenticates via ?token= itself.
	r.Get("/ws", h.ws)

	addr := ":" + cfg.Port
	log.Info().Str("addr", addr).Msg("notify-svc listening")
	if err := http.ListenAndServe(addr, r); err != nil {
		log.Fatal().Err(err).Msg("notify-svc stopped")
	}
}

type config struct {
	Port           string
	DatabaseURL    string
	JWTSecret      string
	InternalSecret string
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

	internalSecret := os.Getenv("INTERNAL_SECRET")
	if internalSecret == "" {
		return config{}, fmt.Errorf("INTERNAL_SECRET is required")
	}

	port := os.Getenv("NOTIFY_SVC_PORT")
	if port == "" {
		port = "8084"
	}

	frontendOrigin := os.Getenv("FRONTEND_ORIGIN")
	if frontendOrigin == "" {
		frontendOrigin = "http://localhost:3000"
	}

	return config{
		Port:           port,
		DatabaseURL:    dbURL,
		JWTSecret:      secret,
		InternalSecret: internalSecret,
		FrontendOrigin: frontendOrigin,
	}, nil
}

// originHost extracts host:port from a full origin URL — websocket.AcceptOptions
// matches OriginPatterns against the Origin header's host, not the full URL.
func originHost(origin string) string {
	u, err := url.Parse(origin)
	if err != nil || u.Host == "" {
		return origin
	}
	return u.Host
}

package main

import (
	"log"
	"net/http"

	"github.com/go-chi/chi/v5"
)

func main() {
	r := chi.NewRouter()
	r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	})

	addr := ":8082"
	log.Printf("api-svc listening on %s", addr)
	if err := http.ListenAndServe(addr, r); err != nil {
		log.Fatalf("api-svc: %v", err)
	}
}

package main

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/rs/zerolog/log"
	"gorm.io/gorm"

	"github.com/atulsinghhhh/optiflow/internal/auth"
	"github.com/atulsinghhhh/optiflow/internal/models"
)

type handler struct {
	db        *gorm.DB
	jwtSecret []byte
}

type signupRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Name     string `json:"name"`
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type refreshRequest struct {
	RefreshToken string `json:"refresh_token"`
}

type tokenResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token,omitempty"`
}

func writeError(w http.ResponseWriter, status int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func (h *handler) issueTokenPair(user models.User) (tokenResponse, error) {
	access, err := auth.IssueToken(user.ID, auth.AccessToken, auth.AccessTokenTTL, h.jwtSecret)
	if err != nil {
		return tokenResponse{}, err
	}
	refresh, err := auth.IssueToken(user.ID, auth.RefreshToken, auth.RefreshTokenTTL, h.jwtSecret)
	if err != nil {
		return tokenResponse{}, err
	}
	return tokenResponse{AccessToken: access, RefreshToken: refresh}, nil
}

func (h *handler) signup(w http.ResponseWriter, r *http.Request) {
	var req signupRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Email == "" || req.Password == "" || req.Name == "" {
		writeError(w, http.StatusBadRequest, "email, password, and name are required")
		return
	}

	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		log.Error().Err(err).Msg("hashing password")
		writeError(w, http.StatusInternalServerError, "could not create account")
		return
	}

	user := models.User{Email: req.Email, PasswordHash: hash, Name: req.Name}
	if err := h.db.Create(&user).Error; err != nil {
		writeError(w, http.StatusConflict, "email already registered")
		return
	}

	tokens, err := h.issueTokenPair(user)
	if err != nil {
		log.Error().Err(err).Msg("issuing tokens")
		writeError(w, http.StatusInternalServerError, "could not create account")
		return
	}

	writeJSON(w, http.StatusCreated, tokens)
}

func (h *handler) login(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	var user models.User
	if err := h.db.Where("email = ?", req.Email).First(&user).Error; err != nil {
		writeError(w, http.StatusUnauthorized, "invalid email or password")
		return
	}

	if err := auth.VerifyPassword(user.PasswordHash, req.Password); err != nil {
		writeError(w, http.StatusUnauthorized, "invalid email or password")
		return
	}

	tokens, err := h.issueTokenPair(user)
	if err != nil {
		log.Error().Err(err).Msg("issuing tokens")
		writeError(w, http.StatusInternalServerError, "could not log in")
		return
	}

	writeJSON(w, http.StatusOK, tokens)
}

func (h *handler) refresh(w http.ResponseWriter, r *http.Request) {
	var req refreshRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	claims, err := auth.ParseToken(req.RefreshToken, h.jwtSecret)
	if err != nil || claims.Type != auth.RefreshToken {
		writeError(w, http.StatusUnauthorized, "invalid refresh token")
		return
	}

	var user models.User
	if err := h.db.First(&user, "id = ?", claims.UserID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			writeError(w, http.StatusUnauthorized, "invalid refresh token")
			return
		}
		log.Error().Err(err).Msg("looking up user for refresh")
		writeError(w, http.StatusInternalServerError, "could not refresh token")
		return
	}

	access, err := auth.IssueToken(user.ID, auth.AccessToken, auth.AccessTokenTTL, h.jwtSecret)
	if err != nil {
		log.Error().Err(err).Msg("issuing access token")
		writeError(w, http.StatusInternalServerError, "could not refresh token")
		return
	}

	writeJSON(w, http.StatusOK, tokenResponse{AccessToken: access})
}

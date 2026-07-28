package main

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
	"gorm.io/gorm"

	"github.com/atulsinghhhh/optiflow/internal/auth"
	"github.com/atulsinghhhh/optiflow/internal/httpx"
	"github.com/atulsinghhhh/optiflow/internal/middleware"
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
		httpx.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Email == "" || req.Password == "" || req.Name == "" {
		httpx.WriteError(w, http.StatusBadRequest, "email, password, and name are required")
		return
	}

	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		log.Error().Err(err).Msg("hashing password")
		httpx.WriteError(w, http.StatusInternalServerError, "could not create account")
		return
	}

	user := models.User{Email: req.Email, PasswordHash: hash, Name: req.Name}
	if err := h.db.Create(&user).Error; err != nil {
		httpx.WriteError(w, http.StatusConflict, "email already registered")
		return
	}

	tokens, err := h.issueTokenPair(user)
	if err != nil {
		log.Error().Err(err).Msg("issuing tokens")
		httpx.WriteError(w, http.StatusInternalServerError, "could not create account")
		return
	}

	httpx.WriteJSON(w, http.StatusCreated, tokens)
}

func (h *handler) login(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	var user models.User
	if err := h.db.Where("email = ?", req.Email).First(&user).Error; err != nil {
		httpx.WriteError(w, http.StatusUnauthorized, "invalid email or password")
		return
	}

	if err := auth.VerifyPassword(user.PasswordHash, req.Password); err != nil {
		httpx.WriteError(w, http.StatusUnauthorized, "invalid email or password")
		return
	}

	tokens, err := h.issueTokenPair(user)
	if err != nil {
		log.Error().Err(err).Msg("issuing tokens")
		httpx.WriteError(w, http.StatusInternalServerError, "could not log in")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, tokens)
}

func (h *handler) refresh(w http.ResponseWriter, r *http.Request) {
	var req refreshRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	claims, err := auth.ParseToken(req.RefreshToken, h.jwtSecret)
	if err != nil || claims.Type != auth.RefreshToken {
		httpx.WriteError(w, http.StatusUnauthorized, "invalid refresh token")
		return
	}

	var user models.User
	if err := h.db.First(&user, "id = ?", claims.UserID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			httpx.WriteError(w, http.StatusUnauthorized, "invalid refresh token")
			return
		}
		log.Error().Err(err).Msg("looking up user for refresh")
		httpx.WriteError(w, http.StatusInternalServerError, "could not refresh token")
		return
	}

	access, err := auth.IssueToken(user.ID, auth.AccessToken, auth.AccessTokenTTL, h.jwtSecret)
	if err != nil {
		log.Error().Err(err).Msg("issuing access token")
		httpx.WriteError(w, http.StatusInternalServerError, "could not refresh token")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, tokenResponse{AccessToken: access})
}

type meResponse struct {
	ID    uuid.UUID `json:"id"`
	Email string    `json:"email"`
	Name  string    `json:"name"`
}

type updateMeRequest struct {
	Name string `json:"name"`
}

// getMe exists because the JWT the frontend holds only carries a user_id
// claim — auth-svc never issues the user's name/email inside the token — so
// this is the only way the frontend can show real profile data instead of
// deriving it (badly) from the session.
func (h *handler) getMe(w http.ResponseWriter, r *http.Request) {
	userID, _ := middleware.UserIDFromContext(r.Context())

	var user models.User
	if err := h.db.First(&user, "id = ?", userID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			httpx.WriteError(w, http.StatusNotFound, "user not found")
			return
		}
		log.Error().Err(err).Msg("looking up current user")
		httpx.WriteError(w, http.StatusInternalServerError, "could not load profile")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, meResponse{ID: user.ID, Email: user.Email, Name: user.Name})
}

func (h *handler) updateMe(w http.ResponseWriter, r *http.Request) {
	userID, _ := middleware.UserIDFromContext(r.Context())

	var req updateMeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Name == "" {
		httpx.WriteError(w, http.StatusBadRequest, "name cannot be empty")
		return
	}

	var user models.User
	if err := h.db.First(&user, "id = ?", userID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			httpx.WriteError(w, http.StatusNotFound, "user not found")
			return
		}
		log.Error().Err(err).Msg("looking up current user")
		httpx.WriteError(w, http.StatusInternalServerError, "could not update profile")
		return
	}

	user.Name = req.Name
	if err := h.db.Save(&user).Error; err != nil {
		log.Error().Err(err).Msg("updating current user")
		httpx.WriteError(w, http.StatusInternalServerError, "could not update profile")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, meResponse{ID: user.ID, Email: user.Email, Name: user.Name})
}

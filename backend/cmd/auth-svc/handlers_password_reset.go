package main

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/rs/zerolog/log"
	"gorm.io/gorm"

	"github.com/atulsinghhhh/optiflow/internal/auth"
	"github.com/atulsinghhhh/optiflow/internal/httpx"
	"github.com/atulsinghhhh/optiflow/internal/models"
)

const passwordResetTokenTTL = 30 * time.Minute

type passwordResetRequestRequest struct {
	Email string `json:"email"`
}

// TODO(email-delivery): no email/SMTP provider is wired up anywhere in this
// stack yet (see plan.md's Open Decisions). Until one is chosen, the raw
// reset token is returned directly in this response instead of emailed —
// functionally complete for testing the flow end-to-end, but this response
// shape MUST change to a generic "check your email" message once real
// delivery exists, so the token itself is never exposed to the API caller.
type passwordResetRequestResponse struct {
	ResetToken string    `json:"reset_token"`
	ExpiresAt  time.Time `json:"expires_at"`
}

func generateResetToken() (raw string, hash string, err error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", "", err
	}
	raw = base64.RawURLEncoding.EncodeToString(buf)
	sum := sha256.Sum256([]byte(raw))
	hash = hex.EncodeToString(sum[:])
	return raw, hash, nil
}

func hashResetToken(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}

func (h *handler) requestPasswordReset(w http.ResponseWriter, r *http.Request) {
	var req passwordResetRequestRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Email == "" {
		httpx.WriteError(w, http.StatusBadRequest, "email is required")
		return
	}

	var user models.User
	if err := h.db.Where("email = ?", req.Email).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			httpx.WriteError(w, http.StatusNotFound, "no account with that email")
			return
		}
		log.Error().Err(err).Msg("looking up user for password reset")
		httpx.WriteError(w, http.StatusInternalServerError, "could not start password reset")
		return
	}

	raw, hash, err := generateResetToken()
	if err != nil {
		log.Error().Err(err).Msg("generating password reset token")
		httpx.WriteError(w, http.StatusInternalServerError, "could not start password reset")
		return
	}

	resetToken := models.PasswordResetToken{
		UserID:    user.ID,
		TokenHash: hash,
		ExpiresAt: time.Now().Add(passwordResetTokenTTL),
	}
	if err := h.db.Create(&resetToken).Error; err != nil {
		log.Error().Err(err).Msg("creating password reset token")
		httpx.WriteError(w, http.StatusInternalServerError, "could not start password reset")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, passwordResetRequestResponse{
		ResetToken: raw,
		ExpiresAt:  resetToken.ExpiresAt,
	})
}

type passwordResetConfirmRequest struct {
	Token       string `json:"token"`
	NewPassword string `json:"new_password"`
}

func (h *handler) confirmPasswordReset(w http.ResponseWriter, r *http.Request) {
	var req passwordResetConfirmRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Token == "" || len(req.NewPassword) < 6 {
		httpx.WriteError(w, http.StatusBadRequest, "token is required and new_password must be at least 6 characters")
		return
	}

	var resetToken models.PasswordResetToken
	if err := h.db.Where("token_hash = ?", hashResetToken(req.Token)).First(&resetToken).Error; err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid or expired reset token")
		return
	}
	if resetToken.Used || time.Now().After(resetToken.ExpiresAt) {
		httpx.WriteError(w, http.StatusBadRequest, "invalid or expired reset token")
		return
	}

	hash, err := auth.HashPassword(req.NewPassword)
	if err != nil {
		log.Error().Err(err).Msg("hashing new password")
		httpx.WriteError(w, http.StatusInternalServerError, "could not reset password")
		return
	}

	if err := h.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&models.User{}).Where("id = ?", resetToken.UserID).Update("password_hash", hash).Error; err != nil {
			return err
		}
		return tx.Model(&resetToken).Update("used", true).Error
	}); err != nil {
		log.Error().Err(err).Msg("resetting password")
		httpx.WriteError(w, http.StatusInternalServerError, "could not reset password")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

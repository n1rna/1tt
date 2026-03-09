package handler

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/n1rna/1two/api/internal/config"
	"github.com/n1rna/1two/api/internal/middleware"
)

type FileInfo struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	OriginalName string `json:"originalName"`
	Size         int64  `json:"size"`
	MimeType     string `json:"mimeType"`
	CreatedAt    string `json:"createdAt"`
	URL          string `json:"url"`
}

func generateID() string {
	b := make([]byte, 16)
	rand.Read(b)
	return hex.EncodeToString(b)
}

const maxUploadSize = 50 << 20 // 50 MB

func UploadFile(cfg *config.Config, db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		r.Body = http.MaxBytesReader(w, r.Body, maxUploadSize)
		if err := r.ParseMultipartForm(maxUploadSize); err != nil {
			http.Error(w, `{"error":"file too large (max 50MB)"}`, http.StatusBadRequest)
			return
		}

		file, header, err := r.FormFile("file")
		if err != nil {
			http.Error(w, `{"error":"no file provided"}`, http.StatusBadRequest)
			return
		}
		defer file.Close()

		fileID := generateID()
		ext := filepath.Ext(header.Filename)
		storedName := fileID + ext
		contentType := header.Header.Get("Content-Type")

		userDir := filepath.Join(cfg.UploadDir, userID)
		os.MkdirAll(userDir, 0o755)

		dst, err := os.Create(filepath.Join(userDir, storedName))
		if err != nil {
			http.Error(w, `{"error":"failed to save file"}`, http.StatusInternalServerError)
			return
		}
		defer dst.Close()

		written, err := io.Copy(dst, file)
		if err != nil {
			http.Error(w, `{"error":"failed to write file"}`, http.StatusInternalServerError)
			return
		}

		const q = `
			INSERT INTO files (id, user_id, filename, original_name, content_type, size)
			VALUES ($1, $2, $3, $4, $5, $6)
			RETURNING created_at`

		var createdAt time.Time
		err = db.QueryRowContext(r.Context(), q,
			fileID, userID, storedName, header.Filename, contentType, written,
		).Scan(&createdAt)
		if err != nil {
			os.Remove(filepath.Join(userDir, storedName))
			http.Error(w, `{"error":"failed to record file"}`, http.StatusInternalServerError)
			return
		}

		info := FileInfo{
			ID:           fileID,
			Name:         storedName,
			OriginalName: header.Filename,
			Size:         written,
			MimeType:     contentType,
			CreatedAt:    createdAt.UTC().Format(time.RFC3339),
			URL:          fmt.Sprintf("/api/v1/files/%s", fileID),
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(info)
	}
}

func ListFiles(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		const q = `
			SELECT id, filename, original_name, content_type, size, created_at
			FROM files
			WHERE user_id = $1
			ORDER BY created_at DESC`

		rows, err := db.QueryContext(r.Context(), q, userID)
		if err != nil {
			http.Error(w, `{"error":"failed to list files"}`, http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		files := make([]FileInfo, 0)
		for rows.Next() {
			var f FileInfo
			var createdAt time.Time
			if err := rows.Scan(&f.ID, &f.Name, &f.OriginalName, &f.MimeType, &f.Size, &createdAt); err != nil {
				http.Error(w, `{"error":"failed to read files"}`, http.StatusInternalServerError)
				return
			}
			f.CreatedAt = createdAt.UTC().Format(time.RFC3339)
			f.URL = fmt.Sprintf("/api/v1/files/%s", f.ID)
			files = append(files, f)
		}
		if err := rows.Err(); err != nil {
			http.Error(w, `{"error":"failed to iterate files"}`, http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"files": files})
	}
}

func GetFile(cfg *config.Config, db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.GetUserID(r.Context())
		fileID := chi.URLParam(r, "id")

		const q = `
			SELECT filename, original_name, content_type
			FROM files
			WHERE id = $1 AND user_id = $2`

		var storedName, originalName, contentType string
		err := db.QueryRowContext(r.Context(), q, fileID, userID).
			Scan(&storedName, &originalName, &contentType)
		if err == sql.ErrNoRows {
			http.Error(w, `{"error":"file not found"}`, http.StatusNotFound)
			return
		}
		if err != nil {
			http.Error(w, `{"error":"failed to look up file"}`, http.StatusInternalServerError)
			return
		}

		filePath := filepath.Join(cfg.UploadDir, userID, storedName)

		// Sanitize: ensure the resolved path stays within the upload directory.
		absUpload, _ := filepath.Abs(cfg.UploadDir)
		absFile, _ := filepath.Abs(filePath)
		if !strings.HasPrefix(absFile, absUpload) {
			http.Error(w, `{"error":"forbidden"}`, http.StatusForbidden)
			return
		}

		w.Header().Set("Content-Type", contentType)
		w.Header().Set("Content-Disposition", fmt.Sprintf(`inline; filename="%s"`, originalName))
		http.ServeFile(w, r, filePath)
	}
}

func DeleteFile(cfg *config.Config, db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.GetUserID(r.Context())
		fileID := chi.URLParam(r, "id")

		const q = `
			DELETE FROM files
			WHERE id = $1 AND user_id = $2
			RETURNING filename`

		var storedName string
		err := db.QueryRowContext(r.Context(), q, fileID, userID).Scan(&storedName)
		if err == sql.ErrNoRows {
			http.Error(w, `{"error":"file not found"}`, http.StatusNotFound)
			return
		}
		if err != nil {
			http.Error(w, `{"error":"failed to delete file"}`, http.StatusInternalServerError)
			return
		}

		filePath := filepath.Join(cfg.UploadDir, userID, storedName)
		absUpload, _ := filepath.Abs(cfg.UploadDir)
		absFile, _ := filepath.Abs(filePath)
		if strings.HasPrefix(absFile, absUpload) {
			os.Remove(filePath)
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "deleted"})
	}
}

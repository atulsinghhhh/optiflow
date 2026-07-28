// Package storage wraps the MinIO client used for object storage.
package storage

import (
	"context"
	"fmt"
	"io"
	"net/url"
	"time"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

type Client struct {
	mc     *minio.Client
	Bucket string
}

type Config struct {
	Endpoint  string
	AccessKey string
	SecretKey string
	UseSSL    bool
	Bucket    string
}

func NewClient(ctx context.Context, cfg Config) (*Client, error) {
	mc, err := minio.New(cfg.Endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(cfg.AccessKey, cfg.SecretKey, ""),
		Secure: cfg.UseSSL,
	})
	if err != nil {
		return nil, fmt.Errorf("creating minio client: %w", err)
	}

	exists, err := mc.BucketExists(ctx, cfg.Bucket)
	if err != nil {
		return nil, fmt.Errorf("checking bucket %q: %w", cfg.Bucket, err)
	}
	if !exists {
		if err := mc.MakeBucket(ctx, cfg.Bucket, minio.MakeBucketOptions{}); err != nil {
			return nil, fmt.Errorf("creating bucket %q: %w", cfg.Bucket, err)
		}
	}

	return &Client{mc: mc, Bucket: cfg.Bucket}, nil
}

// PresignedPutURL returns a URL the caller can PUT the object's bytes to directly,
// bypassing the app server entirely.
func (c *Client) PresignedPutURL(ctx context.Context, objectKey string, expiry time.Duration) (*url.URL, error) {
	u, err := c.mc.PresignedPutObject(ctx, c.Bucket, objectKey, expiry)
	if err != nil {
		return nil, fmt.Errorf("presigning put url: %w", err)
	}
	return u, nil
}

// PresignedGetURL returns a time-limited URL for downloading/previewing the object.
func (c *Client) PresignedGetURL(ctx context.Context, objectKey string, expiry time.Duration) (*url.URL, error) {
	u, err := c.mc.PresignedGetObject(ctx, c.Bucket, objectKey, expiry, url.Values{})
	if err != nil {
		return nil, fmt.Errorf("presigning get url: %w", err)
	}
	return u, nil
}

// StatObject confirms the object actually exists in the bucket — used to verify an
// upload really landed before marking a File record ready, rather than trusting the
// client's say-so.
func (c *Client) StatObject(ctx context.Context, objectKey string) (minio.ObjectInfo, error) {
	info, err := c.mc.StatObject(ctx, c.Bucket, objectKey, minio.StatObjectOptions{})
	if err != nil {
		return minio.ObjectInfo{}, fmt.Errorf("statting object %q: %w", objectKey, err)
	}
	return info, nil
}

// GetObject opens the object for server-side reading — used by workers that need
// the actual bytes (e.g. image-worker decoding a thumbnail source), not a URL.
func (c *Client) GetObject(ctx context.Context, objectKey string) (io.ReadCloser, error) {
	obj, err := c.mc.GetObject(ctx, c.Bucket, objectKey, minio.GetObjectOptions{})
	if err != nil {
		return nil, fmt.Errorf("getting object %q: %w", objectKey, err)
	}
	return obj, nil
}

// PutObject uploads bytes server-side — used by workers writing derived objects
// (e.g. a generated thumbnail), as opposed to the presigned-URL path clients use.
func (c *Client) PutObject(ctx context.Context, objectKey string, reader io.Reader, size int64, contentType string) error {
	_, err := c.mc.PutObject(ctx, c.Bucket, objectKey, reader, size, minio.PutObjectOptions{ContentType: contentType})
	if err != nil {
		return fmt.Errorf("putting object %q: %w", objectKey, err)
	}
	return nil
}

// RemoveObject deletes the object from the bucket.
func (c *Client) RemoveObject(ctx context.Context, objectKey string) error {
	if err := c.mc.RemoveObject(ctx, c.Bucket, objectKey, minio.RemoveObjectOptions{}); err != nil {
		return fmt.Errorf("removing object %q: %w", objectKey, err)
	}
	return nil
}

// ListObjects returns every object key under the given prefix — used to find
// all the derived objects (HLS playlists/segments) belonging to a video so
// they can be cleaned up together when the source file is deleted.
func (c *Client) ListObjects(ctx context.Context, prefix string) ([]string, error) {
	var keys []string
	for obj := range c.mc.ListObjects(ctx, c.Bucket, minio.ListObjectsOptions{Prefix: prefix, Recursive: true}) {
		if obj.Err != nil {
			return nil, fmt.Errorf("listing objects with prefix %q: %w", prefix, obj.Err)
		}
		keys = append(keys, obj.Key)
	}
	return keys, nil
}

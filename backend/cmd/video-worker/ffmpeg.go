package main

import (
	"bytes"
	"context"
	"fmt"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
)

// rendition is one entry in the HLS bitrate ladder.
type rendition struct {
	Name    string // "360p", "720p", "1080p" — also the output file basename
	Height  int
	Bitrate string // ffmpeg -b:v value, e.g. "800k"
}

var renditionLadder = []rendition{
	{Name: "360p", Height: 360, Bitrate: "800k"},
	{Name: "720p", Height: 720, Bitrate: "2800k"},
	{Name: "1080p", Height: 1080, Bitrate: "5000k"},
}

// selectRenditions returns every ladder entry that doesn't exceed the source's
// height — upscaling a rendition past the source resolution wastes bandwidth
// without adding quality. Falls back to a single native-resolution rendition if
// the source is smaller than the lowest ladder rung.
func selectRenditions(srcHeight int) []rendition {
	var included []rendition
	for _, r := range renditionLadder {
		if r.Height <= srcHeight {
			included = append(included, r)
		}
	}
	if len(included) == 0 {
		included = []rendition{{Name: fmt.Sprintf("%dp", srcHeight), Height: srcHeight, Bitrate: "800k"}}
	}
	return included
}

// evenWidth computes a width for the target height that preserves the source's
// aspect ratio and rounds to an even number, since h264 requires even dimensions.
func evenWidth(height, srcWidth, srcHeight int) int {
	w := int(float64(height) * float64(srcWidth) / float64(srcHeight))
	if w%2 != 0 {
		w++
	}
	return w
}

func runFFmpeg(ctx context.Context, args ...string) error {
	cmd := exec.CommandContext(ctx, "ffmpeg", args...)
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("ffmpeg %s: %w: %s", strings.Join(args, " "), err, stderr.String())
	}
	return nil
}

// probeDimensions returns the source video's width and height via ffprobe.
func probeDimensions(ctx context.Context, path string) (width, height int, err error) {
	out, err := exec.CommandContext(ctx, "ffprobe",
		"-v", "error",
		"-select_streams", "v:0",
		"-show_entries", "stream=width,height",
		"-of", "csv=s=x:p=0",
		path,
	).Output()
	if err != nil {
		return 0, 0, fmt.Errorf("ffprobe dimensions: %w", err)
	}
	parts := strings.Split(strings.TrimSpace(string(out)), "x")
	if len(parts) != 2 {
		return 0, 0, fmt.Errorf("ffprobe dimensions: unexpected output %q", out)
	}
	width, err = strconv.Atoi(parts[0])
	if err != nil {
		return 0, 0, fmt.Errorf("ffprobe dimensions: parsing width: %w", err)
	}
	height, err = strconv.Atoi(parts[1])
	if err != nil {
		return 0, 0, fmt.Errorf("ffprobe dimensions: parsing height: %w", err)
	}
	return width, height, nil
}

// probeDuration returns the source video's duration in seconds via ffprobe.
func probeDuration(ctx context.Context, path string) (float64, error) {
	out, err := exec.CommandContext(ctx, "ffprobe",
		"-v", "error",
		"-show_entries", "format=duration",
		"-of", "csv=p=0",
		path,
	).Output()
	if err != nil {
		return 0, fmt.Errorf("ffprobe duration: %w", err)
	}
	duration, err := strconv.ParseFloat(strings.TrimSpace(string(out)), 64)
	if err != nil {
		return 0, fmt.Errorf("ffprobe duration: parsing: %w", err)
	}
	return duration, nil
}

// extractPoster grabs a single frame at the given timestamp (seconds) as a JPEG.
func extractPoster(ctx context.Context, inputPath, outputPath string, timestampSeconds float64) error {
	return runFFmpeg(ctx,
		"-y",
		"-ss", fmt.Sprintf("%.2f", timestampSeconds),
		"-i", inputPath,
		"-vframes", "1",
		"-q:v", "2",
		outputPath,
	)
}

// transcodeRendition produces one HLS variant (a .m3u8 playlist plus its .ts
// segments) for the given rendition into outDir.
func transcodeRendition(ctx context.Context, inputPath, outDir string, r rendition) error {
	playlistPath := filepath.Join(outDir, r.Name+".m3u8")
	segmentPattern := filepath.Join(outDir, r.Name+"_%03d.ts")

	return runFFmpeg(ctx,
		"-y",
		"-i", inputPath,
		"-vf", fmt.Sprintf("scale=-2:%d", r.Height),
		"-c:v", "h264", "-profile:v", "main", "-crf", "20", "-sc_threshold", "0",
		"-g", "48", "-keyint_min", "48",
		"-b:v", r.Bitrate, "-maxrate", r.Bitrate, "-bufsize", r.Bitrate,
		"-c:a", "aac", "-ar", "48000", "-b:a", "128k",
		"-hls_time", "6",
		"-hls_playlist_type", "vod",
		"-hls_segment_filename", segmentPattern,
		playlistPath,
	)
}

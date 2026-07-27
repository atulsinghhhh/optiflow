package main

import (
	"fmt"
	"strconv"
	"strings"
)

// buildMasterPlaylist writes an HLS master manifest referencing one variant
// playlist per rendition, each tagged with its bitrate and resolution so a
// player (hls.js) can pick the right one for the client's bandwidth.
func buildMasterPlaylist(renditions []rendition, srcWidth, srcHeight int) string {
	var b strings.Builder
	b.WriteString("#EXTM3U\n#EXT-X-VERSION:3\n")
	for _, r := range renditions {
		width := evenWidth(r.Height, srcWidth, srcHeight)
		fmt.Fprintf(&b, "#EXT-X-STREAM-INF:BANDWIDTH=%d,RESOLUTION=%dx%d\n%s.m3u8\n",
			bitrateToBandwidth(r.Bitrate), width, r.Height, r.Name)
	}
	return b.String()
}

// bitrateToBandwidth converts an ffmpeg bitrate value like "800k" into a raw
// bits-per-second integer for the HLS BANDWIDTH attribute.
func bitrateToBandwidth(bitrate string) int {
	s := strings.TrimSuffix(strings.ToLower(bitrate), "k")
	n, err := strconv.Atoi(s)
	if err != nil {
		return 0
	}
	return n * 1000
}

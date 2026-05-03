#!/bin/bash
# Download subtitles from a YouTube video.
#
# Usage:
#   ./download_subtitles.sh <YouTube_URL> [output_dir]
#
# Priority:
#   1. Human Chinese subtitles
#   2. Human English subtitles
#   3. Auto-generated Chinese or English subtitles

set -euo pipefail

URL="${1:-}"
OUTPUT_DIR="${2:-.}"

if [ -z "$URL" ]; then
    echo "Usage: ./download_subtitles.sh <YouTube_URL> [output_dir]"
    exit 1
fi

if ! command -v yt-dlp >/dev/null 2>&1; then
    echo "Error: yt-dlp is required. Install it before downloading subtitles."
    exit 1
fi

mkdir -p "$OUTPUT_DIR"
MARKER="$(mktemp)"
touch "$MARKER"

cleanup() {
    rm -f "$MARKER"
}
trap cleanup EXIT

find_new_subtitle() {
    find "$OUTPUT_DIR" \( -name "*.srt" -o -name "*.vtt" \) -newer "$MARKER" 2>/dev/null | head -1
}

echo ">>> Checking available subtitles..."
yt-dlp --list-subs --no-download "$URL" 2>/dev/null | tail -20 || true

echo ""
echo ">>> Trying human Chinese subtitles..."
if yt-dlp --write-subs --sub-langs "zh-Hans,zh-Hant,zh,zh-CN,zh-TW" --sub-format srt --skip-download -o "$OUTPUT_DIR/%(title)s" "$URL" 2>/dev/null; then
    FOUND="$(find_new_subtitle)"
    if [ -n "$FOUND" ]; then
        echo "Downloaded: $FOUND"
        exit 0
    fi
fi

echo ">>> No human Chinese subtitles found. Trying human English subtitles..."
if yt-dlp --write-subs --sub-langs "en,en-US,en-GB" --sub-format srt --skip-download -o "$OUTPUT_DIR/%(title)s" "$URL" 2>/dev/null; then
    FOUND="$(find_new_subtitle)"
    if [ -n "$FOUND" ]; then
        echo "Downloaded: $FOUND"
        exit 0
    fi
fi

echo ">>> No human subtitles found. Trying auto-generated subtitles..."
if yt-dlp --write-auto-subs --sub-langs "zh-Hans,zh,en" --sub-format srt --skip-download -o "$OUTPUT_DIR/%(title)s" "$URL" 2>/dev/null; then
    FOUND="$(find_new_subtitle)"
    if [ -n "$FOUND" ]; then
        echo "Downloaded auto subtitles: $FOUND"
        exit 0
    fi
fi

echo "No usable subtitles found."
exit 1

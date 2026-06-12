#!/usr/bin/env bash
set -euo pipefail

INPUT="${1:-site.mov}"
OUTPUT_DIR="${2:-public/frames}"
FPS="${FPS:-30}"
WIDTH="${WIDTH:-1280}"
QUALITY="${QUALITY:-65}"

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg is required. Install ffmpeg first." >&2
  exit 1
fi

if [ ! -f "$INPUT" ]; then
  echo "Input video not found: $INPUT" >&2
  echo "Usage: bash scripts/extract-frames.sh path/to/video.mov [output-dir]" >&2
  exit 1
fi

rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

echo "Extracting frames..."
echo "Input: $INPUT"
echo "Output: $OUTPUT_DIR"
echo "FPS: $FPS | Width: $WIDTH | WebP quality: $QUALITY"

ffmpeg -y -hide_banner -loglevel error -threads 0 \
  -i "$INPUT" \
  -vf "fps=${FPS},scale=${WIDTH}:-2" \
  -c:v libwebp \
  -quality "$QUALITY" \
  -compression_level 0 \
  "$OUTPUT_DIR/frame_%04d.webp"

COUNT=$(find "$OUTPUT_DIR" -maxdepth 1 -name 'frame_*.webp' | wc -l | tr -d ' ')
FIRST_FRAME=$(find "$OUTPUT_DIR" -maxdepth 1 -name 'frame_*.webp' | sort | head -n 1)
HEIGHT="unknown"

if command -v ffprobe >/dev/null 2>&1 && [ -n "$FIRST_FRAME" ]; then
  HEIGHT=$(ffprobe -v error -select_streams v:0 -show_entries stream=height -of csv=p=0 "$FIRST_FRAME" 2>/dev/null || echo "unknown")
fi

cat > "$OUTPUT_DIR/meta.json" <<META
{
  "fps": ${FPS},
  "totalFrames": ${COUNT},
  "width": ${WIDTH},
  "height": "${HEIGHT}",
  "format": "webp"
}
META

echo "Done. ${COUNT} WebP frames generated."

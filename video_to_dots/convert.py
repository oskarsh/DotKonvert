"""
convert.py — Video to Dot Matrix Converter

Extracts a time range from a video file, converts each frame to a low-resolution
grayscale grid, then to 1-bit (or dithered) black/white. Outputs a single JSON
file containing frame arrays suitable for playback in a HISE DotPnl component.

Dependencies:
  - Python 3.8+
  - Pillow (PIL): image handling
  - FFmpeg: must be installed and on PATH for frame extraction

Usage:
  python convert.py input.mp4
  python convert.py input.mp4 --start 30 --duration 10 --cols 60 --rows 45 --dither --output clip.json

Output format:
  {
    "cols": int, "rows": int, "fps": int, "frameCount": int,
    "frames": [ [0.0|1.0, ...], ... ]   # each frame = cols*rows values, row-major
  }

See also: live_preview.html for in-browser tuning of threshold/dither/grid before exporting.
"""

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image


def extract_frames(video_path, output_dir, start, duration, fps, cols, rows):
    """Extract a segment of video as PNG frames via ffmpeg; resized to cols×rows, at given fps."""
    cmd = [
        "ffmpeg",
        "-y",
        "-ss", str(start),
        "-t", str(duration),
        "-i", video_path,
        "-vf", f"fps={fps},scale={cols}:{rows}",
        os.path.join(output_dir, "%06d.png"),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"ffmpeg error:\n{result.stderr}", file=sys.stderr)
        sys.exit(1)


def frame_to_dots(image_path, threshold, use_dither, invert):
    """Convert a single grayscale frame to a flat list of 0.0/1.0 (threshold or Floyd–Steinberg dither)."""
    img = Image.open(image_path).convert("L")

    if use_dither:
        img = img.convert("1")  # Floyd-Steinberg dither
        pixels = [1.0 if p > 0 else 0.0 for p in img.getdata()]
    else:
        pixels = [1.0 if p > threshold else 0.0 for p in img.getdata()]

    if invert:
        pixels = [1.0 - p for p in pixels]

    return pixels


def main():
    parser = argparse.ArgumentParser(description="Convert video to dot matrix JSON")
    parser.add_argument("video", help="Path to input video file")
    parser.add_argument("--start", type=float, default=0, help="Start time in seconds")
    parser.add_argument("--duration", type=float, default=10, help="Duration in seconds")
    parser.add_argument("--fps", type=int, default=15, help="Frames per second")
    parser.add_argument("--cols", type=int, default=40, help="Grid columns")
    parser.add_argument("--rows", type=int, default=30, help="Grid rows")
    parser.add_argument("--threshold", type=int, default=128, help="B&W threshold 0-255")
    parser.add_argument("--dither", action="store_true", help="Use Floyd-Steinberg dithering")
    parser.add_argument("--invert", action="store_true", help="Invert black and white")
    parser.add_argument("--output", default="dot_video.json", help="Output JSON path")
    args = parser.parse_args()

    if not os.path.isfile(args.video):
        print(f"Video not found: {args.video}", file=sys.stderr)
        sys.exit(1)

    if shutil.which("ffmpeg") is None:
        print("ffmpeg not found. Install it and make sure it's on your PATH.", file=sys.stderr)
        sys.exit(1)

    tmp_dir = tempfile.mkdtemp(prefix="dots_")

    try:
        print(f"Extracting frames from {args.video}...")
        extract_frames(args.video, tmp_dir, args.start, args.duration, args.fps, args.cols, args.rows)

        frame_files = sorted(Path(tmp_dir).glob("*.png"))
        if not frame_files:
            print("No frames extracted. Check your video path and ffmpeg.", file=sys.stderr)
            sys.exit(1)

        print(f"Converting {len(frame_files)} frames to {args.cols}x{args.rows} dot matrix...")

        frames = []
        for f in frame_files:
            dots = frame_to_dots(str(f), args.threshold, args.dither, args.invert)
            frames.append(dots)

        output = {
            "cols": args.cols,
            "rows": args.rows,
            "fps": args.fps,
            "frameCount": len(frames),
            "frames": frames,
        }

        with open(args.output, "w") as f:
            json.dump(output, f)

        size_kb = os.path.getsize(args.output) / 1024
        print(f"Done! {len(frames)} frames written to {args.output} ({size_kb:.1f} KB)")

    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


if __name__ == "__main__":
    main()

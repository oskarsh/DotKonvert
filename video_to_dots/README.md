# Video to Dot Matrix Converter

Converts a section of a video file into a JSON array of 1-bit dot matrix frames for playback in a HISE DotPnl component.

## Prerequisites

- Python 3.8+
- FFmpeg installed and on PATH

## Setup

```bash
mkdir video_to_dots && cd video_to_dots
python3 -m venv venv
source venv/bin/activate   # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

## Usage

```bash
python convert.py input.mp4
python convert.py input.mp4 --start 30 --duration 10 --cols 60 --rows 45 --dither
```

| Flag | Default | Description |
|------|---------|-------------|
| `--start` | 0 | Start time in seconds |
| `--duration` | 10 | Duration in seconds |
| `--fps` | 15 | Frames per second |
| `--cols` | 40 | Dot grid columns |
| `--rows` | 30 | Dot grid rows |
| `--threshold` | 128 | Brightness threshold (0-255) |
| `--dither` | flag | Use Floyd-Steinberg dithering instead of hard threshold |
| `--invert` | flag | Invert black/white |
| `--output` | dot_video.json | Output file path |

## Output format

```json
{
  "cols": 40,
  "rows": 30,
  "fps": 15,
  "frameCount": 150,
  "frames": [
    [0.0, 1.0, 0.0, ...],
    ...
  ]
}
```

Each frame is a flat array of `cols * rows` values (0.0 or 1.0), row by row, left-to-right, top-to-bottom.

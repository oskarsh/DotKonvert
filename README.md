# DotKonvert

![DotKonvert](video_to_dots/favicon.svg)

![screenshot](screen.png)

Video → dot matrix. Live preview in the browser. Export JSON. HISE DotPnl–compatible.

**[→ open](https://oskarsh.github.io/DotKonvert/)**

---

### CLI

```bash
cd video_to_dots && pip install -r requirements.txt
python convert.py input.mp4 [--start 0 --duration 10 --cols 40 --rows 30 --dither --output out.json]
```

Output: `cols`, `rows`, `fps`, `frameCount`, `frames` (flat arrays, row-major).

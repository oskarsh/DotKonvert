/**
 * live_preview.js
 *
 * Dot Matrix Live Preview — in-browser video-to-dot-matrix with live tuning.
 *
 * Responsibilities:
 *   - Load video via file input or drag-drop
 *   - Timeline: loop start/end, seek by click, drag handles; play loops segment
 *   - Capture current video frame to an offscreen canvas (cols×rows)
 *   - Process: grayscale → brightness/contrast/gamma → 1-bit, N-level, or full
 *   - Dither: Floyd–Steinberg for 1-bit or N-level
 *   - Draw dot matrix on #previewCanvas (dots = opacity 0–1)
 *
 * Expected DOM IDs: fileInput, drop, videoWrap, video, previewCanvas, outputMode,
 * thresholdGroup, threshold, thresholdVal, brightnessEl/Val, contrastEl/Val,
 * gammaEl/Val, colsEl, rowsEl, dotSizeEl/Val, ditherEl, invertEl, playBtn, pauseBtn,
 * timelineSection, timelineTrack, timelineRange, timelinePlayhead, handleStart,
 * handleEnd, timeCurrent, timeDuration, startTimeInput, endTimeInput.
 *
 * Run after DOM ready; no exports (script runs in page scope).
 */

(function () {
  const fileInput = document.getElementById('fileInput');
  const drop = document.getElementById('drop');
  const videoWrap = document.getElementById('videoWrap');
  const video = document.getElementById('video');
  const previewCanvas = document.getElementById('previewCanvas');
  const previewCtx = previewCanvas.getContext('2d');
  const hint = document.getElementById('hint');
  const outputModeEl = document.getElementById('outputMode');
  const thresholdGroup = document.getElementById('thresholdGroup');
  const thresholdEl = document.getElementById('threshold');
  const thresholdVal = document.getElementById('thresholdVal');
  const brightnessEl = document.getElementById('brightness');
  const brightnessVal = document.getElementById('brightnessVal');
  const contrastEl = document.getElementById('contrast');
  const contrastVal = document.getElementById('contrastVal');
  const gammaEl = document.getElementById('gamma');
  const gammaVal = document.getElementById('gammaVal');
  const colsEl = document.getElementById('cols');
  const rowsEl = document.getElementById('rows');
  const dotSizeEl = document.getElementById('dotSize');
  const dotSizeVal = document.getElementById('dotSizeVal');
  const ditherEl = document.getElementById('dither');
  const invertEl = document.getElementById('invert');
  const colorModeEl = document.getElementById('colorMode');
  const playBtn = document.getElementById('playBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const timelineSection = document.getElementById('timelineSection');
  const timelineTrack = document.getElementById('timelineTrack');
  const timelineRange = document.getElementById('timelineRange');
  const timelinePlayhead = document.getElementById('timelinePlayhead');
  const handleStart = document.getElementById('handleStart');
  const handleEnd = document.getElementById('handleEnd');
  const timeCurrent = document.getElementById('timeCurrent');
  const timeDuration = document.getElementById('timeDuration');
  const startTimeInput = document.getElementById('startTimeInput');
  const endTimeInput = document.getElementById('endTimeInput');
  const playbackSpeedEl = document.getElementById('playbackSpeed');
  const previewFpsEl = document.getElementById('previewFps');
  const exportNameEl = document.getElementById('exportName');
  const copyJsonBtn = document.getElementById('copyJsonBtn');
  const copyJsonStatus = document.getElementById('copyJsonStatus');
  const presetSelectEl = document.getElementById('presetSelect');
  const sourceModeEl = document.getElementById('sourceMode');
  const webcamStartBtn = document.getElementById('webcamStartBtn');
  const webcamStopBtn = document.getElementById('webcamStopBtn');
  const exportDurationEl = document.getElementById('exportDuration');
  const exportDurationLabel = document.getElementById('exportDurationLabel');
  const exportDurationRow = document.getElementById('exportDurationRow');

  const CUSTOM_PRESETS_KEY = 'dotkonvert_custom_presets';
  const BUILTIN_PRESET_IDS = ['8level', '1bit', 'led', 'smooth', 'minimal', 'grain', 'colorVivid', 'colorPastel', 'colorMono', 'bwSoft', 'bwPunchy', 'noisy', 'mirror', 'softDots'];

  const PRESETS = {
    '8level': { outputMode: '8', threshold: 128, brightness: 0, contrast: 100, gamma: 100, saturation: 100, blur: 0, sharpen: 0, noise: 0, zoom: 100, cols: 40, rows: 30, dotSize: 45, dither: false, invert: false, colorMode: false, flipH: false, flipV: false, smooth: 0, postContrast: 100 },
    '1bit': { outputMode: '1', threshold: 128, brightness: 0, contrast: 120, gamma: 100, saturation: 100, blur: 0, sharpen: 0, noise: 0, zoom: 100, cols: 40, rows: 30, dotSize: 45, dither: true, invert: false, colorMode: false, flipH: false, flipV: false, smooth: 0, postContrast: 100 },
    led: { outputMode: '4', threshold: 128, brightness: 10, contrast: 110, gamma: 90, saturation: 100, blur: 0, sharpen: 0, noise: 0, zoom: 100, cols: 32, rows: 24, dotSize: 50, dither: false, invert: false, colorMode: false, flipH: false, flipV: false, smooth: 0, postContrast: 100 },
    smooth: { outputMode: 'full', threshold: 128, brightness: 0, contrast: 100, gamma: 100, saturation: 100, blur: 0, sharpen: 0, noise: 0, zoom: 100, cols: 40, rows: 30, dotSize: 45, dither: false, invert: false, colorMode: false, flipH: false, flipV: false, smooth: 0, postContrast: 100 },
    minimal: { outputMode: '1', threshold: 160, brightness: 20, contrast: 100, gamma: 100, saturation: 100, blur: 0, sharpen: 0, noise: 0, zoom: 100, cols: 24, rows: 18, dotSize: 55, dither: false, invert: false, colorMode: false, flipH: false, flipV: false, smooth: 0, postContrast: 100 },
    grain: { outputMode: '16', threshold: 128, brightness: -5, contrast: 95, gamma: 110, saturation: 100, blur: 0, sharpen: 0, noise: 0, zoom: 100, cols: 48, rows: 36, dotSize: 40, dither: true, invert: false, colorMode: false, flipH: false, flipV: false, smooth: 0, postContrast: 100 },
    colorVivid: { outputMode: '8', threshold: 128, brightness: 5, contrast: 110, gamma: 95, saturation: 140, blur: 0, sharpen: 15, noise: 0, zoom: 100, cols: 40, rows: 30, dotSize: 45, dither: false, invert: false, colorMode: true, flipH: false, flipV: false, smooth: 0, postContrast: 100 },
    colorPastel: { outputMode: '16', threshold: 128, brightness: 15, contrast: 90, gamma: 105, saturation: 70, blur: 1, sharpen: 0, noise: 0, zoom: 100, cols: 36, rows: 27, dotSize: 48, dither: false, invert: false, colorMode: true, flipH: false, flipV: false, smooth: 1, postContrast: 95 },
    colorMono: { outputMode: 'full', threshold: 128, brightness: 0, contrast: 100, gamma: 100, saturation: 0, blur: 0, sharpen: 0, noise: 0, zoom: 100, cols: 40, rows: 30, dotSize: 45, dither: false, invert: false, colorMode: true, flipH: false, flipV: false, smooth: 0, postContrast: 100 },
    bwSoft: { outputMode: '8', threshold: 128, brightness: 0, contrast: 90, gamma: 110, saturation: 100, blur: 2, sharpen: 0, noise: 0, zoom: 100, cols: 40, rows: 30, dotSize: 50, dither: true, invert: false, colorMode: false, flipH: false, flipV: false, smooth: 1, postContrast: 95 },
    bwPunchy: { outputMode: '1', threshold: 128, brightness: 0, contrast: 130, gamma: 85, saturation: 100, blur: 0, sharpen: 25, noise: 0, zoom: 100, cols: 40, rows: 30, dotSize: 45, dither: true, invert: false, colorMode: false, flipH: false, flipV: false, smooth: 0, postContrast: 110 },
    noisy: { outputMode: '8', threshold: 128, brightness: 0, contrast: 100, gamma: 100, saturation: 100, blur: 0, sharpen: 0, noise: 15, zoom: 100, cols: 40, rows: 30, dotSize: 45, dither: false, invert: false, colorMode: false, flipH: false, flipV: false, smooth: 0, postContrast: 100 },
    mirror: { outputMode: '8', threshold: 128, brightness: 0, contrast: 100, gamma: 100, saturation: 100, blur: 0, sharpen: 0, noise: 0, zoom: 100, cols: 40, rows: 30, dotSize: 45, dither: false, invert: false, colorMode: false, flipH: true, flipV: false, smooth: 0, postContrast: 100 },
    softDots: { outputMode: '8', threshold: 128, brightness: 0, contrast: 100, gamma: 100, saturation: 100, blur: 1, sharpen: 0, noise: 0, zoom: 100, cols: 40, rows: 30, dotSize: 50, dither: false, invert: false, colorMode: false, flipH: false, flipV: false, smooth: 2, postContrast: 95 },
  };

  // Color palettes for Perlin/Vertex/Plasma (value 0–1 maps to interpolated RGB). Each entry: [r,g,b] 0–255.
  const PALETTES = {
    default: { name: 'Default (generator)', colors: null },
    sunset: { name: 'Sunset', colors: [[20, 0, 40], [180, 40, 80], [255, 120, 60], [255, 220, 160]] },
    ocean: { name: 'Ocean', colors: [[0, 20, 50], [0, 80, 120], [50, 160, 200], [180, 220, 255]] },
    forest: { name: 'Forest', colors: [[10, 30, 15], [30, 90, 40], [80, 140, 60], [180, 200, 120]] },
    fire: { name: 'Fire', colors: [[0, 0, 0], [128, 0, 0], [255, 100, 0], [255, 255, 150]] },
    ice: { name: 'Ice', colors: [[0, 20, 40], [80, 160, 220], [180, 220, 255], [230, 245, 255]] },
    magma: { name: 'Magma', colors: [[0, 0, 4], [80, 20, 100], [200, 60, 120], [255, 200, 180]] },
    viridis: { name: 'Viridis', colors: [[68, 1, 84], [59, 82, 139], [33, 145, 140], [94, 201, 98], [253, 231, 37]] },
    plasma: { name: 'Plasma', colors: [[13, 8, 135], [126, 3, 168], [204, 71, 120], [248, 149, 64], [240, 249, 33]] },
    inferno: { name: 'Inferno', colors: [[0, 0, 4], [80, 20, 100], [180, 50, 80], [250, 180, 80], [255, 255, 204]] },
    cividis: { name: 'Cividis', colors: [[0, 32, 76], [65, 90, 140], [120, 170, 185], [230, 210, 120], [253, 231, 37]] },
    turbo: { name: 'Turbo', colors: [[49, 18, 60], [0, 180, 220], [0, 255, 160], [230, 220, 0], [255, 80, 0]] },
    neon: { name: 'Neon', colors: [[255, 0, 255], [0, 255, 255], [255, 255, 0], [255, 0, 128]] },
    candy: { name: 'Candy', colors: [[255, 180, 200], [255, 220, 120], [200, 255, 220], [180, 200, 255]] },
    midnight: { name: 'Midnight', colors: [[10, 5, 30], [40, 20, 80], [80, 60, 140], [140, 120, 200]] },
    autumn: { name: 'Autumn', colors: [[60, 30, 10], [140, 80, 30], [200, 140, 60], [255, 200, 120]] },
    mint: { name: 'Mint', colors: [[220, 255, 240], [160, 240, 200], [80, 200, 160], [20, 120, 100]] },
    rose: { name: 'Rose', colors: [[255, 240, 245], [255, 180, 200], [220, 100, 140], [160, 50, 80]] },
    copper: { name: 'Copper', colors: [[40, 25, 15], [120, 70, 40], [180, 110, 60], [220, 180, 140]] },
    electric: { name: 'Electric', colors: [[0, 0, 0], [0, 0, 255], [0, 255, 255], [255, 255, 255]] },
    heat: { name: 'Heat', colors: [[0, 0, 0], [255, 0, 0], [255, 255, 0], [255, 255, 255]] },
    cold: { name: 'Cold', colors: [[0, 0, 0], [0, 0, 128], [0, 128, 255], [200, 230, 255]] },
    lime: { name: 'Lime', colors: [[20, 40, 0], [80, 160, 0], [180, 255, 80], [220, 255, 180]] },
    grape: { name: 'Grape', colors: [[40, 0, 60], [100, 40, 140], [180, 120, 220], [220, 200, 255]] },
    peach: { name: 'Peach', colors: [[255, 220, 200], [255, 180, 140], [255, 140, 80], [200, 80, 40]] },
    steel: { name: 'Steel', colors: [[40, 50, 60], [100, 120, 140], [160, 180, 200], [220, 230, 240]] },
    aurora: { name: 'Aurora', colors: [[0, 40, 30], [0, 180, 120], [100, 255, 200], [200, 255, 255]] },
    wine: { name: 'Wine', colors: [[40, 0, 20], [100, 20, 50], [180, 60, 80], [255, 180, 180]] },
    honey: { name: 'Honey', colors: [[40, 25, 0], [140, 90, 0], [220, 180, 60], [255, 240, 180]] },
    lavender: { name: 'Lavender', colors: [[240, 230, 255], [200, 180, 255], [160, 120, 240], [100, 60, 180]] },
    emerald: { name: 'Emerald', colors: [[0, 40, 30], [0, 120, 80], [80, 200, 140], [180, 255, 220]] },
    coral: { name: 'Coral', colors: [[255, 220, 210], [255, 160, 140], [255, 100, 80], [200, 50, 50]] },
    slate: { name: 'Slate', colors: [[30, 35, 45], [70, 85, 105], [120, 140, 165], [190, 195, 210]] },
    citrus: { name: 'Citrus', colors: [[255, 240, 0], [255, 200, 0], [255, 140, 0], [200, 80, 0]] },
    berry: { name: 'Berry', colors: [[80, 0, 80], [160, 40, 120], [220, 100, 180], [255, 180, 220]] },
    fog: { name: 'Fog', colors: [[240, 242, 245], [200, 205, 215], [150, 160, 175], [100, 105, 120]] },
    gold: { name: 'Gold', colors: [[40, 30, 0], [120, 90, 0], [200, 160, 40], [255, 230, 140]] },
    cyanMagenta: { name: 'Cyan–Magenta', colors: [[0, 255, 255], [255, 0, 255], [0, 255, 255]] },
    greyscale: { name: 'Greyscale', colors: [[0, 0, 0], [255, 255, 255]] },
    sepia: { name: 'Sepia', colors: [[20, 15, 10], [80, 60, 40], [160, 130, 90], [255, 240, 210]] },
    vaporwave: { name: 'Vaporwave', colors: [[255, 0, 128], [128, 0, 255], [0, 255, 255], [255, 255, 0]] },
    matrix: { name: 'Matrix', colors: [[0, 20, 0], [0, 80, 0], [0, 180, 0], [180, 255, 180]] },
    synthwave: { name: 'Synthwave', colors: [[255, 50, 150], [100, 50, 255], [0, 200, 255], [255, 220, 100]] },
    nord: { name: 'Nord', colors: [[46, 52, 64], [76, 86, 106], [136, 192, 208], [236, 239, 244]] },
    dracula: { name: 'Dracula', colors: [[40, 42, 54], [68, 71, 90], [189, 147, 249], [255, 121, 198]] },
    monokai: { name: 'Monokai', colors: [[39, 40, 34], [249, 38, 114], [166, 226, 46], [253, 151, 31]] },
    tokyoNight: { name: 'Tokyo Night', colors: [[26, 27, 38], [49, 50, 68], [125, 207, 255], [187, 154, 247]] },
    oneDark: { name: 'One Dark', colors: [[40, 44, 52], [97, 175, 239], [152, 195, 121], [229, 192, 123]] },
  };

  const PALETTE_IDS = Object.keys(PALETTES).filter((id) => id !== 'default');

  function getPaletteColor(t, paletteId) {
    const p = PALETTES[paletteId];
    if (!p || !p.colors || p.colors.length === 0) return null;
    const colors = p.colors;
    const T = Math.max(0, Math.min(1, t));
    if (colors.length === 1) return colors[0];
    const i = T * (colors.length - 1);
    const i0 = Math.floor(i);
    const i1 = Math.min(i0 + 1, colors.length - 1);
    const f = i - i0;
    const c0 = colors[i0], c1 = colors[i1];
    return [
      Math.round(c0[0] + (c1[0] - c0[0]) * f),
      Math.round(c0[1] + (c1[1] - c0[1]) * f),
      Math.round(c0[2] + (c1[2] - c0[2]) * f),
    ];
  }

  function getCurrentPresetSnapshot() {
    return {
      outputMode: outputModeEl.value,
      threshold: parseInt(thresholdEl.value, 10) || 128,
      brightness: parseInt(brightnessEl.value, 10) || 0,
      contrast: parseInt(contrastEl.value, 10) || 100,
      gamma: parseInt(gammaEl.value, 10) || 100,
      saturation: parseInt(document.getElementById('saturation').value, 10) || 100,
      blur: parseInt(document.getElementById('blur').value, 10) || 0,
      sharpen: parseInt(document.getElementById('sharpen').value, 10) || 0,
      noise: parseInt(document.getElementById('noise').value, 10) || 0,
      zoom: parseInt(document.getElementById('zoom').value, 10) || 100,
      cols: parseInt(colsEl.value, 10) || 40,
      rows: parseInt(rowsEl.value, 10) || 30,
      dotSize: parseInt(dotSizeEl.value, 10) || 45,
      dither: ditherEl.checked,
      invert: invertEl.checked,
      colorMode: colorModeEl.checked,
      flipH: document.getElementById('flipH').checked,
      flipV: document.getElementById('flipV').checked,
      smooth: parseInt(document.getElementById('smooth').value, 10) || 0,
      postContrast: parseInt(document.getElementById('postContrast').value, 10) || 100,
    };
  }

  function slugify(name) {
    return name.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 30) || 'preset';
  }

  function getCustomPresets() {
    try {
      const raw = localStorage.getItem(CUSTOM_PRESETS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveCustomPresets(list) {
    try {
      localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(list));
    } catch (e) {}
  }

  function loadCustomPresetsIntoPRESETS() {
    for (const p of getCustomPresets()) {
      const { id, name, ...config } = p;
      PRESETS[id] = config;
    }
  }

  function refreshPresetSelect() {
    const custom = getCustomPresets();
    const builtinOpts = {
      '8level': '8-level (default)', '1bit': '1-bit high contrast', 'led': 'LED punchy', 'smooth': 'Smooth continuous',
      'minimal': 'Minimal sparse', 'grain': 'Film grain', 'colorVivid': 'Color vivid', 'colorPastel': 'Color pastel',
      'colorMono': 'Color (desat)', 'bwSoft': 'B&W soft', 'bwPunchy': 'B&W punchy', 'noisy': 'Noisy',
      'mirror': 'Mirror (flip H)', 'softDots': 'Soft dots',
    };
    presetSelectEl.innerHTML = '';
    const opt0 = document.createElement('option');
    opt0.value = '';
    opt0.textContent = 'Custom';
    presetSelectEl.appendChild(opt0);
    for (const id of BUILTIN_PRESET_IDS) {
      const o = document.createElement('option');
      o.value = id;
      o.textContent = builtinOpts[id] || id;
      presetSelectEl.appendChild(o);
    }
    for (const p of custom) {
      const o = document.createElement('option');
      o.value = p.id;
      o.textContent = p.name;
      presetSelectEl.appendChild(o);
    }
  }

  function applyPreset(id) {
    const p = PRESETS[id];
    if (!p) return;
    outputModeEl.value = p.outputMode;
    thresholdEl.value = p.threshold ?? 128;
    brightnessEl.value = p.brightness ?? 0;
    contrastEl.value = p.contrast ?? 100;
    gammaEl.value = p.gamma ?? 100;
    colsEl.value = p.cols ?? 40;
    rowsEl.value = p.rows ?? 30;
    dotSizeEl.value = p.dotSize ?? 45;
    ditherEl.checked = p.dither ?? false;
    invertEl.checked = p.invert ?? false;
    document.getElementById('saturation').value = p.saturation ?? 100;
    document.getElementById('blur').value = p.blur ?? 0;
    document.getElementById('sharpen').value = p.sharpen ?? 0;
    document.getElementById('noise').value = p.noise ?? 0;
    document.getElementById('zoom').value = p.zoom ?? 100;
    colorModeEl.checked = p.colorMode ?? false;
    document.getElementById('flipH').checked = p.flipH ?? false;
    document.getElementById('flipV').checked = p.flipV ?? false;
    document.getElementById('smooth').value = p.smooth ?? 0;
    document.getElementById('postContrast').value = p.postContrast ?? 100;
    updateThresholdVisibility();
    brightnessVal.textContent = brightnessEl.value;
    contrastVal.textContent = (parseInt(contrastEl.value, 10) / 100).toFixed(1);
    gammaVal.textContent = (parseInt(gammaEl.value, 10) / 100).toFixed(1);
    thresholdVal.textContent = thresholdEl.value;
    dotSizeVal.textContent = dotSizeEl.value + '%';
    document.getElementById('saturationVal').textContent = (p.saturation ?? 100) + '%';
    document.getElementById('blurVal').textContent = String(p.blur ?? 0);
    document.getElementById('sharpenVal').textContent = (p.sharpen ?? 0) + '%';
    document.getElementById('noiseVal').textContent = (p.noise ?? 0) + '%';
    document.getElementById('zoomVal').textContent = (p.zoom ?? 100) + '%';
    document.getElementById('smoothVal').textContent = String(p.smooth ?? 0);
    document.getElementById('postContrastVal').textContent = ((p.postContrast ?? 100) / 100).toFixed(1);
    updateCaptureSize();
    drawPreview();
  }

  const CELL = 10;
  let captureCanvas, captureCtx;
  let generatorCanvas, generatorCtx;
  let rafId = null;
  let loopStart = 0;
  let loopEnd = 10;
  let duration = 0;
  let dragHandle = null;
  let didDrag = false;
  let lastDrawTime = 0;
  let webcamStream = null;
  let generatorTime = 0;

  const generatorPanels = {
    video: document.getElementById('optionsVideo'),
    webcam: document.getElementById('optionsWebcam'),
    perlin: document.getElementById('optionsPerlin'),
    waves: document.getElementById('optionsWaves'),
    waves3d: document.getElementById('optionsWaves3d'),
    vertex: document.getElementById('optionsVertex'),
    plasma: document.getElementById('optionsPlasma'),
    terrain: document.getElementById('optionsTerrain'),
  };

  const GENERATOR_MODES = ['perlin', 'waves', 'waves3d', 'vertex', 'plasma', 'terrain'];

  function getSourceMode() {
    return sourceModeEl.value;
  }

  function showGeneratorOptions() {
    const mode = getSourceMode();
    Object.keys(generatorPanels).forEach((key) => {
      generatorPanels[key].classList.toggle('hidden', key !== mode);
    });
    const isVideo = mode === 'video';
    exportDurationRow.classList.toggle('hidden', isVideo);
    exportDurationLabel.textContent = isVideo ? 'Duration (from timeline)' : 'Duration (seconds to capture)';
    drop.classList.toggle('hidden', mode !== 'video');
    if (mode === 'video') {
      videoWrap.classList.toggle('hidden', !duration);
    } else if (mode === 'webcam') {
      videoWrap.classList.toggle('hidden', !webcamStream);
      if (webcamStream) video.srcObject = webcamStream;
    } else {
      videoWrap.classList.add('hidden');
    }
    timelineSection.classList.toggle('hidden', mode !== 'video' || !duration);
    hint.classList.toggle('hidden', mode !== 'video' ? true : !!duration);
    if (mode !== 'video') hint.classList.add('hidden');
    const colorPaletteSection = document.getElementById('colorPaletteSection');
    if (colorPaletteSection) {
      colorPaletteSection.classList.toggle('hidden', !['perlin', 'vertex', 'plasma'].includes(mode));
      if (['perlin', 'vertex', 'plasma'].includes(mode)) colorPaletteSection.open = true;
    }
    updateCaptureSize();
    drawPreview();
  }

  function populatePaletteSelect() {
    const sel = document.getElementById('colorPaletteSelect');
    if (!sel) return;
    sel.innerHTML = '';
    for (const [id, p] of Object.entries(PALETTES)) {
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = p.name;
      sel.appendChild(opt);
    }
  }

  function getSelectedPaletteId() {
    const sel = document.getElementById('colorPaletteSelect');
    return (sel && sel.value) ? sel.value : 'default';
  }

  function handleDrop(e) {
    e.preventDefault();
    document.body.classList.remove('drag-over');
    drop.classList.remove('dragover');
    if (getSourceMode() !== 'video') return;
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith('video/')) loadVideo(f);
  }
  function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }

  drop.addEventListener('click', () => fileInput.click());
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('dragover'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('dragover'));
  drop.addEventListener('drop', handleDrop);

  document.body.addEventListener('dragover', (e) => {
    handleDragOver(e);
    document.body.classList.add('drag-over');
  });
  document.body.addEventListener('dragleave', (e) => {
    if (!e.relatedTarget || !document.body.contains(e.relatedTarget)) document.body.classList.remove('drag-over');
  });
  document.body.addEventListener('drop', handleDrop);

  fileInput.addEventListener('change', () => {
    const f = fileInput.files[0];
    if (f) loadVideo(f);
  });

  function applyPlaybackSpeed() {
    const speed = parseFloat(playbackSpeedEl.value) || 1;
    video.playbackRate = speed;
  }

  function exportNameFromFileName(fileName) {
    const base = fileName.replace(/\.[^/.]+$/, '').trim();
    const words = base.split(/\s+/).filter(Boolean).slice(0, 3);
    return (words.length ? words.join(' ') : base || 'export') + '_dotted';
  }

  function loadVideo(file) {
    const url = URL.createObjectURL(file);
    video.src = url;
    exportNameEl.value = exportNameFromFileName(file.name);
    video.onloadedmetadata = () => {
      duration = video.duration;
      applyPlaybackSpeed();
      loopEnd = duration;
      loopStart = 0;
      startTimeInput.value = '0';
      startTimeInput.max = duration;
      endTimeInput.value = duration.toFixed(1);
      endTimeInput.max = duration;
      endTimeInput.min = 0;
      startTimeInput.min = 0;
      timeDuration.textContent = formatTime(duration);
      videoWrap.classList.remove('hidden');
      timelineSection.classList.remove('hidden');
      hint.classList.add('hidden');
      updateCaptureSize();
      updateTimelineUI();
      drawPreview();
    };
    video.onended = () => { playBtn.disabled = false; pauseBtn.disabled = true; stopLoop(); };
  }

  function formatTime(s) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m + ':' + (sec < 10 ? '0' : '') + sec.toFixed(1);
  }

  function updateTimelineUI() {
    if (!duration) return;
    const t = video.currentTime;
    const startPct = (loopStart / duration) * 100;
    const endPct = (loopEnd / duration) * 100;
    const currentPct = (t / duration) * 100;
    timelineRange.style.left = startPct + '%';
    timelineRange.style.width = (endPct - startPct) + '%';
    timelinePlayhead.style.left = currentPct + '%';
    handleStart.style.left = startPct + '%';
    handleEnd.style.left = endPct + '%';
    timeCurrent.textContent = formatTime(t);
  }

  function seekFromTrack(clientX) {
    const rect = timelineTrack.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    video.currentTime = pct * duration;
    updateTimelineUI();
    drawPreview();
  }

  function getConfig() {
    const mode = outputModeEl.value;
    return {
      outputMode: mode === 'full' ? 'full' : mode === '1' ? 1 : parseInt(mode, 10),
      threshold: parseInt(thresholdEl.value, 10),
      brightness: parseInt(brightnessEl.value, 10),
      contrast: parseInt(contrastEl.value, 10) / 100,
      gamma: parseInt(gammaEl.value, 10) / 100,
      saturation: parseInt(document.getElementById('saturation').value, 10) / 100,
      blur: parseInt(document.getElementById('blur').value, 10) || 0,
      sharpen: parseInt(document.getElementById('sharpen').value, 10) / 100,
      noise: parseInt(document.getElementById('noise').value, 10) / 100,
      zoom: parseInt(document.getElementById('zoom').value, 10) || 100,
      cols: Math.max(8, parseInt(colsEl.value, 10) || 40),
      rows: Math.max(8, parseInt(rowsEl.value, 10) || 30),
      dotSize: parseInt(dotSizeEl.value, 10) / 100,
      dither: ditherEl.checked,
      invert: invertEl.checked,
      flipH: document.getElementById('flipH').checked,
      flipV: document.getElementById('flipV').checked,
      smooth: parseInt(document.getElementById('smooth').value, 10) || 0,
      postContrast: parseInt(document.getElementById('postContrast').value, 10) / 100,
      colorMode: colorModeEl.checked,
    };
  }

  function processGray(gray, cfg) {
    const out = new Float32Array(gray.length);
    for (let i = 0; i < gray.length; i++) {
      let v = gray[i] + cfg.brightness;
      v = ((v / 255 - 0.5) * cfg.contrast + 0.5) * 255;
      v = Math.max(0, Math.min(255, v));
      v = Math.pow(v / 255, cfg.gamma) * 255;
      out[i] = Math.max(0, Math.min(255, v));
    }
    return out;
  }

  function processChannel(v, cfg) {
    let x = v + cfg.brightness;
    x = ((x / 255 - 0.5) * cfg.contrast + 0.5) * 255;
    x = Math.max(0, Math.min(255, x));
    x = Math.pow(x / 255, cfg.gamma) * 255;
    return Math.max(0, Math.min(255, x)) / 255;
  }

  function applyPreprocessing(imgData, cfg) {
    const { width: w, height: h, data: d } = imgData;
    const n = w * h;
    let out = new Uint8ClampedArray(d.length);
    out.set(d);

    const get = (arr, x, y, c) => {
      const ix = Math.max(0, Math.min(w - 1, x));
      const iy = Math.max(0, Math.min(h - 1, y));
      return arr[(iy * w + ix) * 4 + c];
    };

    if (cfg.blur > 0) {
      const r = cfg.blur;
      const tmp = new Uint8ClampedArray(out.length);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          for (let c = 0; c < 3; c++) {
            let sum = 0, count = 0;
            for (let dy = -r; dy <= r; dy++) {
              for (let dx = -r; dx <= r; dx++) {
                sum += get(out, x + dx, y + dy, c);
                count++;
              }
            }
            tmp[(y * w + x) * 4 + c] = sum / count;
          }
          tmp[(y * w + x) * 4 + 3] = 255;
        }
      }
      out = tmp;
    }

    if (cfg.sharpen > 0) {
      const tmp = new Uint8ClampedArray(out.length);
      const k = cfg.sharpen;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          for (let c = 0; c < 3; c++) {
            const c0 = get(out, x, y, c);
            const lap = 4 * c0 - get(out, x - 1, y, c) - get(out, x + 1, y, c) - get(out, x, y - 1, c) - get(out, x, y + 1, c);
            const v = c0 + lap * k;
            tmp[(y * w + x) * 4 + c] = Math.max(0, Math.min(255, v));
          }
          tmp[(y * w + x) * 4 + 3] = 255;
        }
      }
      out = tmp;
    }

    if (cfg.saturation !== 1) {
      const sat = cfg.saturation;
      for (let i = 0; i < n; i++) {
        const r = out[i * 4], g = out[i * 4 + 1], b = out[i * 4 + 2];
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        out[i * 4] = Math.max(0, Math.min(255, gray + (r - gray) * sat));
        out[i * 4 + 1] = Math.max(0, Math.min(255, gray + (g - gray) * sat));
        out[i * 4 + 2] = Math.max(0, Math.min(255, gray + (b - gray) * sat));
      }
    }

    if (cfg.noise > 0) {
      const amt = cfg.noise * 255;
      for (let i = 0; i < n * 4; i++) {
        if (i % 4 === 3) continue;
        const v = out[i] + (Math.random() - 0.5) * 2 * amt;
        out[i] = Math.max(0, Math.min(255, v));
      }
    }

    const result = new ImageData(new Uint8ClampedArray(out), w, h);
    return result;
  }

  function applyPostProcessing(dots, cols, rows, cfg) {
    let out = dots.slice();
    const isColor = Array.isArray(out[0]);

    if (cfg.flipH) {
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < Math.floor(cols / 2); col++) {
          const a = row * cols + col;
          const b = row * cols + (cols - 1 - col);
          [out[a], out[b]] = [out[b], out[a]];
        }
      }
    }
    if (cfg.flipV) {
      for (let row = 0; row < Math.floor(rows / 2); row++) {
        for (let col = 0; col < cols; col++) {
          const a = row * cols + col;
          const b = (rows - 1 - row) * cols + col;
          [out[a], out[b]] = [out[b], out[a]];
        }
      }
    }

    if (cfg.smooth > 0) {
      const passes = cfg.smooth;
      const get = (arr, i, j) => {
        if (i < 0 || i >= rows || j < 0 || j >= cols) return null;
        const v = arr[i * cols + j];
        return isColor ? v.slice() : v;
      };
      for (let p = 0; p < passes; p++) {
        const next = out.slice();
        for (let i = 0; i < rows; i++) {
          for (let j = 0; j < cols; j++) {
            const idx = i * cols + j;
            if (isColor) {
              const c0 = get(out, i, j);
              const c1 = get(out, i - 1, j);
              const c2 = get(out, i + 1, j);
              const c3 = get(out, i, j - 1);
              const c4 = get(out, i, j + 1);
              let n = 1;
              const sum = [c0[0], c0[1], c0[2]];
              if (c1) { sum[0] += c1[0]; sum[1] += c1[1]; sum[2] += c1[2]; n++; }
              if (c2) { sum[0] += c2[0]; sum[1] += c2[1]; sum[2] += c2[2]; n++; }
              if (c3) { sum[0] += c3[0]; sum[1] += c3[1]; sum[2] += c3[2]; n++; }
              if (c4) { sum[0] += c4[0]; sum[1] += c4[1]; sum[2] += c4[2]; n++; }
              next[idx] = [sum[0] / n, sum[1] / n, sum[2] / n];
            } else {
              const v0 = get(out, i, j);
              const v1 = get(out, i - 1, j);
              const v2 = get(out, i + 1, j);
              const v3 = get(out, i, j - 1);
              const v4 = get(out, i, j + 1);
              let n = 1, sum = v0;
              if (v1 != null) { sum += v1; n++; }
              if (v2 != null) { sum += v2; n++; }
              if (v3 != null) { sum += v3; n++; }
              if (v4 != null) { sum += v4; n++; }
              next[idx] = sum / n;
            }
          }
        }
        out = next;
      }
    }

    if (cfg.postContrast !== 1) {
      const C = cfg.postContrast;
      for (let i = 0; i < out.length; i++) {
        if (isColor) {
          out[i] = out[i].map((v) => Math.max(0, Math.min(1, (v - 0.5) * C + 0.5)));
        } else {
          out[i] = Math.max(0, Math.min(1, (out[i] - 0.5) * C + 0.5));
        }
      }
    }

    return out;
  }

  function ditherToLevels(buf, cols, rows, levels) {
    const out = new Float32Array(buf.length);
    for (let i = 0; i < buf.length; i++) out[i] = buf[i];
    const step = 255 / (levels - 1);
    for (let i = 0; i < out.length; i++) {
      const old = out[i];
      const nearest = Math.round(old / step) * step;
      out[i] = nearest;
      const err = old - nearest;
      const x = i % cols;
      const y = (i / cols) | 0;
      if (x + 1 < cols) out[i + 1] = Math.max(0, Math.min(255, out[i + 1] + err * 7 / 16));
      if (y + 1 < rows) {
        if (x > 0) out[i + cols - 1] = Math.max(0, Math.min(255, out[i + cols - 1] + err * 3 / 16));
        out[i + cols] = Math.max(0, Math.min(255, out[i + cols] + err * 5 / 16));
        if (x + 1 < cols) out[i + cols + 1] = Math.max(0, Math.min(255, out[i + cols + 1] + err * 1 / 16));
      }
    }
    return Array.from(out).map(v => v / 255);
  }

  function updateCaptureSize() {
    const { cols, rows } = getConfig();
    if (!captureCanvas || captureCanvas.width !== cols || captureCanvas.height !== rows) {
      captureCanvas = document.createElement('canvas');
      captureCanvas.width = cols;
      captureCanvas.height = rows;
      captureCtx = captureCanvas.getContext('2d');
    }
    const mode = getSourceMode();
    if (GENERATOR_MODES.includes(mode) && (!generatorCanvas || generatorCanvas.width !== cols || generatorCanvas.height !== rows)) {
      generatorCanvas = document.createElement('canvas');
      generatorCanvas.width = cols;
      generatorCanvas.height = rows;
      generatorCtx = generatorCanvas.getContext('2d');
    }
  }

  // Simple 2D Perlin-like noise (permutation + smooth)
  const PERM = new Uint8Array(512);
  (function () {
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [p[i], p[j]] = [p[j], p[i]];
    }
    for (let i = 0; i < 512; i++) PERM[i] = p[i & 255];
  })();
  function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
  function lerp(a, b, t) { return a + t * (b - a); }
  function grad2(h, x, y) {
    const g = (h & 3) === 0 ? [1, 1] : (h & 3) === 1 ? [-1, 1] : (h & 3) === 2 ? [1, -1] : [-1, -1];
    return g[0] * x + g[1] * y;
  }
  function perlin2(x, y, z) {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
    x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
    const u = fade(x), v = fade(y), w = fade(z);
    const A = PERM[X] + Y, B = PERM[X + 1] + Y;
    const AA = PERM[A] + Z, AB = PERM[A + 1] + Z, BA = PERM[B] + Z, BB = PERM[B + 1] + Z;
    return lerp(lerp(lerp(grad2(PERM[AA], x, y), grad2(PERM[BA], x - 1, y), u),
      lerp(grad2(PERM[AB], x, y - 1), grad2(PERM[BB], x - 1, y - 1), u), v),
      lerp(lerp(grad2(PERM[AA + 1], x, y), grad2(PERM[BA + 1], x - 1, y), u),
        lerp(grad2(PERM[AB + 1], x, y - 1), grad2(PERM[BB + 1], x - 1, y - 1), u), v), w) * 0.5 + 0.5;
  }

  function drawPerlinFrame() {
    if (!generatorCtx || !generatorCanvas) return;
    const cols = generatorCanvas.width, rows = generatorCanvas.height;
    const speed = (parseInt(document.getElementById('perlinSpeed').value, 10) || 60) / 1000;
    const scale = (parseInt(document.getElementById('perlinScale').value, 10) || 25) / 10;
    const octaves = Math.max(1, parseInt(document.getElementById('perlinOctaves').value, 10) || 2);
    const colorMode = document.getElementById('perlinColor').checked;
    const paletteId = getSelectedPaletteId();
    const usePalette = colorMode && paletteId !== 'default' && getPaletteColor(0.5, paletteId);
    const img = generatorCtx.createImageData(cols, rows);
    const offR = 0;
    const offG = 77.7;
    const offB = 133.3;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const nx = x * scale / cols;
        const ny = y * scale / rows;
        const t = generatorTime * speed;
        if (colorMode) {
          let r = 0, g = 0, b = 0, f = 1, a = 1, sum = 0;
          for (let o = 0; o < octaves; o++) {
            r += a * perlin2(nx * f + offR, ny * f, t * f + offR);
            g += a * perlin2(nx * f + offG, ny * f + offG * 0.5, t * f + offG);
            b += a * perlin2(nx * f + offB, ny * f + offB * 0.3, t * f + offB);
            sum += a;
            a *= 0.5;
            f *= 2;
          }
          const s = 1 / sum;
          if (usePalette) {
            const v = (r * s + g * s + b * s) / 3;
            const rgb = getPaletteColor(v, paletteId);
            if (rgb) {
              img.data[(y * cols + x) * 4] = Math.max(0, Math.min(255, rgb[0]));
              img.data[(y * cols + x) * 4 + 1] = Math.max(0, Math.min(255, rgb[1]));
              img.data[(y * cols + x) * 4 + 2] = Math.max(0, Math.min(255, rgb[2]));
            } else {
              img.data[(y * cols + x) * 4] = Math.max(0, Math.min(255, (r * s) * 255)) | 0;
              img.data[(y * cols + x) * 4 + 1] = Math.max(0, Math.min(255, (g * s) * 255)) | 0;
              img.data[(y * cols + x) * 4 + 2] = Math.max(0, Math.min(255, (b * s) * 255)) | 0;
            }
          } else {
            img.data[(y * cols + x) * 4] = Math.max(0, Math.min(255, (r * s) * 255)) | 0;
            img.data[(y * cols + x) * 4 + 1] = Math.max(0, Math.min(255, (g * s) * 255)) | 0;
            img.data[(y * cols + x) * 4 + 2] = Math.max(0, Math.min(255, (b * s) * 255)) | 0;
          }
        } else {
          let v = 0, f = 1, a = 1, sum = 0;
          for (let o = 0; o < octaves; o++) {
            v += a * perlin2(nx * f, ny * f, t * f);
            sum += a;
            a *= 0.5;
            f *= 2;
          }
          v = Math.max(0, Math.min(255, (v / sum) * 255)) | 0;
          const i = (y * cols + x) * 4;
          img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        }
        img.data[(y * cols + x) * 4 + 3] = 255;
      }
    }
    generatorCtx.putImageData(img, 0, 0);
  }

  function drawWavesFrame() {
    if (!generatorCtx || !generatorCanvas) return;
    const cols = generatorCanvas.width, rows = generatorCanvas.height;
    const freq = parseInt(document.getElementById('wavesFreq').value, 10) || 4;
    const speed = (parseInt(document.getElementById('wavesSpeed').value, 10) || 50) / 100;
    const amp = (parseInt(document.getElementById('wavesAmp').value, 10) || 50) / 100;
    const img = generatorCtx.createImageData(cols, rows);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const nx = x / cols, ny = y / rows;
        const v = (Math.sin(nx * Math.PI * 2 * freq + generatorTime * speed) * 0.5 + 0.5) * amp +
          (Math.sin(ny * Math.PI * 2 * freq * 0.7 + generatorTime * speed * 1.1) * 0.5 + 0.5) * amp;
        const c = Math.max(0, Math.min(255, (v * 255) | 0));
        const i = (y * cols + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = c;
        img.data[i + 3] = 255;
      }
    }
    generatorCtx.putImageData(img, 0, 0);
  }

  function height3DWaves(nx, ny, t, freq, amp) {
    return (Math.sin(nx * Math.PI * 2 * freq + t) * 0.5 + 0.5) * amp +
      (Math.sin(ny * Math.PI * 2 * freq * 0.8 + t * 1.2) * 0.5 + 0.5) * amp;
  }

  function draw3DWavesFrame() {
    if (!generatorCtx || !generatorCanvas) return;
    const cols = generatorCanvas.width, rows = generatorCanvas.height;
    const freq = parseInt(document.getElementById('waves3dFreq').value, 10) || 3;
    const speed = (parseInt(document.getElementById('waves3dSpeed').value, 10) || 40) / 100;
    const amp = (parseInt(document.getElementById('waves3dAmp').value, 10) || 70) / 100;
    const lightDeg = (parseInt(document.getElementById('waves3dLight').value, 10) || 315) * (Math.PI / 180);
    const lx = Math.cos(lightDeg);
    const ly = Math.sin(lightDeg);
    const t = generatorTime * speed;
    const img = generatorCtx.createImageData(cols, rows);
    const step = 1 / Math.max(cols, rows);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const nx = x / cols, ny = y / rows;
        const h = height3DWaves(nx, ny, t, freq, amp);
        const hx = (height3DWaves(nx + step, ny, t, freq, amp) - height3DWaves(nx - step, ny, t, freq, amp)) * 0.5;
        const hy = (height3DWaves(nx, ny + step, t, freq, amp) - height3DWaves(nx, ny - step, t, freq, amp)) * 0.5;
        const nz = 1;
        const len = Math.sqrt(hx * hx + hy * hy + nz * nz) || 1;
        const shade = Math.max(0, Math.min(1, (-hx * lx - hy * ly + nz * 0.3) / len * 1.2 + 0.5));
        const c = Math.max(0, Math.min(255, (h * shade * 255) | 0));
        const i = (y * cols + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = c;
        img.data[i + 3] = 255;
      }
    }
    generatorCtx.putImageData(img, 0, 0);
  }

  function drawVertexFrame() {
    if (!generatorCtx || !generatorCanvas) return;
    const cols = generatorCanvas.width, rows = generatorCanvas.height;
    const speed = (parseInt(document.getElementById('vertexSpeed').value, 10) || 60) / 100;
    const depth = (parseInt(document.getElementById('vertexDepth').value, 10) || 60) / 100;
    const wavelength = Math.max(1, parseInt(document.getElementById('vertexWavelength').value, 10) || 5);
    const colorMode = document.getElementById('vertexColor').checked;
    const t = generatorTime * speed;
    const img = generatorCtx.createImageData(cols, rows);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const nx = x / cols, ny = y / rows;
        const z = (Math.sin(nx * Math.PI * 2 * wavelength + t) * 0.5 + 0.5) * depth +
          (Math.sin(ny * Math.PI * 2 * wavelength * 0.6 + t * 1.3) * 0.5 + 0.5) * depth;
        const v = Math.max(0, Math.min(1, z * 1.2));
        if (colorMode) {
          const paletteId = getSelectedPaletteId();
          const rgb = paletteId !== 'default' ? getPaletteColor(v, paletteId) : null;
          if (rgb) {
            img.data[(y * cols + x) * 4] = Math.max(0, Math.min(255, rgb[0]));
            img.data[(y * cols + x) * 4 + 1] = Math.max(0, Math.min(255, rgb[1]));
            img.data[(y * cols + x) * 4 + 2] = Math.max(0, Math.min(255, rgb[2]));
          } else {
            const r = Math.max(0, Math.min(255, (v * 0.9 + nx * 0.1) * 255)) | 0;
            const g = Math.max(0, Math.min(255, (v * 0.7 + ny * 0.3) * 255)) | 0;
            const b = Math.max(0, Math.min(255, (v * 0.5 + (1 - nx) * 0.5) * 255)) | 0;
            img.data[(y * cols + x) * 4] = r;
            img.data[(y * cols + x) * 4 + 1] = g;
            img.data[(y * cols + x) * 4 + 2] = b;
          }
        } else {
          const c = Math.max(0, Math.min(255, (v * 255) | 0));
          const i = (y * cols + x) * 4;
          img.data[i] = img.data[i + 1] = img.data[i + 2] = c;
        }
        img.data[(y * cols + x) * 4 + 3] = 255;
      }
    }
    generatorCtx.putImageData(img, 0, 0);
  }

  function drawPlasmaFrame() {
    if (!generatorCtx || !generatorCanvas) return;
    const cols = generatorCanvas.width, rows = generatorCanvas.height;
    const speed = (parseInt(document.getElementById('plasmaSpeed').value, 10) || 50) / 100;
    const scale = (parseInt(document.getElementById('plasmaScale').value, 10) || 20) / 10;
    const colorMode = document.getElementById('plasmaColor').checked;
    const t = generatorTime * speed;
    const img = generatorCtx.createImageData(cols, rows);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const nx = x / cols, ny = y / rows;
        const v = (
          Math.sin(nx * scale * 10 + t) +
          Math.sin(ny * scale * 10 + t * 1.1) +
          Math.sin((nx + ny) * scale * 10 + t * 0.9) +
          Math.sin(Math.sqrt((nx - 0.5) ** 2 + (ny - 0.5) ** 2) * scale * 15 + t)
        ) * 0.25 + 0.5;
        const vc = Math.max(0, Math.min(255, (v * 255) | 0));
        if (colorMode) {
          const paletteId = getSelectedPaletteId();
          const rgb = paletteId !== 'default' ? getPaletteColor(v, paletteId) : null;
          if (rgb) {
            img.data[(y * cols + x) * 4] = Math.max(0, Math.min(255, rgb[0]));
            img.data[(y * cols + x) * 4 + 1] = Math.max(0, Math.min(255, rgb[1]));
            img.data[(y * cols + x) * 4 + 2] = Math.max(0, Math.min(255, rgb[2]));
          } else {
            img.data[(y * cols + x) * 4] = Math.max(0, Math.min(255, (v * 255) | 0));
            img.data[(y * cols + x) * 4 + 1] = Math.max(0, Math.min(255, ((1 - v) * 200 + 55) | 0));
            img.data[(y * cols + x) * 4 + 2] = Math.max(0, Math.min(255, ((v * 0.5 + 0.5) * 255) | 0));
          }
        } else {
          const i = (y * cols + x) * 4;
          img.data[i] = img.data[i + 1] = img.data[i + 2] = vc;
        }
        img.data[(y * cols + x) * 4 + 3] = 255;
      }
    }
    generatorCtx.putImageData(img, 0, 0);
  }

  function drawTerrainFrame() {
    if (!generatorCtx || !generatorCanvas) return;
    const cols = generatorCanvas.width, rows = generatorCanvas.height;
    const speed = (parseInt(document.getElementById('terrainSpeed').value, 10) || 30) / 1000;
    const scale = (parseInt(document.getElementById('terrainScale').value, 10) || 18) / 10;
    const lightDeg = (parseInt(document.getElementById('terrainLight').value, 10) || 45) * (Math.PI / 180);
    const lx = Math.cos(lightDeg);
    const ly = Math.sin(lightDeg);
    const t = generatorTime * speed;
    const img = generatorCtx.createImageData(cols, rows);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const nx = x * scale / cols;
        const ny = y * scale / rows;
        const h = perlin2(nx, ny, t) * 0.6 + perlin2(nx * 2, ny * 2, t * 0.7) * 0.3 + 0.1;
        const hx = (perlin2(nx + 0.05, ny, t) - perlin2(nx - 0.05, ny, t)) * 5;
        const hy = (perlin2(nx, ny + 0.05, t) - perlin2(nx, ny - 0.05, t)) * 5;
        const shade = Math.max(0, Math.min(1, (-hx * lx - hy * ly) * 2 + 0.6));
        const c = Math.max(0, Math.min(255, (h * shade * 255) | 0));
        const i = (y * cols + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = c;
        img.data[i + 3] = 255;
      }
    }
    generatorCtx.putImageData(img, 0, 0);
  }

  function getCurrentFrameSource() {
    const mode = getSourceMode();
    if (mode === 'video' || mode === 'webcam') return video;
    if (mode === 'perlin') { drawPerlinFrame(); return generatorCanvas; }
    if (mode === 'waves') { drawWavesFrame(); return generatorCanvas; }
    if (mode === 'waves3d') { draw3DWavesFrame(); return generatorCanvas; }
    if (mode === 'vertex') { drawVertexFrame(); return generatorCanvas; }
    if (mode === 'plasma') { drawPlasmaFrame(); return generatorCanvas; }
    if (mode === 'terrain') { drawTerrainFrame(); return generatorCanvas; }
    return video;
  }

  function frameToDots() {
    const mode = getSourceMode();
    const useVideo = mode === 'video' || mode === 'webcam';
    if (useVideo && video.readyState < 2) return null;
    updateCaptureSize();
    const cfg = getConfig();
    const { cols, rows, threshold, outputMode, dither, invert, colorMode } = cfg;
    const source = getCurrentFrameSource();
    const zoomPct = cfg.zoom || 100;
    const zoomFactor = zoomPct / 100;
    const sw = source.videoWidth ?? source.width;
    const sh = source.videoHeight ?? source.height;
    if (sw && sh) {
      if (zoomFactor > 1) {
        const cw = sw / zoomFactor;
        const ch = sh / zoomFactor;
        const sx = (sw - cw) / 2;
        const sy = (sh - ch) / 2;
        captureCtx.drawImage(source, sx, sy, cw, ch, 0, 0, cols, rows);
      } else if (zoomFactor < 1) {
        captureCtx.fillStyle = '#000';
        captureCtx.fillRect(0, 0, cols, rows);
        const dw = cols * zoomFactor;
        const dh = rows * zoomFactor;
        const dx = (cols - dw) / 2;
        const dy = (rows - dh) / 2;
        captureCtx.drawImage(source, 0, 0, sw, sh, dx, dy, dw, dh);
      } else {
        captureCtx.drawImage(source, 0, 0, sw, sh, 0, 0, cols, rows);
      }
    } else {
      captureCtx.drawImage(source, 0, 0, cols, rows);
    }
    let imgData = captureCtx.getImageData(0, 0, cols, rows);
    imgData = applyPreprocessing(imgData, cfg);

    if (colorMode) {
      const dots = [];
      for (let i = 0; i < cols * rows; i++) {
        let r = processChannel(imgData.data[i * 4], cfg);
        let g = processChannel(imgData.data[i * 4 + 1], cfg);
        let b = processChannel(imgData.data[i * 4 + 2], cfg);
        dots.push([r, g, b]);
      }
      let out = applyPostProcessing(dots, cols, rows, cfg);
      if (invert) out = out.map(([r, g, b]) => [1 - r, 1 - g, 1 - b]);
      return { cols, rows, dots: out, colorMode: true };
    }

    const gray = new Uint8Array(cols * rows);
    for (let i = 0; i < gray.length; i++) {
      const r = imgData.data[i * 4];
      const g = imgData.data[i * 4 + 1];
      const b = imgData.data[i * 4 + 2];
      gray[i] = (0.299 * r + 0.587 * g + 0.114 * b) | 0;
    }
    let processed = processGray(gray, cfg);
    let out;
    if (outputMode === 'full') {
      out = Array.from(processed).map(p => p / 255);
    } else if (outputMode === 1) {
      if (dither) {
        const buf = Array.from(processed);
        for (let i = 0; i < buf.length; i++) {
          const old = buf[i];
          const newVal = old < 128 ? 0 : 255;
          buf[i] = newVal;
          const err = old - newVal;
          const x = i % cols;
          const y = (i / cols) | 0;
          if (x + 1 < cols) buf[i + 1] = Math.max(0, Math.min(255, buf[i + 1] + err * 7 / 16));
          if (y + 1 < rows) {
            if (x > 0) buf[i + cols - 1] = Math.max(0, Math.min(255, buf[i + cols - 1] + err * 3 / 16));
            buf[i + cols] = Math.max(0, Math.min(255, buf[i + cols] + err * 5 / 16));
            if (x + 1 < cols) buf[i + cols + 1] = Math.max(0, Math.min(255, buf[i + cols + 1] + err * 1 / 16));
          }
        }
        out = buf.map(p => p > 0 ? 1.0 : 0.0);
      } else {
        out = Array.from(processed).map(p => (p > threshold ? 1.0 : 0.0));
      }
    } else {
      const levels = outputMode;
      if (dither) {
        out = ditherToLevels(processed, cols, rows, levels);
      } else {
        const step = 255 / (levels - 1);
        out = Array.from(processed).map(p => {
          const q = Math.round(p / step) * step;
          return Math.max(0, Math.min(1, q / 255));
        });
      }
    }
    out = applyPostProcessing(out, cols, rows, cfg);
    if (invert) out = out.map(p => 1.0 - p);
    return { cols, rows, dots: out };
  }

  function drawPreview() {
    const result = frameToDots();
    if (!result) return;
    const { cols, rows, dots, colorMode } = result;
    const dotSize = getConfig().dotSize;
    previewCanvas.width = cols * CELL;
    previewCanvas.height = rows * CELL;
    previewCtx.fillStyle = '#000';
    previewCtx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);
    const rad = (CELL / 2) * dotSize;
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        const idx = i * cols + j;
        const x = j * CELL + CELL / 2;
        const y = i * CELL + CELL / 2;
        if (colorMode) {
          const [r, g, b] = dots[idx];
          previewCtx.fillStyle = `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`;
        } else {
          const opacity = dots[idx];
          if (opacity <= 0) continue;
          previewCtx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
        }
        previewCtx.beginPath();
        previewCtx.arc(x, y, rad, 0, Math.PI * 2);
        previewCtx.fill();
      }
    }
  }

  function loop(now) {
    const mode = getSourceMode();
    if (GENERATOR_MODES.includes(mode)) generatorTime = now / 1000;
    const fps = Math.max(1, Math.min(60, parseInt(previewFpsEl.value, 10) || 15));
    const interval = 1000 / fps;
    if (now - lastDrawTime >= interval) {
      lastDrawTime = now;
      drawPreview();
    }
    rafId = requestAnimationFrame(loop);
  }

  function stopLoop() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
  }

  function seekVideo(t) {
    return new Promise((resolve) => {
      video.onseeked = () => { video.onseeked = null; resolve(); };
      video.currentTime = t;
    });
  }

  async function captureExportFrames() {
    const cfg = getConfig();
    const fps = Math.max(1, Math.min(60, parseInt(previewFpsEl.value, 10) || 15));
    const mode = getSourceMode();
    let frameCount, frames = [];

    if (mode === 'video' && duration) {
      frameCount = Math.max(1, Math.ceil((loopEnd - loopStart) * fps));
      const wasPaused = video.paused;
      const savedTime = video.currentTime;
      if (!video.paused) video.pause();
      for (let i = 0; i < frameCount; i++) {
        const t = loopStart + (i / fps);
        await seekVideo(t);
        const result = frameToDots();
        if (result) frames.push(result.dots);
      }
      await seekVideo(savedTime);
      if (!wasPaused) video.play();
    } else {
      const secs = Math.max(0.5, parseFloat(exportDurationEl.value) || 2);
      frameCount = Math.max(1, Math.ceil(secs * fps));
      if (mode === 'webcam' && webcamStream) {
        for (let i = 0; i < frameCount; i++) {
          await new Promise((r) => setTimeout(r, 1000 / fps));
          const result = frameToDots();
          if (result) frames.push(result.dots);
        }
      } else if (GENERATOR_MODES.includes(mode)) {
        const savedTime = generatorTime;
        for (let i = 0; i < frameCount; i++) {
          generatorTime = savedTime + i / fps;
          const result = frameToDots();
          if (result) frames.push(result.dots);
        }
        generatorTime = savedTime;
      } else {
        const result = frameToDots();
        if (result) for (let i = 0; i < frameCount; i++) frames.push(result.dots);
      }
    }

    const output = {
      cols: cfg.cols,
      rows: cfg.rows,
      fps,
      frameCount: frames.length,
      frames,
    };
    if (cfg.colorMode) output.colorMode = true;
    const name = (exportNameEl.value || '').trim();
    if (name) output.name = name;
    return JSON.stringify(output);
  }

  async function copyJson() {
    const mode = getSourceMode();
    if (mode === 'video' && !duration) {
      copyJsonStatus.textContent = 'Load a video first';
      setTimeout(() => { copyJsonStatus.textContent = ''; }, 2000);
      return;
    }
    if (mode === 'webcam' && !webcamStream) {
      copyJsonStatus.textContent = 'Start camera first';
      setTimeout(() => { copyJsonStatus.textContent = ''; }, 2000);
      return;
    }
    copyJsonBtn.disabled = true;
    copyJsonStatus.textContent = 'Copying…';
    try {
      const json = await captureExportFrames();
      await navigator.clipboard.writeText(json);
      copyJsonStatus.textContent = 'Copied!';
    } catch (e) {
      copyJsonStatus.textContent = 'Failed';
    }
    copyJsonBtn.disabled = false;
    setTimeout(() => { copyJsonStatus.textContent = ''; }, 2500);
  }

  function updateThresholdVisibility() {
    thresholdGroup.style.display = outputModeEl.value === '1' ? 'block' : 'none';
  }


  video.addEventListener('seeked', drawPreview);
  video.addEventListener('timeupdate', () => {
    updateTimelineUI();
    if (video.currentTime >= loopEnd) {
      video.currentTime = loopStart;
    }
  });

  handleStart.addEventListener('mousedown', (e) => { e.preventDefault(); dragHandle = 'start'; didDrag = false; });
  handleEnd.addEventListener('mousedown', (e) => { e.preventDefault(); dragHandle = 'end'; didDrag = false; });
  document.addEventListener('mousemove', (e) => {
    if (dragHandle === null || !duration) return;
    didDrag = true;
    const rect = timelineTrack.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const t = pct * duration;
    if (dragHandle === 'start') {
      loopStart = Math.max(0, Math.min(t, loopEnd - 0.05));
      startTimeInput.value = loopStart.toFixed(2);
    } else {
      loopEnd = Math.max(loopStart + 0.05, Math.min(t, duration));
      endTimeInput.value = loopEnd.toFixed(2);
    }
    updateTimelineUI();
  });
  document.addEventListener('mouseup', () => { dragHandle = null; });
  timelineTrack.addEventListener('click', (e) => {
    if (didDrag) { didDrag = false; return; }
    if (e.target === handleStart || e.target === handleEnd) return;
    seekFromTrack(e.clientX);
  }, true);

  startTimeInput.addEventListener('change', () => {
    loopStart = Math.max(0, Math.min(parseFloat(startTimeInput.value) || 0, loopEnd - 0.05));
    startTimeInput.value = loopStart.toFixed(2);
    video.currentTime = Math.max(loopStart, Math.min(video.currentTime, loopEnd));
    updateTimelineUI();
  });
  endTimeInput.addEventListener('change', () => {
    loopEnd = Math.max(loopStart + 0.05, Math.min(parseFloat(endTimeInput.value) || duration, duration));
    endTimeInput.value = loopEnd.toFixed(2);
    video.currentTime = Math.max(loopStart, Math.min(video.currentTime, loopEnd));
    updateTimelineUI();
  });

  function setPresetCustom() {
    presetSelectEl.value = '';
  }

  presetSelectEl.addEventListener('change', () => {
    if (presetSelectEl.value) applyPreset(presetSelectEl.value);
  });

  outputModeEl.addEventListener('change', () => { setPresetCustom(); updateThresholdVisibility(); drawPreview(); });
  thresholdEl.addEventListener('input', () => {
    setPresetCustom();
    thresholdVal.textContent = thresholdEl.value;
    drawPreview();
  });
  brightnessEl.addEventListener('input', () => {
    setPresetCustom();
    brightnessVal.textContent = brightnessEl.value;
    drawPreview();
  });
  contrastEl.addEventListener('input', () => {
    setPresetCustom();
    contrastVal.textContent = (parseInt(contrastEl.value, 10) / 100).toFixed(1);
    drawPreview();
  });
  gammaEl.addEventListener('input', () => {
    setPresetCustom();
    gammaVal.textContent = (parseInt(gammaEl.value, 10) / 100).toFixed(1);
    drawPreview();
  });
  dotSizeEl.addEventListener('input', () => {
    setPresetCustom();
    dotSizeVal.textContent = dotSizeEl.value + '%';
    drawPreview();
  });
  colsEl.addEventListener('input', () => { setPresetCustom(); updateCaptureSize(); drawPreview(); });
  rowsEl.addEventListener('input', () => { setPresetCustom(); updateCaptureSize(); drawPreview(); });
  ditherEl.addEventListener('change', () => { setPresetCustom(); drawPreview(); });
  invertEl.addEventListener('change', () => { setPresetCustom(); drawPreview(); });
  colorModeEl.addEventListener('change', () => { setPresetCustom(); drawPreview(); });

  const satEl = document.getElementById('saturation');
  const blurEl = document.getElementById('blur');
  const sharpenEl = document.getElementById('sharpen');
  const noiseEl = document.getElementById('noise');
  const smoothEl = document.getElementById('smooth');
  const postContrastEl = document.getElementById('postContrast');
  satEl.addEventListener('input', () => { setPresetCustom(); document.getElementById('saturationVal').textContent = satEl.value + '%'; drawPreview(); });
  blurEl.addEventListener('input', () => { setPresetCustom(); document.getElementById('blurVal').textContent = blurEl.value; drawPreview(); });
  sharpenEl.addEventListener('input', () => { setPresetCustom(); document.getElementById('sharpenVal').textContent = sharpenEl.value + '%'; drawPreview(); });
  noiseEl.addEventListener('input', () => { setPresetCustom(); document.getElementById('noiseVal').textContent = noiseEl.value + '%'; drawPreview(); });
  document.getElementById('zoom').addEventListener('input', () => { setPresetCustom(); document.getElementById('zoomVal').textContent = document.getElementById('zoom').value + '%'; drawPreview(); });
  smoothEl.addEventListener('input', () => { setPresetCustom(); document.getElementById('smoothVal').textContent = smoothEl.value; drawPreview(); });
  postContrastEl.addEventListener('input', () => { setPresetCustom(); document.getElementById('postContrastVal').textContent = (parseInt(postContrastEl.value, 10) / 100).toFixed(1); drawPreview(); });
  document.getElementById('flipH').addEventListener('change', () => { setPresetCustom(); drawPreview(); });
  document.getElementById('flipV').addEventListener('change', () => { setPresetCustom(); drawPreview(); });

  updateThresholdVisibility();
  if (!presetSelectEl.value) presetSelectEl.value = '8level';
  brightnessVal.textContent = brightnessEl.value;
  contrastVal.textContent = (parseInt(contrastEl.value, 10) / 100).toFixed(1);
  gammaVal.textContent = (parseInt(gammaEl.value, 10) / 100).toFixed(1);
  thresholdVal.textContent = thresholdEl.value;
  dotSizeVal.textContent = dotSizeEl.value + '%';
  document.getElementById('saturationVal').textContent = satEl.value + '%';
  document.getElementById('blurVal').textContent = blurEl.value;
  document.getElementById('sharpenVal').textContent = sharpenEl.value + '%';
  document.getElementById('noiseVal').textContent = noiseEl.value + '%';
  document.getElementById('zoomVal').textContent = document.getElementById('zoom').value + '%';
  document.getElementById('smoothVal').textContent = smoothEl.value;
  document.getElementById('postContrastVal').textContent = (parseInt(postContrastEl.value, 10) / 100).toFixed(1);

  playbackSpeedEl.addEventListener('change', () => { applyPlaybackSpeed(); });
  previewFpsEl.addEventListener('input', () => { });
  previewFpsEl.addEventListener('change', drawPreview);

  copyJsonBtn.addEventListener('click', copyJson);

  sourceModeEl.addEventListener('change', showGeneratorOptions);

  loadCustomPresetsIntoPRESETS();
  refreshPresetSelect();

  document.getElementById('presetSaveBtn').addEventListener('click', () => {
    const nameInput = document.getElementById('presetNameInput');
    const statusEl = document.getElementById('presetSaveStatus');
    const name = (nameInput.value || '').trim();
    if (!name) {
      statusEl.textContent = 'Enter a name';
      setTimeout(() => { statusEl.textContent = ''; }, 2000);
      return;
    }
    const slug = slugify(name);
    const id = 'custom_' + (slug || 'preset');
    const snapshot = getCurrentPresetSnapshot();
    let list = getCustomPresets();
    const existing = list.findIndex((p) => p.id === id);
    const entry = { id, name: name.slice(0, 40), ...snapshot };
    if (existing >= 0) list[existing] = entry;
    else list = list.concat(entry);
    saveCustomPresets(list);
    loadCustomPresetsIntoPRESETS();
    refreshPresetSelect();
    presetSelectEl.value = id;
    statusEl.textContent = 'Saved';
    nameInput.value = '';
    setTimeout(() => { statusEl.textContent = ''; }, 2000);
  });

  webcamStartBtn.addEventListener('click', async () => {
    try {
      webcamStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      video.src = '';
      video.srcObject = webcamStream;
      video.onloadedmetadata = () => { video.play(); };
      webcamStartBtn.classList.add('hidden');
      webcamStopBtn.classList.remove('hidden');
      videoWrap.classList.remove('hidden');
      showGeneratorOptions();
    } catch (e) {
      copyJsonStatus.textContent = 'Camera access denied';
      setTimeout(() => { copyJsonStatus.textContent = ''; }, 3000);
    }
  });
  webcamStopBtn.addEventListener('click', () => {
    if (webcamStream) {
      webcamStream.getTracks().forEach((t) => t.stop());
      webcamStream = null;
    }
    video.srcObject = null;
    webcamStartBtn.classList.remove('hidden');
    webcamStopBtn.classList.add('hidden');
    videoWrap.classList.add('hidden');
    showGeneratorOptions();
  });

  document.getElementById('perlinSpeed').addEventListener('input', () => {
    document.getElementById('perlinSpeedVal').textContent = document.getElementById('perlinSpeed').value;
    drawPreview();
  });
  document.getElementById('perlinScale').addEventListener('input', () => {
    document.getElementById('perlinScaleVal').textContent = document.getElementById('perlinScale').value;
    drawPreview();
  });
  document.getElementById('perlinOctaves').addEventListener('input', drawPreview);
  document.getElementById('perlinColor').addEventListener('change', drawPreview);
  document.getElementById('wavesFreq').addEventListener('input', () => {
    document.getElementById('wavesFreqVal').textContent = document.getElementById('wavesFreq').value;
    drawPreview();
  });
  document.getElementById('wavesSpeed').addEventListener('input', () => {
    document.getElementById('wavesSpeedVal').textContent = document.getElementById('wavesSpeed').value;
    drawPreview();
  });
  document.getElementById('wavesAmp').addEventListener('input', () => {
    document.getElementById('wavesAmpVal').textContent = document.getElementById('wavesAmp').value + '%';
    drawPreview();
  });

  function bindGeneratorControl(id, valId, suffix) {
    const el = document.getElementById(id);
    const valEl = document.getElementById(valId);
    if (!el || !valEl) return;
    el.addEventListener('input', () => {
      valEl.textContent = suffix ? el.value + suffix : el.value;
      drawPreview();
    });
    valEl.textContent = suffix ? el.value + suffix : el.value;
  }
  bindGeneratorControl('waves3dFreq', 'waves3dFreqVal');
  bindGeneratorControl('waves3dSpeed', 'waves3dSpeedVal');
  bindGeneratorControl('waves3dAmp', 'waves3dAmpVal', '%');
  bindGeneratorControl('waves3dLight', 'waves3dLightVal');
  bindGeneratorControl('vertexSpeed', 'vertexSpeedVal');
  bindGeneratorControl('vertexDepth', 'vertexDepthVal', '%');
  bindGeneratorControl('vertexWavelength', 'vertexWavelengthVal');
  document.getElementById('vertexColor').addEventListener('change', drawPreview);
  bindGeneratorControl('plasmaSpeed', 'plasmaSpeedVal');
  bindGeneratorControl('plasmaScale', 'plasmaScaleVal');
  document.getElementById('plasmaColor').addEventListener('change', drawPreview);
  bindGeneratorControl('terrainSpeed', 'terrainSpeedVal');
  bindGeneratorControl('terrainScale', 'terrainScaleVal');
  bindGeneratorControl('terrainLight', 'terrainLightVal');

  const colorPaletteSelectEl = document.getElementById('colorPaletteSelect');
  const colorPaletteRandomBtn = document.getElementById('colorPaletteRandom');
  if (colorPaletteSelectEl) colorPaletteSelectEl.addEventListener('change', drawPreview);
  if (colorPaletteRandomBtn) {
    colorPaletteRandomBtn.addEventListener('click', () => {
      if (PALETTE_IDS.length === 0) return;
      const id = PALETTE_IDS[Math.floor(Math.random() * PALETTE_IDS.length)];
      if (colorPaletteSelectEl) { colorPaletteSelectEl.value = id; drawPreview(); }
    });
  }

  document.getElementById('perlinSpeedVal').textContent = document.getElementById('perlinSpeed').value;
  document.getElementById('perlinScaleVal').textContent = document.getElementById('perlinScale').value;
  document.getElementById('wavesFreqVal').textContent = document.getElementById('wavesFreq').value;
  document.getElementById('wavesSpeedVal').textContent = document.getElementById('wavesSpeed').value;
  document.getElementById('wavesAmpVal').textContent = document.getElementById('wavesAmp').value + '%';

  populatePaletteSelect();
  showGeneratorOptions();
  if (!rafId) rafId = requestAnimationFrame(loop);

  playBtn.addEventListener('click', () => {
    if (video.currentTime < loopStart || video.currentTime >= loopEnd) {
      video.currentTime = loopStart;
    }
    lastDrawTime = 0;
    video.play();
    playBtn.disabled = true;
    pauseBtn.disabled = false;
    if (!rafId) rafId = requestAnimationFrame(loop);
  });
  pauseBtn.addEventListener('click', () => {
    video.pause();
    playBtn.disabled = false;
    pauseBtn.disabled = true;
    stopLoop();
    drawPreview();
  });
})();

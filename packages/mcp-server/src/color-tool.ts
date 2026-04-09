// Color utilities and conversion.
// No API required -- pure computation.

// ─── Types ────────────────────────────────────────────────────────────────────

interface RGB { r: number; g: number; b: number }
interface HSL { h: number; s: number; l: number }
interface HSV { h: number; s: number; v: number }
interface CMYK { c: number; m: number; y: number; k: number }

// ─── convert_color ────────────────────────────────────────────────────────────

export function convertColor(args: Record<string, unknown>): unknown {
  const value = String(args.value ?? "").trim();
  const fromFormat = String(args.from_format ?? "").toLowerCase();

  if (!value) return { error: "value is required." };
  if (!fromFormat) return { error: "from_format is required (hex, rgb, hsl, hsv, cmyk)." };

  let rgb: RGB;

  try {
    switch (fromFormat) {
      case "hex": rgb = hexToRgb(value); break;
      case "rgb": rgb = parseRgb(value); break;
      case "hsl": rgb = hslToRgb(parseHsl(value)); break;
      case "hsv": rgb = hsvToRgb(parseHsv(value)); break;
      case "cmyk": rgb = cmykToRgb(parseCmyk(value)); break;
      default: return { error: `from_format "${fromFormat}" not supported. Use: hex, rgb, hsl, hsv, cmyk.` };
    }
  } catch (e) {
    return { error: `Could not parse "${value}" as ${fromFormat}: ${String(e)}` };
  }

  const hsl = rgbToHsl(rgb);
  const hsv = rgbToHsv(rgb);
  const cmyk = rgbToCmyk(rgb);
  const hex = rgbToHex(rgb);

  return {
    input: value,
    from_format: fromFormat,
    hex,
    rgb: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`,
    rgb_object: rgb,
    hsl: `hsl(${round1(hsl.h)}, ${round1(hsl.s)}%, ${round1(hsl.l)}%)`,
    hsl_object: { h: round1(hsl.h), s: round1(hsl.s), l: round1(hsl.l) },
    hsv: `hsv(${round1(hsv.h)}, ${round1(hsv.s)}%, ${round1(hsv.v)}%)`,
    hsv_object: { h: round1(hsv.h), s: round1(hsv.s), v: round1(hsv.v) },
    cmyk: `cmyk(${round1(cmyk.c)}%, ${round1(cmyk.m)}%, ${round1(cmyk.y)}%, ${round1(cmyk.k)}%)`,
    cmyk_object: { c: round1(cmyk.c), m: round1(cmyk.m), y: round1(cmyk.y), k: round1(cmyk.k) },
  };
}

// ─── get_color_info ───────────────────────────────────────────────────────────

export function getColorInfo(args: Record<string, unknown>): unknown {
  const value = String(args.value ?? "").trim();
  if (!value) return { error: "value is required (hex like #FF5733 or rgb like rgb(255,87,51))." };

  let rgb: RGB;
  try {
    if (value.startsWith("#") || /^[0-9a-fA-F]{3,6}$/.test(value)) {
      rgb = hexToRgb(value);
    } else {
      rgb = parseRgb(value);
    }
  } catch (e) {
    return { error: `Could not parse color: ${String(e)}` };
  }

  const luminance = relativeLuminance(rgb);
  const isDark = luminance < 0.179;
  const hsl = rgbToHsl(rgb);
  const hex = rgbToHex(rgb);
  const colorName = findClosestColorName(rgb);

  return {
    hex,
    rgb: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`,
    hsl: `hsl(${round1(hsl.h)}, ${round1(hsl.s)}%, ${round1(hsl.l)}%)`,
    name: colorName,
    luminance: round4(luminance),
    is_dark: isDark,
    is_light: !isDark,
    suggested_text_color: isDark ? "#FFFFFF" : "#000000",
  };
}

// ─── generate_color_palette ───────────────────────────────────────────────────

export function generateColorPalette(args: Record<string, unknown>): unknown {
  const baseHex = String(args.base_hex ?? "").trim();
  if (!baseHex) return { error: "base_hex is required (e.g. #FF5733)." };

  let rgb: RGB;
  try { rgb = hexToRgb(baseHex); } catch (e) {
    return { error: `Could not parse hex "${baseHex}": ${String(e)}` };
  }

  const hsl = rgbToHsl(rgb);
  const h = hsl.h;

  const rotate = (deg: number) => ((h + deg) % 360 + 360) % 360;
  const toHex = (hue: number) => rgbToHex(hslToRgb({ h: hue, s: hsl.s, l: hsl.l }));

  return {
    base: rgbToHex(rgb),
    complementary: [toHex(rotate(180))],
    analogous: [toHex(rotate(30)), toHex(rotate(-30))],
    triadic: [toHex(rotate(120)), toHex(rotate(240))],
    split_complementary: [toHex(rotate(150)), toHex(rotate(210))],
    tetradic: [toHex(rotate(90)), toHex(rotate(180)), toHex(rotate(270))],
    shades: generateShades(hsl),
    tints: generateTints(hsl),
  };
}

// ─── mix_colors ───────────────────────────────────────────────────────────────

export function mixColors(args: Record<string, unknown>): unknown {
  const hex1 = String(args.color1_hex ?? "").trim();
  const hex2 = String(args.color2_hex ?? "").trim();
  const ratio = Math.max(0, Math.min(1, Number(args.ratio ?? 0.5)));

  if (!hex1) return { error: "color1_hex is required." };
  if (!hex2) return { error: "color2_hex is required." };

  let rgb1: RGB, rgb2: RGB;
  try { rgb1 = hexToRgb(hex1); } catch { return { error: `Invalid color1_hex "${hex1}".` }; }
  try { rgb2 = hexToRgb(hex2); } catch { return { error: `Invalid color2_hex "${hex2}".` }; }

  const mixed: RGB = {
    r: Math.round(rgb1.r * (1 - ratio) + rgb2.r * ratio),
    g: Math.round(rgb1.g * (1 - ratio) + rgb2.g * ratio),
    b: Math.round(rgb1.b * (1 - ratio) + rgb2.b * ratio),
  };

  return {
    color1: rgbToHex(rgb1),
    color2: rgbToHex(rgb2),
    ratio,
    mixed_hex: rgbToHex(mixed),
    mixed_rgb: `rgb(${mixed.r}, ${mixed.g}, ${mixed.b})`,
    description: `${Math.round((1 - ratio) * 100)}% ${rgbToHex(rgb1)} + ${Math.round(ratio * 100)}% ${rgbToHex(rgb2)}`,
  };
}

// ─── check_contrast_ratio ─────────────────────────────────────────────────────

export function checkContrastRatio(args: Record<string, unknown>): unknown {
  const fgHex = String(args.foreground_hex ?? "").trim();
  const bgHex = String(args.background_hex ?? "").trim();

  if (!fgHex) return { error: "foreground_hex is required." };
  if (!bgHex) return { error: "background_hex is required." };

  let fg: RGB, bg: RGB;
  try { fg = hexToRgb(fgHex); } catch { return { error: `Invalid foreground_hex "${fgHex}".` }; }
  try { bg = hexToRgb(bgHex); } catch { return { error: `Invalid background_hex "${bgHex}".` }; }

  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  const ratio = (lighter + 0.05) / (darker + 0.05);

  return {
    foreground: rgbToHex(fg),
    background: rgbToHex(bg),
    contrast_ratio: round2(ratio),
    contrast_ratio_string: `${round2(ratio)}:1`,
    wcag: {
      aa_normal_text: ratio >= 4.5,
      aa_large_text: ratio >= 3,
      aa_ui_components: ratio >= 3,
      aaa_normal_text: ratio >= 7,
      aaa_large_text: ratio >= 4.5,
    },
    rating: ratio >= 7 ? "AAA (Excellent)" : ratio >= 4.5 ? "AA (Good)" : ratio >= 3 ? "AA Large / UI (Acceptable)" : "Fail (Insufficient)",
  };
}

// ─── Color conversion helpers ─────────────────────────────────────────────────

function hexToRgb(hex: string): RGB {
  const clean = hex.replace(/^#/, "");
  let full: string;
  if (clean.length === 3) full = clean.split("").map((c) => c + c).join("");
  else if (clean.length === 6) full = clean;
  else throw new Error(`hex must be 3 or 6 digits, got "${hex}".`);
  const n = parseInt(full, 16);
  if (isNaN(n)) throw new Error(`"${hex}" is not a valid hex color.`);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex(rgb: RGB): string {
  return "#" + [rgb.r, rgb.g, rgb.b].map((v) => Math.round(v).toString(16).padStart(2, "0").toUpperCase()).join("");
}

function parseRgb(s: string): RGB {
  const m = s.match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (!m) throw new Error(`Cannot parse RGB from "${s}". Expected format: rgb(r, g, b) or r, g, b.`);
  const [r, g, b] = [+m[1], +m[2], +m[3]];
  if (r > 255 || g > 255 || b > 255) throw new Error("RGB values must be 0-255.");
  return { r, g, b };
}

function parseHsl(s: string): HSL {
  const m = s.match(/([\d.]+)\s*[,\s]\s*([\d.]+)%?\s*[,\s]\s*([\d.]+)%?/);
  if (!m) throw new Error(`Cannot parse HSL from "${s}". Expected: h, s%, l%.`);
  return { h: +m[1], s: +m[2], l: +m[3] };
}

function parseHsv(s: string): HSV {
  const m = s.match(/([\d.]+)\s*[,\s]\s*([\d.]+)%?\s*[,\s]\s*([\d.]+)%?/);
  if (!m) throw new Error(`Cannot parse HSV from "${s}". Expected: h, s%, v%.`);
  return { h: +m[1], s: +m[2], v: +m[3] };
}

function parseCmyk(s: string): CMYK {
  const m = s.match(/([\d.]+)%?\s*[,\s]\s*([\d.]+)%?\s*[,\s]\s*([\d.]+)%?\s*[,\s]\s*([\d.]+)%?/);
  if (!m) throw new Error(`Cannot parse CMYK from "${s}". Expected: c%, m%, y%, k%.`);
  return { c: +m[1], m: +m[2], y: +m[3], k: +m[4] };
}

function rgbToHsl(rgb: RGB): HSL {
  const r = rgb.r / 255, g = rgb.g / 255, b = rgb.b / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: l * 100 };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  switch (max) {
    case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
    case g: h = ((b - r) / d + 2) / 6; break;
    default: h = ((r - g) / d + 4) / 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToRgb(hsl: HSL): RGB {
  const h = hsl.h / 360, s = hsl.s / 100, l = hsl.l / 100;
  if (s === 0) { const v = Math.round(l * 255); return { r: v, g: v, b: v }; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue2rgb = (t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return {
    r: Math.round(hue2rgb(h + 1 / 3) * 255),
    g: Math.round(hue2rgb(h) * 255),
    b: Math.round(hue2rgb(h - 1 / 3) * 255),
  };
}

function rgbToHsv(rgb: RGB): HSV {
  const r = rgb.r / 255, g = rgb.g / 255, b = rgb.b / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  const v = max;
  const s = max === 0 ? 0 : d / max;
  let h = 0;
  if (d !== 0) {
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      default: h = ((r - g) / d + 4) / 6;
    }
  }
  return { h: h * 360, s: s * 100, v: v * 100 };
}

function hsvToRgb(hsv: HSV): RGB {
  const h = hsv.h / 360, s = hsv.s / 100, v = hsv.v / 100;
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  let r: number, g: number, b: number;
  switch (i % 6) {
    case 0: [r, g, b] = [v, t, p]; break;
    case 1: [r, g, b] = [q, v, p]; break;
    case 2: [r, g, b] = [p, v, t]; break;
    case 3: [r, g, b] = [p, q, v]; break;
    case 4: [r, g, b] = [t, p, v]; break;
    default: [r, g, b] = [v, p, q];
  }
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}

function rgbToCmyk(rgb: RGB): CMYK {
  const r = rgb.r / 255, g = rgb.g / 255, b = rgb.b / 255;
  const k = 1 - Math.max(r, g, b);
  if (k === 1) return { c: 0, m: 0, y: 0, k: 100 };
  return {
    c: ((1 - r - k) / (1 - k)) * 100,
    m: ((1 - g - k) / (1 - k)) * 100,
    y: ((1 - b - k) / (1 - k)) * 100,
    k: k * 100,
  };
}

function cmykToRgb(cmyk: CMYK): RGB {
  const c = cmyk.c / 100, m = cmyk.m / 100, y = cmyk.y / 100, k = cmyk.k / 100;
  return {
    r: Math.round(255 * (1 - c) * (1 - k)),
    g: Math.round(255 * (1 - m) * (1 - k)),
    b: Math.round(255 * (1 - y) * (1 - k)),
  };
}

function relativeLuminance(rgb: RGB): number {
  const toLinear = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(rgb.r) + 0.7152 * toLinear(rgb.g) + 0.0722 * toLinear(rgb.b);
}

function generateShades(hsl: HSL): string[] {
  return [80, 60, 40, 20, 10].map((l) => rgbToHex(hslToRgb({ h: hsl.h, s: hsl.s, l })));
}

function generateTints(hsl: HSL): string[] {
  return [90, 80, 70, 60, 50].map((l) => rgbToHex(hslToRgb({ h: hsl.h, s: hsl.s, l })));
}

// Basic CSS named colors for nearest-name lookup
const CSS_COLORS: Array<{ name: string; r: number; g: number; b: number }> = [
  { name: "red", r: 255, g: 0, b: 0 }, { name: "green", r: 0, g: 128, b: 0 },
  { name: "blue", r: 0, g: 0, b: 255 }, { name: "white", r: 255, g: 255, b: 255 },
  { name: "black", r: 0, g: 0, b: 0 }, { name: "yellow", r: 255, g: 255, b: 0 },
  { name: "cyan", r: 0, g: 255, b: 255 }, { name: "magenta", r: 255, g: 0, b: 255 },
  { name: "orange", r: 255, g: 165, b: 0 }, { name: "purple", r: 128, g: 0, b: 128 },
  { name: "pink", r: 255, g: 192, b: 203 }, { name: "brown", r: 165, g: 42, b: 42 },
  { name: "gray", r: 128, g: 128, b: 128 }, { name: "silver", r: 192, g: 192, b: 192 },
  { name: "gold", r: 255, g: 215, b: 0 }, { name: "lime", r: 0, g: 255, b: 0 },
  { name: "navy", r: 0, g: 0, b: 128 }, { name: "teal", r: 0, g: 128, b: 128 },
  { name: "maroon", r: 128, g: 0, b: 0 }, { name: "olive", r: 128, g: 128, b: 0 },
  { name: "coral", r: 255, g: 127, b: 80 }, { name: "salmon", r: 250, g: 128, b: 114 },
  { name: "violet", r: 238, g: 130, b: 238 }, { name: "indigo", r: 75, g: 0, b: 130 },
  { name: "turquoise", r: 64, g: 224, b: 208 }, { name: "crimson", r: 220, g: 20, b: 60 },
];

function findClosestColorName(rgb: RGB): string {
  let closest = CSS_COLORS[0];
  let minDist = Infinity;
  for (const c of CSS_COLORS) {
    const dist = Math.pow(rgb.r - c.r, 2) + Math.pow(rgb.g - c.g, 2) + Math.pow(rgb.b - c.b, 2);
    if (dist < minDist) { minDist = dist; closest = c; }
  }
  return closest.name;
}

function round1(n: number): number { return Math.round(n * 10) / 10; }
function round2(n: number): number { return Math.round(n * 100) / 100; }
function round4(n: number): number { return Math.round(n * 10000) / 10000; }

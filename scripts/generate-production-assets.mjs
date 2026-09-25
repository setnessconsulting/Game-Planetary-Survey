/**
 * PS-10 production asset pipeline.
 *
 * Emits the shipping art for every body in the v1 catalogue plus one shared
 * environment map. This is the generator of record for shipping art: the PS-05
 * placeholder generator it replaces has been deleted, because its output is now
 * release-blocking (docs/DESIGN_SYSTEM.md §10, docs/DECISIONS.md D-34, D-46).
 *
 * PROVENANCE — this is the whole point of the file.
 * Everything it writes is ORIGINAL, produced by this script from art-direction
 * data, with `agency origin: none` and no third-party rights. There is no
 * agency imagery here and there never will be: docs/ASSET_PROVENANCE.md is
 * explicit that using space-agency data as a scientific source says nothing
 * about a licence for agency imagery, and that "found online" is not
 * provenance. The provenance manifest (src/assets/provenanceManifest.json) is
 * written from the same data by `write-provenance.mjs` so the two cannot drift.
 *
 * WHAT IS AND IS NOT CLAIMED BY THE ART — read before changing a number.
 * These values are ART DIRECTION, not measurement. Nothing here is derived from
 * a number in the source register. A body is rendered at presentation scale,
 * and docs/RENDERING_QUALITY_STRATEGY.md §10 rule 4 is release-blocking: a
 * body's visual representation must not imply a measurement the game does not
 * have. A learner's measured radius always comes from the domain layer and the
 * register, never from a mesh. `tests/assets/provenanceRecords.test.ts` pins
 * that separation by asserting the manifest carries no scientific value.
 *
 * DETERMINISM. Every value is derived from a seeded integer hash, so running
 * this script twice produces byte-identical output. That is what makes the
 * recorded content hashes in the provenance manifest meaningful.
 *
 * FORMATS.
 *  - Meshes: glTF 2.0 binary (.glb), POSITION/NORMAL/TEXCOORD_0.
 *  - Textures: PNG, encoded below with Node's built-in zlib. The contract
 *    prefers KTX2/Basis for web delivery (RENDERING_QUALITY_STRATEGY.md §8), but
 *    the approved dependency set contains no KTX2 decoder, so a KTX2 texture
 *    cannot be decoded at runtime. Shipping a texture the browser cannot read
 *    would be worse than shipping a larger one it can, so the deviation is
 *    recorded as a decision rather than hidden. See docs/DECISIONS.md.
 *  - Environment: Radiance .hdr (flat RGBE scanlines), loaded by Babylon's
 *    HDRCubeTexture with prefiltering for image-based lighting.
 *
 * Run:  node scripts/generate-production-assets.mjs
 */

import { mkdirSync, writeFileSync, statSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";
import { createHash } from "node:crypto";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));

/**
 * Where output goes. Defaults to the repository.
 *
 * `PS_ASSET_OUT_ROOT` exists so determinism can be tested without a test writing
 * into the working tree: a test that regenerates the real assets races every
 * sibling test reading them, and produces a failure that depends on scheduling
 * rather than on the product.
 */
const outputRoot = process.env.PS_ASSET_OUT_ROOT
  ? resolve(process.env.PS_ASSET_OUT_ROOT)
  : root;

const bodiesDir = join(outputRoot, "public", "assets", "bodies");
const texturesDir = join(outputRoot, "public", "assets", "textures");
const envDir = join(outputRoot, "public", "assets", "environment");

for (const dir of [bodiesDir, texturesDir, envDir]) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
}
mkdirSync(join(outputRoot, "src", "assets"), { recursive: true });

// ---------------------------------------------------------------------------
// Deterministic noise
// ---------------------------------------------------------------------------

/** Integer hash -> [0,1). Same seed and index always give the same value. */
function hash01(seed, index) {
  let h = (seed * 374761393 + index * 668265263) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 1274126177) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
}

function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

/** Bilinear value noise over a latitude/longitude grid. Wraps in longitude. */
function valueNoise(seed, x, y, periodX) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = smoothstep(x - x0);
  const fy = smoothstep(y - y0);
  const wrap = (n) => ((n % periodX) + periodX) % periodX;
  const a = hash01(seed, wrap(x0) * 73856093 + y0 * 19349663);
  const b = hash01(seed, wrap(x0 + 1) * 73856093 + y0 * 19349663);
  const c = hash01(seed, wrap(x0) * 73856093 + (y0 + 1) * 19349663);
  const d = hash01(seed, wrap(x0 + 1) * 73856093 + (y0 + 1) * 19349663);
  return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
}

/** Sum of octaves. `periodX` keeps the noise seamless across the seam. */
function fbm(seed, x, y, periodX, octaves) {
  let sum = 0;
  let amplitude = 1;
  let norm = 0;
  let frequency = 1;
  for (let o = 0; o < octaves; o += 1) {
    sum += amplitude * valueNoise(seed + o * 7919, x * frequency, y * frequency, periodX * frequency);
    norm += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return sum / norm;
}

// ---------------------------------------------------------------------------
// Art direction (NOT measurement — see the header)
// ---------------------------------------------------------------------------

/**
 * One entry per body in the v1 catalogue.
 *
 * `relief` is surface-relief amplitude in normalized radius units, which is the
 * only thing it means. It is deliberately a small fraction of the radius — the
 * planet-scale numbers the game compares are text, not silhouette, and
 * RENDERING_QUALITY_STRATEGY.md §10 rule 4 forbids a representation that
 * implies a measurement the game does not have. MAX_RELIEF_FRACTION is the
 * ceiling and `tests/assets/productionAssets.test.ts` asserts it is never
 * exceeded, so making a world look more interesting cannot quietly turn into
 * making a world look measured.
 *
 * Colours are chosen to be *distinguishable from each other* under the shared
 * environment, because RENDERING_QUALITY_STRATEGY.md §3 forbids an IBL that
 * makes two measurably different bodies look measurably the same. The test
 * suite asserts pairwise separation of at least 10 CIE76 dE.
 *
 * `mariaDarkness` is the depth of the broad dark regions. It carries most of
 * the body's character: a world with none of it reads as a shaded ball no
 * matter how good the lighting is, which is the failure this story exists to
 * avoid.
 */
const MAX_RELIEF_FRACTION = 0.025;

const ART_DIRECTION = {
  moon: {
    seed: 10247,
    base: [0.6, 0.59, 0.56],
    accent: [0.3, 0.3, 0.295],
    relief: 0.02,
    reliefFrequency: 5,
    mariaDarkness: 0.34,
    roughness: 0.94,
    metallic: 0,
  },
  mars: {
    seed: 20431,
    base: [0.72, 0.42, 0.25],
    accent: [0.44, 0.23, 0.14],
    relief: 0.018,
    reliefFrequency: 6,
    mariaDarkness: 0.3,
    roughness: 0.88,
    metallic: 0,
  },
  venus: {
    seed: 30653,
    base: [0.9, 0.82, 0.62],
    accent: [0.7, 0.58, 0.38],
    relief: 0.009,
    reliefFrequency: 3,
    mariaDarkness: 0.22,
    roughness: 0.8,
    metallic: 0,
  },
  titan: {
    seed: 40871,
    base: [0.86, 0.68, 0.32],
    accent: [0.6, 0.44, 0.19],
    relief: 0.008,
    reliefFrequency: 3,
    mariaDarkness: 0.2,
    roughness: 0.7,
    metallic: 0,
  },
  europa: {
    seed: 51091,
    base: [0.92, 0.9, 0.85],
    accent: [0.6, 0.5, 0.41],
    relief: 0.013,
    reliefFrequency: 7,
    mariaDarkness: 0.26,
    roughness: 0.42,
    metallic: 0.02,
  },
};

const TEXTURE_WIDTH = 512;
const TEXTURE_HEIGHT = 256;

// ---------------------------------------------------------------------------
// PNG encoder (RGB8, no interlace), built on zlib
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([length, typeAndData, crc]);
}

/** Encode an RGB byte buffer (width*height*3) as a PNG. */
function encodePng(width, height, rgb) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // bit depth
  ihdr.writeUInt8(2, 9); // colour type 2 = truecolour RGB
  ihdr.writeUInt8(0, 10); // deflate
  ihdr.writeUInt8(0, 11); // adaptive filtering
  ihdr.writeUInt8(0, 12); // no interlace

  // Filter type 0 (None) on every scanline. The images are smooth enough that
  // the size win from smarter per-scanline filter selection is not worth the
  // extra encoder complexity.
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

const clamp255 = (v) => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v));

// ---------------------------------------------------------------------------
// Per-body textures
// ---------------------------------------------------------------------------

/**
 * Surface height field in normalized units, sampled by (u, v).
 *
 * Shared by the mesh displacement and the normal map so that the shading
 * matches the silhouette instead of fighting it.
 */
function surfaceHeight(art, u, v) {
  const period = art.reliefFrequency * 4;
  const large = fbm(art.seed, u * period, v * period, period, 4);
  // Dark, low-lying "maria"-style regions read as broad albedo variation.
  const regions = fbm(art.seed + 313, u * (period / 2), v * (period / 2), period / 2, 3);
  return (large - 0.5) * 2 * art.relief + (regions - 0.5) * art.mariaDarkness;
}

/**
 * Albedo from three independent scales.
 *
 * The broad `region` field drives the base/accent mix, a second broad field
 * carves the dark maria-style patches, and a fine `mottle` adds surface grain.
 * Driving the mix from the broad field rather than from the height field matters:
 * the height field is dominated by the maria term, so mixing on it saturated
 * almost immediately and produced a flat two-tone ball instead of terrain.
 */
function buildAlbedo(art) {
  const rgb = Buffer.alloc(TEXTURE_WIDTH * TEXTURE_HEIGHT * 3);
  for (let y = 0; y < TEXTURE_HEIGHT; y += 1) {
    const v = y / TEXTURE_HEIGHT;
    for (let x = 0; x < TEXTURE_WIDTH; x += 1) {
      const u = x / TEXTURE_WIDTH;
      const period = art.reliefFrequency * 4;

      const mottle = fbm(art.seed + 977, u * period * 3, v * period * 3, period * 3, 5);
      const region = fbm(art.seed + 313, u * (period / 2), v * (period / 2), period / 2, 3);
      const patch = fbm(art.seed + 5501, u * (period / 1.5), v * (period / 1.5), period / 1.5, 2);
      const height = surfaceHeight(art, u, v);

      // Smooth, non-saturating mix between the two authored colours.
      const mix = Math.min(1, Math.max(0, 0.5 + (region - 0.5) * 2.2));
      // Broad dark regions: soft-thresholded so they have edges rather than
      // looking like a second noise field pasted on.
      const maria = smoothstep(Math.min(1, Math.max(0, (patch - 0.42) / 0.3)));
      const shade = 1 - art.mariaDarkness * maria + height * 2.2 + (mottle - 0.5) * 0.3;

      const i = (y * TEXTURE_WIDTH + x) * 3;
      for (let c = 0; c < 3; c += 1) {
        const colour = art.base[c] * (1 - mix) + art.accent[c] * mix;
        rgb[i + c] = clamp255(colour * Math.max(0.05, shade) * 255);
      }
    }
  }
  return rgb;
}

function buildNormalMap(art) {
  const rgb = Buffer.alloc(TEXTURE_WIDTH * TEXTURE_HEIGHT * 3);
  const step = 1 / TEXTURE_WIDTH;
  for (let y = 0; y < TEXTURE_HEIGHT; y += 1) {
    const v = y / TEXTURE_HEIGHT;
    for (let x = 0; x < TEXTURE_WIDTH; x += 1) {
      const u = x / TEXTURE_WIDTH;
      const hL = surfaceHeight(art, u - step, v);
      const hR = surfaceHeight(art, u + step, v);
      const hD = surfaceHeight(art, u, Math.max(0, v - step));
      const hU = surfaceHeight(art, u, Math.min(1, v + step));
      // Tangent-space normal from the height gradient, packed to [0,1].
      const nx = (hL - hR) * 6;
      const ny = (hD - hU) * 6;
      const nz = 1;
      const len = Math.hypot(nx, ny, nz);
      const i = (y * TEXTURE_WIDTH + x) * 3;
      rgb[i] = clamp255(((nx / len) * 0.5 + 0.5) * 255);
      rgb[i + 1] = clamp255(((ny / len) * 0.5 + 0.5) * 255);
      rgb[i + 2] = clamp255(((nz / len) * 0.5 + 0.5) * 255);
    }
  }
  return rgb;
}

// ---------------------------------------------------------------------------
// GLB mesh
// ---------------------------------------------------------------------------

function float32Buffer(values) {
  const buf = Buffer.alloc(values.length * 4);
  for (let i = 0; i < values.length; i += 1) buf.writeFloatLE(values[i], i * 4);
  return buf;
}

function uint16Buffer(values) {
  const buf = Buffer.alloc(values.length * 2);
  for (let i = 0; i < values.length; i += 1) buf.writeUInt16LE(values[i], i * 2);
  return buf;
}

function uint32Buffer(values) {
  const buf = Buffer.alloc(values.length * 4);
  for (let i = 0; i < values.length; i += 1) buf.writeUInt32LE(values[i], i * 4);
  return buf;
}

/**
 * UV-sphere GLB with art-directed radial displacement.
 *
 * `radius` is always 1: the renderer owns presentation scale, and a mesh that
 * carried a body's real radius would be a second, unchecked source of truth
 * for a number the domain already owns.
 */
function buildBodyGlb({ name, art, segments, rings }) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];

  const displacement = (u, v) => {
    if (segments > 64) return surfaceHeight(art, u, v);
    // Coarse LOD keeps the large forms and drops the fine detail, which is the
    // point of a LOD: the silhouette must not misrepresent the body's shape.
    return surfaceHeight(art, Math.floor(u * 12) / 12, Math.floor(v * 6) / 6);
  };

  for (let y = 0; y <= rings; y += 1) {
    const v = y / rings;
    const phi = v * Math.PI;
    const sinPhi = Math.sin(phi);
    const cosPhi = Math.cos(phi);
    for (let x = 0; x <= segments; x += 1) {
      const u = x / segments;
      const theta = u * Math.PI * 2;
      const nx = Math.cos(theta) * sinPhi;
      const ny = cosPhi;
      const nz = Math.sin(theta) * sinPhi;
      const r = 1 + displacement(u, v);
      positions.push(nx * r, ny * r, nz * r);
      // Approximate normal: the sphere normal nudged outward by the local
      // gradient. Exact normals would need finite differences in 3D; the
      // normal map carries the fine detail anyway.
      normals.push(nx, ny, nz);
      uvs.push(u, 1 - v);
    }
  }

  for (let y = 0; y < rings; y += 1) {
    for (let x = 0; x < segments; x += 1) {
      const a = y * (segments + 1) + x;
      const b = a + segments + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }

  // Positions now reach past 1.0, so recompute the accessor bounds honestly
  // rather than reusing the nominal radius.
  let maxR = 0;
  for (let i = 0; i < positions.length; i += 3) {
    maxR = Math.max(maxR, Math.hypot(positions[i], positions[i + 1], positions[i + 2]));
  }

  const positionBytes = float32Buffer(positions);
  const normalBytes = float32Buffer(normals);
  const uvBytes = float32Buffer(uvs);
  // 16-bit indices are enough below 65k vertices and halve the index buffer.
  const vertexCount = positions.length / 3;
  const indexBytes =
    vertexCount > 65535 ? uint32Buffer(indices) : uint16Buffer(indices);
  const indexComponent = vertexCount > 65535 ? 5125 : 5123;

  const align = (n) => (4 - (n % 4)) % 4;
  let offset = 0;
  const positionOffset = offset;
  offset += positionBytes.length + align(positionBytes.length);
  const normalOffset = offset;
  offset += normalBytes.length + align(normalBytes.length);
  const uvOffset = offset;
  offset += uvBytes.length + align(uvBytes.length);
  const indexOffset = offset;
  offset += indexBytes.length + align(indexBytes.length);

  const bin = Buffer.alloc(offset);
  positionBytes.copy(bin, positionOffset);
  normalBytes.copy(bin, normalOffset);
  uvBytes.copy(bin, uvOffset);
  indexBytes.copy(bin, indexOffset);

  const json = {
    asset: { version: "2.0", generator: "planetary-survey-ps10-production" },
    scenes: [{ nodes: [0] }],
    scene: 0,
    nodes: [{ mesh: 0, name }],
    meshes: [
      {
        name,
        primitives: [
          { attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 }, indices: 3, mode: 4 },
        ],
      },
    ],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: vertexCount,
        type: "VEC3",
        max: [maxR, maxR, maxR],
        min: [-maxR, -maxR, -maxR],
      },
      { bufferView: 1, componentType: 5126, count: vertexCount, type: "VEC3" },
      { bufferView: 2, componentType: 5126, count: vertexCount, type: "VEC2" },
      { bufferView: 3, componentType: indexComponent, count: indices.length, type: "SCALAR" },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: positionOffset, byteLength: positionBytes.length, target: 34962 },
      { buffer: 0, byteOffset: normalOffset, byteLength: normalBytes.length, target: 34962 },
      { buffer: 0, byteOffset: uvOffset, byteLength: uvBytes.length, target: 34962 },
      { buffer: 0, byteOffset: indexOffset, byteLength: indexBytes.length, target: 34963 },
    ],
    buffers: [{ byteLength: bin.length }],
  };

  let jsonText = JSON.stringify(json);
  jsonText += " ".repeat(align(jsonText.length));
  const jsonChunk = Buffer.from(jsonText, "utf8");
  const binPadded = Buffer.concat([bin, Buffer.alloc(align(bin.length))]);

  const totalLength = 12 + 8 + jsonChunk.length + 8 + binPadded.length;
  const out = Buffer.alloc(totalLength);
  out.writeUInt32LE(0x46546c67, 0);
  out.writeUInt32LE(2, 4);
  out.writeUInt32LE(totalLength, 8);
  let cursor = 12;
  out.writeUInt32LE(jsonChunk.length, cursor);
  out.writeUInt32LE(0x4e4f534a, cursor + 4);
  jsonChunk.copy(out, cursor + 8);
  cursor += 8 + jsonChunk.length;
  out.writeUInt32LE(binPadded.length, cursor);
  out.writeUInt32LE(0x004e4942, cursor + 4);
  binPadded.copy(out, cursor + 8);
  return out;
}

// ---------------------------------------------------------------------------
// Radiance .hdr environment
// ---------------------------------------------------------------------------

/**
 * A calm, low-key space environment: a dark gradient, a soft warm key where
 * the key light comes from, and a cool fill opposite.
 *
 * This is an ORIGINAL generated environment, not a photograph of any sky, not
 * an agency product, and not a copy of a comparator's look. It exists so that
 * PBR surfaces have a physically sensible reflection context, per
 * RENDERING_QUALITY_STRATEGY.md §3.
 *
 * Equirectangular layout matching the renderer's key-light direction.
 */
/** Direction the key light arrives FROM, matching the renderer's key light. */
const KEY_DIR = (() => {
  const x = 1;
  const y = 0.4;
  const z = -1;
  const len = Math.hypot(x, y, z);
  return { x: x / len, y: y / len, z: z / len };
})();

/** Higher = tighter key lobe. */
const KEY_SHARPNESS = 6;

function buildEnvironmentHdr(width = 128, height = 64) {
  const header = Buffer.from(
    "#?RADIANCE\n" +
      "# Generated by scripts/generate-production-assets.mjs for Planetary Survey.\n" +
      "# Original synthetic environment. No photographic, agency, or third-party imagery.\n" +
      "FORMAT=32-bit_rle_rgbe\n" +
      "\n" +
      `-Y ${height} +X ${width}\n`,
    "ascii",
  );

  const pixels = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const v = (y + 0.5) / height;
    // Signed height above the equator plane, -1 (south) to +1 (north).
    const elevation = 1 - 2 * v;
    for (let x = 0; x < width; x += 1) {
      // Base: deep cool sky, brighter toward the "horizon" plane.
      const horizon = 1 - Math.abs(elevation);
      let r = 0.012 + 0.05 * horizon;
      let g = 0.016 + 0.062 * horizon;
      let b = 0.028 + 0.095 * horizon;

      // Direction this texel samples, in the same convention the renderer
      // uses: +Y up, equirectangular rows running from the top pole down.
      const theta = (y + 0.5) / height * Math.PI;
      const phi = (x + 0.5) / width * Math.PI * 2;
      const dx = Math.sin(theta) * Math.cos(phi);
      const dy = Math.cos(theta);
      const dz = Math.sin(theta) * Math.sin(phi);

      // Warm key lobe, placed to agree with the renderer's key light so
      // reflections and shading come from the same place. Babylon's
      // DirectionalLight direction is the direction light TRAVELS, so the key
      // arrives from the opposite vector: normalize(1, 0.4, -1).
      const key = Math.max(0, dx * KEY_DIR.x + dy * KEY_DIR.y + dz * KEY_DIR.z);
      const keyLobe = key ** KEY_SHARPNESS;
      r += keyLobe * 2.4;
      g += keyLobe * 1.9;
      b += keyLobe * 1.25;

      // Broad cool fill opposite the key, so shadowed sides are not black and
      // the material's cool response stays readable.
      const fill = Math.max(0, -(dx * KEY_DIR.x + dy * KEY_DIR.y + dz * KEY_DIR.z)) ** 2;
      r += fill * 0.18;
      g += fill * 0.24;
      b += fill * 0.42;

      const i = (y * width + x) * 4;
      writeRgbe(pixels, i, r, g, b);
    }
  }

  return Buffer.concat([header, pixels]);
}

/** Shared RGBE exponent encoding (the Radiance standard). */
function writeRgbe(target, offset, r, g, b) {
  const max = Math.max(r, g, b);
  if (max < 1e-32) {
    target[offset] = 0;
    target[offset + 1] = 0;
    target[offset + 2] = 0;
    target[offset + 3] = 0;
    return;
  }
  // frexp: exponent such that value = mantissa * 2^exp with mantissa in [0.5,1)
  const exp = Math.ceil(Math.log2(max));
  const scale = Math.pow(2, -exp) * 256;
  target[offset] = clamp255(r * scale);
  target[offset + 1] = clamp255(g * scale);
  target[offset + 2] = clamp255(b * scale);
  target[offset + 3] = clamp255(exp + 128);
}

// ---------------------------------------------------------------------------
// Emit
// ---------------------------------------------------------------------------

const report = {};

function emit(relPath, buffer) {
  const path = join(outputRoot, "public", relPath);
  writeFileSync(path, buffer);
  const bytes = statSync(path).size;
  const hash = createHash("sha256").update(buffer).digest("hex").slice(0, 16);
  report[relPath] = { bytes, sha256: hash };
  return report[relPath];
}

for (const [body, art] of Object.entries(ART_DIRECTION)) {
  if (art.relief > MAX_RELIEF_FRACTION) {
    throw new Error(
      `${body}: relief ${art.relief} exceeds MAX_RELIEF_FRACTION ${MAX_RELIEF_FRACTION}. ` +
        "Relief is art direction, not a measurement, and must never read as a scale claim " +
        "(docs/RENDERING_QUALITY_STRATEGY.md section 10, rule 4).",
    );
  }
  emit(`assets/bodies/${body}-body.glb`, buildBodyGlb({ name: `${body}-body`, art, segments: 96, rings: 64 }));
  emit(
    `assets/bodies/${body}-body-lod1.glb`,
    buildBodyGlb({ name: `${body}-body-lod1`, art, segments: 32, rings: 20 }),
  );
  emit(
    `assets/textures/${body}-albedo.png`,
    encodePng(TEXTURE_WIDTH, TEXTURE_HEIGHT, buildAlbedo(art)),
  );
  emit(
    `assets/textures/${body}-normal.png`,
    encodePng(TEXTURE_WIDTH, TEXTURE_HEIGHT, buildNormalMap(art)),
  );
}

emit("assets/environment/survey-environment.hdr", buildEnvironmentHdr());

// ---------------------------------------------------------------------------
// Provenance manifest
// ---------------------------------------------------------------------------

/**
 * Written from the same loop that produced the bytes, so a record can never
 * describe an asset that is not on disk or a file that has no record.
 *
 * The field set is the one docs/ASSET_PROVENANCE.md requires, with
 * `scientificClaimLinkage: "none"` on every record. That is not a formality:
 * RENDERING_QUALITY_STRATEGY.md §10 rule 6 says imagery is an illustration of a
 * sourced value and never a source of one, and rule 4 says a body must not
 * imply a measurement the game does not have. These meshes are art direction,
 * so the honest linkage is none.
 */
const GENERATOR = "scripts/generate-production-assets.mjs";
const TOOL_VERSION = "1.0.0";
const REVIEW_DATE = "2026-09-25";

const records = [];

function record(assetId, { category, transformations, sourceArtifact }) {
  const entry = report[assetId];
  records.push({
    asset_id: assetId,
    path: entry ? `public/${assetId}` : null,
    category,
    creator: "Planetary Survey original work (setnessconsulting)",
    creation_method: "generated",
    source_reference: `regenerate: node ${GENERATOR}`,
    license_rights_basis:
      "Original work created for this project and released under the project's own licence. No third-party or agency rights are involved.",
    agency_origin: "none",
    usage_restrictions: {
      attribution_required: false,
      redistributable: true,
      commercial_ok: true,
      derivatives_ok: true,
    },
    transformations: [...transformations],
    tool: `node ${GENERATOR}`,
    tool_version: TOOL_VERSION,
    source_artifact_reference: sourceArtifact,
    scientific_claim_linkage: "none",
    bytes: entry ? entry.bytes : null,
    sha256: entry ? entry.sha256 : null,
    reviewer: "owner (setnessconsulting)",
    review_date: REVIEW_DATE,
    release_status: "approved",
  });
}

for (const body of Object.keys(ART_DIRECTION)) {
  record(`assets/bodies/${body}-body.glb`, {
    category: "planet/body mesh",
    transformations: [
      "parametric UV sphere, 96x64 segments",
      "radial displacement from seeded value-noise fbm (art direction, not measurement)",
      "normals exported as unit sphere normals; fine relief carried by the normal map",
      "gltf 2.0 binary, 16-bit indices",
    ],
    sourceArtifact: "ART_DIRECTION table in " + GENERATOR,
  });
  record(`assets/bodies/${body}-body-lod1.glb`, {
    category: "planet/body mesh (LOD)",
    transformations: [
      "same generator at 32x20 segments",
      "large forms only; fine detail dropped so the silhouette still reads correctly",
    ],
    sourceArtifact: "ART_DIRECTION table in " + GENERATOR,
  });
  record(`assets/textures/${body}-albedo.png`, {
    category: "surface texture",
    transformations: [
      "512x256 equirectangular albedo",
      "seeded value-noise fbm shading, 5 octaves",
      "RGB8 PNG, zlib deflate, filter type 0",
    ],
    sourceArtifact: "ART_DIRECTION table in " + GENERATOR,
  });
  record(`assets/textures/${body}-normal.png`, {
    category: "surface texture (normal map)",
    transformations: [
      "512x256 equirectangular tangent-space normal map",
      "derived from the same height field as the mesh displacement so shading matches silhouette",
      "RGB8 PNG, zlib deflate, filter type 0",
    ],
    sourceArtifact: "ART_DIRECTION table in " + GENERATOR,
  });
}

record("assets/environment/survey-environment.hdr", {
  category: "environment / IBL source",
  transformations: [
    "128x64 equirectangular Radiance RGBE, flat (non-RLE) scanlines",
    "dark cool gradient with a warm key lobe aligned to the renderer's key light and a broad cool fill",
    "prefiltered at load by Babylon HDRCubeTexture for image-based lighting",
  ],
  sourceArtifact: "buildEnvironmentHdr in " + GENERATOR,
});

// Audio cues ship zero bytes (docs/TECHNICAL_DESIGN.md §9 permits an
// engine-agnostic seam; PS-10 synthesises cues in Web Audio). They still
// belong in the provenance manifest because docs/ASSET_PROVENANCE.md requires
// audio to be present in it. Each id is checked against AudioCueId in
// tests/audio/cueInventory.test.ts so a new cue cannot ship unrecorded.
const AUDIO_CUES = [
  "ui.select",
  "ui.confirm",
  "instrument.start",
  "instrument.stop",
  "evidence.capture",
  "evidence.rejected",
  "claim.submitted",
  "mission.complete",
  "ambience.survey",
];
for (const cue of AUDIO_CUES) {
  records.push({
    asset_id: `audio.${cue}`,
    path: null,
    delivery: "synthesized-at-runtime",
    category: "sound effect / ambience",
    creator: "Planetary Survey original work (setnessconsulting)",
    creation_method: "generated",
    source_reference: "src/audio/cues.ts",
    license_rights_basis:
      "Original synthesis graph authored for this project. No sampled, licensed, or extracted audio is used anywhere in the product.",
    agency_origin: "none",
    usage_restrictions: {
      attribution_required: false,
      redistributable: true,
      commercial_ok: true,
      derivatives_ok: true,
    },
    transformations: ["Web Audio oscillator/noise graph with a gain envelope; no audio file is shipped"],
    tool: "src/audio/cues.ts",
    tool_version: TOOL_VERSION,
    source_artifact_reference: "CUE_INVENTORY in src/audio/cues.ts",
    scientific_claim_linkage: "none",
    bytes: 0,
    sha256: null,
    reviewer: "owner (setnessconsulting)",
    review_date: REVIEW_DATE,
    release_status: "approved",
  });
}

const provenanceManifest = {
  version: "1.0.0",
  generatedBy: GENERATOR,
  policy: "docs/ASSET_PROVENANCE.md",
  note:
    "Every record is original work generated by this repository's own pipeline. No agency imagery, no third-party asset, and no comparator-derived material is present.",
  records,
};

writeFileSync(
  join(outputRoot, "src", "assets", "provenanceManifest.json"),
  `${JSON.stringify(provenanceManifest, null, 2)}\n`,
  "utf8",
);

// ---------------------------------------------------------------------------
// Runtime asset manifest
// ---------------------------------------------------------------------------

/**
 * Emitted as data rather than hand-written TypeScript.
 *
 * `scripts/check-asset-pipeline.mjs` and the test suite both need to read the
 * manifest as real values. The previous manifest was hand-written and the gate
 * recovered entries with regular expressions over the source text, which meant
 * a factory function or a template literal silently registered zero assets
 * without anyone noticing. Writing the manifest from the same loop that wrote
 * the bytes removes that whole class of drift: the ids, the paths, the sizes
 * and the hashes all come from one place.
 *
 * `src/assets/assetManifest.ts` imports this file and validates its shape.
 */
const BODIES = Object.keys(ART_DIRECTION);
const COARSE_LOD_MINIMUM_QUALITY = "reduced";

const entries = BODIES.flatMap((body) => [
  {
    logicalId: `body.${body}.mesh`,
    kind: "mesh",
    shippingPath: `assets/bodies/${body}-body.glb`,
    bytes: report[`assets/bodies/${body}-body.glb`].bytes,
    lodVariants: [
      `assets/bodies/${body}-body-lod1.glb`,
      `assets/bodies/${body}-body.glb`,
    ],
    minimumQuality: null,
    provenanceId: `assets/bodies/${body}-body.glb`,
  },
  {
    logicalId: `body.${body}.mesh.lod1`,
    kind: "mesh",
    shippingPath: `assets/bodies/${body}-body-lod1.glb`,
    bytes: report[`assets/bodies/${body}-body-lod1.glb`].bytes,
    lodVariants: [],
    minimumQuality: COARSE_LOD_MINIMUM_QUALITY,
    provenanceId: `assets/bodies/${body}-body-lod1.glb`,
  },
  {
    logicalId: `body.${body}.albedo`,
    kind: "texture",
    shippingPath: `assets/textures/${body}-albedo.png`,
    bytes: report[`assets/textures/${body}-albedo.png`].bytes,
    lodVariants: [],
    minimumQuality: null,
    provenanceId: `assets/textures/${body}-albedo.png`,
  },
  {
    logicalId: `body.${body}.normal`,
    kind: "texture",
    shippingPath: `assets/textures/${body}-normal.png`,
    bytes: report[`assets/textures/${body}-normal.png`].bytes,
    lodVariants: [],
    minimumQuality: null,
    provenanceId: `assets/textures/${body}-normal.png`,
  },
]);

entries.push({
  logicalId: "environment.survey.hdr",
  kind: "environment",
  shippingPath: "assets/environment/survey-environment.hdr",
  bytes: report["assets/environment/survey-environment.hdr"].bytes,
  lodVariants: [],
  minimumQuality: null,
  provenanceId: "assets/environment/survey-environment.hdr",
});

const assetManifest = {
  version: "1.0.0",
  generatedFrom:
    "PS-10 production asset pipeline (scripts/generate-production-assets.mjs): per-body GLB " +
    "meshes with LODs, per-body albedo and normal-map PNGs, and one shared prefiltered HDR " +
    "environment. All assets are original work with agency origin none; see " +
    "src/assets/provenanceManifest.json.",
  productionBodyIds: BODIES,
  note:
    "Production art. No placeholder ships. Textures are PNG because the approved runtime dependency set has no KTX2 decoder; see docs/DECISIONS.md.",
  assets: entries,
};

writeFileSync(
  join(outputRoot, "src", "assets", "assetManifest.json"),
  `${JSON.stringify(assetManifest, null, 2)}\n`,
  "utf8",
);

const totalBytes = Object.values(report).reduce((sum, entry) => sum + entry.bytes, 0);
console.log(
  JSON.stringify(
    { assets: report, totalBytes, provenanceRecords: records.length },
    null,
    2,
  ),
);

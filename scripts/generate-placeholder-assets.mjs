/**
 * Generate PS-05 placeholder shipping assets (GLB + KTX2).
 *
 * These are ORIGINAL generated placeholders with no agency imagery and no
 * scientific claim. Provenance ids use the `generated.*` prefix (D-34). Re-run
 * with `node scripts/generate-placeholder-assets.mjs` after changing geometry.
 *
 * Bytes are measured and printed so `assetManifest.ts` can stay honest.
 */

import { mkdirSync, writeFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const outDir = join(root, "public", "assets", "bodies");

mkdirSync(outDir, { recursive: true });

/**
 * Build a minimal UV-sphere GLB (glTF 2.0 binary) with POSITION / NORMAL / TEXCOORD_0.
 * No embedded textures — albedo comes from the separate KTX2 path or PBR fallback.
 */
function buildSphereGlb({ segments = 24, rings = 16, radius = 1 } = {}) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];

  for (let y = 0; y <= rings; y += 1) {
    const v = y / rings;
    const phi = v * Math.PI;
    const sinPhi = Math.sin(phi);
    const cosPhi = Math.cos(phi);
    for (let x = 0; x <= segments; x += 1) {
      const u = x / segments;
      const theta = u * Math.PI * 2;
      const sinTheta = Math.sin(theta);
      const cosTheta = Math.cos(theta);
      const nx = cosTheta * sinPhi;
      const ny = cosPhi;
      const nz = sinTheta * sinPhi;
      positions.push(nx * radius, ny * radius, nz * radius);
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

  const positionBytes = float32Buffer(positions);
  const normalBytes = float32Buffer(normals);
  const uvBytes = float32Buffer(uvs);
  const indexBytes = uint16Buffer(indices);

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

  const vertexCount = positions.length / 3;
  const json = {
    asset: { version: "2.0", generator: "planetary-survey-ps05-placeholder" },
    scenes: [{ nodes: [0] }],
    scene: 0,
    nodes: [{ mesh: 0, name: "placeholder-body" }],
    meshes: [
      {
        name: "placeholder-body",
        primitives: [
          {
            attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 },
            indices: 3,
            mode: 4,
          },
        ],
      },
    ],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: vertexCount,
        type: "VEC3",
        max: [radius, radius, radius],
        min: [-radius, -radius, -radius],
      },
      { bufferView: 1, componentType: 5126, count: vertexCount, type: "VEC3" },
      { bufferView: 2, componentType: 5126, count: vertexCount, type: "VEC2" },
      { bufferView: 3, componentType: 5123, count: indices.length, type: "SCALAR" },
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
  const jsonPadding = align(jsonText.length);
  jsonText += " ".repeat(jsonPadding);
  const jsonChunk = Buffer.from(jsonText, "utf8");
  const binPadding = align(bin.length);
  const binPadded = Buffer.concat([bin, Buffer.alloc(binPadding)]);

  const totalLength = 12 + 8 + jsonChunk.length + 8 + binPadded.length;
  const out = Buffer.alloc(totalLength);
  // glTF magic / version / length
  out.writeUInt32LE(0x46546c67, 0);
  out.writeUInt32LE(2, 4);
  out.writeUInt32LE(totalLength, 8);
  let cursor = 12;
  out.writeUInt32LE(jsonChunk.length, cursor);
  out.writeUInt32LE(0x4e4f534a, cursor + 4); // JSON
  jsonChunk.copy(out, cursor + 8);
  cursor += 8 + jsonChunk.length;
  out.writeUInt32LE(binPadded.length, cursor);
  out.writeUInt32LE(0x004e4942, cursor + 4); // BIN
  binPadded.copy(out, cursor + 8);
  return out;
}

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

/**
 * Minimal KTX2 with a 4x4 uncompressed RGBA8 level (VK_FORMAT_R8G8B8A8_UNORM).
 * Generated placeholder — not agency imagery. Babylon loads it through the
 * registered shipping path; decode uses the local KTX2 path in the renderer.
 */
function buildPlaceholderKtx2() {
  const width = 4;
  const height = 4;
  const pixels = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      // Calm slate-blue survey colour — deliberately non-photographic.
      pixels[i] = 90;
      pixels[i + 1] = 110;
      pixels[i + 2] = 140;
      pixels[i + 3] = 255;
    }
  }

  // Supercompression scheme NONE (0); typeSize 1; pixelWidth/Height as above.
  // This is a deliberately tiny Level 0 image for pipeline proof, not production art.
  const identifier = Buffer.from([
    0xab, 0x4b, 0x54, 0x58, 0x20, 0x32, 0x30, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);

  const header = Buffer.alloc(9 * 4);
  // vkFormat = VK_FORMAT_R8G8B8A8_UNORM (37)
  header.writeUInt32LE(37, 0);
  header.writeUInt32LE(1, 4); // typeSize
  header.writeUInt32LE(width, 8);
  header.writeUInt32LE(height, 12);
  header.writeUInt32LE(0, 16); // pixelDepth
  header.writeUInt32LE(0, 20); // layerCount
  header.writeUInt32LE(1, 24); // faceCount
  header.writeUInt32LE(1, 28); // levelCount
  header.writeUInt32LE(0, 32); // supercompressionScheme NONE

  const index = Buffer.alloc(4 * 4 + 8 * 2 + 8 * 3);
  // dfdByteOffset / dfdByteLength / kvdByteOffset / kvdByteLength / sgdByteOffset / sgdByteLength
  // Filled after we know DFD size. Level index follows.
  const dfd = buildBasicDfd();
  const dfdByteOffset = identifier.length + header.length + index.length;
  const dfdByteLength = dfd.length;
  const kvdByteOffset = 0;
  const kvdByteLength = 0;
  const sgdByteOffset = 0n;
  const sgdByteLength = 0n;

  index.writeUInt32LE(dfdByteOffset, 0);
  index.writeUInt32LE(dfdByteLength, 4);
  index.writeUInt32LE(kvdByteOffset, 8);
  index.writeUInt32LE(kvdByteLength, 12);
  index.writeBigUInt64LE(sgdByteOffset, 16);
  index.writeBigUInt64LE(sgdByteLength, 24);

  const levelByteOffset = BigInt(dfdByteOffset + dfdByteLength);
  const levelByteLength = BigInt(pixels.length);
  const levelUncompressed = BigInt(pixels.length);
  index.writeBigUInt64LE(levelByteOffset, 32);
  index.writeBigUInt64LE(levelByteLength, 40);
  index.writeBigUInt64LE(levelUncompressed, 48);

  return Buffer.concat([identifier, header, index, dfd, pixels]);
}

/** Data Format Descriptor for R8G8B8A8_UNORM (one sample per channel). */
function buildBasicDfd() {
  // Simplified DFD: totalSize + vendor/descriptor + sample information for RGBA8.
  // Structure per KTX2 / Khronos Data Format specification.
  const sampleCount = 4;
  const descriptorBlockSize = 24 + sampleCount * 16;
  const totalSize = 4 + descriptorBlockSize;
  const buf = Buffer.alloc(totalSize);
  buf.writeUInt32LE(totalSize, 0);
  // vendorId 0, descriptorType 0 (BASICFORMAT), versionNumber 2, descriptorBlockSize
  buf.writeUInt16LE(0, 4);
  buf.writeUInt16LE(0, 6);
  buf.writeUInt16LE(2, 8);
  buf.writeUInt16LE(descriptorBlockSize, 10);
  // colorModel = RGBSDA (1), colorPrimaries = BT709 (1), transfer = LINEAR (1), flags = 0
  buf.writeUInt8(1, 12);
  buf.writeUInt8(1, 13);
  buf.writeUInt8(1, 14);
  buf.writeUInt8(0, 15);
  // texelBlockDimension: 0,0,0,0 => 1x1x1x1
  buf.writeUInt8(0, 16);
  buf.writeUInt8(0, 17);
  buf.writeUInt8(0, 18);
  buf.writeUInt8(0, 19);
  // bytesPlane0 = 4, others 0
  buf.writeUInt8(4, 20);
  buf.writeUInt8(0, 21);
  buf.writeUInt8(0, 22);
  buf.writeUInt8(0, 23);
  buf.writeUInt8(0, 24);
  buf.writeUInt8(0, 25);
  buf.writeUInt8(0, 26);
  buf.writeUInt8(0, 27);

  const channels = [
    { bitOffset: 0, channel: 0 }, // R
    { bitOffset: 8, channel: 1 }, // G
    { bitOffset: 16, channel: 2 }, // B
    { bitOffset: 24, channel: 15 }, // A (channelType 15 = alpha in RGBSDA)
  ];
  let sampleOffset = 28;
  for (const sample of channels) {
    buf.writeUInt16LE(sample.bitOffset, sampleOffset);
    buf.writeUInt8(7, sampleOffset + 2); // bitLength = 8-1
    buf.writeUInt8(sample.channel, sampleOffset + 3);
    buf.writeUInt32LE(0xffffffff, sampleOffset + 4); // sampleLower
    buf.writeUInt32LE(0xffffffff, sampleOffset + 8); // sampleUpper (UNORM uses FFFFFFFF)
    // samplePosition x,y,z,w unused
    buf.writeUInt8(0, sampleOffset + 12);
    buf.writeUInt8(0, sampleOffset + 13);
    buf.writeUInt8(0, sampleOffset + 14);
    buf.writeUInt8(0, sampleOffset + 15);
    sampleOffset += 16;
  }
  return buf;
}

const glb = buildSphereGlb();
const glbPath = join(outDir, "placeholder-body.glb");
writeFileSync(glbPath, glb);

const ktx2 = buildPlaceholderKtx2();
const ktx2Path = join(outDir, "placeholder-albedo.ktx2");
writeFileSync(ktx2Path, ktx2);

// Coarse LOD: same mesh, recorded as a second logical shipping path for the
 // progressive loader to select under the reduced tier.
const glbCoarse = buildSphereGlb({ segments: 12, rings: 8 });
const glbCoarsePath = join(outDir, "placeholder-body-lod1.glb");
writeFileSync(glbCoarsePath, glbCoarse);

console.log(
  JSON.stringify(
    {
      "assets/bodies/placeholder-body.glb": statSync(glbPath).size,
      "assets/bodies/placeholder-body-lod1.glb": statSync(glbCoarsePath).size,
      "assets/bodies/placeholder-albedo.ktx2": statSync(ktx2Path).size,
    },
    null,
    2,
  ),
);

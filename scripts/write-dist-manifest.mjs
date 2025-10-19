#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";

const distFolderName = "dist";
const dotDistPrefix = `./${distFolderName}/`;
const distPrefix = `${distFolderName}/`;

const resolvePackageRoot = () => {
  const [relativePath] = process.argv.slice(2);
  if (relativePath) {
    return resolve(process.cwd(), relativePath);
  }
  return process.cwd();
};

const normalizeEntryPoint = (value) => {
  if (typeof value !== "string") {
    return value;
  }
  if (value.startsWith(dotDistPrefix)) {
    return `./${value.slice(dotDistPrefix.length)}`;
  }
  if (value.startsWith(distPrefix)) {
    return `./${value.slice(distPrefix.length)}`;
  }
  return value;
};

const normalizeExports = (value) => {
  if (typeof value === "string") {
    return normalizeEntryPoint(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeExports(item));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [
        key,
        normalizeExports(entryValue),
      ]),
    );
  }
  return value;
};

const packageRoot = resolvePackageRoot();
const sourceManifestPath = resolve(packageRoot, "package.json");
const distDirectory = resolve(packageRoot, distFolderName);
const distManifestPath = resolve(distDirectory, "package.json");

const rawManifest = await readFile(sourceManifestPath, "utf8");
const manifest = JSON.parse(rawManifest);

const distManifest = { ...manifest };

distManifest.main =
  distManifest.main !== undefined
    ? normalizeEntryPoint(distManifest.main)
    : "./index.js";

if (distManifest.module !== undefined) {
  distManifest.module = normalizeEntryPoint(distManifest.module);
}

if (distManifest.types !== undefined) {
  distManifest.types = normalizeEntryPoint(distManifest.types);
}

if (distManifest.typings !== undefined) {
  distManifest.typings = normalizeEntryPoint(distManifest.typings);
}

if (distManifest.exports !== undefined) {
  distManifest.exports = normalizeExports(distManifest.exports);
}

delete distManifest.scripts;
delete distManifest.files;

await mkdir(distDirectory, { recursive: true });
const serialized = `${JSON.stringify(distManifest, null, 2)}\n`;
await writeFile(distManifestPath, serialized);

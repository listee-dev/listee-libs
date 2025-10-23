#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
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

const resolveWorkspaceRoot = async () => {
  let current = packageRoot;
  while (true) {
    const parent = dirname(current);
    const manifestPath = resolve(current, "package.json");
    try {
      const raw = await readFile(manifestPath, "utf8");
      const parsed = JSON.parse(raw);
      if (parsed.workspaces !== undefined || parsed.catalog !== undefined) {
        return { rootDir: current, manifest: parsed };
      }
    } catch {
      // ignore and continue climbing
    }
    if (parent === current) {
      break;
    }
    current = parent;
  }
  return null;
};

const replaceCatalogReferences = (dependencies, catalog) => {
  if (!dependencies || typeof dependencies !== "object") {
    return dependencies;
  }

  return Object.fromEntries(
    Object.entries(dependencies).map(([name, range]) => {
      if (typeof range === "string" && range.startsWith("catalog:")) {
        const catalogKey = range === "catalog:" ? name : range.slice("catalog:".length);
        const resolved = catalog?.[catalogKey];
        if (typeof resolved === "string" && resolved.length > 0) {
          return [name, resolved];
        }
      }
      return [name, range];
    }),
  );
};

const getErrorMessage = (value) => {
  if (value instanceof Error) {
    return value.message;
  }
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return "Unknown error";
  }
};

try {
  const rawManifest = await readFile(sourceManifestPath, "utf8");
  const manifest = JSON.parse(rawManifest);

  const workspaceInfo = await resolveWorkspaceRoot();
  const rootCatalog = workspaceInfo?.manifest?.catalog ?? {};

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

  distManifest.dependencies = replaceCatalogReferences(
    distManifest.dependencies,
    rootCatalog,
  );
  distManifest.devDependencies = replaceCatalogReferences(
    distManifest.devDependencies,
    rootCatalog,
  );
  distManifest.peerDependencies = replaceCatalogReferences(
    distManifest.peerDependencies,
    rootCatalog,
  );
  distManifest.optionalDependencies = replaceCatalogReferences(
    distManifest.optionalDependencies,
    rootCatalog,
  );

  delete distManifest.scripts;
  delete distManifest.files;

  await mkdir(distDirectory, { recursive: true });
  const serialized = `${JSON.stringify(distManifest, null, 2)}\n`;
  await writeFile(distManifestPath, serialized);
  console.log(`✔️ Generated ${distManifestPath}`);
} catch (error) {
  console.error(
    `Failed to generate dist manifest for ${packageRoot}: ${getErrorMessage(
      error,
    )}`,
  );
  process.exit(1);
}

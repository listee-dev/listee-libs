#!/usr/bin/env node
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
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

const resolveWorkspacePackages = async (workspaceRoot) => {
  if (!workspaceRoot) {
    return new Map();
  }

  const workspaces = workspaceRoot.manifest.workspaces;
  const patterns = [];
  if (Array.isArray(workspaces)) {
    patterns.push(...workspaces);
  } else if (workspaces && Array.isArray(workspaces.packages)) {
    patterns.push(...workspaces.packages);
  }

  const packageVersions = new Map();

  for (const pattern of patterns) {
    if (!pattern.endsWith("/*")) {
      continue;
    }
    const base = resolve(workspaceRoot.rootDir, pattern.slice(0, -2));
    try {
      const entries = await readdir(base, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue;
        }
        const manifestPath = resolve(base, entry.name, "package.json");
        try {
          const raw = await readFile(manifestPath, "utf8");
          const parsed = JSON.parse(raw);
          if (typeof parsed.name === "string" && typeof parsed.version === "string") {
            packageVersions.set(parsed.name, parsed.version);
          }
        } catch {
          // ignore missing manifests
        }
      }
    } catch {
      // ignore missing workspace directories
    }
  }

  return packageVersions;
};

const replaceSpecialReferences = (
  dependencies,
  catalog,
  workspaceVersions,
  unresolved,
) => {
  if (!dependencies || typeof dependencies !== "object") {
    return dependencies;
  }

  return Object.fromEntries(
    Object.entries(dependencies).map(([name, range]) => {
      if (typeof range === "string") {
        if (range.startsWith("catalog:")) {
          const catalogKey = range === "catalog:" ? name : range.slice("catalog:".length);
          const resolved = catalog?.[catalogKey];
          if (typeof resolved === "string" && resolved.length > 0) {
            return [name, resolved];
          }
          unresolved.push({ name, range, type: "catalog" });
        }

        if (range.startsWith("workspace:")) {
          const specifier = range.slice("workspace:".length);
          const version = workspaceVersions.get(name);
          if (typeof version === "string" && version.length > 0) {
            if (specifier === "^" || specifier === "~") {
              return [name, `${specifier}${version}`];
            }
            return [name, version];
          }
          unresolved.push({ name, range, type: "workspace" });
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
  const workspaceVersions = await resolveWorkspacePackages(workspaceInfo);
  const unresolvedReferences = [];

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

  distManifest.dependencies = replaceSpecialReferences(
    distManifest.dependencies,
    rootCatalog,
    workspaceVersions,
    unresolvedReferences,
  );
  distManifest.devDependencies = replaceSpecialReferences(
    distManifest.devDependencies,
    rootCatalog,
    workspaceVersions,
    unresolvedReferences,
  );
  distManifest.peerDependencies = replaceSpecialReferences(
    distManifest.peerDependencies,
    rootCatalog,
    workspaceVersions,
    unresolvedReferences,
  );
  distManifest.optionalDependencies = replaceSpecialReferences(
    distManifest.optionalDependencies,
    rootCatalog,
    workspaceVersions,
    unresolvedReferences,
  );

  if (unresolvedReferences.length > 0) {
    console.error("❌ Unresolved workspace/catalog references detected:");
    for (const { name, range, type } of unresolvedReferences) {
      console.error(`  ${name}: ${range} (${type})`);
    }
    process.exit(1);
  }

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

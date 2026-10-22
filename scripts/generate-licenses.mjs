import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

const root = process.cwd();
const lockPath = path.join(root, "package-lock.json");
const outputDir = path.join(root, "public", "licenses");
const textsDir = path.join(outputDir, "texts");

const lock = JSON.parse(await fs.readFile(lockPath, "utf8"));
const rootPackage = JSON.parse(
  await fs.readFile(path.join(root, "package.json"), "utf8"),
);

if (!lock.packages) {
  throw new Error("package-lock.json: package field not found!");
}

await fs.mkdir(textsDir, { recursive: true });

const entries = Object.entries(lock.packages).filter(
  ([packagePath]) => packagePath !== "",
);

const packagePaths = new Set(entries.map(([packagePath]) => packagePath));
const packageData = new Map();
const parents = new Map();

function resolvePackagePath(fromPath, name) {
  let base = fromPath;

  while (true) {
    const candidate = base
      ? `${base}/node_modules/${name}`
      : `node_modules/${name}`;

    if (packagePaths.has(candidate)) return candidate;

    if (!base) return null;

    const parent = path.posix.dirname(base);
    base = parent === "." ? "" : parent;
  }
}

function dependencyNames(meta) {
  return new Set([
    ...Object.keys(meta.dependencies ?? {}),
    ...Object.keys(meta.optionalDependencies ?? {}),
    ...Object.keys(meta.peerDependencies ?? {}),
  ]);
}

function getPackageType(packagePath) {
  const metadata = packageData.get(packagePath);
  return {
    dependency: metadata?.production ?? false,
    devDependency: metadata?.development ?? false,
  };
}

function repositoryUrl(repository) {
  if (typeof repository === "string") return repository;
  return repository?.url ?? null;
}

function getFunding(funding) {
  if (!funding) return [];

  const items = Array.isArray(funding) ? funding : [funding];

  return items.map((item) =>
    typeof item === "string"
      ? { url: item, type: null }
      : { url: item.url ?? null, type: item.type ?? null },
  );
}

for (const [packagePath, lockMeta] of entries) {
  const diskPath = path.join(root, packagePath);

  let pkg = {};

  try {
    pkg = JSON.parse(
      await fs.readFile(path.join(diskPath, "package.json"), "utf8"),
    );
  } catch (error) {
    console.warn(`[notice] ${packagePath} cannot read`);
    console.warn(`[notice] cause of: ${error.message}`);
  }

  packageData.set(packagePath, {
    id: packagePath,
    name: pkg.name ?? lockMeta.name ?? path.posix.basename(packagePath),
    version: pkg.version ?? lockMeta.version ?? null,
    description: pkg.description ?? null,
    license: pkg.license ?? lockMeta.license ?? null,
    homepage: pkg.homepage ?? null,
    repository: repositoryUrl(pkg.repository),
    funding: getFunding(pkg.funding),
    production: false,
    development: false,
    parents: new Set(),
    packagePath,
    meta: lockMeta,
  });

  parents.set(packagePath, new Set());
}

for (const [packagePath, meta] of entries) {
  for (const name of dependencyNames(meta)) {
    const childPath = resolvePackagePath(packagePath, name);

    if (!childPath) continue;

    parents.get(childPath)?.add(packagePath);
  }
}

function markTree(dependencies, field) {
  const visited = new Set();

  function visit(packagePath) {
    if (!packagePath || visited.has(packagePath)) return;
    visited.add(packagePath);

    const data = packageData.get(packagePath);
    if (!data) return;

    data[field] = true;

    for (const name of dependencyNames(data.meta)) {
      visit(resolvePackagePath(packagePath, name));
    }
  }

  for (const name of Object.keys(dependencies ?? {})) {
    visit(resolvePackagePath("", name));
  }
}

markTree(rootPackage.dependencies, "production");
markTree(rootPackage.devDependencies, "development");

const licenseFiles = /^(license|licence|copying|notice)([-_. ].*)?$/i;

async function readLicenseFiles(packagePath, id) {
  const packageDir = path.join(root, packagePath);
  let names = [];

  try {
    names = await fs.readdir(packageDir);
  } catch {
    return [];
  }

  const files = names.filter((name) => licenseFiles.test(name));
  const texts = [];

  for (const name of files) {
    const fullPath = path.join(packageDir, name);

    try {
      const stat = await fs.stat(fullPath);
      if (!stat.isFile()) continue;

      const text = await fs.readFile(fullPath, "utf8");
      if (!text.trim()) continue;

      const hash = createHash("sha256")
        .update(id + ":" + name)
        .digest("hex")
        .slice(0, 16);

      const fileName = `${hash}.txt`;

      await fs.writeFile(path.join(textsDir, fileName), text, "utf8");

      texts.push({
        name,
        textFile: `texts/${fileName}`,
      });
    } catch (error) {
      console.warn(`[notice] ${packagePath} (${id}) cannot read`);
      console.warn(`[notice] cause of: ${error.message}`);
    }
  }

  return texts;
}

const packages = [];

for (const [packagePath, data] of packageData) {
  const id = packagePath;
  const texts = await readLicenseFiles(packagePath, id);
  const type = getPackageType(packagePath);

  const licenseId =
    typeof data.license === "string"
      ? data.license
      : data.license?.type ?? null;

  packages.push({
    id,
    name: data.name,
    version: data.version,
    description: data.description,
    type: [
      ...(type.dependency ? ["dependency"] : []),
      ...(type.devDependency ? ["devDependency"] : []),
    ],
    direct:
      Object.hasOwn(rootPackage.dependencies ?? {}, data.name) ||
      Object.hasOwn(rootPackage.devDependencies ?? {}, data.name),
    parents: [...(parents.get(packagePath) ?? [])],
    license: {
      id: licenseId,
      textFiles: texts,
    },
    homepage: data.homepage,
    repository: data.repository,
    funding: data.funding,
  });
}

packages.sort((a, b) => a.name.localeCompare(b.name));

const result = {
  generatedAt: new Date().toISOString(),
  packageCount: packages.length,
  packages,
};

await fs.writeFile(
  path.join(outputDir, "dependencies.json"),
  JSON.stringify(result, null, 2),
  "utf8",
);

console.log(`${packages.length} packaged license inventory created`);

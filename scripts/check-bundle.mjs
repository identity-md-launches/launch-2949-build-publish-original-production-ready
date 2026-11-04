import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import { resolve, relative, dirname, extname } from "node:path";
const root = resolve(".");
const excluded = new Set([
  ".git",
  ".github",
  ".imd",
  ".cache",
  ".npm",
  ".vite",
  "node_modules",
  "npm-cache",
  "coverage",
]);
const files = [];
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = resolve(dir, entry.name),
      rel = relative(root, path).replaceAll("\\", "/");
    if (
      excluded.has(entry.name) ||
      entry.name === ".env" ||
      entry.name.startsWith(".env.") ||
      rel === "test/scratch" ||
      entry.name.endsWith(".tsbuildinfo")
    )
      continue;
    assert.ok(!entry.isSymbolicLink(), `Unexpected submission symlink: ${rel}`);
    if (entry.isDirectory()) await walk(path);
    else {
      assert.ok(
        !/\.(tgz|zip|tar|deb)$/.test(entry.name),
        `Unnecessary archive: ${rel}`,
      );
      files.push({ path: rel, bytes: (await stat(path)).size });
    }
  }
}
await walk(root);
const bytes = files.reduce((sum, f) => sum + f.bytes, 0);
assert.ok(bytes <= 8388608, `Submission is ${bytes} bytes, above 8 MiB`);
assert.ok(
  (await stat(".gitignore")).size <= 512,
  "Ignore-file budget exceeded",
);
const html = await readFile("dist/index.html", "utf8");
assert.match(html, /<title>Squeekstr Desk<\/title>/);
assert.match(html, /name="description"/);
assert.match(html, /property="og:title"/);
const references = [...html.matchAll(/(?:src|href)="([^"#]+)"/g)].map(
  (m) => m[1],
);
const og = html.match(/property="og:image"\s+content="([^"]+)"/);
assert.ok(og, "Missing OG image");
references.push(og[1]);
for (const ref of references) {
  assert.ok(ref.startsWith("./"), `Export URL is not relative: ${ref}`);
  const path = resolve("dist", ref);
  assert.ok((await stat(path)).isFile(), `Missing asset: ${ref}`);
  if (extname(path) === ".css") {
    const css = await readFile(path, "utf8");
    for (const m of css.matchAll(/url\(([^)]+)\)/g)) {
      const asset = m[1].replaceAll(/['"]/g, "");
      assert.ok(
        !asset.startsWith("/") && !asset.startsWith("http"),
        "CSS runtime asset must be local and relative",
      );
      assert.ok(
        (await stat(resolve(dirname(path), asset))).isFile(),
        `Missing CSS asset ${asset}`,
      );
    }
  }
}
const lock = JSON.parse(await readFile("package-lock.json", "utf8"));
const pkg = JSON.parse(await readFile("package.json", "utf8"));
assert.deepEqual(lock.packages[""].dependencies, pkg.dependencies);
assert.deepEqual(lock.packages[""].devDependencies, pkg.devDependencies);
const exportFiles = files.filter((f) => f.path.startsWith("dist/"));
console.log(
  JSON.stringify(
    {
      submissionBytes: bytes,
      limitBytes: 8388608,
      submissionFiles: files.length,
      exportBytes: exportFiles.reduce((n, f) => n + f.bytes, 0),
      exportFiles: exportFiles.length,
      ignoreBytes: (await stat(".gitignore")).size,
      localAssetReferencesChecked: references.length,
      lockfileMatches: true,
    },
    null,
    2,
  ),
);

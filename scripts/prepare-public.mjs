import {
  copyFileSync,
  cpSync,
  mkdirSync,
  rmSync
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const publicRoot = join(root, "public");

rmSync(publicRoot, { recursive: true, force: true });

function copy(relativePath) {
  const destination = join(publicRoot, relativePath);
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(join(root, relativePath), destination);
}

for (const file of [
  "index.html",
  "styles.css",
  "game-engine.js",
  "app.js",
  "art/cards/minimal/card-back-lighthouse.png"
]) {
  copy(file);
}

const labelledSource = join(
  root,
  "art",
  "cards",
  "minimal",
  "labelled"
);
const labelledDestination = join(
  publicRoot,
  "art",
  "cards",
  "minimal",
  "labelled"
);

mkdirSync(dirname(labelledDestination), { recursive: true });
cpSync(labelledSource, labelledDestination, {
  recursive: true,
  force: true
});

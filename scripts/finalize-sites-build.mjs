import {
  copyFileSync,
  existsSync,
  mkdirSync
} from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const dist = join(root, "dist");
const hostingSource = join(root, ".openai", "hosting.json");
const hostingDirectory = join(dist, ".openai");
const hostingDestination = join(hostingDirectory, "hosting.json");

mkdirSync(hostingDirectory, { recursive: true });
copyFileSync(hostingSource, hostingDestination);

const requiredFiles = [
  "server/index.js",
  ".openai/hosting.json",
  "client/index.html",
  "client/styles.css",
  "client/game-engine.js",
  "client/app.js",
  "client/art/cards/minimal/card-back-lighthouse.png",
  "client/art/cards/minimal/labelled/custode.png",
  "client/art/cards/minimal/labelled/sabotatore.png",
  "client/art/cards/minimal/labelled/sentinella.png",
  "client/art/cards/minimal/labelled/tecnico.png",
  "client/art/cards/minimal/labelled/portavoce.png",
  "client/art/cards/minimal/labelled/naufrago.png",
  "client/art/cards/minimal/labelled/vedetta.png",
  "client/art/cards/minimal/labelled/cartografa-della-baia.png",
  "client/art/cards/minimal/labelled/guastatore.png"
];

const missingFiles = requiredFiles.filter(
  (relativePath) => !existsSync(join(dist, relativePath))
);

if (missingFiles.length > 0) {
  throw new Error(
    `Build Sites incompleto. File mancanti:\n${missingFiles.join("\n")}`
  );
}

console.log("Build Sites verificata: Worker, metadati e carte presenti.");

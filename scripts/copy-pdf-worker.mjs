// pdfjs-dist's worker script uses `import.meta` in a way that breaks when
// webpack/Terser tries to bundle+minify it as part of the app (see
// contract-field-mapper.tsx) — copying it into public/ instead and
// referencing it as a plain static path sidesteps that entirely. Runs on
// every `npm install` (see package.json "postinstall") so it always matches
// the installed pdfjs-dist version.
import { copyFileSync, mkdirSync } from "fs";
import path from "path";

const src = path.join(process.cwd(), "node_modules", "pdfjs-dist", "build", "pdf.worker.min.mjs");
const destDir = path.join(process.cwd(), "public");
const dest = path.join(destDir, "pdf.worker.min.mjs");

mkdirSync(destDir, { recursive: true });
copyFileSync(src, dest);
console.log("Copied pdf.worker.min.mjs to public/");

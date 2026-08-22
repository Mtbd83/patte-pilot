// Leaflet's default marker icons are referenced by relative path
// (L.Icon.Default) which breaks under bundlers — copying them into public/
// and pointing L.Icon.Default.mergeOptions at plain static paths (see
// vets-map.tsx) sidesteps that entirely, same approach as
// copy-pdf-worker.mjs. Runs on every `npm install` (see package.json
// "postinstall") so it always matches the installed leaflet version.
import { copyFileSync, mkdirSync } from "fs";
import path from "path";

const srcDir = path.join(process.cwd(), "node_modules", "leaflet", "dist", "images");
const destDir = path.join(process.cwd(), "public", "leaflet");

mkdirSync(destDir, { recursive: true });
for (const file of ["marker-icon.png", "marker-icon-2x.png", "marker-shadow.png"]) {
  copyFileSync(path.join(srcDir, file), path.join(destDir, file));
}
console.log("Copied Leaflet marker icons to public/leaflet/");

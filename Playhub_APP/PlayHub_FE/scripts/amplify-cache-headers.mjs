// After an Amplify build: let browsers cache the fingerprinted files in /assets for a year.
// Their names change whenever their content does, so a deploy is still picked up at once.
// Nitro writes the Amplify deploy manifest without a cache rule for them (browsers then
// re-check every file on every visit), so add one ahead of the catch-all static route.
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const path = ".amplify-hosting/deploy-manifest.json";
if (!existsSync(path)) {
  console.log("amplify-cache-headers: no Amplify manifest (not an Amplify build), nothing to do");
  process.exit(0);
}
const manifest = JSON.parse(readFileSync(path, "utf8"));
if (!manifest.routes.some((route) => route.path === "/assets/*")) {
  manifest.routes.unshift({
    path: "/assets/*",
    target: { kind: "Static", cacheControl: "public, max-age=31536000, immutable" },
    fallback: { kind: "Compute", src: "default" },
  });
  writeFileSync(path, JSON.stringify(manifest, null, 2));
}
console.log("amplify-cache-headers: /assets cached for a year");

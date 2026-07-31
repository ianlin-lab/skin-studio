import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(scriptDirectory, "..");
const assetDirectory = path.join(projectDirectory, "assets", "motion", "pen-spin");
const sourcePath = path.join(assetDirectory, "renaissance-static-clean.png");
const outputPath = path.join(assetDirectory, "renaissance-living-parallax-v3.svg");
const bundledOutputPath = path.join(
  projectDirectory,
  "bundled-themes",
  "medieval-scriptorium",
  "background.svg",
);
const source = await fs.readFile(sourcePath);
const sourceDataUrl = `data:image/png;base64,${source.toString("base64")}`;

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     xmlns:xlink="http://www.w3.org/1999/xlink"
     width="1586" height="992" viewBox="0 0 1586 992"
     role="img" aria-label="A Renaissance workshop with lightweight ambient motion">
  <defs>
    <image id="master" width="1586" height="992" xlink:href="${sourceDataUrl}"/>
    <radialGradient id="windowGlow" cx="72%" cy="30%" r="62%">
      <stop offset="0" stop-color="#f8d99a" stop-opacity=".24"/>
      <stop offset=".46" stop-color="#d78d48" stop-opacity=".09"/>
      <stop offset="1" stop-color="#4d2517" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="curtainShade" x1="0" y1="0" x2="1" y2=".7">
      <stop offset="0" stop-color="#160b09" stop-opacity=".2"/>
      <stop offset=".55" stop-color="#3a1711" stop-opacity=".07"/>
      <stop offset="1" stop-color="#160b09" stop-opacity="0"/>
    </linearGradient>
    <style>
      @media (prefers-reduced-motion: reduce) {
        .ambient-motion { display: none; }
      }
    </style>
  </defs>

  <!-- Keep the expensive raster scene in a single compositing layer. -->
  <use xlink:href="#master"/>

  <!-- Vector-only light and shadow movement keeps the scene alive without
       duplicating, masking, blurring, or re-rasterizing the full image. -->
  <g class="ambient-motion" pointer-events="none">
    <ellipse cx="1190" cy="330" rx="650" ry="430" fill="url(#windowGlow)" opacity=".08">
      <animate attributeName="opacity"
        values=".055;.115;.075;.055"
        keyTimes="0;.38;.74;1" dur="13.8s" repeatCount="indefinite"/>
      <animateTransform attributeName="transform" type="translate"
        values="0 0;7 -3;-4 2;0 0"
        keyTimes="0;.38;.74;1" dur="17.2s" repeatCount="indefinite"/>
    </ellipse>
    <path d="M0 0 H1586 V330
             C1340 354 1110 365 880 344
             C610 320 330 286 0 324Z"
          fill="url(#curtainShade)" opacity=".16">
      <animate attributeName="opacity"
        values=".13;.19;.15;.13"
        keyTimes="0;.42;.76;1" dur="11.6s" repeatCount="indefinite"/>
    </path>
    <g fill="#f5d99d" opacity=".16">
      <circle cx="1118" cy="284" r="2.2">
        <animate attributeName="cy" values="284;270;284" dur="9.4s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values=".08;.28;.08" dur="9.4s" repeatCount="indefinite"/>
      </circle>
      <circle cx="1284" cy="356" r="1.6">
        <animate attributeName="cy" values="356;343;356" dur="12.1s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values=".06;.22;.06" dur="12.1s" repeatCount="indefinite"/>
      </circle>
      <circle cx="1396" cy="248" r="1.8">
        <animate attributeName="cy" values="248;237;248" dur="10.7s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values=".05;.2;.05" dur="10.7s" repeatCount="indefinite"/>
      </circle>
    </g>
  </g>
</svg>
`;

await Promise.all([
  fs.writeFile(outputPath, svg, { encoding: "utf8", mode: 0o600 }),
  fs.writeFile(bundledOutputPath, svg, { encoding: "utf8", mode: 0o600 }),
]);
console.log([outputPath, bundledOutputPath].join("\n"));

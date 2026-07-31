import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(scriptDirectory, "..");
const assetDirectory = path.join(projectDirectory, "assets", "motion", "pen-spin");
const sourcePath = path.join(assetDirectory, "renaissance-static-clean.png");
const outputPath = path.join(assetDirectory, "renaissance-pen-spin.svg");

const source = await fs.readFile(sourcePath);
const sourceDataUrl = `data:image/png;base64,${source.toString("base64")}`;

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     xmlns:xlink="http://www.w3.org/1999/xlink"
     width="1586" height="992" viewBox="0 0 1586 992"
     role="img" aria-label="A painterly desk scene with a looping pen spin">
  <defs>
    <image id="master" width="1586" height="992" xlink:href="${sourceDataUrl}"/>
    <linearGradient id="boardPatch" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ded9cf"/>
      <stop offset=".52" stop-color="#cdc7bb"/>
      <stop offset="1" stop-color="#bdb5a5"/>
    </linearGradient>
    <linearGradient id="handPatch" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#513023"/>
      <stop offset=".48" stop-color="#3a2118"/>
      <stop offset="1" stop-color="#25140f"/>
    </linearGradient>
    <linearGradient id="pencilBody" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#d9a349"/>
      <stop offset=".42" stop-color="#bf8428"/>
      <stop offset=".76" stop-color="#a86c1f"/>
      <stop offset="1" stop-color="#7e4b18"/>
    </linearGradient>
    <linearGradient id="metal" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#d8d9d4"/>
      <stop offset=".5" stop-color="#858d90"/>
      <stop offset="1" stop-color="#4e575b"/>
    </linearGradient>
    <filter id="pencilShadow" x="-30%" y="-80%" width="180%" height="260%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="2.2" result="blur"/>
      <feOffset in="blur" dx="2.2" dy="3.2" result="offsetBlur"/>
      <feColorMatrix in="offsetBlur" type="matrix"
        values="0 0 0 0 0
                0 0 0 0 0
                0 0 0 0 0
                0 0 0 .42 0" result="shadow"/>
      <feMerge>
        <feMergeNode in="shadow"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    <mask id="fingerOcclusion" maskUnits="userSpaceOnUse">
      <rect width="1586" height="992" fill="white"/>
      <path d="M1248 480
               C1254 482 1255 487 1251 494
               L1237 517
               C1233 524 1228 527 1223 524
               C1219 521 1221 516 1225 510
               L1240 486
               C1242 482 1245 480 1248 480Z"
            fill="black"/>
      <ellipse cx="1242" cy="494" rx="9.5" ry="8.5" fill="black"/>
    </mask>
  </defs>

  <use xlink:href="#master"/>

  <!-- The pen is a deterministic vector layer. The mask makes the center pass
       behind the restored fingertip, so it reads as held rather than floating. -->
  <g mask="url(#fingerOcclusion)">
    <g>
      <animateTransform attributeName="transform" type="rotate"
                        from="56 1245 490" to="416 1245 490"
                        dur="2.2s" repeatCount="indefinite"
                        calcMode="linear"/>
      <g transform="translate(1245 490)" filter="url(#pencilShadow)">
        <path d="M-65 0 L-57 -4.4 L-57 4.4Z" fill="#3b3027"/>
        <rect x="-58" y="-3.55" width="137" height="7.1" rx="2.7"
              fill="url(#pencilBody)" stroke="#6f431a" stroke-width="1"/>
        <path d="M-52 -1.65 H74" stroke="#f0c36d" stroke-width="1"
              stroke-linecap="round" opacity=".68"/>
        <rect x="78" y="-3.75" width="14" height="7.5" rx="1.3"
              fill="url(#metal)" stroke="#50575a" stroke-width=".9"/>
        <path d="M82 -3.3 V3.3 M87 -3.3 V3.3" stroke="#656c6f"
              stroke-width=".8" opacity=".76"/>
        <rect x="91" y="-3.4" width="10" height="6.8" rx="2.8"
              fill="#c7c9c1" stroke="#70777a" stroke-width=".9"/>
      </g>
    </g>
  </g>
</svg>
`;

await fs.writeFile(outputPath, svg, { encoding: "utf8", mode: 0o600 });
console.log(outputPath);

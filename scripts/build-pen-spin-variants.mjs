import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(scriptDirectory, "..");
const assetDirectory = path.join(projectDirectory, "assets", "motion", "pen-spin");
const sourcePath = path.join(assetDirectory, "renaissance-static-clean.png");
const personPath = path.join(assetDirectory, "renaissance-person-cutout.png");
const bundledOutputPath = path.join(
  projectDirectory,
  "bundled-themes",
  "medieval-scriptorium",
  "background.svg",
);
const [source, person] = await Promise.all([
  fs.readFile(sourcePath),
  fs.readFile(personPath),
]);
const sourceDataUrl = `data:image/png;base64,${source.toString("base64")}`;
const personDataUrl = `data:image/png;base64,${person.toString("base64")}`;

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     xmlns:xlink="http://www.w3.org/1999/xlink"
     width="1586" height="992" viewBox="0 0 1586 992"
     role="img" aria-label="A Renaissance workshop with a gently breathing figure">
  <defs>
    <image id="master" width="1586" height="992" xlink:href="${sourceDataUrl}"/>
    <image id="person" width="1586" height="992" xlink:href="${personDataUrl}"/>
    <clipPath id="personClip" clipPathUnits="userSpaceOnUse">
      <path d="M490 992 L482 780
               C514 642 628 543 766 494
               C751 429 761 288 856 229
               C951 243 1014 339 984 476
               C1104 491 1218 558 1280 678
               C1327 760 1354 891 1375 992Z"/>
      <path d="M1150 738
               C1160 683 1178 640 1201 602
               C1214 579 1218 536 1238 494
               C1245 478 1258 476 1264 488
               C1261 505 1254 520 1258 539
               C1275 571 1289 607 1290 642
               C1290 685 1252 726 1209 744Z"/>
    </clipPath>
    <style>
      .person-motion {
        transform-box: view-box;
        transform-origin: 875px 905px;
        will-change: transform;
        animation: personFloat 11.8s ease-in-out infinite;
      }
      @keyframes personFloat {
        0%, 100% { transform: translate(0, 0) scale(1); }
        28% { transform: translate(4px, -5px) scale(1.014, 1.022); }
        62% { transform: translate(-2.5px, 2px) scale(1.009, 1.012); }
        82% { transform: translate(2px, 1px) scale(1.012, 1.018); }
      }
      @media (prefers-reduced-motion: reduce) {
        .person-motion {
          animation: none;
          transform: none;
        }
      }
    </style>
  </defs>

  <!-- The background stays still. Only the clipped figure breathes and floats. -->
  <use xlink:href="#master"/>
  <g class="person-motion" clip-path="url(#personClip)">
    <use xlink:href="#person"/>
  </g>
</svg>
`;

await fs.writeFile(bundledOutputPath, svg, { encoding: "utf8", mode: 0o600 });
console.log(bundledOutputPath);

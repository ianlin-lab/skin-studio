import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(scriptDirectory, "..");
const assetDirectory = path.join(projectDirectory, "assets", "motion", "pen-spin");
const sourcePath = path.join(assetDirectory, "renaissance-static-clean.png");
const outputPath = path.join(assetDirectory, "renaissance-living-parallax-v3.svg");
const source = await fs.readFile(sourcePath);
const sourceDataUrl = `data:image/png;base64,${source.toString("base64")}`;

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     xmlns:xlink="http://www.w3.org/1999/xlink"
     width="1586" height="992" viewBox="0 0 1586 992"
     role="img" aria-label="A living painterly desk scene with layered parallax">
  <defs>
    <image id="master" width="1586" height="992" xlink:href="${sourceDataUrl}"/>
    <filter id="soft" x="-18%" y="-18%" width="136%" height="136%">
      <feGaussianBlur stdDeviation="10"/>
    </filter>
    <filter id="softWide" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="19"/>
    </filter>
    <mask id="cloudMask" maskUnits="userSpaceOnUse">
      <rect width="1586" height="992" fill="black"/>
      <path d="M944 165 H1586 V992 H1452
               C1457 825 1454 711 1408 606
               C1368 514 1292 447 1182 407
               C1060 365 984 296 944 165Z"
            fill="white" filter="url(#softWide)"/>
    </mask>
    <mask id="backPlaneMask" maskUnits="userSpaceOnUse">
      <rect width="1586" height="992" fill="black"/>
      <rect x="340" y="350" width="430" height="340" rx="22" fill="white" filter="url(#soft)"/>
      <path d="M986 374 L1442 374 L1418 738 L962 738Z"
            fill="white" filter="url(#soft)"/>
    </mask>
    <mask id="upperCurtainMask" maskUnits="userSpaceOnUse">
      <rect width="1586" height="992" fill="black"/>
      <path d="M0 0 H1586 V394
               C1386 381 1216 382 1045 397
               C788 419 546 393 322 360
               C158 335 67 320 0 336Z"
            fill="white" filter="url(#softWide)"/>
    </mask>
    <mask id="foregroundDrapeMask" maskUnits="userSpaceOnUse">
      <rect width="1586" height="992" fill="black"/>
      <path d="M0 0 H286 V992 H0Z" fill="white" filter="url(#softWide)"/>
      <path d="M0 792 C235 744 447 765 620 866
               C724 927 808 978 858 992 H0Z"
            fill="white" filter="url(#softWide)"/>
    </mask>
    <mask id="personMask" maskUnits="userSpaceOnUse">
      <rect width="1586" height="992" fill="black"/>
      <path d="M490 992 L482 780
               C514 642 628 543 766 494
               C751 429 761 288 856 229
               C951 243 1014 339 984 476
               C1104 491 1218 558 1280 678
               C1327 760 1354 891 1375 992Z"
            fill="white" filter="url(#softWide)"/>
      <path d="M1130 515 C1220 468 1300 512 1322 611
               L1281 777 L1150 742Z"
            fill="white" filter="url(#soft)"/>
    </mask>
  </defs>

  <use xlink:href="#master"/>

  <!-- Far distance: the cloud layer drifts furthest and slowest. -->
  <g mask="url(#cloudMask)" opacity=".9">
    <g>
      <animateTransform attributeName="transform" type="translate"
        values="0 0; 5.4 -2.2; -3.6 1.7; 0 0"
        keyTimes="0; .39; .76; 1" dur="16.6s" repeatCount="indefinite"/>
      <use xlink:href="#master"/>
    </g>
  </g>

  <!-- Mid distance: monitor and drawing board counter-drift gently. -->
  <g mask="url(#backPlaneMask)" opacity=".94">
    <g>
      <animateTransform attributeName="transform" type="translate"
        values="0 0; -2.15 1.35; 1.45 -.8; 0 0"
        keyTimes="0; .37; .73; 1" dur="11.7s" repeatCount="indefinite"/>
      <use xlink:href="#master"/>
    </g>
  </g>

  <!-- Near distance: the two curtain planes move independently. -->
  <g mask="url(#upperCurtainMask)" opacity=".92">
    <g>
      <animateTransform attributeName="transform" type="translate"
        values="0 0; 3.5 -2.25; -1.25 1.55; 0 0"
        keyTimes="0; .35; .71; 1" dur="10.3s" repeatCount="indefinite"/>
      <use xlink:href="#master"/>
    </g>
  </g>
  <g mask="url(#foregroundDrapeMask)" opacity=".9">
    <g>
      <animateTransform attributeName="transform" type="translate"
        values="0 0; -4.25 2.3; 2.1 -1.35; 0 0"
        keyTimes="0; .33; .7; 1" dur="8.8s" repeatCount="indefinite"/>
      <use xlink:href="#master"/>
    </g>
  </g>

  <!-- The full figure, including the arm, breathes and shifts as one layer. -->
  <g mask="url(#personMask)">
    <g>
      <animateTransform attributeName="transform" type="translate"
        values="0 0; 3.8 -3.1; -2.25 1.65; 0 0"
        keyTimes="0; .39; .75; 1" dur="6.3s" repeatCount="indefinite"/>
      <g transform="translate(875 905)">
        <g>
          <animateTransform attributeName="transform" type="scale"
            values="1 1; 1.0045 1.009; .9978 .9965; 1 1"
            keyTimes="0; .39; .75; 1" dur="6.3s" repeatCount="indefinite"/>
          <use xlink:href="#master" transform="translate(-875 -905)"/>
        </g>
      </g>
    </g>
  </g>
</svg>
`;

await fs.writeFile(outputPath, svg, { encoding: "utf8", mode: 0o600 });
console.log(outputPath);

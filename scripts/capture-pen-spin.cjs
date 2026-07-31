const { app, BrowserWindow } = require("electron");
const path = require("node:path");

app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  const previewName = process.argv[2] || "preview.html";
  const captureLabel = process.argv[3] || "legacy";
  const captureMode = process.argv[4] || "pen";
  const window = new BrowserWindow({
    width: 1586,
    height: 992,
    show: false,
    useContentSize: true,
    webPreferences: {
      offscreen: true,
      backgroundThrottling: false,
    },
  });

  await window.loadFile(path.join(
    __dirname,
    "..",
    "assets",
    "motion",
    "pen-spin",
    previewName,
  ));

  const outputDirectory = `/private/tmp/pen-spin-captures-${captureLabel}`;
  const fs = require("node:fs/promises");
  await fs.mkdir(outputDirectory, { recursive: true });

  const capturePlan = captureMode === "ambient"
    ? [["a", 80], ["b", 1350], ["c", 1350], ["d", 1350], ["e", 1350]]
    : [["a", 80], ["b", 250], ["c", 350], ["d", 400], ["e", 420], ["f", 400], ["g", 500]];

  for (const [name, delay] of capturePlan) {
    await new Promise((resolve) => setTimeout(resolve, delay));
    const full = await window.webContents.capturePage();
    const crop = full.crop({ x: 2240, y: 720, width: 720, height: 600 });
    await fs.writeFile(path.join(outputDirectory, `full-${name}.png`), full.toPNG());
    await fs.writeFile(path.join(outputDirectory, `crop-${name}.png`), crop.toPNG());
  }

  window.destroy();
  app.quit();
});

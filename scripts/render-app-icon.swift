import AppKit
import Foundation

guard CommandLine.arguments.count == 3 else {
  fputs("Usage: render-app-icon <source.png> <output.png>\n", stderr)
  exit(1)
}

let sourceURL = URL(fileURLWithPath: CommandLine.arguments[1])
let outputURL = URL(fileURLWithPath: CommandLine.arguments[2])
let canvasSize = CGSize(width: 1024, height: 1024)
let inset: CGFloat = 92
let cornerRadius: CGFloat = 164

guard let source = NSImage(contentsOf: sourceURL) else {
  fputs("Unable to read source image: \(sourceURL.path)\n", stderr)
  exit(1)
}

let targetRect = CGRect(
  x: inset,
  y: inset,
  width: canvasSize.width - inset * 2,
  height: canvasSize.height - inset * 2
)

guard let bitmap = NSBitmapImageRep(
  bitmapDataPlanes: nil,
  pixelsWide: Int(canvasSize.width),
  pixelsHigh: Int(canvasSize.height),
  bitsPerSample: 8,
  samplesPerPixel: 4,
  hasAlpha: true,
  isPlanar: false,
  colorSpaceName: .deviceRGB,
  bytesPerRow: 0,
  bitsPerPixel: 0
), let context = NSGraphicsContext(bitmapImageRep: bitmap) else {
  fputs("Unable to create icon canvas\n", stderr)
  exit(1)
}

NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = context
NSColor.clear.setFill()
CGRect(origin: .zero, size: canvasSize).fill()
NSGraphicsContext.current?.imageInterpolation = .high
let mask = NSBezierPath(roundedRect: targetRect, xRadius: cornerRadius, yRadius: cornerRadius)
mask.addClip()
source.draw(in: targetRect, from: CGRect(origin: .zero, size: source.size), operation: .sourceOver, fraction: 1)
NSGraphicsContext.restoreGraphicsState()

guard let data = bitmap.representation(using: .png, properties: [:]) else {
  fputs("Unable to encode icon PNG\n", stderr)
  exit(1)
}

try data.write(to: outputURL)

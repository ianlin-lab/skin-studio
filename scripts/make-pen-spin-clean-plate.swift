import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

struct Point {
    let x: Double
    let y: Double
}

func distanceToSegment(_ point: Point, _ start: Point, _ end: Point) -> Double {
    let dx = end.x - start.x
    let dy = end.y - start.y
    let lengthSquared = dx * dx + dy * dy
    let t = max(0, min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared))
    let closestX = start.x + t * dx
    let closestY = start.y + t * dy
    return hypot(point.x - closestX, point.y - closestY)
}

func decodeRGBA(_ image: CGImage) -> [UInt8] {
    let width = image.width
    let height = image.height
    let bytesPerRow = width * 4
    var pixels = [UInt8](repeating: 0, count: height * bytesPerRow)
    pixels.withUnsafeMutableBytes { rawBuffer in
        guard
            let baseAddress = rawBuffer.baseAddress,
            let context = CGContext(
                data: baseAddress,
                width: width,
                height: height,
                bitsPerComponent: 8,
                bytesPerRow: bytesPerRow,
                space: CGColorSpaceCreateDeviceRGB(),
                bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
                    | CGBitmapInfo.byteOrder32Big.rawValue
            )
        else {
            fatalError("Unable to create bitmap context")
        }
        context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
    }
    return pixels
}

func encodePNG(
    pixels: inout [UInt8],
    width: Int,
    height: Int,
    outputURL: URL
) {
    let bytesPerRow = width * 4
    var outputImage: CGImage?
    pixels.withUnsafeMutableBytes { rawBuffer in
        guard
            let baseAddress = rawBuffer.baseAddress,
            let context = CGContext(
                data: baseAddress,
                width: width,
                height: height,
                bitsPerComponent: 8,
                bytesPerRow: bytesPerRow,
                space: CGColorSpaceCreateDeviceRGB(),
                bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
                    | CGBitmapInfo.byteOrder32Big.rawValue
            )
        else {
            fatalError("Unable to create output bitmap")
        }
        outputImage = context.makeImage()
    }

    guard
        let result = outputImage,
        let destination = CGImageDestinationCreateWithURL(
            outputURL as CFURL,
            UTType.png.identifier as CFString,
            1,
            nil
        )
    else {
        fatalError("Unable to create output destination")
    }
    CGImageDestinationAddImage(destination, result, nil)
    guard CGImageDestinationFinalize(destination) else {
        fatalError("Unable to write output image")
    }
}

let scriptURL = URL(fileURLWithPath: #filePath)
let projectURL = scriptURL
    .deletingLastPathComponent()
    .deletingLastPathComponent()
let assetURL = projectURL
    .appendingPathComponent("assets/motion/pen-spin", isDirectory: true)
let sourceURL = assetURL.appendingPathComponent("renaissance-pen-spin-master.png")
let cleanReferenceURL = assetURL.appendingPathComponent("renaissance-clean-ai.png")
let outputURL = assetURL.appendingPathComponent("renaissance-static-clean.png")

func loadImage(_ url: URL) -> CGImage {
    guard
        let source = CGImageSourceCreateWithURL(url as CFURL, nil),
        let image = CGImageSourceCreateImageAtIndex(source, 0, nil)
    else {
        fatalError("Unable to read \(url.lastPathComponent)")
    }
    return image
}

let sourceImage = loadImage(sourceURL)
let referenceImage = loadImage(cleanReferenceURL)
guard
    sourceImage.width == referenceImage.width,
    sourceImage.height == referenceImage.height
else {
    fatalError("Source and clean reference dimensions differ")
}

let width = sourceImage.width
let height = sourceImage.height
let bytesPerRow = width * 4
var sourcePixels = decodeRGBA(sourceImage)
let referencePixels = decodeRGBA(referenceImage)

let start = Point(x: 1201, y: 436)
let end = Point(x: 1288, y: 574)
let innerRadius = 6.0
let outerRadius = 12.0
let lineDX = end.x - start.x
let lineDY = end.y - start.y
let lineLength = hypot(lineDX, lineDY)
let normalX = -lineDY / lineLength
let normalY = lineDX / lineLength
let toneSampleDistance = 20.0
let minX = max(0, Int(start.x) - 14)
let maxX = min(width - 1, Int(end.x) + 14)
let minY = max(0, Int(start.y) - 14)
let maxY = min(height - 1, Int(end.y) + 14)

for y in minY...maxY {
    for x in minX...maxX {
        let distance = distanceToSegment(
            Point(x: Double(x), y: Double(y)),
            start,
            end
        )
        guard distance < outerRadius else { continue }

        let linear = max(0, min(1, (outerRadius - distance) / (outerRadius - innerRadius)))
        let blend = distance <= innerRadius ? 1 : linear * linear * (3 - 2 * linear)
        let offset = y * bytesPerRow + x * 4
        let firstX = min(width - 1, max(0, Int(round(Double(x) + normalX * toneSampleDistance))))
        let firstY = min(height - 1, max(0, Int(round(Double(y) + normalY * toneSampleDistance))))
        let secondX = min(width - 1, max(0, Int(round(Double(x) - normalX * toneSampleDistance))))
        let secondY = min(height - 1, max(0, Int(round(Double(y) - normalY * toneSampleDistance))))
        let firstOffset = firstY * bytesPerRow + firstX * 4
        let secondOffset = secondY * bytesPerRow + secondX * 4
        for channel in 0..<3 {
            let original = Double(sourcePixels[offset + channel])
            let firstToneDelta = Double(sourcePixels[firstOffset + channel])
                - Double(referencePixels[firstOffset + channel])
            let secondToneDelta = Double(sourcePixels[secondOffset + channel])
                - Double(referencePixels[secondOffset + channel])
            let toneDelta = (475...535).contains(y)
                ? 0
                : (firstToneDelta + secondToneDelta) / 2
            let replacement = max(
                0,
                min(255, Double(referencePixels[offset + channel]) + toneDelta)
            )
            sourcePixels[offset + channel] = UInt8(
                max(0, min(255, Int(round(original * (1 - blend) + replacement * blend))))
            )
        }
        sourcePixels[offset + 3] = 255
    }
}

encodePNG(
    pixels: &sourcePixels,
    width: width,
    height: height,
    outputURL: outputURL
)
print(outputURL.path)

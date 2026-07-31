import CoreGraphics
import CoreImage
import CoreImage.CIFilterBuiltins
import CoreVideo
import Foundation
import Vision

let scriptURL = URL(fileURLWithPath: #filePath)
let projectURL = scriptURL.deletingLastPathComponent().deletingLastPathComponent()
let assetURL = projectURL
  .appendingPathComponent("assets")
  .appendingPathComponent("motion")
  .appendingPathComponent("pen-spin")
let inputURL = assetURL.appendingPathComponent("renaissance-static-clean.png")
let outputURL = assetURL.appendingPathComponent("renaissance-person-cutout.png")

guard let inputImage = CIImage(contentsOf: inputURL) else {
  throw NSError(
    domain: "SkinStudio",
    code: 1,
    userInfo: [NSLocalizedDescriptionKey: "Unable to load source image"]
  )
}

let request = VNGeneratePersonSegmentationRequest()
request.qualityLevel = .accurate
request.outputPixelFormat = kCVPixelFormatType_OneComponent8
let handler = VNImageRequestHandler(ciImage: inputImage, orientation: .up)
try handler.perform([request])

guard let observation = request.results?.first else {
  throw NSError(
    domain: "SkinStudio",
    code: 2,
    userInfo: [NSLocalizedDescriptionKey: "Vision did not produce a person mask"]
  )
}

let rawMask = CIImage(cvPixelBuffer: observation.pixelBuffer)
let scaledMask = rawMask
  .transformed(by: CGAffineTransform(
    scaleX: inputImage.extent.width / rawMask.extent.width,
    y: inputImage.extent.height / rawMask.extent.height
  ))
  .cropped(to: inputImage.extent)

let transparent = CIImage(color: .clear).cropped(to: inputImage.extent)
let blend = CIFilter.blendWithMask()
blend.inputImage = inputImage
blend.backgroundImage = transparent
blend.maskImage = scaledMask

guard let cutout = blend.outputImage?.cropped(to: inputImage.extent) else {
  throw NSError(
    domain: "SkinStudio",
    code: 3,
    userInfo: [NSLocalizedDescriptionKey: "Unable to composite the person cutout"]
  )
}

let context = CIContext(options: [.useSoftwareRenderer: false])
guard let colorSpace = CGColorSpace(name: CGColorSpace.sRGB) else {
  throw NSError(
    domain: "SkinStudio",
    code: 4,
    userInfo: [NSLocalizedDescriptionKey: "Unable to create an sRGB color space"]
  )
}
try context.writePNGRepresentation(
  of: cutout,
  to: outputURL,
  format: .RGBA8,
  colorSpace: colorSpace
)
print(outputURL.path)

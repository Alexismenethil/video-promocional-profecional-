// Máscara del sujeto principal con Vision (la misma técnica que «Copiar sujeto» de Fotos), sin red.
//   swiftc -O mascara_vision.swift -o mascara_vision
//   ./mascara_vision entrada.webp salida-mascara.png [instancia|todas]
// Escribe la máscara en gris de 16 bits al tamaño de la foto e informa cuántas instancias vio.
import Foundation
import Vision
import CoreImage
import ImageIO

let a = CommandLine.arguments
guard a.count >= 3 else { print("uso: mascara_vision entrada salida.png [todas|1|2…]"); exit(2) }
let entrada = URL(fileURLWithPath: a[1]), salida = URL(fileURLWithPath: a[2])
guard let fuente = CGImageSourceCreateWithURL(entrada as CFURL, nil),
      let cg = CGImageSourceCreateImageAtIndex(fuente, 0, nil) else { print("no se pudo leer \(a[1])"); exit(1) }
let pedido = VNGenerateForegroundInstanceMaskRequest()
let manejador = VNImageRequestHandler(cgImage: cg, options: [:])
try manejador.perform([pedido])
guard let obs = pedido.results?.first else { print("sin sujeto"); exit(3) }
var instancias = obs.allInstances
if a.count >= 4, a[3] != "todas" {
  instancias = IndexSet(a[3].split(separator: ",").compactMap { Int($0) })
}
let mascara = try obs.generateScaledMaskForImage(forInstances: instancias, from: manejador)
let ci = CIImage(cvPixelBuffer: mascara)
try CIContext().writePNGRepresentation(of: ci, to: salida, format: .L16, colorSpace: CGColorSpaceCreateDeviceGray())
print("\(a[1].split(separator: "/").last!): \(obs.allInstances.count) instancia(s) \(Array(obs.allInstances)) → \(Array(instancias))")

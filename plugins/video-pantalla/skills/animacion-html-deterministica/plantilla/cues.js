// El único reloj: imagen y sonido leen de acá (audio.py lo lee con audiolib.leer_cues).
// 128 BPM en 4/4 → pulso 0,46875 s, compás 1,875 s: ocho compases justos en 15 s.
// Los tiempos caen en pulsos: pulso n = n × 0,46875.
window.CUES = {
  "dur": 15.0, "fps": 60, "bpm": 128, "pulso": 0.46875,
  "firmaSale": [0.26, 0.5],
  "iris": [0.47, 1.25],
  "tituloB": 1.05,
  "arcos": [1.875, 2.109, 2.344],
  "pasosB": [3.75, 4.6875, 5.625, 6.5625],
  "goteo": [7.5, 8.1],
  "carrusel": [8.0, 8.9],
  "tituloC": 8.3,
  "carruselPasos": [9.375, 10.3125, 11.25],
  "cierre": [12.19, 13.0],
  "firma": [13.1, 13.7],
  "brillo": [14.06, 14.75],
  // [desde, hasta, submuestras]: desenfoque de movimiento donde algo corre (render.mjs)
  "muestras": [[0.47, 1.25, 6], [1.875, 2.9, 5], [3.75, 7.0, 4], [7.5, 8.9, 8], [9.375, 11.7, 6], [12.19, 13.0, 8]]
};

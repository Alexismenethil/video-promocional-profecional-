# Ejemplos: el código de los videos ya hechos

| Carpeta | Video | Técnicas principales |
| --- | --- | --- |
| `sabor-a-retablo/` | café · crepes · helados (120 BPM, huayno-pop) | puertas 3D, portal por la hornacina, estallido de pétalos con física cerrada, vapor, cinta de nombres, bolas que caen con aplastamiento, brillo de color |
| `sabor-a-retablo-3d/` | menu board de 60 s en 3D (128 BPM, house con zampoña y charango) | three.js con la GPU, submuestras acumuladas en la página (movimiento + lente + antialias), retablo 3D con portal, 12 nichos, productos que flotan, fotos en arcos, motivos de papel recortados de la foto del retablo, polvo dorado que deshace y arma el logo, tablas-prisma, pilastra/cornisa, remolino de hojas, puertas; música con estudio2.py |
| `sabor-a-retablo-final/` | menu board final de 1:52 (40 productos; 128 BPM) | el retablo 3D abre y cierra; 18 tableros limpios en 3D maquetados en px de diseño (`aMundo`), ventanas en arco para platos cortados, mostrador para vasos cortados, flor-portal con el tablero siguiente en miniatura, empuje, tablas-prisma, látigo, puertas; eventos de sonido exportados desde la página |
| `eos-gelato/` | gelatos · sorbetes · bebidas (128 BPM, house suave) | letras-ventana con ola, zoom con paralaje por la «O», foto que se encoge en un arco, vitrina por pulsos, jarabe, carrusel 3D, salida por la «S» y vaciado |

Es **solo código** (`index.html`, `anim.js` o `src/`, `cues.js`/`cues.py`, `prep.py`, `audio.py`, `README.md`). No incluye
los logos, fotos ni fuentes de los negocios: `prep.py` los toma del repo de cada negocio y de su carta
publicada. Para regenerar uno hace falta ese repo y la URL pública de su carta:

```bash
CARTA_URL=https://<api-publica>/api/carta python3 prep.py /ruta/al/repo-del-negocio
python3 audio.py
# render.mjs, exportar.py y package.json: de la skill generar-y-exportar-video
npm install && ESCALA=2 node render.mjs video 60 && NOMBRE=<negocio> python3 exportar.py
```

Notas:
- Estos `audio.py` son la versión anterior (todo en un archivo); las mismas funciones están ordenadas en
  `../../sonido-para-video/scripts/audiolib.py`. Para un video nuevo, usar audiolib.
- El `render.mjs` de la skill lee las submuestras de `CUES.muestras`; estos proyectos las tenían dentro
  de `render.mjs` (función `muestras`). Al reutilizarlos, pasar esos tramos a `cues.js`:
  - Sabor a Retablo: `[[4.8,5.2,12],[2.35,3.0,10],[10.5,10.95,10],[11.72,12.04,8],[6.9,7.22,6],[7.05,8.62,6],[1.0,1.7,5],[1.9,2.35,5],[10.95,11.4,5],[0.15,0.95,3],[12.08,12.8,3],[1.7,1.9,3],[3.0,3.7,3],[5.2,5.8,3]]`
  - EOS Gelato: `[[2.05,2.62,12],[11.25,11.62,12],[1.875,2.05,8],[2.62,2.75,8],[11.62,11.85,8],[4.3,4.9,8],[7.5,8.7,8],[5.625,5.925,6],[6.094,6.394,6],[6.5625,6.8625,6],[7.031,7.331,6],[8.906,9.206,6],[9.375,9.675,6],[9.844,10.144,6],[10.3125,10.6125,6],[10.781,11.081,6],[0.47,1.12,4],[12.66,13.3,4],[4.92,5.6,4],[1.6,1.875,4],[0.9,1.8,3],[11.85,12.75,3],[2.75,4.3,3]]`

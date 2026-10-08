---
name: marca-y-carta-publicada
description: Reúne la identidad de una marca desde su repositorio (colores, tipografías, logos, motivos, significado del nombre) y los productos reales desde su carta publicada en producción, SOLO con lectura GET, sin tocar producción. Baja y elige fotos reales, limpia nombres, vectoriza el logo letra por letra, recorta hojas o productos, copia las fuentes del build y prepara versiones @2x para 4K. Úsala antes de diseñar un video o una pieza gráfica para un negocio con carta digital (Next.js + API en Render/Vercel, fotos en Cloudinary).
when_to_use: Fase 1 de video-pantalla-local. También cuando pidan «usa las fotos reales del desplegado», cuando haya que saber qué productos están publicados o disponibles, o cuando haga falta el logo en vector.
---

# Marca y carta publicada

## Regla de oro: producción solo se lee
- Solo `GET` anónimo a la ruta pública de la carta (la misma que usa el teléfono de un cliente al
  escanear el QR). Sin cookies, sin tokens, sin POST/PUT/PATCH/DELETE, sin panel de administración.
- Nada de deploys, base de datos, Render, Vercel ni Cloudinary (no crear transformaciones: consumen
  créditos de la cuenta del cliente). Las URLs de fotos se bajan tal cual están publicadas.
- Leer una vez y guardar `carta.json`; trabajar desde la copia (`CARTA_JSON`/`--json`).
- No usar los secretos del repo (`.env*`): no hacen falta para leer lo público.
- Detalle y cómo confirmar que la ruta no escribe: [referencias/seguridad-produccion.md](referencias/seguridad-produccion.md).

## 1. Identidad de la marca (en el repo)

Leer, en este orden, y anotar tokens concretos:
1. Documentos de diseño: `diseño/IDENTIDAD.md`, `DESIGN.md`, `PLAN.md` si existen.
2. `frontend/src/app/globals.css` (o equivalente): variables de color y comentarios (suelen decir para
   qué sirve cada color), utilidades con nombre propio (`arco`, `filete`, `rotulo`, `toldo`,
   `barrido-luz`, `viruta`): son **motivos de la marca** reutilizables en el video.
3. `layout.tsx`: qué fuentes carga `next/font` (familia, pesos, itálicas).
4. `public/` (y `public/marca/`): logos (PNG con alfa, versión blanca), fondos, hojas, fotos del local.
   **Mirar cada imagen**: los repos copiados de otra marca traen activos ajenos (SAR tenía fondos con
   el logo de EOS). Las fotos generadas o de catálogo pueden tener otro logo («eos gelateria» en
   minúscula no era el oficial).
5. El significado del nombre, el local físico (una foto del local dice mucho: arcos, luces, plantas).

## 2. La carta publicada

Encontrar la URL pública:
- `.github/workflows/*deploy*.yml`: `NEXT_PUBLIC_API_URL` (p. ej. `https://<api>.onrender.com`).
- La ruta en el backend: `backend/src/rutas/carta.ts` → `GET /carta`, montada en `/api`.

```bash
python3 herramientas/leer_carta.py --url https://<api>/api/carta --guardar carta.json   # ~1 min si Render duerme
python3 herramientas/leer_carta.py --json carta.json --listar
python3 herramientas/leer_carta.py --json carta.json --bajar fotos --todas --hoja fotos/hoja.jpg
```

Mirar la hoja de contactos y decidir con los ojos:
- Estilo consistente dentro de cada escena (en EOS: batidos y jugos de estudio claro no se mezclaron
  con milkshakes/sodas/frozen de ambiente rosa y luz cálida).
- Productos sin foto publicada o no disponibles quedan fuera (y se dice en la entrega).
- Si una foto real es pobre para el uso (el Mocaccino de SAR), proponer la foto de la casa.
- Fotos con algo especial (el atardecer del Maracuyá de EOS) pueden sostener la idea del video.

Nombres: usar los publicados pero limpios (`sabor()` en `leer_carta.py`): «Milkshake  de Cafe» → «Café»,
«frozen Frutos rojos» → «Frutos Rojos», tildes (maracuyá, piña, lúcuma…), conectores en minúscula. La
categoría va aparte, como rótulo («MILKSHAKE», «SODA ITALIANA»).

## 3. prep.py del proyecto
Cada video tiene un `prep.py` que deja todo en `assets/` y escribe `assets/datos.js`
(`window.DATOS = {…}`) con lo que la animación necesita: listas de productos
`{slug, nombre, rotulo, src, src2x?, foco:[x,y], zoom}` por escena y textos. Estructura sugerida:

```python
carta = leer(url, os.environ.get("CARTA_JSON"))        # de leer_carta.py
ps = {p["slug"]: p for p in productos(carta) if con_foto(p)}
elegir = lambda preferidos, categorias, n: ([s for s in preferidos if s in ps] +
          [s for s, p in ps.items() if p["categoria"] in categorias and s not in preferidos])[:n]
```
Preferidos por slug + relleno por categoría: si mañana un producto sale de la carta, el video se
regenera igual. Ver `../video-pantalla-local/ejemplos/*/prep.py`.

## 4. Herramientas (en `scripts/`, copiadas a `herramientas/` en cada proyecto)

| Script | Uso |
| --- | --- |
| `leer_carta.py` | lectura GET, listado, descarga de fotos, hoja de contactos, `sabor()` para nombres |
| `vectorizar_logo.py logo.png assets/logo.js --letras EOS --previa v.png` | logo en cúbicas por letra + núcleo de cada letra (para apuntar la cámara). Requiere `potrace` |
| `fuentes_next.py <repo> --listar / --copiar "Familia:normal=assets/fonts/display.woff2" …` | fuentes del build de Next (subconjunto latino con ñ y tildes) |
| `recortar_fondo_blanco.py hoja.jpg assets/hojas.png --piezas 2` | objetos sobre blanco de estudio → PNG con alfa |
| `quitar_base_lisa.py bola.webp assets/bolas/x.png` | quita la base lisa de estudio pegada a un recorte (bolas de helado) |
| `doble.py a.webp b.png …` | versiones @2x (Lanczos + nitidez) para lo que en 4K se ve grande |
| `mascara_vision.swift` (`swiftc -O … -o mascara_vision`; `./mascara_vision foto.webp m.png`) | recorte de sujeto de macOS (Vision), local: máscara de 16 bits de platos, copas y vasos con su fondo real. Para el estilo «producto sobre color» |
| `hoja_recortes.py salida.jpg slug…` | hoja de contactos de recortes sobre tres colores de la marca, para juzgar bordes |

Recortes con Vision (Sabor a Retablo, menu board): el filo semitransparente trae el fondo del local;
no restarlo dividiendo por alfa (satura y deja halo): darle al filo el color del interior más cercano
(`distance_transform_edt(..., return_indices=True)`). **Antes de elegir una foto, mirar si la máscara
toca el borde de la foto**: un plato o un pie cortados por el encuadre quedan con un lado recto sobre
color (pasó con la Crepa Tropical, la Galaxia y el Milkshake de Oreo). Elegir fotos completas o tapar
el corte con otro producto delante.

Notas:
- Logo: si el PNG no tiene alfa, se usa la tinta oscura. Letras con puntos o tildes se agrupan solas.
  Revisar la previa a 12× en una curva: tiene que ser lisa.
- Fuentes: si el build no existe, construir la carta en local una vez o pedirlas. Google Fonts es la
  fuente oficial de Cormorant, Manrope, Playfair, Montserrat (licencia OFL).
- 4K: las fotos de carta rondan 1100 px. Un arco de ~450 px de alto se ve bien; a pantalla completa se
  ablanda (usar @2x y no dejarla quieta mucho tiempo). Pedir originales si el video lo necesita.

## 5. Qué dejar anotado antes de la idea
Paleta (hex por rol), fuentes (archivo por rol), motivos de la marca, objeto/nombre/local con
potencial, productos elegidos por escena (con foto y foco), los que quedan fuera y por qué.

# Leer producción sin tocarla

El usuario fue explícito: **«no se toca producción»**. Leer la carta publicada está permitido (lo pidió:
«usa las fotos reales del desplegado») porque es exactamente lo que hace cualquier cliente.

## Antes de la primera consulta, confirmar que la ruta es de lectura
1. Buscar la ruta en el backend (`rutas/carta.ts`): debe ser `router.get('/carta', …)` y llamar a un
   servicio que solo consulta (p. ej. `prisma.categoria.findMany`).
2. Revisar los middlewares montados antes (`app.ts`): una sesión por cookie (`conSesion`) sin cookie no
   hace nada; si algún middleware crea filas por visita (sesiones anónimas, contadores), avisar al usuario
   antes de consultar.
3. Nunca mandar cookies ni cabeceras de autenticación. `User-Agent` descriptivo.

## Durante
- Una lectura, guardada en `carta.json`, y el resto del trabajo desde la copia.
- El plan gratis de Render se duerme: la primera respuesta tarda ~60 s. No reintentar en bucle.
- Las fotos (Cloudinary u otra CDN) se bajan por su URL pública, sin parámetros de transformación.

## Lo que nunca se hace
- Deploys, `git push` al repo del negocio, cambios en variables de Vercel/Render.
- Escribir en la base de datos (ni con scripts de «semilla»), usar el panel de administración.
- Crear transformaciones en Cloudinary (upscale con IA, recortes): son derivadas que se guardan y cobran
  en la cuenta del cliente.
- Usar los `.env` del repo (secretos de producción): para leer lo público no hacen falta.
- Decir «render» para lo local: decir «generar cuadros» y «exportar».

## Si el usuario pregunta «¿no tocaste nada?»
Mostrar `git status --short` del repo (solo debería aparecer `?? output/`) y decir exactamente qué se
consultó (la carta pública con GET y las fotos por sus URLs públicas).

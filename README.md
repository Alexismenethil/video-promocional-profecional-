# Video promocional profesional · skills para Claude Code

Habilidades (skills) para que Claude haga **videos promocionales de 15 segundos en bucle para la
pantalla de un negocio** —cafetería, heladería, crepería, restaurante— con calidad de estudio: la
idea sale de la marca, la animación se escribe en código, las fotos son las reales de la carta
publicada, el sonido se sintetiza y se exporta en **4K 60, 1080 60 y 1080 30**, con música y solo
efectos.

Nacieron de dos videos reales (Sabor a Retablo y EOS Gelato, Ayacucho, 2026) y guardan todo lo que
funcionó y todo lo que hubo que corregir, para que **cada video nuevo salga mejor que el anterior**.

## Cómo se usa

Con las skills instaladas, basta con pedirlo en una sesión de Claude Code abierta en el repo del negocio:

> «Hazme una animación bonita de 15 segundos para la pantalla del local, con las fotos reales de la
> carta publicada. No toques producción.»

Claude sigue el flujo de la skill `video-pantalla-local`: lee la marca y la carta (solo lectura), propone
la idea, anima, pone sonido, revisa cuadro por cuadro, genera los cuadros 4K, exporta los 6 archivos y
los deja en `output/video/` del repo del negocio, sin commits. Al final anota lo aprendido en la bitácora.

## Las skills

| Skill | Qué hace |
| --- | --- |
| `video-pantalla-local` | **Entrada.** El flujo completo, las reglas (producción no se toca), la entrega y la bitácora de lecciones |
| `marca-y-carta-publicada` | Identidad desde el repo, carta publicada por GET, fotos reales, logo vectorizado, fuentes, recortes |
| `direccion-creativa-video` | La idea desde la marca, guion por pulsos, color, tipografía, transiciones y los dos casos completos |
| `animacion-html-deterministica` | Motor `seek(t)` puro, plantilla lista y recetas de cada efecto (y sus trampas) |
| `sonido-para-video` | `audiolib.py`: instrumentos y efectos sintetizados, mezcla, máster a −16 LUFS, versión solo efectos |
| `generar-y-exportar-video` | Cuadros con Chrome sin cabeza y desenfoque de movimiento; ffmpeg a HEVC 4K y H.264 1080 |
| `revisar-video` | Hojas de contactos, tira de cuadros, costura del bucle, espectrograma, verificación de los MP4 |

## Instalación

**Como plugin (recomendado para compartir):**
```bash
claude plugin marketplace add Alexismenethil/video-promocional-profecional-
claude plugin install video-pantalla@video-promocional
```
Las skills quedan como `/video-pantalla:video-pantalla-local`, etc., y Claude las usa solas cuando el
pedido encaja.

**Como skills personales (en esta máquina, siempre al día con el repo):**
```bash
bash instalar.sh            # enlaces en ~/.claude/skills (bash instalar.sh --quitar para sacarlos)
```

**Solo para una sesión:** `claude --plugin-dir ./plugins/video-pantalla`

## Requisitos
- Google Chrome (lo usa `puppeteer-core`; ruta configurable con `CHROME=`).
- Node 20+ (`npm install` instala `puppeteer-core` y `sharp` en cada proyecto).
- Python 3 con `numpy`, `scipy`, `pillow`, `fonttools`.
- `ffmpeg` con `libx264` y `libx265`; `potrace` para vectorizar logos (`brew install ffmpeg potrace`).

## Estructura
```
.claude-plugin/marketplace.json
plugins/video-pantalla/
  .claude-plugin/plugin.json
  skills/
    video-pantalla-local/        SKILL.md · referencias/ (bitácora, entrega) · scripts/nuevo_proyecto.sh · ejemplos/
    marca-y-carta-publicada/     SKILL.md · referencias/ · scripts/ (leer_carta, vectorizar_logo, fuentes_next, recortes, doble)
    direccion-creativa-video/    SKILL.md · referencias/ (transiciones, tipografía, casos)
    animacion-html-deterministica/ SKILL.md · plantilla/ · referencias/ (recetas, trampas)
    sonido-para-video/           SKILL.md · scripts/audiolib.py · referencias/ (composición, catálogo de efectos)
    generar-y-exportar-video/    SKILL.md · scripts/ (render.mjs, exportar.py, package.json)
    revisar-video/               SKILL.md · scripts/ (hoja, tira, costura, espectro, verificar.sh)
instalar.sh
```

## Cómo mejora con cada video
La bitácora (`plugins/video-pantalla/skills/video-pantalla-local/referencias/bitacora.md`) se lee antes
de empezar y se completa al terminar: qué gustó, qué se corrigió y las lecciones técnicas con valores
concretos. Si aparece una técnica nueva, se agrega a las recetas; si una herramienta mejora, se
actualiza su script. Después: commit y push de este repo.

## Privacidad
Este repositorio es público: contiene código, plantillas y lecciones, **no** los logos, fotos, fuentes
ni direcciones de producción de los negocios. Los ejemplos se regeneran desde el repo de cada negocio.
Las fotos de la plantilla son marcadores generados.

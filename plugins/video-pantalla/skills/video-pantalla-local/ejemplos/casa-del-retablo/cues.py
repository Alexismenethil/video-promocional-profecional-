"""El reloj del video (imagen y sonido): escribe cues.js.

120 BPM, 4/4: pulso 0,5 s, compás 2 s, 84 compases = 168 s exactos (10.080 cuadros a 60 fps).

    1–3    apertura: el logo en rojo; el techo de la casa crece y se vuelve un retablo de verdad, que
           abre sus puertas; la cámara entra
    4–81   veintiséis tableros de tres compases, cada uno con su transición de entrada
    82–84  cierre: la cámara sale, las puertas se cierran y la casa vuelve a ser el logo

La música va en frases de seis compases (dos tableros); la apertura y el cierre forman una sola frase que
cruza el bucle (82–84 + 1–3).
"""
import json

BPM = 120
PUL = 60 / BPM
COMP = 4 * PUL
TABLEROS = ["historia", "tamanos", "t100-heroe", "t100-trio", "t100-carrusel", "t160-heroe", "t160-pared", "t160-par-a",
            "t160-par-b", "t200-heroe", "t200-trio", "t200b-par", "t250-heroe", "t250-par", "t500-heroe", "t500-par",
            "grandes", "especiales", "anchos", "mini", "toritos", "espejos", "angeles", "personalizados", "museo", "contacto"]
N_TAB = len(TABLEROS)
TAB = 3
COMPASES = 3 + N_TAB * TAB + 3
assert COMPASES % 4 == 0, COMPASES
DUR = COMPASES * COMP


def b(compas, pulso=0.0):
    return round((compas - 1) * COMP + pulso * PUL, 6)


C_FIN = 4 + N_TAB * TAB
T0 = [b(4 + TAB * k) for k in range(N_TAB)]

APERTURA = {"techo": [b(1, 0.5), b(2, 1)], "retablo": [b(1, 3), b(2, 3)], "abre": b(2, 3), "entra": [b(3, 1), b(4)]}
CIERRE = {"sale": [b(C_FIN), b(C_FIN, 3)], "cierra": b(C_FIN + 1), "logo": [b(C_FIN + 1, 1), b(C_FIN + 2, 2)]}

# Transición que lleva al tablero j (desde el j−1)
TRANS = [None,
         {"tipo": "casa", "dir": 1},                          # tamaños
         {"tipo": "abrir"},                                   # 19 × 20
         {"tipo": "tablas", "juego": "v8", "desde": "izq"},
         {"tipo": "latigo", "dir": 1},
         {"tipo": "abrir"},                                   # 15 × 30
         {"tipo": "empuje", "dir": 1},
         {"tipo": "flores", "dir": 1},
         {"tipo": "tablas", "juego": "h6", "desde": "izq"},
         {"tipo": "casa", "dir": -1},                         # 22 × 32
         {"tipo": "latigo", "dir": -1},
         {"tipo": "tablas", "juego": "v12", "desde": "centro"},
         {"tipo": "abrir"},                                   # 27 × 36
         {"tipo": "empuje", "dir": -1},
         {"tipo": "zoom"},                                    # 37 × 48
         {"tipo": "tablas", "juego": "v10", "desde": "der"},
         {"tipo": "flores", "dir": -1},                       # grandes
         {"tipo": "abrir"},
         {"tipo": "latigo", "dir": 1},
         {"tipo": "tablas", "juego": "h8", "desde": "izq"},
         {"tipo": "casa", "dir": 1},                          # toritos
         {"tipo": "empuje", "dir": 1},
         {"tipo": "flores", "dir": 1},                        # ángeles
         {"tipo": "tablas", "juego": "v16", "desde": "izq"},
         {"tipo": "abrir"},                                   # museo
         {"tipo": "casa", "dir": -1}]
assert len(TRANS) == N_TAB
VENTANA = {"tablas": [0.82, 0.03], "latigo": [0.3, 0.36], "casa": [0.86, 0.3], "empuje": [0.42, 0.3],
           "abrir": [0.2, 0.85], "flores": [0.55, 0.55], "zoom": [0.65, 0.6]}

BASE = 10
KT = {"tablas": 16, "latigo": 24, "casa": 18, "empuje": 22, "abrir": 18, "flores": 16, "zoom": 20}
muestras = [[0, b(4) + 0.1, 16]]
for j, T in enumerate(TRANS):
    if T:
        a, d = VENTANA[T["tipo"]]
        muestras.append([round(T0[j] - a - 0.02, 4), round(T0[j] + d + 0.02, 4), KT[T["tipo"]]])
muestras += [[b(C_FIN) - 0.05, DUR, 16]]

CUES = {
    "dur": round(DUR, 6), "fps": 60, "bpm": BPM, "pulso": PUL, "compas": COMP, "compases": COMPASES,
    "apertura": APERTURA, "cierre": CIERRE, "t0": T0, "tablero": TAB * COMP, "tableros": TABLEROS, "trans": TRANS,
    "ventana": VENTANA, "muestrasBase": BASE, "muestras": muestras,
}

if __name__ == "__main__":
    with open("cues.js", "w", encoding="utf-8") as f:
        f.write("// Escrito por cues.py: el reloj del video (imagen y sonido). No editar a mano.\n")
        f.write("window.CUES = " + json.dumps(CUES, ensure_ascii=False) + ";\n")
    print(f"cues.js · {DUR:.3f} s · {COMPASES} compases · {N_TAB} tableros")

"""El reloj del video (imagen y sonido): escribe cues.js.

128 BPM, 4/4: pulso 0,46875 s, compás 1,875 s, 72 compases = 135 s exactos (8.100 cuadros a 60 fps,
4.050 a 30 fps).

    1–3    apertura: la firma se deshace en polvo que entra por la ranura del retablo, las puertas se
           abren (compás 3) y la cámara entra por el portal
    4–69   veintidós tableros de tres compases, cada uno con su transición de entrada
    70–72  cierre: la cámara sale por el portal, portazo (compás 71), el polvo arma el logo, brillo

La música va en frases de seis compases (dos tableros): la apertura y el cierre forman una sola frase
que cruza el bucle (70–72 + 1–3).
"""
import json

BPM = 128
PUL = 60 / BPM
COMP = 4 * PUL
N_TAB = 22
TAB = 3                                    # compases por tablero
COMPASES = 3 + N_TAB * TAB + 3             # 72
DUR = COMPASES * COMP


def b(compas, pulso=0.0):
    """Segundos del compás `compas` (desde 1) más `pulso` pulsos."""
    return round((compas - 1) * COMP + pulso * PUL, 6)


C_FIN = 4 + N_TAB * TAB                    # 70: empieza el cierre

RETABLO = {
    "disuelve": [b(1, 1), b(2, 2)],
    "alCentro": [b(1, 1.5), b(2, 3)],
    "ranura": [b(1, 4), b(3)],
    "golpes": [b(2, 2), b(2, 3), b(2, 3.5)],
    "abre": b(3),
    "zambullida": [b(3, 1.6), b(4)],
    "sale": [b(C_FIN), b(C_FIN, 2.4)],
    "cierra": b(C_FIN + 1),
    "alLado": [b(C_FIN + 1, 1), b(C_FIN + 2, 1)],
    "arma": [b(C_FIN + 1, 1.25), b(C_FIN + 2, 1.5)],
    "brillo": [b(C_FIN + 2, 1.75), b(C_FIN + 2, 3.5)],
}

T0 = [b(4 + TAB * k) for k in range(N_TAB)]
TABLEROS = ["clasica", "salados-a", "salados-b", "autor", "galaxia", "dulces-a", "fresa", "dulces-b", "dulces-c", "promo",
            "oreo", "milkshakes", "frappes", "copas", "split", "paleta", "affogato", "cafe-a", "cafe-b", "torta", "postres", "chapla"]

# Transición que lleva al tablero j (desde el j−1)
TRANS = [None,
         {"tipo": "tablas", "juego": "v8", "desde": "izq"},
         {"tipo": "latigo", "dir": 1},
         {"tipo": "flor"},
         {"tipo": "tablas", "juego": "h6", "desde": "izq"},
         {"tipo": "empuje", "dir": 1},
         {"tipo": "latigo", "dir": -1},
         {"tipo": "tablas", "juego": "v12", "desde": "centro"},
         {"tipo": "flor"},
         {"tipo": "empuje", "dir": -1},
         {"tipo": "puertas"},
         {"tipo": "tablas", "juego": "v10", "desde": "der"},
         {"tipo": "empuje", "dir": 1},
         {"tipo": "flor"},
         {"tipo": "latigo", "dir": 1},
         {"tipo": "tablas", "juego": "v8", "desde": "der"},
         {"tipo": "empuje", "dir": -1},
         {"tipo": "tablas", "juego": "h6", "desde": "izq"},
         {"tipo": "latigo", "dir": -1},
         {"tipo": "flor"},
         {"tipo": "tablas", "juego": "v12", "desde": "centro"},
         {"tipo": "empuje", "dir": 1}]
VENTANA = {"tablas": [0.82, 0.03], "latigo": [0.3, 0.36], "flor": [0.86, 0.3], "empuje": [0.42, 0.3],
           "puertas": [0.46, 0.66]}

# Submuestras por cuadro (desenfoque de movimiento + profundidad de campo + antialias)
BASE = 10
KT = {"tablas": 16, "latigo": 24, "flor": 18, "empuje": 22, "puertas": 16}
muestras = []
muestras += [[b(3) - 0.05, b(4) + 0.1, 22]]                     # puertas, estallido y zambullida
for j, T in enumerate(TRANS):
    if T:
        a, d = VENTANA[T["tipo"]]
        muestras.append([round(T0[j] - a - 0.02, 4), round(T0[j] + d + 0.02, 4), KT[T["tipo"]]])
muestras += [[b(C_FIN) - 0.05, b(C_FIN + 1) + 0.5, 20], [b(C_FIN + 1) + 0.5, DUR, 10]]

CUES = {
    "dur": round(DUR, 6), "fps": 60, "bpm": BPM, "pulso": PUL, "compas": COMP, "compases": COMPASES,
    "retablo": RETABLO, "t0": T0, "tablero": TAB * COMP, "tableros": TABLEROS, "trans": TRANS, "ventana": VENTANA,
    "muestrasBase": BASE, "muestras": muestras,
}

if __name__ == "__main__":
    with open("cues.js", "w", encoding="utf-8") as f:
        f.write("// Escrito por cues.py: el reloj del video (imagen y sonido). No editar a mano.\n")
        f.write("window.CUES = " + json.dumps(CUES, ensure_ascii=False) + ";\n")
    print(f"cues.js · {DUR:.3f} s · {COMPASES} compases · {len(muestras)} tramos de submuestras")

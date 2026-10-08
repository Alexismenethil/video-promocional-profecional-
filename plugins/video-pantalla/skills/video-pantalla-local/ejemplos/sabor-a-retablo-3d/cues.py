"""El reloj del video (imagen y sonido): escribe cues.js.

128 BPM, 4/4: pulso 0,46875 s, compás 1,875 s, 32 compases = 60 s exactos.

    1–4    apertura: la firma se deshace en polvo que entra por la ranura del retablo, las puertas se
           abren (compás 4) y la cámara entra por el portal
    5–28   doce tarjetas de dos compases, cada una con su transición de entrada
    29–32  cierre: la cámara sale por el portal, portazo (compás 30), el polvo arma el logo, brillo
"""
import json

BPM = 128
PUL = 60 / BPM
COMP = 4 * PUL
DUR = 32 * COMP


def b(compas, pulso=0.0):
    """Segundos del compás `compas` (desde 1) más `pulso` pulsos."""
    return round((compas - 1) * COMP + pulso * PUL, 6)


RETABLO = {
    "disuelve": [b(1, 2), b(2, 3)],
    "alCentro": [b(1, 3), b(3)],
    "ranura": [b(2, 1), b(4)],
    "golpes": [b(3, 1), b(3, 3), b(3, 3.5)],
    "abre": b(4),
    "zambullida": [b(4, 1.6), b(5)],
    "sale": [b(29), b(29, 2.6)],
    "cierra": b(30),
    "alLado": [b(30, 1), b(31, 1)],
    "arma": [b(30, 2), b(31, 3)],
    "brillo": [b(31, 3.2), b(32, 1.6)],
}

TARJETAS = ["clasica", "salados", "autor", "dulces", "promo", "cafe", "postres", "chapla",
            "milkshakes", "frappes", "copas", "split"]
T0 = [b(5 + 2 * k) for k in range(12)]

# Transición que lleva a la tarjeta j (desde la j−1)
TRANS = [None,
         {"tipo": "paneo", "dir": 1},
         {"tipo": "tablas", "juego": "v8", "desde": "izq"},
         {"tipo": "grua", "dir": 1},
         {"tipo": "hojas", "dir": 1},
         {"tipo": "latigo", "dir": 1},
         {"tipo": "tablas", "juego": "h6", "desde": "izq"},
         {"tipo": "paneo", "dir": -1},
         {"tipo": "puertas"},
         {"tipo": "grua", "dir": -1},
         {"tipo": "tablas", "juego": "v12", "desde": "centro"},
         {"tipo": "latigo", "dir": -1}]
VENTANA = {"paneo": [0.52, 0.48], "grua": [0.52, 0.48], "latigo": [0.34, 0.4], "tablas": [0.82, 0.03],
           "hojas": [0.56, 0.56], "puertas": [0.46, 0.66]}

# Submuestras por cuadro (desenfoque de movimiento + profundidad de campo + antialias)
BASE = 10
muestras = [[0, b(1, 3), 8]]
muestras += [[b(4) - 0.05, b(5) + 0.1, 22]]                         # puertas, estallido y zambullida
for j, T in enumerate(TRANS):
    if T:
        a, d = VENTANA[T["tipo"]]
        K = {"paneo": 20, "grua": 20, "latigo": 24, "tablas": 16, "hojas": 18, "puertas": 16}[T["tipo"]]
        muestras.append([round(T0[j] - a - 0.02, 4), round(T0[j] + d + 0.02, 4), K])
muestras += [[b(29) - 0.05, b(30) + 0.5, 20], [b(30) + 0.5, DUR, 10]]

CUES = {
    "dur": round(DUR, 6), "fps": 60, "bpm": BPM, "pulso": PUL, "compas": COMP,
    "retablo": RETABLO, "t0": T0, "tarjetas": TARJETAS, "trans": TRANS, "ventana": VENTANA,
    "muestrasBase": BASE, "muestras": muestras,
}

if __name__ == "__main__":
    with open("cues.js", "w", encoding="utf-8") as f:
        f.write("// Escrito por cues.py: el reloj del video (imagen y sonido). No editar a mano.\n")
        f.write("window.CUES = " + json.dumps(CUES, ensure_ascii=False) + ";\n")
    print(f"cues.js · {DUR:.3f} s · {len(muestras)} tramos de submuestras")

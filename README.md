# Carga de Baterías Airsoft

PWA para calcular el tiempo de carga de baterías de réplicas de airsoft:
**NiMH**, **NiCd**, **LiPo** y **Li-Ion**.

## Funciones

- Tiempo estimado de carga según capacidad (mAh), corriente del cargador (mA) y nivel de carga actual.
- Tasa C aplicada, con aviso de seguridad (carga lenta, adecuada, alta o excesiva) y corriente recomendada.
- Voltajes del pack (nominal, carga completa, mínimo y almacenamiento) según número de celdas.
- Consejos de seguridad por química.
- Funciona sin conexión e instalable en el móvil.

## Fórmulas

| Química | Tiempo estimado | Corriente recomendada |
|---|---|---|
| NiMH | capacidad × (1 − carga actual) ÷ corriente × 1,4 | 0,5C–1C |
| NiCd | capacidad × (1 − carga actual) ÷ corriente × 1,2 | 1C |
| LiPo | capacidad × (1 − carga actual) ÷ corriente × 1,2 (fase CV) | 0,5C–1C |
| Li-Ion | capacidad × (1 − carga actual) ÷ corriente × 1,2 (fase CV) | 0,3C–0,5C |

Son estimaciones; sigue siempre las indicaciones del fabricante.

## ¿Cómo saber la carga actual?

- **LiPo / Li-Ion:** mide el voltaje en reposo (30 min sin usar ni cargar) con un LiPo checker,
  el cargador balanceador o un multímetro, e ingrésalo en *Voltaje medido*. La app acepta el total
  del pack o el voltaje por celda y estima el % con una tabla de referencia (LiPo: 4,20 V = 100 %,
  3,84 V ≈ 50 %, 3,50 V ≈ 0 %).
- **NiMH / NiCd:** el voltaje casi no cambia durante la descarga, así que no sirve para estimar la carga.
  Descárgala antes (hasta ≈1,0 V por celda) y calcula con 0 %.

## Actualizaciones (Network First)

El service worker (`sw.js`) usa la estrategia **Network First**: cada petición va primero a la red
(con un tiempo de espera de 4 s) y guarda la respuesta en caché; si no hay conexión, responde desde la caché.
Cuando se publica una nueva versión del service worker, la app muestra el aviso “Hay una nueva versión disponible”.
Si cambias la lista de archivos del app shell, incrementa `CACHE_VERSION` en `sw.js`.

## Desarrollo

```bash
npm test                 # pruebas de las fórmulas (node --test, sin dependencias)
python3 -m http.server   # servir en http://localhost:8000
```

## Despliegue

El workflow `.github/workflows/deploy.yml` ejecuta las pruebas y publica el sitio en GitHub Pages
en cada push a `main` (o manualmente con *Run workflow*). En *Settings → Pages*, la fuente debe ser “GitHub Actions”.

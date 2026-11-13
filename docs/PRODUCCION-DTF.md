# Producción con DTF

El cliente elige el modelo y la talla. Desde **Admin → Pedidos → (pedido) → Producción DTF** se
descarga un ZIP con todo lo necesario para fabricar ese par.

## Contenido del paquete

| Archivo | Para qué sirve |
|---|---|
| `hoja-dtf_560x…mm_300ppp.png` | Todas las piezas juntas en una hoja del ancho del rollo. **Es lo que se envía al proveedor DTF.** PNG transparente a 300 ppp, sin espejar |
| `imprimir/NN-pie-zona_AxBmm.png` | Cada pieza por separado, al mismo tamaño (por si se imprime suelta) |
| `plantillas/…_plantilla.png` | Silueta del panel a tamaño real, en papel. En gris, el panel; en azul, el sangrado; en rojo discontinuo, dónde va el arte. Trae una regla de 50 mm |
| `originales/` | Imágenes del cliente a resolución completa |
| `hoja-produccion.html` | Resumen: talla y escala, color y material por zona («pintar» si cambia), textos con su fuente, medidas y posición de cada pieza, avisos de calidad y pasos |

Se puede elegir el ancho de la hoja: rollo de 58 cm (560 mm útiles) u hoja de 30 cm.

## Cómo se calcula

- **Tamaño real.** Cada zona imprimible tiene su medida en mm en el manifiesto del modelo
  (`texture.printMm`), medida sobre la geometría 3D. La medida corresponde a la talla de referencia
  del modelo (`print.referenceSizeEU`, EU 42,5 para modelos de 30 cm).
- **Escala por talla.** Las piezas se escalan con la longitud de la suela de la talla del pedido
  (punto de París: 6,67 mm por talla + holgura). Por ejemplo, una EU 38 sale al 90 %. Es una
  aproximación uniforme: en la realidad, el ancho crece algo menos que el largo.
- **Resolución.** El arte se recompone a 300 ppp con el mismo motor del visor, usando el original
  de cada imagen subida. Los textos, los patrones y los SVG del catálogo salen nítidos a cualquier
  tamaño. El editor avisa al cliente si una imagen queda por debajo de 240 ppp (aceptable) o de
  150 ppp (baja).
- **Forma.** Cada pieza se recorta a la silueta real del panel más 3 mm de sangrado. Lo que el
  cliente puso fuera del panel no se imprime.
- **Qué va a DTF y qué no.** Solo las capas (imágenes, textos y patrones) van a DTF. El color base
  de cada zona se pinta.

## Antes del primer pedido real: calibrar

El modelo 3D se parece al zapato que vas a usar, pero no es idéntico. Una vez por modelo:

1. Genera el paquete de un pedido de prueba en la talla de referencia.
2. Imprime una plantilla al 100 % y comprueba la regla de 50 mm con una regla real.
3. Ponla sobre el zapato real. Si el panel real es, por ejemplo, un 4 % más grande, multiplica
   por 1,04 el `printMm` de esa zona en `src/config/models/<modelo>.json` y vuelve a desplegar.

Si se regenera un GLB (`npm run model:prepare*`), vuelve a medir con `npm run model:print-sizes`.
Al volver a medir se sobrescriben los ajustes manuales: anótalos.

## Límites conocidos

- La puntera y el talón son curvos: la película se adapta, pero conviene probar con cada proveedor.
- Las capas con opacidad menor al 100 % se reproducen peor, porque DTF imprime sobre base blanca.
  La hoja de producción lo avisa.
- Las imágenes subidas antes de este cambio no tienen original en el servidor: se imprimen con la
  versión reducida (2048 px) y la hoja lo indica.
- Los originales pesan hasta 15 MB. En el servidor, `MAX_UPLOAD_BYTES` vale ahora 16 MB por
  defecto. Si tu `.env` fija un valor menor, súbelo. Si el servidor rechaza un original, el pedido
  se hace igualmente y se imprime con la versión reducida.

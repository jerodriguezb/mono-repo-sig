# Seguimiento de índices para `Producserv`

Este documento describe los índices añadidos al modelo `Producserv` y cómo monitorear su utilización.

## Índices actuales

Los índices definidos en `backend/server/modelos/producserv.js` incluyen:

- Único por `codprod`.
- Compuestos por `activo` junto con `descripcion`, `codprod`, `rubro` y `marca` para facilitar búsquedas en registros vigentes.
- Índice de texto parcial (filtrando por `activo: true`) sobre `descripcion` y `codprod` para búsquedas flexibles.

Recordá ejecutar `Model.syncIndexes()` o el comando equivalente después de desplegar para asegurar que MongoDB sincronice los índices definidos en el esquema.

```js
await Producserv.syncIndexes();
```

## Verificación con `explain()`

Antes y después de aplicar cambios o sincronizar índices, utilizá `explain()` para confirmar que el planificador los aprovecha. Por ejemplo:

```js
// En la shell de MongoDB o mongosh
use <tu_base_de_datos>;
db.producservs.explain('executionStats').find({ activo: true, descripcion: /pieza/i });

// Agregación equivalente a la ruta GET /producservs
const pipeline = [
  { $match: { activo: true, descripcion: /pieza/i } },
  { $sort: { descripcion: 1 } },
  { $skip: 0 },
  { $limit: 10 },
];
db.producservs.explain('executionStats').aggregate(pipeline);
```

Revisá los campos `winningPlan` y `executionStats.totalDocsExamined` para verificar que los índices reducen la cantidad de documentos examinados. Documentá los resultados en tus reportes de monitoreo para mantener un historial del impacto en rendimiento.

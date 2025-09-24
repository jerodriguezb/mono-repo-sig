# Backend – Flujo de depósito y logística

Este servicio Express expone los endpoints REST para gestionar comandas y el flujo operativo de depósito, control de carga y despacho. Las modificaciones recientes amplían el modelo `Comanda` para soportar auditoría completa y nuevas etapas.

## Campos clave del modelo `Comanda`

El esquema (`backend/server/modelos/comanda.js`) ahora incluye:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `estadoPreparacion` | String (`"A Preparar" \| "En Curso" \| "Lista para carga"`) | Estado interno de depósito. |
| `operarioAsignado` | ObjectId → `Usuario` | Operario responsable de la preparación. |
| `preparacion` | Subdocumento | Datos del checklist de depósito: responsable, horarios, verificación de bultos, control de temperatura, incidencias y archivos adjuntos. |
| `controlCarga` | Subdocumento | Inspector, fecha/hora, confirmación del checklist, sello y anotaciones del control de carga. |
| `historial` | Array de subdocumentos | Auditoría `{ accion, usuario, motivo, fecha }` para cada cambio relevante. |
| `entregas` | Array de subdocumentos | Registro por parada con estado (`Completada/Parcial/Rechazada`), motivo, fotos y confirmación de checklist. |
| `motivoLogistica` / `usuarioLogistica` | String & ObjectId | Observaciones y usuario responsable de la asignación logística. |

Todos los subdocumentos usan timestamps para poder reconstruir la línea temporal de una orden.

## Endpoint `PUT /comandas/:id`

El controlador (`backend/server/rutas/comanda.js`) valida y fusiona los cambios recibidos:

* **Depósito / logística** (roles `ADMIN_ROLE` o `USER_CAM`) pueden actualizar `estadoPreparacion`, `operarioAsignado`, `preparacion`, `controlCarga`, `motivoLogistica`, `usuarioLogistica` y asignar camiones. Se registran entradas en `historial` automáticamente.
* **Choferes** (`USER_CAM`) o administradores pueden cargar entregas parciales usando el campo `entregaNueva` o reemplazar el arreglo `entregas` completo.
* Se validan transiciones críticas: para pasar a “En Curso” debe existir `preparacion.inicio`, y para “Lista para carga” es obligatorio contar con `preparacion.fin` y un operario asignado. El control de carga sólo puede registrarse en este último estado.
* La ruta sigue permitiendo que administradores/preventistas modifiquen campos generales (`codcli`, `items`, etc.) respetando las reglas existentes.

Cualquier modificación relevante genera un nuevo item en `historial`, lo que permite visualizarlo desde el frontend sin endpoints adicionales.

## Flujo sugerido desde el frontend

1. **Depósito** trabaja sobre `/comandasapreparar` realizando polling y mantiene el checklist en `preparacion`. “Tomar comanda” asigna el operario y cambia a “En Curso”.
2. Al completar la preparación se marca `estadoPreparacion = "Lista para carga"` y se habilita el `controlCarga`.
3. Con la comanda lista, logística asigna camión (`camion`, `usuarioLogistica`, `motivoLogistica`).
4. Sólo cuando `controlCarga` está completo la orden aparece en el panel de choferes. Cada entrega se persiste en `entregas` y queda auditada en `historial`.
5. Todas las transiciones (preparación, control de carga, despacho, entregas) quedan disponibles en el nuevo componente “Seguimiento” de las tablas administrativas.

## Validaciones y seguridad

* Los middlewares de autenticación siguen vigentes. El propio controlador hace verificación de rol antes de aceptar cambios sensibles.
* Se realizan comprobaciones de consistencia (camión sólo asignable a comandas listas, control de carga sólo cuando corresponde, etc.).
* Las operaciones sobre `Comanda` utilizan `mongoose` con `runValidators` y merges controlados para evitar sobrescribir información previa.

## Cómo actualizar una comanda

Todos los datos nuevos se envían mediante `PUT /comandas/:id` con el payload correspondiente, por ejemplo:

```json
{
  "estadoPreparacion": "Lista para carga",
  "preparacion": {
    "responsable": "<usuarioId>",
    "inicio": "2025-02-10T11:30:00.000Z",
    "fin": "2025-02-10T12:05:00.000Z",
    "verificacionBultos": true,
    "archivos": [{ "nombre": "checklist.pdf", "url": "https://..." }]
  },
  "motivoHistorial": "Checklist completado"
}
```

El controlador fusiona la información con el documento existente y añade la entrada correspondiente en `historial`.

Consulta el archivo `backend/server/rutas/comanda.js` para ejemplos de combinaciones soportadas (control de carga, asignación logística y entrega).


# API logística y depósito – Campos de `Comanda`

Este backend expone un único recurso principal (`/comandas`) que ahora centraliza todas las
operaciones de depósito, logística y seguimiento de entregas. No se agregaron nuevos
endpoints: cada actualización se realiza con `PUT /comandas/:id` enviando únicamente los
campos que cambian.

## Nuevos campos del esquema

El modelo `Comanda` (`server/modelos/comanda.js`) incorpora subdocumentos y metadatos
orientados al flujo operativo:

| Campo | Tipo | Descripción |
| ----- | ---- | ----------- |
| `estadoPreparacion` | `String` (`A Preparar`, `En Curso`, `Lista para carga`) | Estado interno del tablero de depósito. |
| `operarioAsignado` | `ObjectId -> Usuario` | Operario responsable de la preparación. |
| `preparacion` | Subdocumento | Contiene `responsable`, `inicio`, `fin`, `verificacionBultos`, `controlTemperatura`, `incidencias`, `checklistDepositoConfirmado` y `archivos[]`. Todos los cambios quedan auditados en `historial`. |
| `controlCarga` | Subdocumento | Registra `inspector`, `fecha`, `checklistDepositoConfirmado`, `numeroSello`, `anotaciones` y `archivos[]`. Sólo se permite cuando la comanda está en `Lista para carga`. |
| `motivoLogistica` | `String` | Observaciones de logística al asignar camión o planificar el despacho. |
| `usuarioLogistica` | `ObjectId -> Usuario` | Usuario que aprueba/gestiona la asignación logística. |
| `salidaDeposito` | `Date` | Marca el despacho efectivo del camión. |
| `usuarioDespacho` | `ObjectId -> Usuario` | Usuario que autoriza la salida del depósito. |
| `historial` | `[{ accion, usuario, motivo, fecha }]` | Bitácora automática de cada cambio crítico (estados, control de carga, asignaciones, despachos, entregas). |
| `entregas` | Subdocumento repetible | Cada entrega contiene `parada`, `estado` (`Completa`, `Parcial`, `Rechazada`), cantidades, `motivo`, `checklistConfirmado`, `fotos[]`, `fecha` y `usuario`. |

Todos los subdocumentos utilizan `timestamps` y admiten archivos adjuntos mediante pares
`{ nombre, url, tipo }`.

## Validaciones en `PUT /comandas/:id`

El controlador (`server/rutas/comanda.js`) aplica reglas según el rol del token:

- Sólo depósito/logística (roles `ADMIN_ROLE` y `USER_ROLE`) pueden modificar
  `estadoPreparacion`, `operarioAsignado`, `preparacion`, `controlCarga`, `camion*`,
  `motivoLogistica`, `usuarioLogistica`, `salidaDeposito` y `usuarioDespacho`.
- El paso `En Curso → Lista para carga` exige que el checklist de preparación esté completo.
  Además, únicamente el operario asignado (o un administrador) puede cerrarlo.
- El control de carga requiere que la comanda esté en `Lista para carga` y que se confirme el
  checklist del depósito.
- Los choferes (`USER_CAM`) sólo pueden registrar entregas (`entregas` o `nuevaEntrega`).
- Cada transición relevante genera una entrada en `historial` con el usuario autenticado y el
  motivo recibido en el payload (si aplica).

Todas las operaciones se ejecutan dentro de transacciones de Mongoose para garantizar
consistencia y el `GET /comandas*` ya devuelve los nuevos campos con `populate` de usuarios,
camiones y subdocumentos.

## Flujo de actualización recomendado

1. **Preparación:** `PUT /comandas/:id` con `{ operarioAsignado, preparacion, estadoPreparacion }`.
2. **Control de carga:** `{ controlCarga }` una vez que la tarjeta está en `Lista para carga`.
3. **Asignación logística:** `{ camion, camionero, motivoLogistica, usuarioLogistica }`.
4. **Despacho:** `{ salidaDeposito, usuarioDespacho }` cuando el camión abandona el depósito.
5. **Entregas:** cada parada se registra con `{ nuevaEntrega: { ... } }`.

El historial consolidado permite consultar el seguimiento completo desde el frontend sin
crear vistas adicionales.


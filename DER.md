# DER - Diagrama Entidad-Relación

Última actualización: 2026-07-05

```
┌─────────────────────────┐
│        admins           │
├─────────────────────────┤
│ PK  id (auto)           │
│     usuario    (string) │
│     password   (string) │
└─────────────────────────┘


┌──────────────────────────────┐         ┌──────────────────────────────────────┐
│          clientes            │         │              ventas                  │
├──────────────────────────────┤    1:N  ├──────────────────────────────────────┤
│ PK  id (auto)                │◄────────┤ PK  id (auto)                       │
│     nombre         (string)  │         │ FK  clienteId        (string)       │
│     identificacion (string)  │         │     clienteNombre    (string) [den] │
│     telefono       (string)  │         │     tipoArticulo     (enum)        │
│     email          (string)  │         │       moneda|billete|medalla|      │
│     direccion      (string)  │         │       token|otro                   │
│     saldoPendiente (number)  │         │     descripcion      (string)       │
│                              │         │     fecha            (Timestamp)    │
│                              │         │     monto            (number) [Gs]  │
│                              │         │     estado           (enum)         │
│                              │         │       pendiente|pagado|             │
│                              │         │       enviado|anulado              │
│                              │         └──────────────────────────────────────┘
│                              │
│                              │         ┌──────────────────────────────────────┐
│                              │         │              pagos                   │
│                              │    1:N  ├──────────────────────────────────────┤
│                              │◄────────┤ PK  id (auto)                       │
│                              │         │ FK  clienteId        (string)       │
│                              │         │     clienteNombre    (string) [den] │
│                              │         │     monto            (number) [Gs]  │
│                              │         │     fecha            (Timestamp)    │
│                              │         │     observacion      (string)       │
│                              │         │     estado           (enum) [opt]   │
│                              │         │       (ausente)|anulado             │
└──────────────────────────────┘         └──────────────────────────────────────┘


┌──────────────────────────────┐         ┌──────────────────────────────────────┐
│          compras             │         │             egresos                  │
├──────────────────────────────┤         ├──────────────────────────────────────┤
│ PK  id (auto)                │         │ PK  id (auto)                       │
│     fecha      (Timestamp)   │         │     fecha       (Timestamp)         │
│     monto      (number) [Gs] │         │     monto       (number) [Gs]       │
│     observacion (string)     │         │     descripcion (string)            │
│     proveedor   (string)     │         │     categoria   (string)            │
└──────────────────────────────┘         └──────────────────────────────────────┘


┌──────────────────────────────────────┐
│            inventario                │
├──────────────────────────────────────┤
│ PK  id (auto)                        │
│     rubro              (enum)        │
│       monedas|billetes|medallas|     │
│       estampillas|token|otros        │
│     estado             (enum)        │
│       en_stock|vendido|entregado|    │
│       recuperado|anulado             │
│     descripcion        (string)      │
│     fechaCompra        (Timestamp)   │
│     precioCompraUSD    (number) [US] │
│     precioReferenciaUSD(number) [US] │
│     precioVentaGs      (number) [Gs] │
│     precioVentaUSD     (number) [US] │
│     fechaVenta         (Timestamp)   │
│     comentario         (string)      │
└──────────────────────────────────────┘


┌──────────────────────────────────────┐         ┌──────────────────────────────────────┐
│             expos                    │         │          expos_ventas                │
├──────────────────────────────────────┤    1:N  ├──────────────────────────────────────┤
│ PK  id (auto)                        │◄────────┤ PK  id (auto)                       │
│     nombre           (string)        │         │ FK  expoId           (string)       │
│     fechaInicio      (Timestamp)     │         │     expoNombre       (string) [den] │
│     fechaFin         (Timestamp)     │         │     tipoArticulo     (enum)         │
│     ubicacion        (string)        │         │       moneda|billete|medalla|       │
│     costo            (number) [Gs]   │         │       token|otro                    │
│     comentario       (string)        │         │     descripcion      (string)       │
│     totalVentas      (number) [Gs]   │         │     fecha            (Timestamp)    │
│     cantidadVentas   (number)        │         │     monto            (number) [Gs]  │
│     finalizado       (boolean)       │         │                                      │
└──────────────────────────────────────┘         └──────────────────────────────────────┘
```

## Relaciones

| Relación | Tipo | Descripción |
|---|---|---|
| **clientes → ventas** | 1:N | Un cliente tiene muchas ventas (`clienteId`) |
| **clientes → pagos** | 1:N | Un cliente tiene muchos pagos (`clienteId`) |
| **compras** | independiente | Sin relación a otras entidades |
| **egresos** | independiente | Sin relación a otras entidades |
| **inventario** | independiente | Sin relación a otras entidades |
| **expos → expos_ventas** | 1:N | Un evento tiene muchas ventas (`expoId`) |
| **admins** | independiente | Solo autenticación |

## Notas

- **[den]** = campo desnormalizado (nombre del cliente copiado para evitar joins)
- **[Gs]** = montos en Guaraníes / **[US]** = montos en USD
- `clientes.saldoPendiente` es un campo calculado que se actualiza con `increment()` al crear ventas o pagos
- **[opt]** `pagos.estado` es opcional; ausente = pago activo. Se setea a `"anulado"` al anular un pago desde la lista, lo que restituye `saldoPendiente` del cliente pero no revierte ventas que ese pago haya marcado como pagadas
- **compras**, **egresos** e **inventario** son entidades independientes sin FK a ninguna otra colección
- **expos_ventas** son ventas al contado sin cliente asociado; `totalVentas` y `cantidadVentas` en `expos` se actualizan con `increment()` al crear/editar ventas
- **[imp]** `origen` es un campo opcional presente solo en registros creados por la importación histórica (`"importacion"`). Permite filtrar/identificar datos importados del spreadsheet 2020–2026
- El cliente **"Histórico (pre-sistema)"** agrupa los cobros diarios importados sin detalle de cliente. Su `saldoPendiente` es siempre 0

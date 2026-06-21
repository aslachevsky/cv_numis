# DER - Diagrama Entidad-Relación

Última actualización: 2026-06-19

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
│     telefono       (string)  │         │     descripcion      (string)       │
│     email          (string)  │         │     fecha            (Timestamp)    │
│     direccion      (string)  │         │     monto            (number) [Gs]  │
│     saldoPendiente (number)  │         │     estado           (enum)         │
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
```

## Relaciones

| Relación | Tipo | Descripción |
|---|---|---|
| **clientes → ventas** | 1:N | Un cliente tiene muchas ventas (`clienteId`) |
| **clientes → pagos** | 1:N | Un cliente tiene muchos pagos (`clienteId`) |
| **compras** | independiente | Sin relación a otras entidades |
| **egresos** | independiente | Sin relación a otras entidades |
| **inventario** | independiente | Sin relación a otras entidades |
| **admins** | independiente | Solo autenticación |

## Notas

- **[den]** = campo desnormalizado (nombre del cliente copiado para evitar joins)
- **[Gs]** = montos en Guaraníes / **[US]** = montos en USD
- `clientes.saldoPendiente` es un campo calculado que se actualiza con `increment()` al crear ventas o pagos
- **compras**, **egresos** e **inventario** son entidades independientes sin FK a ninguna otra colección

# ADR-002 — Dos contextos acotados: Catálogo y Venta de entradas

## Contexto
El sistema gestiona los eventos que organiza la productora y la venta de sus entradas.
Ambos se relacionan (una entrada es para un evento), pero su lenguaje, sus reglas, sus
usuarios y su carga son distintos.

## Decisión
- **Catálogo** (`src/catalog`): qué eventos hay, dónde, cuándo, con qué aforo y precio.
  Agregado `Event`.
- **Venta de entradas** (`src/ticketing`): vender sin sobrevender, validar en la puerta,
  reembolsar. Agregados `TicketAllocation` (cupo por evento) y `Ticket`.

La venta tiene su propio modelo del evento (`EventReference`, `SaleableEvent`, `Money`) y
no comparte value objects con el catálogo.

## Por qué
- Para la venta, un evento es solo "aforo + inicio + precio + ¿se puede vender?". No
  necesita el nombre ni el recinto; reutilizar `Event` acoplaría la venta a la cartelera.
- Las invariantes son independientes: "un recinto, una hora" no afecta a "no sobrevender"
  y viceversa; cada agregado se modifica sin cargar el otro.
- La carga es muy distinta: el catálogo cambia poco; la venta recibe picos de compras
  simultáneas. Separarlos permite optimizar (y, en el futuro, escalar) la venta sola.
- Es la división mínima que cumple la rúbrica (≥ 2 contextos con lectura y escritura) sin
  contextos artificiales.

## Consecuencias
- Hace falta una traducción explícita entre contextos (ACL, ADR-007).
- Se aceptan clases distintas para el mismo concepto (`EventId`/`EventReference`,
  `TicketPrice`/`Money`).
- El cupo guarda una copia (aforo, inicio, precio) tomada del catálogo al abrir la venta;
  como el catálogo no permite cambiarlos, no se desincroniza.

## Alternativas descartadas
- *Un único contexto "Eventos"*: incumple la rúbrica y mezcla cartelera con venta.
- *Tercer contexto "Pagos"*: sin pasarela real no aportaría reglas nuevas (ver deuda técnica).

# ADR-008 — Códigos de entrada aleatorios guardados como HMAC-SHA256

## Contexto
Quien tiene el código de una entrada, entra: es una credencial. No puede guardarse en
claro, ni aparecer en respuestas posteriores, logs o eventos. Además la puerta necesita
encontrar la entrada **a partir del código** rápidamente.

## Decisión
- `TicketCode.generate()` crea un código `XXXX-XXXX-XXXX` con un generador criptográfico
  (`crypto.randomInt`) sobre un alfabeto sin caracteres ambiguos (31 símbolos → ~59 bits).
- Puerto `TicketCodeHasher` en `ticketing/domain/ports`; adaptador `HmacTicketCodeHasher`:
  **HMAC-SHA256** con un secreto del servidor (`TICKET_CODE_SECRET`, ≥ 32 caracteres).
- Solo se guarda el hash (`code_hash`, único). El código se devuelve **una vez**, en la
  respuesta de la compra. `TicketCode` se serializa como `[REDACTED]`.

## Por qué
- **No se usa un hash lento (scrypt/bcrypt)**: esos existen para contraseñas elegidas por
  personas (poca entropía). Aquí el código ya es aleatorio con ~59 bits; probar 7,9·10¹⁷
  combinaciones es inviable. Además la búsqueda en la puerta requiere un hash
  **determinista y sin sal** para poder indexarlo.
- **No basta un SHA-256 simple**: con una copia de la base, alguien podría calcular el hash
  de códigos candidatos sin límite. Con HMAC necesita también el secreto del servidor, que
  no está en la base.
- Todo con `node:crypto`, sin dependencias nativas.

## Consecuencias
- Si se pierde o rota `TICKET_CODE_SECRET`, los códigos emitidos dejan de validarse:
  rotarlo requiere un plan (doble verificación con el secreto anterior; deuda técnica).
- Un comprador que pierde su código no puede recuperarlo (habría que reemitir la entrada).

## Alternativas descartadas
- Guardar el código en claro o cifrado reversible: una fuga de la base expondría todas las entradas.
- UUID como código: demasiado largo para teclearlo o dictarlo en la puerta.

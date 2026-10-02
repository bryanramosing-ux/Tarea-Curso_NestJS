# ADR-008 — Hash de contraseñas con scrypt nativo de Node

## Contexto
Las contraseñas no pueden guardarse en claro ni aparecer en respuestas o logs. El
algoritmo concreto es un detalle técnico que no debe contaminar el dominio.

## Decisión
- Puerto `PasswordHasher` en `users/domain/ports`; el dominio solo conoce
  `PlainPassword` (política RN-004) y `PasswordHash` (valor opaco).
- Adaptador `ScryptPasswordHasher` con `crypto.scrypt` de Node: sal aleatoria de 16
  bytes, N=16384, r=8, p=1, clave de 64 bytes, formato autodescriptivo
  `scrypt$N$r$p$sal$hash`, verificación con `timingSafeEqual`.
- `PlainPassword` y `PasswordHash` devuelven `[REDACTED]` al serializarse.

## Por qué
- scrypt es una función de derivación de claves resistente a fuerza bruta
  (memory-hard) recomendada para contraseñas, y viene incluida en Node: no requiere
  dependencias nativas (`bcrypt`) que fallan al compilar en algunos entornos o que
  pnpm 10 bloquea por defecto (scripts de instalación).
- Guardar los parámetros en el hash permite endurecerlos en el futuro sin invalidar
  los existentes.
- El límite de 72 caracteres mantiene compatibilidad con una posible migración a bcrypt.

## Consecuencias
- El registro tarda unas decenas de milisegundos por el coste del hash (deseado).
- No hay endpoint de login todavía; `verify` está implementado y probado para cuando exista.

## Alternativas descartadas
- `bcrypt` (dependencia nativa), `argon2` (dependencia nativa), SHA-256 con sal (demasiado rápido).

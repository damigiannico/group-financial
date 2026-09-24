# Finanzas grupales

Finanzas grupales es un panel de economía compartida para un grupo del grupo. La autenticación usa Better Auth y la persistencia usa Neon Postgres mediante Drizzle.

## Configuración necesaria

Las variables ya configuradas en el proyecto son:

- `DATABASE_URL`: conexión de Neon.
- `BETTER_AUTH_SECRET`: secreto de sesiones de Better Auth.

No uses datos mock ni `localStorage`: los movimientos se leen y escriben en Neon desde `/api/transactions`.

## Cómo probarlo

1. Abrí `/sign-up` y creá el usuario de Damián, por ejemplo `damian@casa.com`, con una contraseña segura.
2. Cerrá sesión desde el botón `Salir` del panel.
3. Creá el usuario de Eli desde `/sign-up`, por ejemplo `eli@casa.com`.
4. Iniciá sesión como cualquiera de los dos.
5. Ambos usuarios quedan asociados al primer grupo existente. Los movimientos creados por uno se muestran al otro porque la API consulta por `group_id`.
6. En un grupo nuevo, el primer usuario crea el grupo y queda como administrador; el siguiente usuario que se registre se suma como integrante.

Si una cuenta ya existe, usá `/sign-in` en lugar de `/sign-up`.

## Estado inicial

Una cuenta nueva empieza con:

- cero ingresos;
- cero gastos;
- balance cero;
- ningún movimiento.

Los valores del panel se calculan exclusivamente con las filas que devuelve Neon. Si la base está vacía, la pantalla permanece en cero.

## Verificación rápida

- `GET /api/transactions` requiere una sesión válida y devuelve `401` si no hay login.
- `POST /api/transactions` guarda el movimiento con el usuario y grupo actuales.
- `DELETE /api/transactions?id=...` elimina sólo movimientos del grupo actual.
- Cada consulta está limitada al grupo al que pertenece el usuario autenticado.

Para diagnosticar un problema de conexión, revisá que el proyecto tenga `DATABASE_URL` y `BETTER_AUTH_SECRET` en Settings → Vars y que las tablas de Better Auth, `household_groups`, `group_members` y `transactions` existan en Neon.

## Desarrollo

```bash
pnpm dev
```

La aplicación usa Next.js 16, Better Auth, Drizzle ORM, PostgreSQL/Neon y SWR para refrescar los movimientos después de guardar o eliminar.

## Nota sobre grupos

La asociación automática al primer grupo facilita la prueba con Damián y Eli en este MVP. En una siguiente etapa conviene reemplazarla por invitaciones con código o enlace para soportar varios hogares sin mezclar grupos.

## Seguridad

No compartas valores de `DATABASE_URL` ni `BETTER_AUTH_SECRET`. Las contraseñas se gestionan con Better Auth y no se guardan en el código fuente.

## Instalación

Para llevar el proyecto fuera de v0, descargalo mediante la opción de instalación con shadcn CLI o conectalo a GitHub; no copies secretos en archivos del repositorio.

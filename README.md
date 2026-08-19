# HiKonta Partners

Panel de solo lectura para que incubadoras/aceleradoras monitoreen la adopción de HiKonta entre
los emprendedores de su portafolio. Proyecto **separado** del app principal (`yelifin-sistema`),
pensado para desplegarse en `partners.hikonta.com`.

Diseño completo de la feature: `database/docs/partner-dashboard-architecture.md` en el repo
principal (`yelifin-sistema`). Migraciones SQL de esta feature: `database/partners/` en ese mismo
repo — **hay que ejecutarlas ahí antes de usar este proyecto**:

1. `database/partners/01-migrate-subscription-payments.sql`
2. `database/partners/02-partners-infrastructure.sql`
3. `database/partners/04-invite-codes.sql` — tabla `partner_invite_codes`, requerida por
   "Agregar organización" (botón en `/organizations`, ver más abajo)

## Por qué es un repo aparte

- Subdominio propio (`partners.hikonta.com`) con su propio despliegue en Vercel.
- Conexión **directa** a la misma base de datos de Neon (mismo `DATABASE_URL`) — sin pasar por la
  API del app principal, sin CORS, sin acoplar los dos despliegues.
- Mismo proyecto de Firebase — un coordinador de partner inicia sesión igual que cualquier usuario
  de HiKonta; su fila en `users` se vincula a `partners` vía `partners.user_id` (mismo patrón que
  usa `verifyAdmin()` en el app principal — no es una columna de rol en `users`).

## Stack

Next.js 16 (App Router) + React 19 + TypeScript, SQL directo sobre Postgres/Neon
(`@neondatabase/serverless`), Firebase Auth, Tailwind CSS v4, SWR, iconos con
[Lineicons](https://lineicons.com/icons) (`@lineiconshq/react-lineicons` + `@lineiconshq/free-icons`).

Deliberadamente **sin** shadcn/ui ni Radix — es un panel chico y de solo lectura; `components/ui/`
tiene un `Card` y un `Badge` mínimos hechos a mano con Tailwind.

## Setup local

```bash
npm install
npm run dev
```

`.env.local` ya está poblado con las mismas credenciales que `yelifin-sistema/.env.local`
(mismo Neon, mismo Firebase) — no está en git (ver `.gitignore`). Agregar además:

```
NEXT_PUBLIC_MAIN_APP_URL=https://hikonta.app   # o el dominio de yelifin-sistema en dev/staging
```

Se usa para armar el enlace de registro (`{NEXT_PUBLIC_MAIN_APP_URL}/register?ref=CODIGO`) del
botón "Agregar organización" — ver sección de abajo. Sin esta var cae al default de producción.

## KPIs del dashboard

Spec de producto: `documentation/dashboard.md` (KPIs, umbrales, fórmulas, panels). Traducido a la
arquitectura real de HiKonta con estas desviaciones deliberadas del doc original:

- **"Último login" no existe** — HiKonta no trackea sesiones. Todo lo que el doc llama "login" se
  muestra como "última actividad" (derivada de `sales`/`transactions`, igual que el resto del panel).
- **Status de 3 niveles** (`ACTIVE` ≤30d, `INACTIVE` 30-90d, `DORMANT` >90d) implementado en
  `/api/partner/dashboard` y `/api/partner/organizations`.
- **Ingresos siguen gateados por `share_financials`** — el doc pide mostrar ingresos libremente;
  se mantiene el opt-in por privacidad (ver `partner-dashboard-architecture.md`), pero ya está
  cableado de verdad: suma real de `sales.total` solo de las orgs que autorizaron, con tendencia
  vs. mes anterior. El resumen deja explícito cuántas orgs están incluidas en la suma.
- **"Volumen de transacciones"** se muestra sin gate — es un conteo, no revela montos.
- **Fase 2/3 del doc** (gráficos de tendencia históricos, retención a 90 días, benchmarking entre
  partners) — no implementado todavía, el propio doc los marca como no-MVP.
- **Panel 3 (Actividad, feed de eventos) se sacó del producto (2026-08-19).** El doc lo pedía como
  vista aparte; quedaba redundante con el detalle de organización, que ya muestra lo mismo como
  tendencia % (ver `ImpactBanner` en `organizations/[id]/page.tsx`) — un feed cronológico sin
  contexto de tendencia no aportaba nada encima. `app/api/partner/activity` y `(partner)/activity`
  ya no existen.

## Estructura

```
app/
  page.tsx                    landing pública (explica qué es el panel)
  login/                      login (Firebase email+password)
  register/                   registro de incubadora — queda pendiente de aprobación
  (partner)/                  layout con sidebar, protegido por proxy.ts
    dashboard/                resumen (5 métricas)
    organizations/            tabla de emprendedores del portafolio
    subscriptions/            panel de suscripciones — stat cards (activas/historial/créditos
                              sin asignar), tabla completa, patrocinados activos, historial
    reports/                  reporte de adopción + tendencias (6 meses)
  api/partner/
    me/                       identidad del coordinador autenticado (o 403 + reason si está pendiente)
    register/                 POST público — crea Firebase user + users + partners (is_active=FALSE)
    dashboard/                resumen agregado
    organizations/            lista + detalle ([id])
    subscriptions/            lista de suscripciones por org (plan, estado, vencimiento) +
                              resumen por estado + orgs patrocinadas activamente
    subscriptions/payments/   historial de patrocinios pagados por este partner
    plans/                    catálogo de planes activos (para el selector de patrocinio)
    credits/                  lotes de créditos de suscripción sin asignar
    reports/adoption/         % de adopción
    reports/trends/           series mensuales (adopción + ingresos, 6 meses)
    sponsor/                  POST — partner patrocina N meses de plan a una org
    invites/                  GET lista + POST genera código de invitación; [id] DELETE cancela
lib/
  auth.ts                     verifyPartner() — análogo a verifyAdmin() del app principal
  billing.ts                  applySubscriptionPayment() — aplica pagos/patrocinios a org_subscriptions
  db.ts                       cliente Neon compartido
proxy.ts                      middleware (convención Next 16) — protege /(partner)/*
```

## Decisiones de diseño (resumen — detalle en partner-dashboard-architecture.md)

- **`Partner → Organizations`, no `Partner → Users`.** El emprendedor es una `organizations` row
  (puede tener varios usuarios), no un `users` row.
- **Sin tabla `activity_log` nueva.** "Última actividad" se deriva de `MAX(sold_at)` en `sales` y
  `MAX(occurred_at)` en `transactions`, filtrado por `org_id` — cero instrumentación nueva.
- **Ingresos/costos nunca se exponen sin opt-in.** `partner_organizations.share_financials` debe
  ser `TRUE` para que un endpoint calcule montos de una org — no implementado aún en las rutas de
  este MVP (todas evitan `SUM`/`amount` por ahora).
- **Patrocinio de meses = mismo mecanismo que un pago normal.** `subscription_payments` con
  `paid_by_partner_id` seteado, vía `applySubscriptionPayment()`.
- **Registro = solicitud, no acceso inmediato.** `POST /api/partner/register` crea todo
  (Firebase user + `users` + `partners`) pero con `partners.is_active = FALSE`. El coordinador
  puede loguearse de inmediato, pero `verifyPartner()` sigue negando acceso (403,
  `reason: "PENDING_APPROVAL"`) hasta que alguien active la fila manualmente — no hay UI de
  aprobación todavía, se hace directo en Neon (ver abajo). `hooks/use-auth.ts` distingue este caso
  ("pending") de "no autenticado" para no generar un loop de redirects entre `/login` y `/dashboard`.
- **Vincular una org al portafolio SÍ tiene UI — "Agregar organización" en `/organizations`.**
  Resuelve la pregunta abierta #6 de `partner-dashboard-architecture.md`. El partner genera un
  código (`partner_invite_codes`, `database/partners/04-invite-codes.sql`); el emprendedor lo
  canjea del lado de `yelifin-sistema` — en `/register?ref=CODIGO` si es cuenta nueva, o en
  Configuración → Organización si ya tiene cuenta. El vínculo lo crea SIEMPRE el canje del
  emprendedor (`redeemPartnerInviteCode()` en `yelifin-sistema/lib/partner-invites.ts`), nunca este
  repo directamente — mismo espíritu de opt-in que `share_financials`. `INSERT` manual a
  `partner_organizations` sigue siendo válido como fallback (ej. importar el seed de dev), pero ya
  no es el único camino.

### Aprobar un partner manualmente (mientras no haya UI de admin)

```sql
UPDATE partners SET is_active = TRUE WHERE id = <id>;
```

## Deploy (pendiente de hacer)

1. Nuevo proyecto en Vercel apuntando a este repo.
2. Dominio: `partners.hikonta.com` (agregar CNAME en el DNS de `hikonta.com`).
3. Env vars en Vercel: copiar las mismas de `.env.local` (Settings → Environment Variables).
4. Confirmar que `database/partners/01` y `02` ya corrieron en Neon.

## Pendiente (no MVP)

- UI de aprobación de partners nuevos (hoy es un `UPDATE` manual en Neon — ver arriba).
- Flujo para vincular una org a un partner (hoy no hay UI — se inserta manualmente en
  `partner_organizations`).
- Email de confirmación/aprobación al registrarse (hoy no se envía nada).
- Filtros por período, exportar a Excel, alertas de inactividad.

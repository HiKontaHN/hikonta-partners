# HiKonta Partners

Panel de solo lectura para que incubadoras/aceleradoras monitoreen la adopción de HiKonta entre
los emprendedores de su portafolio. Proyecto **separado** del app principal (`yelifin-sistema`),
pensado para desplegarse en `partners.hikonta.com`.

Diseño completo de la feature: `database/docs/partner-dashboard-architecture.md` en el repo
principal (`yelifin-sistema`). Migraciones SQL de esta feature: `database/partners/` en ese mismo
repo — **hay que ejecutarlas ahí antes de usar este proyecto**:

1. `database/partners/01-migrate-subscription-payments.sql`
2. `database/partners/02-partners-infrastructure.sql`

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
(mismo Neon, mismo Firebase) — no está en git (ver `.gitignore`).

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

## Estructura

```
app/
  page.tsx                    landing pública (explica qué es el panel)
  login/                      login (Firebase email+password)
  register/                   registro de incubadora — queda pendiente de aprobación
  (partner)/                  layout con sidebar, protegido por proxy.ts
    dashboard/                resumen (5 métricas)
    organizations/            tabla de emprendedores del portafolio
    activity/                 actividad reciente (derivada de sales/transactions)
    reports/                  reporte de adopción
  api/partner/
    me/                       identidad del coordinador autenticado (o 403 + reason si está pendiente)
    register/                 POST público — crea Firebase user + users + partners (is_active=FALSE)
    dashboard/                resumen agregado
    organizations/            lista + detalle ([id])
    activity/                 actividad reciente
    reports/adoption/         % de adopción
    sponsor/                  POST — partner patrocina N meses de plan a una org
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
  `reason: "PENDING_APPROVAL"`) hasta que alguien active la fila manualmente y la vincule a
  organizaciones vía `partner_organizations` — no hay UI de aprobación todavía, se hace directo en
  Neon. `hooks/use-auth.ts` distingue este caso ("pending") de "no autenticado" para no generar un
  loop de redirects entre `/login` y `/dashboard`.

### Aprobar un partner manualmente (mientras no haya UI de admin)

```sql
UPDATE partners SET is_active = TRUE WHERE id = <id>;

INSERT INTO partner_organizations (partner_id, org_id)
VALUES (<partner_id>, <org_id>);
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
- UI para que el partner patrocinee meses (`POST /api/partner/sponsor` ya existe, falta el form).
- Email de confirmación/aprobación al registrarse (hoy no se envía nada).
- Filtros por período, exportar a Excel, alertas de inactividad.

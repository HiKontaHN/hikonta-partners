# Estado del proyecto — HiKonta Partners

> Última actualización: 20 de agosto de 2026 — patrocinio ahora solo consume créditos ya
> comprados (ver sección 12), header fijo de página (slot dedicado) y componente `Spinner`

---

## 1. Qué es esto

Panel de solo lectura para que incubadoras/aceleradoras monitoreen la adopción de HiKonta entre
los emprendedores de su portafolio: quién está activo, cuánto están facturando (si lo autorizan),
y quién necesita seguimiento.

- **Repo:** [`hmorales34/hikonta-partners`](https://github.com/hmorales34/hikonta-partners) (privado) — ya subido a GitHub.
- **Origen del proyecto:** vino de un spec de producto pensado para otro stack (NestJS + TypeORM +
  SQL Server). Se tradujo por completo a la arquitectura real de HiKonta.
- **Diseño de arquitectura completo:** `database/docs/partner-dashboard-architecture.md` en el
  repo principal (`yelifin-sistema`).
- **Spec de KPIs:** `documentation/dashboard.md` en este repo.

---

## 2. Decisiones de arquitectura clave

| Decisión | Por qué |
|---|---|
| **Repo separado**, no una ruta dentro de `yelifin-sistema` | Subdominio propio (`partners.hikonta.com`), despliegue independiente en Vercel |
| **Conexión directa a la misma Neon DB** (mismo `DATABASE_URL`) | Sin pasar por la API del app principal — evita CORS y acopla los dos despliegues |
| **Mismo proyecto de Firebase** | Un coordinador de partner inicia sesión igual que cualquier usuario de HiKonta |
| `Partner → Organizations`, no `Partner → Users` | El emprendedor es una `organizations` row (puede tener varios usuarios), no un `users` row |
| Sin tabla `activity_log` nueva | "Última actividad" se deriva de `MAX(sold_at)` en `sales` y `MAX(occurred_at)` en `transactions` — cero instrumentación nueva |
| Ingresos **nunca** se exponen sin opt-in | `partner_organizations.share_financials` debe ser `TRUE` para que un endpoint calcule montos de una org |
| Registro = solicitud, no acceso inmediato | `partners.is_active = FALSE` hasta aprobación manual — sin UI de aprobación todavía |
| Patrocinio de meses = mismo mecanismo que un pago normal, pero SOLO desde un crédito ya pago | `subscription_payments.paid_by_partner_id` seteado, vía `applySubscriptionPayment()` — ya no acepta monto/plan/meses libres, ver sección 12 |
| Sin shadcn/ui ni Radix | Panel chico, de solo lectura — `components/ui/` hecho a mano con Tailwind |
| Iconos: Lineicons, no lucide-react | Pedido explícito — `@lineiconshq/react-lineicons` + `@lineiconshq/free-icons` |
| Estilo visual: "One UI" (Samsung) | Radios grandes, sombras suaves en vez de bordes duros, sidebar/navbar como islas flotantes colapsables, modo oscuro real con `next-themes` |

---

## 3. Base de datos — todo ejecutado en Neon

Scripts en `database/partners/` del repo principal (`yelifin-sistema`):

| Script | Qué hace | Estado |
|---|---|---|
| `01-migrate-subscription-payments.sql` | Migra `subscription_payments` de `user_id`/`user_subscriptions` a `org_id`/`org_subscriptions`; agrega `months_purchased` + `covers_period_start/end` | ✅ Ejecutado |
| `02-partners-infrastructure.sql` | Crea `partners` (login vía `user_id`) + `partner_organizations` (N:N, con `share_financials`) + `paid_by_partner_id` en `subscription_payments` | ✅ Ejecutado |
| `03-seed-test-data.sql` | **Solo dev** — vincula el partner de prueba `id=1` a 6 organizaciones **reales** existentes (mezcla de activas/inactivas para poder ver ambos estados) | ✅ Ejecutado |

Además, en esta misma sesión se agregó (sin relación directa al panel de partners, pedido aparte
sobre el registro de HiKonta):

| Script | Qué hace | Estado |
|---|---|---|
| `v4.9-add-org-industry.sql` | Primer intento: `organizations.industry` como enum (CHECK) | ✅ Ejecutado, luego reemplazado |
| `v4.10-industries-table.sql` | Reemplaza el enum por una tabla real `industries` (16 filas, incluye "Trinkets y productos cute"); `organizations.industry_id` como FK | ✅ Ejecutado |

---

## 4. Backend — rutas API (este repo)

```
app/api/partner/
  me/                       GET  — identidad del coordinador (o 403 + reason si está pendiente)
  register/                 POST — público, crea Firebase user + users + partners (is_active=FALSE)
  dashboard/                GET  — KPIs del resumen + distribución por sector/industria + impacto agregado
  organizations/            GET  — tabla de emprendedores del portafolio (incluye sector)
  organizations/[id]/       GET  — detalle de una org (incluye sector + impacto de actividad pre/post vínculo)
  subscriptions/            GET  — plan/estado/vencimiento de cada org + resumen por estado + patrocinados activos
  subscriptions/payments/   GET  — historial de patrocinios que pagó ESTE partner (búsqueda + filtro + paginación)
  credits/                  GET  — lotes de créditos de suscripción pre-comprados por el partner (solo lectura)
  plans/                    GET  — catálogo de planes activos
  invites/                  GET  — lista de códigos de invitación generados por este partner
  invites/                  POST — genera un código nuevo (expira, reintenta en colisión de UNIQUE)
  invites/[id]/             DELETE — revoca un código
  reports/adoption/         GET  — % de adopción + reporte para terceros (beneficiarios, ventas generadas, sectores)
  reports/trends/           GET  — series mensuales (adopción + ingresos, 6 meses)
  sponsor/                  POST — reclama un crédito PENDING de un lote propio y lo aplica a una org (rate-limited)
```

`activity/` (GET) **ya no existe** — se eliminó junto con la vista `/activity` (ver sección 11).

`lib/auth.ts` → `verifyPartner()` (análogo a `verifyAdmin()` del app principal).
`lib/billing.ts` → `applySubscriptionPayment()` (aplica pagos/patrocinios a `org_subscriptions`).

### KPIs implementados (`documentation/dashboard.md`)

Traducidos a datos reales de HiKonta — desviaciones deliberadas documentadas en el `README.md`:

- **Tasa de adopción** con badge Excelente/Moderado/Necesita atención (>70% / 50-70% / <50%)
- **Activos / Inactivos / Dormant** (30d / 90d) — no existe login tracking, se deriva de actividad real
- **Ingresos reportados** — suma real de `sales.total`, **solo de orgs con `share_financials=TRUE`**, con tendencia vs. mes anterior
- **Volumen de transacciones** — conteo, sin gate (no revela montos)
- **En alerta** — inactivos 30d+ excluyendo orgs recién creadas
- Fase 2/3 del doc (tendencias históricas, retención 90d, benchmarking) — **no implementado**, el propio doc las marca como no-MVP

---

## 5. Frontend

```
app/
  page.tsx              landing pública
  login/                 login (Firebase email+password, toggle mostrar/ocultar)
  register/               registro de incubadora → queda pendiente de aprobación
  (partner)/              layout protegido — sidebar isla flotante colapsable + navbar isla flotante
    dashboard/             5 KPIs + impacto agregado del portafolio
    organizations/         tabla de emprendedores (propietario, ingresos, tendencia, status) +
                           botón "Agregar organización" (InviteModal)
    organizations/[id]/    detalle de org — ahora incluye ImpactBanner (crecimiento de actividad
                           pre/post vínculo) e income chart con profit además de income
    subscriptions/         plan/vencimiento de cada org — stat cards por estado, "Patrocinados
                           activamente", historial de patrocinios, y CreditsSection (créditos
                           pre-comprados sin asignar)
    reports/                 reporte de adopción + tendencias
```

`activity/` **ya no existe** — ver sección 11 (por qué se sacó y qué la reemplazó).

- **Sidebar**: isla flotante (`rounded-2xl` + sombra, sin borde duro), colapsable a riel de íconos,
  estado persistido en `localStorage`. Drawer off-canvas en mobile.
- **Navbar**: también isla flotante, fija (no scrollea) — el toggle de modo oscuro vive ahí.
- **Modo oscuro**: real, con `next-themes` (antes las variables `.dark` existían en CSS pero nada
  las activaba).
- **Registro → pendiente de aprobación**: `hooks/use-auth.ts` distingue "no autenticado" de
  "autenticado pero sin acceso todavía" (`pending`) para no generar un loop de redirects.

---

## 6. ⚠️ Bypass de autenticación — ACTIVO ahora mismo

`NEXT_PUBLIC_BYPASS_AUTH="true"` en `.env.local` — salta Firebase Auth y `verifyPartner()` por
completo para poder ver el panel sin loguearse (usa el partner de prueba `id=1` del seed).

**Hay un banner amarillo visible en el panel mientras esté prendido.** Hay que apagarlo
(`"false"` o borrar la línea) **antes de desplegar a producción** — tal como está, cualquiera que
entre al dominio vería el panel sin loguearse.

---

## 7. Bugs encontrados y corregidos en el camino

- **SWR con key en array**: el fetcher recibe la key completa como *un solo argumento* (no la
  separa) — un "fix" propio a mitad de sesión rompió esto (`/api/partner/dashboard,bypass` — el
  array se stringificaba con comas al pasarlo a `fetch()`). Corregido desestructurando el array
  dentro del fetcher.
- **Nombres de íconos de Lineicons**: varios nombres "obvios" no existen en el paquete real
  (`HomeOutlined`→`Home2Outlined`, `UsersOutlined`→`UserMultiple4Outlined`,
  `BriefcaseOutlined`→`Briefcase1Outlined`, `Menu1Outlined`→`MenuHamburger1Outlined`,
  `ClockOutlined`→`HourglassOutlined`, etc.). **Regla adoptada:** verificar siempre contra
  `node_modules/.pnpm/@lineiconshq+free-icons@*/.../dist/index.d.ts` con grep antes de usar un
  ícono — la doc/unpkg remoto dio nombres incorrectos más de una vez.
- **`IconType` inventado**: no existe en `@lineiconshq/react-lineicons`; el tipo correcto es
  `LineiconsProps["icon"]`.
- **`me` narrowing perdido** en funciones anidadas del layout — TS no arrastra el
  `if (!me) return null` hacia closures declaradas después; se resolvió recapturando la variable.
- **Migraciones "ya ejecutadas"**: dos veces en la sesión una migración que pensé que faltaba
  resultó estar parcialmente corrida ya (`subscription_payments` constraint, y el enum de
  `industry`) — verificar siempre el estado real en Neon antes de asumir.

---

## 8. Pendiente

- [ ] **Apagar el bypass de autenticación** antes de cualquier despliegue real — sigue activo
      (`NEXT_PUBLIC_BYPASS_AUTH="true"` en `.env.local`, verificado 19 ago tarde)
- [ ] UI de aprobación de partners nuevos (hoy es un `UPDATE partners SET is_active = TRUE` manual en Neon)
- [x] ~~UI para vincular una org a un partner~~ — resuelto vía invite codes, ver sección 11
      (`INSERT` manual en `partner_organizations` sigue siendo un fallback válido, ya no es el único camino)
- [x] UI para que el partner patrocinee meses — página `/subscriptions` (lista + modal `SponsorModal`, también embebido en `/organizations/[id]`), usa `POST /api/partner/sponsor` que ya existía
- [x] Historial de patrocinios detallado — `/api/partner/subscriptions/payments` + sección en `/subscriptions`
- [x] Distribución por sector/industria — dashboard + reporte para terceros
- [x] Rate limiting (global + por endpoint sensible) — portado de `hikonta-admin`
- [x] Fix de la condición de carrera del cookie de sesión en login/register — portado de `hikonta-admin`
- [x] Flujo de invitación para agregar organizaciones al portafolio — ver sección 11
- [x] Métricas de impacto (crecimiento de actividad pre/post vínculo) — dashboard + detalle de org
- [x] Créditos de suscripción pre-comprados por el partner — `/api/partner/credits` + sección en `/subscriptions` (solo lectura, ver sección 11)
- [x] Feed de actividad cronológico → reemplazado por stat cards de suscripciones (ver sección 11)
- [x] Header de página fijo (no `position: sticky`) en `/organizations` y `/organizations/[id]` — slot dedicado en el layout, ver sección 12
- [x] Componente `Spinner`/`PageSpinner`/`SectionSpinner` — reemplaza los "Cargando…" de texto, ver sección 12
- [x] `POST /api/partner/sponsor` ahora SOLO consume créditos ya comprados (`{ orgId, batchId }`) — ver sección 12
- [ ] Email de confirmación/aprobación al registrarse (hoy no se envía nada)
- [ ] Deploy real: proyecto en Vercel + dominio `partners.hikonta.com` + variables de entorno
- [ ] `eslint.config.js` (no está configurado en este repo todavía)
- [ ] Fase 2 de créditos: repartir cada crédito por link/email a alguien sin cuenta todavía (hoy `/api/partner/credits` es solo lectura — el lote lo arma un admin de HiKonta en `hikonta-admin`)
- [ ] Exportar a Excel/PDF el reporte para terceros, alertas automáticas de inactividad (requiere cron — ver sección 10)
- [ ] Cohortes/programas, mentores, empleo real, financiamiento — bloqueados por falta de tablas nuevas, ver `documentation/ideas-feasibility.md`
- [ ] Fase 2/3 de KPIs: gráficos de tendencia histórica, retención a 90 días, benchmarking entre partners

---

## 9. Cómo retomar

```bash
# Este repo
cd hikonta-partners
npm install
npm run dev   # bypass activo — vas a ver el panel con datos reales del seed sin loguearte

# Si necesitás correr migraciones nuevas contra Neon, usar el patrón de
# database/partners/*.sql desde yelifin-sistema (ver database/docs/
# partner-dashboard-architecture.md para el detalle completo)
```

Para desactivar el bypass y probar el login real: `NEXT_PUBLIC_BYPASS_AUTH="false"` en
`.env.local`, y crear un usuario real vía `/register` (queda pendiente de aprobación — activarlo
manualmente en Neon, ver sección 8 del `README.md`).

---

## 10. Seguridad — hardening portado de `hikonta-admin`

`hikonta-admin` (el panel de administración interno de HiKonta, repo hermano) ya había resuelto
varios problemas de seguridad/login que este repo todavía no tenía. Se revisó ese repo y se portó
lo aplicable:

| Cambio | Archivo(s) | Detalle |
|---|---|---|
| Rate limiter en memoria por IP (nuevo) | `lib/rate-limit.ts` | No existía ningún rate limiting en este repo. Copiado tal cual de `hikonta-admin` (que a su vez lo copió de `yelifin-sistema`) |
| Rate limit global en `/api/*` | `proxy.ts` | 300 solicitudes/minuto por IP, antes de llegar a cualquier route handler |
| Rate limit por endpoint sensible | `app/api/partner/register/route.ts` (10/15min), `app/api/partner/sponsor/route.ts` (30/15min) | Igual criterio que `create-user`/`add-admin`/`register-payment` en `hikonta-admin`: rutas que crean usuarios o escriben pagos reales |
| **Bug real corregido** en `proxy.ts` | `proxy.ts` | `verifyFirebaseToken()` usa `crypto.subtle.importKey("spki", ...)` sobre el DER de un certificado X.509 completo — eso **siempre falla**, incluso con un token legítimo (no es una estructura SPKI válida). Antes, el middleware redirigía duro a `/login` cuando esa verificación "fallaba", lo que significa que **cualquier navegación directa o refresh de una ruta protegida iba a rebotar a `/login`** aunque la sesión fuera válida. Está dormido hoy porque `NEXT_PUBLIC_BYPASS_AUTH=true` salta todo `proxy.ts` en dev — iba a explotar apenas se desplegara a producción con el bypass apagado. Ahora, sin cookie o con token "inválido" según ese chequeo roto, el middleware deja pasar (`NextResponse.next()`) — la identidad real la sigue validando cada API route con `verifyPartner()` (Node runtime, `firebase-admin`, sin este bug) y el cliente con `useAuth()` + el redirect en `app/(partner)/layout.tsx` |
| Fix de condición de carrera en el cookie de sesión | `app/login/page.tsx`, `app/register/page.tsx` | Antes: `signInWithEmailAndPassword()` + `router.push("/dashboard")` inmediato, confiando en que el listener async `onIdTokenChanged` de `useAuth()` alcanzara a setear la cookie `token` antes de que `proxy.ts` la necesitara — carrera real, podía rebotar a `/login`. Ahora: se setea la cookie explícitamente con `setTokenCookie(idToken)` antes de navegar, y se usa `window.location.href` (hard reload) en vez de `router.push()` para evitar que el router cache del cliente sirva una respuesta vieja |

No se tocaron `lib/auth.ts`, `hooks/use-auth.ts`, `lib/firebase-admin.ts`, `lib/token-cookie.ts` —
ya eran equivalentes funcionales a los de `hikonta-admin` (solo cambian nombres de dominio
Partner/Admin, o el fin de línea CRLF/LF).

⚠️ Importante: con `NEXT_PUBLIC_BYPASS_AUTH="true"` (ver sección 6), nada de `proxy.ts` se
ejecuta — para probar estos fixes de verdad hay que apagar el bypass.

---

## 11. Últimos 3 commits (19 ago, tarde)

### `42e32b3` — Flujo de invitación de organizaciones + métricas de impacto

- **Pregunta abierta #6 de `partner-dashboard-architecture.md` resuelta**: hasta ahora vincular una
  org al portafolio de un partner era un `INSERT` manual en `partner_organizations`. Ahora hay un
  flujo de invitación por código:
  - `database/partners/04-invite-codes.sql` (en `yelifin-sistema`) crea `partner_invite_codes`.
  - `POST /api/partner/invites` genera un código de 8 caracteres (`lib/invite-codes.ts`), expira a
    los `INVITE_CODE_DEFAULT_EXPIRY_DAYS` días, reintenta hasta 5 veces en colisión de `UNIQUE`.
  - `GET /api/partner/invites` lista los códigos del partner con estado derivado
    (`ACTIVE`/`USED`/`EXPIRED`/`REVOKED`); `DELETE /api/partner/invites/[id]` revoca uno.
  - El **canje real** (crear el vínculo en `partner_organizations`) pasa del lado de
    `yelifin-sistema` (`/api/auth/register?ref=CODIGO` o Configuración → Organización si ya tiene
    cuenta) — este repo nunca escribe el vínculo directamente, mismo espíritu opt-in que
    `share_financials`.
  - UI: botón "Agregar organización" en `/organizations` → `InviteModal` (nuevo componente,
    212 líneas) con el link listo para copiar/compartir.
- **Métricas de impacto** (`lib/impact.ts`, nuevo): crecimiento de actividad (ventas +
  transacciones, **sin montos** — a propósito, ver comentario en el archivo) comparando el
  promedio mensual antes vs. después de `partner_organizations.linked_at`. Requiere ≥14 días de
  historial "antes" para reportar un % (si no, `growthPct: null`, nunca se inventa un número); caso
  especial `startedFromZero` cuando la org no tenía actividad antes de unirse y sí después.
  - Usado en `GET /api/partner/organizations/[id]` (impacto de una org — nuevo `ImpactBanner` en
    la página de detalle) y en `GET /api/partner/dashboard` (promedio agregado del portafolio,
    misma fórmula para que los números sean consistentes entre vista agregada y detalle).
- `income-trend-chart.tsx` ahora también grafica *profit* además de *income* (antes solo income).

### `c14bb13` — Créditos de suscripción (UI + API)

- **Créditos pre-comprados por el partner**: HiKonta le vende al partner lotes de meses de
  suscripción por adelantado (`partner_credit_batches`, generados desde `hikonta-admin` —
  `POST /api/admin/partners/[id]/credit-batches`, no desde este repo), que luego se reparten a
  organizaciones (`partner_subscription_credits`). Ese reparto ("fase 2": link/email a alguien sin
  cuenta) **no está construido** — ver `hikonta-admin/documentation/feature-sponsorship-invites.md`.
- Este repo agrega **solo lectura**: `GET /api/partner/credits` — lista los lotes del partner con
  plan, duración, cantidad, total pagado, y conteo de créditos `pending`/`claimed`/`revoked` por
  lote (cast manual de `numeric` de Postgres a `Number`, mismo patrón que en
  `subscriptions/payments`).
- UI: `CreditsSection` nueva en `/subscriptions` — tabla, oculta si el partner no tiene lotes.

### `ac6cf30` — Se saca el feed de actividad, entran stats de suscripciones

- **`/activity` (página + `GET /api/partner/activity`) eliminados por completo.** Razón
  (documentada también en `README.md`): quedaba redundante con el `ImpactBanner` del detalle de
  organización (agregado en `42e32b3`, mismo día) — un feed cronológico sin contexto de tendencia
  no aportaba nada encima de un % de crecimiento. Se sacó del menú del sidebar
  (`app/(partner)/layout.tsx`).
- `GET /api/partner/subscriptions` ahora devuelve además:
  - `summary`: conteo de orgs por `subscriptionStatus` (`ACTIVE`/`TRIAL`/`PAST_DUE`/`CANCELLED`/
    `EXPIRED`) sobre **todo** el portafolio, no solo la página paginada — para las stat cards.
  - `activelySponsored`: orgs que este partner patrocinó (`paid_by_partner_id`, `months_purchased
    > 0`) y cuya suscripción sigue `ACTIVE` hoy — subconjunto del historial completo de pagos, sin
    paginar (es chico).
- `/subscriptions` gana stat cards por estado + sección "Patrocinados activamente" +
  `CreditsSection` (de `c14bb13`) — la página pasó de ser solo una tabla a un panel completo de
  suscripciones/créditos/patrocinios.
- Retoque menor de ícono/feature en la landing (`app/page.tsx`).

⚠️ Con estos 3 commits, `documentation/dashboard.md` (el spec de KPIs original) queda un poco más
atrás todavía de lo que ya estaba — impacto, créditos y las stat cards de suscripciones no estaban
en ese doc. No se ha actualizado `dashboard.md` en consecuencia.

---

## 11. Features de `documentation/ideas-feasibility.md` aplicadas

De la lista ✅ ("dato existente, solo falta exponerlo") de ese doc, esto es lo que se implementó
en esta sesión (lo demás ya estaba expuesto de antes — ventas, clientes, alerta de 30 días, etc.):

- **Sector/industria** (`organizations.industry_id` → `industries`, migrado en v4.10 pero sin
  ningún endpoint que lo usara todavía): join agregado en `organizations/route.ts` y
  `organizations/[id]/route.ts`, badge en la tabla de Emprendedores y en el header del detalle.
- **Distribución por sector — sección 14**: `GROUP BY industry_id` nuevo en
  `dashboard/route.ts` (`sectorBreakdown`), card con barras por sector en el Dashboard.
- **Reporte para terceros — sección 19**: `reports/adoption/route.ts` ahora devuelve también
  `impact: { beneficiaries, totalSalesGenerated, sectorsBenefited }` — ventas generadas es
  histórico completo (no solo el mes en curso), gateado por `share_financials` igual que el resto
  del panel. Nueva sección en la página de Reportes pensada para copiar/pegar a un patrocinador.
- **Suscripciones — historial detallado**: hasta ahora `/subscriptions` solo mostraba el estado
  *actual* de cada org, sin ningún registro de pagos pasados (a diferencia de `hikonta-admin`, que
  tiene una página `/payments` completa con historial, búsqueda, filtro y paginación sobre
  `subscription_payments`). Se agregó `GET /api/partner/subscriptions/payments` — mismo nivel de
  detalle, acotado a `paid_by_partner_id = este partner` (no todos los pagos de sus orgs, solo lo
  que el partner efectivamente patrocinó) — y una sección "Historial de patrocinios" en la página,
  con búsqueda por negocio, filtro por estado, paginación y total histórico ($ y meses).

Lo marcado 🔴 en ese doc (cohortes, mentores, hitos, financiamiento, empleo real) sigue sin
implementarse — requiere tablas nuevas y captura manual, no se deriva de nada que HiKonta registre
hoy. Ver el doc para el detalle completo de qué falta y por qué.

---

## 12. Sesión del 20 de agosto — header fijo, spinner reusable, y patrocinio solo por créditos

### Header de página "fijo" (no `position: sticky`)

Pedido explícito: el header de identidad de `/organizations/[id]` (y luego también el de
`/organizations`) tenía que quedar fijo de verdad al scrollear, no `sticky` — con `sticky` el
elemento sigue viviendo DENTRO del contenedor con scroll y recién se "engancha" al tope al
pasarlo por encima.

Como el único contenedor con scroll (`<main>`) vive en el layout compartido
(`app/(partner)/layout.tsx`), no en cada página, hizo falta un mecanismo para que una página
empuje contenido a una zona fuera de ese scroll — nuevo `components/partner/page-header-slot.tsx`:

- `PageHeaderProvider` — envuelve todo el layout, guarda "qué header está activo ahora" en un
  `useState` + dos contextos (uno para el setter, otro para el valor — separados para que
  cualquier punto del árbol pueda leer o escribir).
- `PageHeaderOutlet` — se renderiza en el layout, entre el navbar y `<main>`, shrink-0, **fuera**
  del `overflow-y-auto` — mismo mecanismo que ya usa el navbar para quedar fijo.
- `usePageHeader(factory, deps)` — hook que una página llama para publicar su header ahí (como
  `useMemo`, recalcula solo cuando cambian `deps`); se limpia solo al desmontar/cambiar de ruta.

`(partner)/layout.tsx` cambió los `mt-3` sueltos entre navbar/main por `gap-3` en el contenedor
de la columna derecha, así el espaciado es igual tenga la página un header registrado o no.

Aplicado en:
- `organizations/[id]/page.tsx` — logo/nombre/propietario + badges (sector, plan, estado) +
  botón "Patrocinar meses". Deps: solo identidad (`org?.id`, `org?.name`, etc.) — el JSX en sí
  NUNCA va como dep (sería una referencia nueva cada render y dispararía un loop).
- `organizations/page.tsx` — título + botón "Agregar organización" + la barra de filtros
  completa (búsqueda/estado/sector). Acá las deps SÍ incluyen `search`/`status`/`industry`
  (inputs controlados, tienen que reflejar cada tecla).

### Componente `Spinner` reusable

`components/ui/spinner.tsx` — reemplaza todos los `<p>Cargando…</p>` de texto del panel:
- `Spinner` — el círculo giratorio (el mismo que ya usaba el estado de "iniciando sesión" del
  layout, centralizado).
- `PageSpinner` — centra el spinner a la mitad del área de contenido (`min-h-[60vh]`) para la
  carga inicial de una página completa (`dashboard`, `reports`, `organizations`,
  `organizations/[id]`).
- `SectionSpinner` — versión chica (`py-10`, sin `min-h`) para subsecciones que cuelgan debajo de
  contenido que ya se ve (las 3 secciones de `/subscriptions`, la lista de códigos de
  `InviteModal`) — un `PageSpinner` ahí habría dejado un hueco enorme.

### `POST /api/partner/sponsor` — ahora SOLO consume créditos ya comprados

Pedido explícito: "la parte de patrocinar se van a poder agregar solo de los créditos que tengan
agregados" — se revisó `hikonta-admin` (`documentation/feature-sponsorship-invites.md` y
`database/partners/05-credit-batches.sql` en `yelifin-sistema`) para entender el esquema de
créditos antes de tocar nada.

Antes: `SponsorModal` dejaba tipear meses/monto/plan libremente — cualquier partner podía
"registrar" un patrocinio sin que hubiera ningún cargo real detrás. Ahora:

- **Contrato de la API cambió**: `{ orgId, monthsPurchased, amountUsd, planId }` → `{ orgId,
  batchId }`. El backend ya no confía en ningún monto/plan/meses que mande el cliente — todo sale
  del crédito reclamado.
- Reclama UN crédito `PENDING` del lote con un **UPDATE atómico con subquery** (no hace falta
  transacción explícita ni `SELECT` previo):
  ```sql
  UPDATE partner_subscription_credits
  SET status = 'CLAIMED', claimed_org_id = ${orgId}, claimed_at = NOW()
  WHERE id = (
    SELECT id FROM partner_subscription_credits
    WHERE batch_id = ${batchId} AND partner_id = ${partnerId} AND status = 'PENDING'
    ORDER BY id ASC LIMIT 1
  )
  RETURNING id, plan_id, months
  ```
  Race-safe en Postgres (READ COMMITTED): dos requests concurrentes por el mismo lote no pueden
  reclamar la misma fila — la segunda relee la subquery bajo el lock de fila de la primera y ya
  no la ve `PENDING`.
- Con `credit.plan_id`/`credit.months` ya server-side (no del cliente), llama
  `applySubscriptionPayment(orgId, credit.months, { amountUsd: 0, planId: credit.plan_id,
  paidByPartnerId, providerPaymentId: "credit:<id>" })` — `amountUsd: 0` porque el cobro real ya
  pasó al comprar el lote (fase 1 de `feature-sponsorship-invites.md`, resuelve la pregunta
  abierta que dejó ese doc sobre "cómo reflejar el canje sin duplicar el cobro"); el
  `providerPaymentId` deja trazabilidad de qué crédito se usó en `subscription_payments`.
  - Si `applySubscriptionPayment` falla (ej. la org no tiene `org_subscriptions` todavía), el
    crédito vuelve a `PENDING` — rollback manual, mismo criterio que el rollback de Firebase en
    `POST /api/partner/register`.
- `SponsorModal` (componente) ya no tiene campos de meses/monto/plan — carga
  `GET /api/partner/credits`, filtra lotes con `pending_count > 0`, y el partner elige de cuál
  lote asignar una plaza. Si no tiene ningún lote con plazas disponibles, muestra un mensaje
  explicando que los lotes los factura HiKonta desde `hikonta-admin` (no hay autoservicio). Perdió
  el prop `currentPlanId` (ya no hay selector de plan libre) — actualizado en los dos call sites
  (`/organizations/[id]` y `/subscriptions`).
- `/subscriptions`: `onSuccess` del modal ahora también revalida la key compartida de SWR
  `/api/partner/credits` (antes solo revalidaba la lista de suscripciones y forzaba un remount
  del historial de pagos) — si no, el conteo de "pendientes" de `CreditsSection` quedaba
  desactualizado hasta el próximo refetch.
- **Sigue pendiente** (fuera de alcance de hoy, no pedido): flujo para gente sin cuenta todavía
  (link/email de invitación a un crédito puntual) — eso es la fase 2 de
  `feature-sponsorship-invites.md`, con preguntas de producto sin resolver (ver ese doc). Lo de
  hoy es la aplicación de un crédito a una org que YA existe en el portafolio, que es un caso más
  chico y no tenía ninguna decisión pendiente.

**Probado de punta a punta** contra la Neon real (`partner_id=1`, org de prueba `id=6`): se
insertó un lote de prueba con 2 créditos `PENDING`, se reclamaron ambos vía `POST /sponsor`
(bajando `pending_count` 2→1→0 y subiendo `claimed_count` en `GET /api/partner/credits`), se
confirmó el 3er intento devolviendo 409 "No quedan créditos pendientes en ese lote", y que
patrocinar una org fuera del portafolio devuelve 404 antes de tocar ningún crédito. Los datos de
prueba se revirtieron después (lote/créditos/pagos de prueba borrados, `org_subscriptions` de la
org 6 restaurado).

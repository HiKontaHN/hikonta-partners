# Estado del proyecto — HiKonta Partners

> Última actualización: 19 de agosto de 2026

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
| Patrocinio de meses = mismo mecanismo que un pago normal | `subscription_payments.paid_by_partner_id` seteado, vía `applySubscriptionPayment()` |
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
  dashboard/                GET  — KPIs del resumen + distribución por sector/industria
  organizations/            GET  — tabla de emprendedores del portafolio (incluye sector)
  organizations/[id]/       GET  — detalle de una org (incluye sector)
  subscriptions/            GET  — plan/estado/vencimiento de cada org del portafolio
  subscriptions/payments/   GET  — historial de patrocinios que pagó ESTE partner (búsqueda + filtro + paginación)
  plans/                    GET  — catálogo de planes activos
  activity/                 GET  — actividad reciente (derivada de sales/transactions)
  reports/adoption/         GET  — % de adopción + reporte para terceros (beneficiarios, ventas generadas, sectores)
  reports/trends/           GET  — series mensuales (adopción + ingresos, 6 meses)
  sponsor/                  POST — partner patrocina N meses de plan a una org (rate-limited)
```

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
    dashboard/             5 KPIs
    organizations/         tabla de emprendedores (propietario, ingresos, tendencia, status)
    subscriptions/         plan/vencimiento de cada org — patrocinar meses + historial de patrocinios
    activity/               feed de actividad
    reports/                 reporte de adopción + tendencias
```

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

- [ ] **Apagar el bypass de autenticación** antes de cualquier despliegue real
- [ ] UI de aprobación de partners nuevos (hoy es un `UPDATE partners SET is_active = TRUE` manual en Neon)
- [ ] UI para vincular una org a un partner (hoy es un `INSERT` manual en `partner_organizations`)
- [x] UI para que el partner patrocinee meses — página `/subscriptions` (lista + modal `SponsorModal`, también embebido en `/organizations/[id]`), usa `POST /api/partner/sponsor` que ya existía
- [x] Historial de patrocinios detallado — `/api/partner/subscriptions/payments` + sección en `/subscriptions`
- [x] Distribución por sector/industria — dashboard + reporte para terceros
- [x] Rate limiting (global + por endpoint sensible) — portado de `hikonta-admin`
- [x] Fix de la condición de carrera del cookie de sesión en login/register — portado de `hikonta-admin`
- [ ] Email de confirmación/aprobación al registrarse (hoy no se envía nada)
- [ ] Deploy real: proyecto en Vercel + dominio `partners.hikonta.com` + variables de entorno
- [ ] `eslint.config.js` (no está configurado en este repo todavía)
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

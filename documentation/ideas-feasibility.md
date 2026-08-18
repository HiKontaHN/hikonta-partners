# Viabilidad de `ideas.md` contra lo que ya existe

> Evalúa cada sección de `documentation/ideas.md` contra el schema real de `yelifin-sistema`
> (tablas ya creadas en Neon) y lo ya construido en `hikonta-partners` (`app/api/partner/*`).
> No propone diseño nuevo — solo dice qué se puede sacar de los datos que ya existen, qué
> necesita una columna/tabla chica, y qué requeriría un subsistema entero que hoy no existe
> en ninguno de los dos repos.

Leyenda:

- ✅ **Ya disponible** — el dato existe hoy, solo falta exponerlo en una ruta/vista del panel.
- 🟡 **Derivable / columna chica** — se calcula con SQL sobre tablas existentes, o requiere 1-2
  columnas nuevas (sin subsistema nuevo).
- 🔴 **Requiere subsistema nuevo** — no hay ninguna tabla relacionada hoy; hace falta modelar,
  construir CRUD y (para casi todos) un flujo de captura manual, porque **HiKonta es un sistema
  de ventas/inventario/finanzas, no un CRM de seguimiento de incubadora** — nada de esto se
  genera solo porque el emprendedor use la app día a día.

---

## 1. Datos generales de la cohorte — 🔴 en su mayoría

No existe el concepto de "cohorte" ni "programa" en ningún lado. `partner_organizations` es una
lista plana N:N (partner ↔ org), sin agrupación, sin fechas de inicio/fin, sin
postulantes/aceptados/retirados.

| Dato pedido | Estado |
|---|---|
| Sector o industria | ✅ `organizations.industry_id` → `industries` (16 filas, ya migrado v4.10) |
| Edad del emprendimiento | ✅ `organizations.created_at` |
| Nombre/fechas de cohorte, programa, postulantes, aceptados, tasa de aceptación, retirados, graduados | 🔴 no existe — necesitaría tablas `cohorts` + `cohort_organizations` (con `status`: postulante/aceptado/activo/retirado/graduado) |
| Ubicación geográfica | 🔴 no existe columna en `organizations` |
| Etapa del emprendimiento (idea/validación/MVP/…) | 🔴 no existe — columna nueva tipo enum, pero **quién la actualiza** es la pregunta real (¿el emprendedor? ¿el coordinador manualmente?) |
| Número de fundadores | 🔴 no existe — `organization_members` cuenta *usuarios con acceso a la app*, no fundadores |

**Para implementar cohortes de verdad:** 2 tablas nuevas (`cohorts`, `cohort_organizations`) +
UI de asignación. Es infraestructura razonable de construir, pero es la pieza que todo lo
demás del doc (secciones 10, 12, 13, 14) da por hecha que ya existe.

---

## 2. Información de los emprendimientos — mixto

| Dato | Estado |
|---|---|
| Nombre | ✅ `organizations.name` |
| Sector | ✅ `industry_id` |
| Fecha de creación | ✅ `created_at` |
| Información de contacto | ✅ ya disponible sin columnas nuevas — `organizations.owner_user_id → users.email` (mismo JOIN que ya usa `verifyPartner()`) |
| Número de colaboradores | 🟡 proxy imperfecto: `COUNT(organization_members WHERE org_id = X AND is_active)` — son *usuarios de la app* (cajero, bodeguero…), no necesariamente la nómina real del negocio |
| Descripción | 🟡 existía en `ddl.v1`; confirmar si sigue viva en el schema actual antes de usarla |
| Estado actual / etapa | ✅ el "estado" (activo/inactivo/dormant) ya existe en `hikonta-partners`; la "etapa" (idea/MVP/etc.) es 🔴, ver sección 1 |
| Ubicación, fundadores, página web, redes sociales | 🔴 no hay columnas — requeriría agregar campos a `organizations` (fáciles de agregar, pero HiKonta no los usa para nada hoy, así que quedarían huérfanos fuera del panel de partners) |

---

## 3. Desempeño financiero — mixto, con un límite duro

| Indicador | Estado |
|---|---|
| Ventas mensuales / acumuladas / crecimiento mensual | ✅ ya implementado en `dashboard/route.ts` y `reports/trends/route.ts` (`sales.total`, agrupado por mes) — gateado por `share_financials` |
| Costos operativos, utilidad, margen | 🟡 derivable de `transactions` (`type IN ('EXPENSE','INCOME')`) **si** el emprendedor efectivamente registra sus gastos ahí — depende de calidad de dato, no de schema. Debe respetar el mismo gate `share_financials` |
| Flujo de caja | 🟡 derivable de `transactions`/`accounts`, pero es la métrica más cara de calcular bien (requiere neteo por cuenta y período) |
| Inversión recibida, deuda, capital levantado, burn rate, runway | 🔴 **no existe ningún concepto de esto en HiKonta.** Es una app de ventas/inventario para negocios pequeños, no un cap table ni un módulo de financiamiento. No hay tabla de rondas de inversión ni de deuda. Implementarlo es una feature nueva de captura manual (probablemente en el panel del partner, no en HiKonta), no un cálculo sobre datos existentes |
| Comparación Inicio → Mes 3 → Graduación → 6 meses después | 🔴 requiere el concepto de cohorte/graduación (sección 1) para saber qué fecha es "graduación" |

---

## 4. Clientes y mercado — mixto

| Dato | Estado |
|---|---|
| Número total de clientes, clientes nuevos | ✅ `customers` tiene `org_id`, `created_at` — conteo directo |
| Ticket promedio | ✅ `customers.total_spent / total_orders`, o `AVG(sales.total)` |
| Clientes recurrentes / tasa de recompra | 🟡 derivable: `customers.total_orders > 1`, o comparando compradores mes a mes vía `sales` — requiere query, no columna nueva |
| Tasa de retención | 🟡 derivable con ventana de tiempo sobre `sales` (clientes que compraron este mes y también el anterior) |
| Mercado objetivo, segmentos atendidos, nuevos mercados alcanzados | 🔴 no hay dato — es información cualitativa que nadie captura hoy |

Todo lo derivable de `customers`/`sales` en esta sección debería ir detrás del mismo gate
`share_financials` que ya protege ingresos — `total_spent` es información financiera del
emprendedor.

---

## 5. Empleo generado — 🔴 casi todo

No existe tabla de nómina/empleados en HiKonta. `organization_members` (usuarios con login a la
app) **no es lo mismo** que empleados reales — un negocio puede tener 5 empleados y solo 1 con
acceso a HiKonta, o al revés, dar acceso a alguien que no es empleado (contador externo).

- Usar `organization_members` como proxy → 🟡 pero hay que ser explícito en el panel de que es
  "colaboradores con acceso a HiKonta", no "empleados", para no reportar un número falso a un
  patrocinador.
- Empleos generados, permanentes/temporales, fundadores trabajando activamente → 🔴 requiere
  captura manual nueva (no hay ningún dato de nómina en el sistema).

---

## 6. Seguimiento dentro del programa — 🔴 completo

Mentorías, talleres, asistencia, actividades, entregables, evaluaciones: **cero tablas
relacionadas en cualquiera de los dos repos.** Esto es, en esencia, el módulo de CRM de
seguimiento que traía el spec original (NestJS/CRM-TVC) y que `partner-dashboard-architecture.md`
ya había dejado fuera del MVP. No se deriva de nada que HiKonta registre — necesitaría un
subsistema entero (tablas `mentors`, `mentorship_sessions`, `workshops`, `workshop_attendance`,
`deliverables`) más las pantallas de captura para que el coordinador o el mentor las llenen a
mano.

---

## 7. Seguimiento de hitos — 🔴 nuevo, pero acotado

No existe `milestones`/`hitos` en ningún lado. A diferencia de la sección 6, esto es más chico y
autocontenido: una tabla `org_milestones` (org_id, título, estado, fecha objetivo, fecha
cumplimiento, responsable, evidencia, notas) que vive enteramente en el dominio de
`hikonta-partners` (no necesita tocar el schema de negocio de HiKonta). Es candidato razonable a
"siguiente feature" si el incubador la pide — pero es captura 100% manual, no hay señal
automática que reemplace a alguien marcando el hito como cumplido.

---

## 8. Evaluación de mentores — 🔴 depende de la sección 6

No hay tabla `mentors` todavía, así que esto no puede construirse antes que esa pieza. Mismo
patrón: subsistema nuevo, captura manual.

---

## 9. Nivel de riesgo del emprendimiento — 🟡 una versión honesta es posible HOY

La clasificación 🟢🟡🔴 completa (hitos, asistencia, evaluaciones de mentor) depende de las
secciones 6-8, que no existen. **Pero** una primera versión reducida es viable ahora mismo, solo
con señales que ya se calculan en `hikonta-partners`:

```
riesgo = f(
  días desde última actividad     -- ya existe (dashboard/route.ts)
  tendencia de ventas (mes vs mes) -- ya existe (income trend)
  tendencia de clientes (sección 4) -- derivable
)
```

Es un "risk score v1" honesto: financiero + actividad. Habría que dejar explícito en la UI que
es parcial (no incluye mentoría/hitos) hasta que existan esas piezas.

---

## 10. KPIs generales de la cohorte — depende de la sección 1

| KPI | Estado |
|---|---|
| Emprendimientos participantes / activos | ✅ ya existe (sin agrupar por cohorte) |
| Ventas generadas | ✅ ya existe |
| Emprendimientos graduados, tasa de graduación | 🔴 depende de cohorte/graduación (sección 1) |
| Empleos, capital levantado | 🔴 depende de secciones 3 y 5 |

Sin la tabla de cohortes, este panel solo puede mostrarse **a nivel de todo el portafolio del
partner**, no por generación — que es justamente lo que ya existe hoy en `dashboard/route.ts`.

---

## 11. Impacto del programa — mixto

| Indicador | Estado |
|---|---|
| % de emprendimientos que aumentaron ventas, crecimiento promedio | ✅ calculable con lo que ya hace `reports/trends/route.ts` |
| Clientes nuevos obtenidos | ✅ sección 4 |
| Supervivencia a 6/12 meses | 🟡 derivable: ¿la org sigue teniendo `sales`/`transactions` N meses después de `linked_at`? Mismo patrón que ya usa `trends/route.ts` para "activo en el mes X" |
| Empleos generados, capital levantado, formalización legal, productos lanzados, consiguió inversión, nuevos mercados, tasa de graduación | 🔴 todos dependen de datos que no se capturan (secciones 1, 3, 5) |

---

## 12. Comparación entre cohortes — 🔴 bloqueado por la sección 1

No hay nada que comparar sin que exista el concepto de cohorte primero.

---

## 13. Segmentación y filtros — mixto

| Filtro | Estado |
|---|---|
| Sector / Industria | ✅ `industry_id` |
| Estado (activo/inactivo/dormant) | ✅ ya existe |
| Nivel de crecimiento | 🟡 derivable de la tendencia de ventas |
| Nivel de riesgo | 🟡 una vez construida la sección 9 |
| Programa / Cohorte / Año | 🔴 sección 1 |
| Ubicación | 🔴 sección 2 |
| Etapa | 🔴 sección 2 |
| Mentor | 🔴 sección 6 |
| Con/sin inversión | 🔴 sección 3 |
| Graduados | 🔴 sección 1 |

---

## 14. Dashboard de incubadora — mixto

Lo derivable hoy (total emprendimientos, activos, ventas generadas, evolución de ventas,
distribución por sector) es una extensión razonable de lo que ya existe en `dashboard/route.ts` +
`reports/trends/route.ts` — solo falta agregar el `GROUP BY industry_id`. El resto (en riesgo con
score completo, capital, empleos, tasa de graduación, comparación entre cohortes) hereda los
bloqueos de las secciones 1, 3, 5, 6-9.

---

## 15. Dashboard del emprendimiento — 🔴 fuera de alcance del modelo actual, y probablemente redundante

Dos problemas, no uno:

1. **Modelo de acceso.** `hikonta-partners` hoy es de un solo actor: el coordinador del partner,
   solo lectura (`verifyPartner()`). Darle login al emprendedor dentro de este panel es un tercer
   tipo de usuario nuevo (ni `verifyAuth()` normal, ni `verifyPartner()`), con su propio modelo de
   permisos.
2. **Redundancia.** Ventas, clientes, gastos, utilidad, crecimiento — el emprendedor **ya ve
   todo esto en la app principal de HiKonta** (`app/(dashboard)/`). Construirlo de nuevo aquí
   duplica UI que ya existe en el otro repo, para el mismo dato, para el mismo usuario. Lo único
   que no está ya en HiKonta es hitos/mentorías/objetivos — que caen en 🔴 (secciones 6-8).

---

## 16. Dashboard del mentor — 🔴 requiere un actor nuevo completo

No hay tabla `mentors`, no hay tabla de asignación mentor↔organización. Es equivalente en esfuerzo
a lo que costó construir `partners` (tabla + `verifyMentor()` + rutas propias) pero sin ningún
dato existente del que partir — todo lo que mostraría (emprendimientos asignados, próximas
mentorías, hitos pendientes) depende de las secciones 6-8, que tampoco existen.

---

## 17. Cohort Health Score — 🟡 una versión "Startup Health Score" individual es viable ahora

Igual que la sección 9: la versión completa (con mentoría/hitos) no se puede construir todavía,
pero un score compuesto usando solo señales financieras + actividad (crecimiento de ventas,
crecimiento de clientes, recencia de actividad) es una extensión directa de datos que
`hikonta-partners` ya calcula. El "Cohort Health Score" (agregado por cohorte) hereda el bloqueo
de la sección 1.

---

## 18. Alertas automáticas — mixto, y con una advertencia de infraestructura

| Alerta | Estado |
|---|---|
| Sin actividad 30 días | ✅ **ya implementado** (`alertsCount` en `dashboard/route.ts`) |
| Caída significativa de ventas | 🟡 derivable con lo que ya calcula `reports/trends/route.ts` |
| Flujo de caja negativo | 🟡 sección 3, gateado por `share_financials` |
| Tres hitos vencidos, baja asistencia a mentorías | 🔴 secciones 6-7 |
| Requiere financiamiento, listo para graduación | 🔴 secciones 1, 3 |

**Advertencia aparte, sobre lo que ya está "implementado":** hoy ninguna alerta es realmente
*automática* — se recalculan cuando alguien abre el dashboard (`GET` on-demand), no hay cron ni
job que las dispare (ni notifique por email/push) fuera de ese request. `documentation/dashboard.md`
ya lo dejaba pendiente ("alertas automáticas de inactividad" en Fase 3 / pendiente del `README.md`).
Para que sean "automáticas" de verdad hace falta un scheduler — no existe infraestructura de cron
en ninguno de los dos repos hoy.

---

## 19. Reportes para terceros — mixto

| Indicador | Estado |
|---|---|
| Número de beneficiarios / emprendimientos apoyados | ✅ ya existe |
| Ventas generadas | ✅ ya existe |
| Sectores beneficiados | ✅ vía `industry_id` |
| Supervivencia de los emprendimientos | 🟡 sección 11 |
| Tasa de graduación, empleos generados, capital levantado, formalización, casos de éxito (cualitativo) | 🔴 secciones 1, 3, 5 |

---

## Resumen — qué construir primero si se quiere avanzar sobre `ideas.md`

**Quick wins (🟡/✅, sin tablas nuevas, extienden rutas que ya existen):**
1. Distribución por sector/industria en el dashboard (`GROUP BY industry_id`) — sección 14.
2. Clientes nuevos / recurrentes / ticket promedio — sección 4, mismo gate `share_financials`.
3. Supervivencia a 6/12 meses — mismo patrón que `reports/trends/route.ts`.
4. "Startup Health Score" v1 (solo financiero + actividad, dejar explícito que es parcial) —
   secciones 9 y 17.
5. Caída de ventas / flujo de caja negativo como alertas adicionales — sección 18.

**Requiere una tabla nueva, chica, contenida (no toca schema de negocio de HiKonta):**
- `org_milestones` — sección 7. Es la pieza de "seguimiento" más barata de construir del doc.
- `cohorts` + `cohort_organizations` — sección 1. Desbloquea 10, 12, 13, 14 completos.

**Requiere subsistema nuevo grande (nueva tabla + nuevo actor + nuevas pantallas):**
- Mentores (`mentors`, asignaciones, evaluaciones) — secciones 6, 8, 16.
- Financiamiento (inversión, deuda, capital, burn rate, runway) — sección 3 (mitad).
- Empleo real (nómina, no `organization_members`) — sección 5.

**No recomendado / redundante:**
- Dashboard del emprendimiento (sección 15) — HiKonta ya se lo muestra en su propia app; construirlo
  aquí duplica UI para el mismo usuario y el mismo dato.

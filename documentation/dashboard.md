# Partner Dashboard - KPIs & Métricas

## Contexto

El incubador necesita **evidence de que sus emprendedores están siendo exitosos con Hikonta**. Los KPIs no son para vanidad, son para que el incubador:

1. Reporte a su directiva/inversores
2. Intervenga proactivamente si algo sale mal
3. Justifique por qué recomienda Hikonta

---

## Panel 1: RESUMEN (5 KPIs principales)

**Propósito:** Vista de 10 segundos para saber qué está pasando con la cohorte

### KPI 1: Tasa de Adopción (%)

```
Métrica: % de emprendedores activos en últimos 30 días
Fórmula: (Emprendedores con login últimos 30 días / Total emprendedores) * 100

Ejemplo:
15 emprendedores totales
12 con actividad últimos 30 días
= 80% adopción

Visualización:
┌──────────────────────┐
│  Adopción Digital    │
│  80%                 │
│  (12 de 15)          │
│  Estado: EXCELENTE ✅ │
└──────────────────────┘

¿Por qué importa al incubador?
- "Mis emprendedores usan herramientas digitales" ← KPI que reportan a directiva
- Pueden comparar mes a mes (30% → 50% → 80%)
- Es métrica de éxito del programa
- Diferencía: "Somos partners de Hikonta, 80% adopción"

Umbral de éxito:
- >70% = EXCELENTE (el programa pega)
- 50-70% = MODERADO (hay oportunidad)
- <50% = NECESITA ATENCIÓN (problema de onboarding/utilidad)
```

---

### KPI 2: Emprendedores Activos vs Inactivos

```
Métrica: Segmentación por actividad

Definiciones:
- ACTIVO: Login en últimos 30 días
- INACTIVO: Sin login en 30-90 días
- DORMANT: Sin login >90 días

Ejemplo:
Total: 15
├─ Activos: 12 ✅
├─ Inactivos: 2 ⚠️
└─ Dormant: 1 🔴

Visualización:
┌────────────────────────────────────┐
│  Emprendedores Activos             │
│  12 / 15 (80%)                     │
│                                    │
│  Inactivos: 2 (sin usar 30+ días) │
│  Dormant: 1 (sin usar 90+ días)   │
└────────────────────────────────────┘

¿Por qué importa?
- Identifica quiénes necesitan intervención
- Incubador sabe a quién hacer follow-up
- Diferencia entre "decidieron no usar" vs "están en pausa"

Acción: Incubador envía mensaje a los 3 inactivos
```

---

### KPI 3: Ingresos Totales Reportados

```
Métrica: Sum de todos los ingresos registrados en Hikonta por la cohorte

Fórmula: SUM(todas_transacciones.monto) WHERE usuario.partnerID = X

Ejemplo:
Juan García: $3,200
María López: $2,150
Carlos Mendez: $1,800
Diego López: $1,850
... (12 más)
= $45,200 total este mes

Visualización:
┌──────────────────────┐
│  Ingresos Totales    │
│  $45,200             │
│  Este mes            │
│  +12% vs mes anterior│
└──────────────────────┘

¿Por qué importa?
- Es DINERO real (suena bien a inversores)
- Valida que Hikonta está en negocios que VENDEN
- Trending: mes 1 = $30k, mes 2 = $38k, mes 3 = $45k
- Responde: "¿Las herramientas que damos realmente funcionan?"

Nota: Es "Ingresos Reportados" no "Ingresos Verificados"
(emprendedor registra en Hikonta, no auditoría)
```

---

### KPI 4: Volumen de Transacciones (este mes)

```
Métrica: Total de movimientos registrados en Hikonta

Fórmula: COUNT(transacciones) WHERE mes = actual

Ejemplo:
Juan: 28 transacciones
María: 0 (inactiva)
Carlos: 45 transacciones
... (12 más)
= 1,240 transacciones totales

Visualización:
┌──────────────────────┐
│  Transacciones       │
│  1,240               │
│  Este mes            │
│  Promedio: 103/pers  │
└──────────────────────┘

¿Por qué importa?
- Volumen = engagement = la plataforma se está usando
- Si baja mes a mes = problema
- Si sube = proof de que pega
- Diferencia entre "usan pasivamente" vs "usan activamente"

Benchmark:
<500: Baja adopción
500-1000: Moderada
>1000: Excelente
```

---

### KPI 5: Emprendedores en Alerta 🚨

```
Métrica: Inactivos >30 días que necesitan intervención

Fórmula: COUNT(usuarios) WHERE 
  - partnerID = X 
  - lastLogin < (HOY - 30 días)
  - createdAt < (HOY - 30 días)  ← no cuentes nuevos sin probar

Ejemplo:
Total: 15
En alerta: 3
├─ María López (sin usar 22 días)
├─ Diego López (sin usar 45 días)
└─ Patricia Ruiz (sin usar 38 días)

Visualización:
┌──────────────────────┐
│  ⚠️ En Alerta        │
│  3 emprendedores     │
│                      │
│  Necesitan seguimiento
└──────────────────────┘

¿Por qué importa?
- Incubador puede actuar ANTES de que fracasen
- Es herramienta de gestión, no métrica de vanidad
- "Veo el problema, intervengo, rescato la inversión"
- ROI del incubador sube

Acción del incubador:
1. Ve que María está inactiva 22 días
2. La llama: "¿Necesitas ayuda con Hikonta?"
3. Descubre: "No entiendo cómo registrar clientes"
4. Le da capacitación → vuelve a usar
```

---

## Panel 2: EMPRENDEDORES (Tabla + Detalle)

**Propósito:** Ver individualmente a cada emprendedor y sus métricas

### Columnas de la tabla (MVP):

```
┌─────────────┬──────────────┬──────────────┬────────────┬──────────┬──────────┬────────┐
│ Negocio     │ Propietario  │ Último login │ Transacciones│ Ingresos │ Tendencia│ Status │
├─────────────┼──────────────┼──────────────┼────────────┼──────────┼──────────┼────────┤
│ El Típico   │ Juan García  │ Hoy 10am     │ 28         │ $3,200   │ +15% ↗   │ ✅     │
│ Moda Hnra   │ María López  │ Hace 22 días │ 0          │ $0       │ -100% ↘  │ ⚠️     │
│ Consultoría │ Carlos M.    │ Ayer 3pm     │ 45         │ $1,800   │ +8% ↗    │ ✅     │
│ Panadería   │ Diego López  │ Hace 45 días │ 0          │ $0       │ N/A      │ 🔴     │
└─────────────┴──────────────┴──────────────┴────────────┴──────────┴──────────┴────────┘
```

### KPIs por emprendedor individual:

#### A. Días Activo (desde que se registró)

```
Métrica: Cuántos días tiene activa la cuenta

Ejemplo:
Juan: 45 días
María: 30 días
Carlos: 15 días (nuevo)

¿Por qué importa?
- Contexto: ¿Es nuevo o ya debería estar usando?
- Si tiene 60 días y solo 1 login = riesgo
- Si tiene 5 días y ya tiene 20 transacciones = promesa
```

#### B. Transacciones Este Mes

```
Métrica: COUNT(transacciones) WHERE mes = actual AND usuario = X

Ejemplo:
Juan: 28 transacciones
María: 0 (inactiva)
Carlos: 45 transacciones

Interpretación:
- 0 transacciones: No está usando o no está vendiendo
- <10: Baja actividad, verificar si hay problema
- 20+: Está usando la plataforma activamente
```

#### C. Ingresos Este Mes

```
Métrica: SUM(ingresos) este mes

Ejemplo:
Juan: $3,200
María: $0
Carlos: $1,800

Importante:
- Correlacionar con transacciones
- Si tiene muchas transacciones pero bajo ingreso = problema de precios
- Si tiene transacciones pero no registra ingresos = evasión de responsabilidades
```

#### D. Tendencia (vs mes anterior)

```
Cálculo: ((Este mes - Mes anterior) / Mes anterior) * 100

Ejemplo:
Juan: 
  - Mes anterior: $2,800
  - Este mes: $3,200
  - Tendencia: +14.3% ↗

María:
  - Mes anterior: $500
  - Este mes: $0
  - Tendencia: -100% ↘

Interpretación:
- ↗ Creciendo = positivo
- → Estable = ok si está en >$2k
- ↘ Bajando = alerta, investigar
```

#### E. Status (derivado)

```
Regla:
- ✅ ACTIVO: Login últimos 30 días + ingresos >$0
- ⚠️ INACTIVO: Sin login 30-90 días O ingresos $0 hace 30+ días
- 🔴 DORMANT: Sin login >90 días

Ejemplo:
Juan: ✅ (Hoy login, $3,200)
María: ⚠️ (Hace 22 días, $0)
Diego: 🔴 (Hace 45 días, $0)
```

---

### Acciones en tabla EMPRENDEDORES:

```
1. Click en fila → Ver detalle individual
   - Gráfico de transacciones por semana
   - Últimas transacciones registradas
   - Histórico de ingresos (12 meses)
   - Contacto del emprendedor (para enviar mensaje)

2. Filtros:
   - Por Status (mostrar solo inactivos)
   - Por rango de ingresos ($0-1k, $1-3k, $3k+)
   - Por rango de transacciones

3. Ordenar:
   - Por ingresos (mayor a menor)
   - Por fecha última actividad
   - Por tendencia (crecimiento ↗)

4. Exportar:
   - Descargar tabla como Excel
   - Llevar a reunión de mentoring
```

---

## Panel 3: ACTIVIDAD (Feed de lo que está pasando)

**Propósito:** Ver el pulso en tiempo real (qué está haciendo cada emprendedor)

### Tipos de eventos a registrar:

```
EVENT TYPE          │ EJEMPLO                              │ IMPORTANCIA
────────────────────┼────────────────────────────────────────┼──────────────
LOGIN               │ Juan García accedió a Hikonta       │ Demostró "están vivos"
TRANSACCION_NUEVA   │ María registró venta de $150        │ Están vendiendo
REPORTE_EXPORTADO   │ Carlos exportó balance mensual      │ Están analizando datos
PERFIL_ACTUALIZADO  │ Diego actualizó info de negocio     │ Engagement
INACTIVIDAD_ALERTA  │ Patricia sin actividad 30 días ⚠️   │ Necesita follow-up

Ejemplo de feed:

HOY 10:30 - Juan García registró $450 en 3 transacciones
HOY 09:15 - María López se conectó (primer login en 22 días)
AYER 14:00 - Carlos Mendez exportó su balance mensual
14 AGO - Diego López registró $200
14 AGO - ⚠️ Patricia Ruiz sin actividad hace 30 días

¿Por qué importa?
- El incubador ve "hay movimiento" sin revisar a cada uno
- Detecta patrones: "Jueves = día de más transacciones"
- Valida que Hikonta está siendo usado (no es abandonware)
```

### Implementación MVP (simple):

```typescript
// Registrar evento cada vez que emprendedor hace algo:

- Login → "userID 5 logged in"
- Nueva transacción → "userID 5 created transaction $150"
- Exportó reporte → "userID 5 exported monthly report"
- Inactivo >30 días → "userID 5 ALERT: inactive 30+ days"

// Mostrar últimos 20 eventos ordenados por fecha DESC

// Filtros:
- Por tipo de evento
- Por emprendedor
- Por rango de fechas
```

---

## Panel 4: REPORTES (Lo que presentan a directiva)

**Propósito:** Métricas que el incubador puede presentar a su junta/inversores

### Reporte 1: Adopción Digital (Trending)

```
Gráfico de líneas: Tasa adopción últimos 3-6 meses

Mes 1 (Junio):  40% (6/15 activos)
Mes 2 (Julio):  60% (9/15 activos)
Mes 3 (Agosto): 80% (12/15 activos)

Mensaje para incubador:
"Nuestro programa ha alcanzado 80% de adopción digital,
mostrando crecimiento consistente en uso de herramientas"

¿Por qué importa?
- Trending up = proof de éxito
- Puede compararse con otros programas
- Es métrica que inversores entienden
```

### Reporte 2: Ingresos Combinados (Trending)

```
Gráfico de barras: Ingresos totales por mes

Mes 1: $22,000
Mes 2: $31,500
Mes 3: $45,200

Mensaje:
"Los emprendedores de nuestro programa generan ingresos
crecientes: $45k en el mes anterior, 45% arriba del mes 1"

¿Por qué importa?
- Valida ROI del programa
- Demuestra que la inversión en herramientas paga
- Es dinero real que el incubador puede cuantificar
```

### Reporte 3: Ingreso Promedio por Emprendedor

```
Métrica: SUM(ingresos) / COUNT(emprendedores_activos)

Ejemplo:
$45,200 / 12 activos = $3,766 promedio/emprendedor

Interpretación:
"Nuestros emprendedores activos generan ~$3,700/mes en promedio"

¿Por qué importa?
- Responde: "¿Mis emprendedores están ganando dinero?"
- Benchmark: Comparar con otro incubador
- Muestra que NO es solo "actividad", es "ingresos reales"
```

### Reporte 4: Retención a 90 días

```
Métrica: % de emprendedores que siguen usando después de 3 meses

Fórmula: COUNT(activos en mes 3) / COUNT(inscritos en mes 1) * 100

Ejemplo:
Mes 1: Se inscriben 15
Mes 3: Siguen 12 activos
= 80% retención

Mensaje:
"8 de cada 10 emprendedores siguen usando Hikonta después
de 3 meses, indicando adoption stickiness"

¿Por qué importa?
- Diferencia entre "probaron" vs "adoptar en serio"
- Es métrica de producto quality
- Inversores quieren ver stickiness
```

### Reporte 5: Benchmarking (si tienes otros partners)

```
Comparativo:
Incubadora    │ Adopción │ Ingresos Prom │ Retención 90d
──────────────┼──────────┼───────────────┼──────────────
Grupo Terra   │ 80%      │ $3,766        │ 80%
(Otra)        │ 60%      │ $2,100        │ 65%
(Otra)        │ 45%      │ $1,500        │ 50%

Mensaje para Grupo Terra:
"Ustedes están 33% arriba del promedio en adopción,
validando la efectividad de su programa"

¿Por qué importa?
- Competencia sana: quieren estar "arriba"
- Motivación para promocionar Hikonta más
- Diferenciación ante otros incubadores
```

---

## 🎯 Los 3 KPIs CRÍTICOS para el lunes

Si el incubador te pregunta: *"¿Qué me van a mostrar?"*, menciona estos 3:

### 1. Tasa de Adopción (%)

```
"Verán qué porcentaje de sus emprendedores está usando Hikonta
activamente cada mes. Es la métrica principal que pueden reportar."

Ejemplo:
┌──────────────────────┐
│  Adopción: 80%       │
│  (12 de 15)          │
│  Meta: >70% ✅       │
└──────────────────────┘
```

### 2. Ingresos Totales Reportados

```
"Verán el total de ingresos que generan sus emprendedores
usando Hikonta. Demuestra que la herramienta está en negocios reales."

Ejemplo:
┌──────────────────────┐
│  Ingresos: $45,200   │
│  Este mes            │
│  +12% vs mes anterior│
└──────────────────────┘
```

### 3. Estado Individual (Activo/Inactivo)

```
"Verán a cada emprendedor con status. Si alguien está inactivo
>30 días, ustedes pueden intervenir antes de que fracase."

Ejemplo:
- Juan García: ✅ ACTIVO (Hoy 10am, $3,200)
- María López: ⚠️ INACTIVO (Hace 22 días, $0)
- Carlos M.: ✅ ACTIVO (Ayer 3pm, $1,800)
```

---

## 📋 Checklist: KPIs por panel

- [ ] **RESUMEN**: Adopción %, Activos/Inactivos, Ingresos totales, Transacciones, En alerta
- [ ] **EMPRENDEDORES**: Tabla con status, últimas métricas, filtros, ordenamiento
- [ ] **ACTIVIDAD**: Feed de login, transacciones, exportes, alertas de inactividad
- [ ] **REPORTES**: Adopción trending, Ingresos trending, Promedio, Retención, Benchmarking

---

## 🎤 Pitch para el lunes

```
"Hikonta les ofrece tres cosas:

1. VISIBILIDAD: Dashboard que muestra qué % de sus emprendedores
   están usando herramientas digitales (métrica que reportan)

2. INGRESOS REALES: Ven cuánto facturan sus emprendedores
   (validación de que la herramienta está en negocios viables)

3. INTERVENCIÓN PROACTIVA: Emprendedores inactivos >30 días
   aparecen como alerta para que ustedes den follow-up

El panel no es vanidad, es herramienta de gestión de su programa."
```

---

## Implementación técnica (Backend)

```typescript
// Endpoints que necesitas:

GET /partners/dashboard
→ Retorna: adopción %, activos/inactivos, ingresos, transacciones, alertas

GET /partners/entrepreneurs
→ Retorna: tabla de emprendedores con columnas

GET /partners/entrepreneurs/:id
→ Retorna: detalle individual (gráficos, histórico)

GET /partners/activity
→ Retorna: feed de eventos ordenado DESC

GET /partners/reports/adoption
→ Retorna: trending adopción (últimos 6 meses)

GET /partners/reports/income
→ Retorna: trending ingresos (últimos 6 meses)

GET /partners/reports/retention
→ Retorna: % retencion a 30/60/90 días
```

---

## Notas finales

- **MVP**: Enfócate en RESUMEN + EMPRENDEDORES (tabla)
- **Fase 2**: Agrega gráficos en REPORTES
- **Fase 3**: Alertas automáticas, benchmarking, integración con CRM del partner
- **NO muestres**: Datos personales del emprendedor (DNI, métodos de pago)
- **SÍ muestras**: Actividad, ingresos, transacciones (lo acordado)
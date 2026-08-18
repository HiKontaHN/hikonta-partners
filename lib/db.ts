import { neon } from "@neondatabase/serverless";

// Cliente único de Neon, compartido por todas las rutas API.
// Apunta a la MISMA base de datos que yelifin-sistema (HiKonta) —
// este proyecto lee/escribe directo sobre organizations, partners,
// partner_organizations y subscription_payments. Ver decisión de
// arquitectura en database/docs/partner-dashboard-architecture.md
// del repo principal.
export const sql = neon(process.env.DATABASE_URL!);

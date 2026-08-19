// Generación de códigos de invitación (ver database/partners/04-invite-codes.sql
// en yelifin-sistema — este repo comparte esa misma tabla, mismo DATABASE_URL
// que el resto del panel). El canje vive del lado de yelifin-sistema
// (lib/partner-invites.ts): acá SOLO se generan y se listan/revocan.

// Charset sin caracteres ambiguos al escribir a mano o dictar por teléfono
// (sin 0/O, 1/I/L).
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;

export function generateInviteCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

export const INVITE_CODE_DEFAULT_EXPIRY_DAYS = 30;

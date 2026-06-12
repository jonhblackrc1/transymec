// ============================================================
//  Configuración de Supabase (autenticación)
// ------------------------------------------------------------
//  Reemplaza estos dos valores con los de tu proyecto Supabase:
//    Project Settings -> Data API / API Keys
//
//  NOTA DE SEGURIDAD: la "anon key" (clave pública) está DISEÑADA
//  para ir en el frontend y ser visible. NO es un secreto. La
//  seguridad real la dan las "Row Level Security policies" del
//  proyecto, no esconder esta clave.
// ============================================================

window.SUPABASE_CONFIG = {
  url: "https://TU_PROYECTO.supabase.co",
  anonKey: "TU_ANON_KEY",
};

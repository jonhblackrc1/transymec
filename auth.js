// ============================================================
//  Lógica de autenticación compartida (Supabase Auth)
// ============================================================

const cfg = window.SUPABASE_CONFIG || {};
const isConfigured =
  cfg.url &&
  cfg.anonKey &&
  !cfg.url.includes("TU_PROYECTO") &&
  !cfg.anonKey.includes("TU_ANON_KEY");

// Cliente de Supabase (la librería global se llama "supabase")
const sb = isConfigured
  ? window.supabase.createClient(cfg.url, cfg.anonKey)
  : null;

// ---------- Página de LOGIN ----------
function initLogin() {
  const form = document.getElementById("loginForm");
  if (!form) return;

  const msg = document.getElementById("loginMsg");
  const btn = form.querySelector('button[type="submit"]');

  // Si ya hay sesión activa, ir directo al panel.
  if (sb) {
    sb.auth.getSession().then(({ data }) => {
      if (data.session) location.replace("admin.html");
    });
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const usuario = form.usuario.value.trim();
    const password = form.password.value;

    if (!usuario || !password) {
      showMsg(msg, "Ingresa usuario y contraseña.", true);
      return;
    }

    if (!sb) {
      showMsg(
        msg,
        "El login aún no está configurado (falta conectar Supabase).",
        true
      );
      return;
    }

    // Permitimos escribir solo "root": lo completamos al dominio interno.
    const email = usuario.includes("@") ? usuario : `${usuario}@transymec.cl`;

    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Ingresando...";
    showMsg(msg, "");

    const { error } = await sb.auth.signInWithPassword({ email, password });

    if (error) {
      // Mensaje genérico a propósito: no revelar si el usuario existe.
      showMsg(msg, "Usuario o contraseña incorrectos.", true);
      btn.disabled = false;
      btn.textContent = original;
      return;
    }

    location.replace("admin.html");
  });
}

// ---------- Guardia del PANEL (admin) ----------
async function guardAdmin() {
  if (!sb) {
    location.replace("login.html");
    return;
  }
  const { data } = await sb.auth.getSession();
  if (!data.session) {
    location.replace("login.html");
    return;
  }

  // Mostrar el email del usuario conectado.
  const who = document.getElementById("whoami");
  if (who) who.textContent = data.session.user.email;

  // Botón de cerrar sesión.
  const logout = document.getElementById("logoutBtn");
  if (logout) {
    logout.addEventListener("click", async () => {
      await sb.auth.signOut();
      location.replace("login.html");
    });
  }

  // Revelar el contenido del panel (estaba oculto hasta validar sesión).
  document.body.classList.add("auth-ready");
}

function showMsg(el, text, isError) {
  if (!el) return;
  el.textContent = text;
  el.style.color = isError ? "#c0392b" : "";
}

// Punto de entrada según la página.
document.addEventListener("DOMContentLoaded", () => {
  if (document.body.dataset.page === "login") initLogin();
  if (document.body.dataset.page === "admin") guardAdmin();
});

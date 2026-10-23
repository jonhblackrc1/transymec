// ============================================================
//  Ingreso al sistema (admin y conductores)
//  Usa la capa de datos del CRM (js/crm-data.js) y redirige
//  según el rol: admin → admin.html · conductor → conductor.html
// ============================================================
(function () {
  const destino = (perfil) => (perfil.rol === "admin" ? "admin.html" : "conductor.html");

  function showMsg(el, text, isError) {
    if (!el) return;
    el.textContent = text;
    el.style.color = isError ? "#c0392b" : "";
  }

  function initLogin() {
    const form = document.getElementById("loginForm");
    if (!form || !window.CRM) return;
    const msg = document.getElementById("loginMsg");
    const btn = form.querySelector('button[type="submit"]');

    // Si ya hay sesión activa, ir directo a su panel.
    window.CRM.auth.current().then((p) => { if (p) location.replace(destino(p)); }).catch(() => {});

    // En modo demostración, mostrar los accesos de prueba.
    const info = document.getElementById("demoInfo");
    if (info && window.CRM.DEMO_INFO) {
      const d = window.CRM.DEMO_INFO;
      info.innerHTML = `<strong>Modo demostración</strong> (datos de ejemplo en este navegador)<br>
        Admin: <code>${d.admin}</code><br>Conductor: <code>${d.conductor}</code><br>
        Pasajero: <a href="viaje.html?c=TX-DEMO24">${d.pasajero}</a>`;
      info.hidden = false;
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const usuario = form.usuario.value.trim();
      const password = form.password.value;
      if (!usuario || !password) { showMsg(msg, "Ingresa usuario y contraseña.", true); return; }

      const original = btn.textContent;
      btn.disabled = true;
      btn.textContent = "Ingresando...";
      showMsg(msg, "");
      try {
        const perfil = await window.CRM.auth.login(usuario, password);
        location.replace(destino(perfil));
      } catch (err) {
        showMsg(msg, err.message || "Usuario o contraseña incorrectos.", true);
        btn.disabled = false;
        btn.textContent = original;
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (document.body.dataset.page === "login") initLogin();
  });
})();

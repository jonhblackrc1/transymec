// =====================================================================
//  TRANSYMEC · CRM — utilidades de interfaz compartidas
// =====================================================================
(function () {
  "use strict";

  const TZ = "America/Santiago";

  const ESTADOS = {
    pendiente:  { label: "Pendiente",  desc: "Por confirmar" },
    confirmado: { label: "Confirmado", desc: "Listo para salir" },
    en_curso:   { label: "En curso",   desc: "En ruta" },
    finalizado: { label: "Finalizado", desc: "Completado" },
    cancelado:  { label: "Cancelado",  desc: "Cancelado" },
  };

  const SERVICIOS = ["Traslado de personal", "Turismo y excursiones", "Transfer aeropuerto",
    "Gira de estudios", "Paseo de curso", "Evento / matrimonio", "Viaje especial", "Arriendo de bus"];

  const TIPOS_EVENTO = {
    nota:      "Nota",
    estado:    "Estado",
    llegada:   "En punto de encuentro",
    abordaje:  "Abordaje",
    ubicacion: "Ubicación",
    retraso:   "Retraso",
    incidencia:"Incidencia",
  };

  // ---------- Íconos (trazos simples, 24x24) ----------
  const ICONS = {
    panel: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    viajes: '<path d="M4 16V7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v9"/><path d="M4 11h16"/><path d="M4 16h16v2a1 1 0 0 1-1 1h-1M6 19H5a1 1 0 0 1-1-1v-2"/><circle cx="8" cy="19" r="1.6"/><circle cx="16" cy="19" r="1.6"/>',
    agenda: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    clientes: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/>',
    conductores: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5"/><path d="M12 3v6.5M4.5 15.5l5.3-2.3M19.5 15.5l-5.3-2.3"/>',
    flota: '<path d="M3 17V8a2 2 0 0 1 2-2h11l4 5v6"/><path d="M3 12h17"/><circle cx="7.5" cy="17.5" r="2"/><circle cx="16.5" cy="17.5" r="2"/>',
    salir: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 17l-5-5 5-5M5 12h11"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    cerrar: '<path d="M6 6l12 12M18 6L6 18"/>',
    pin: '<path d="M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
    reloj: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    tel: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
    whatsapp: '<path d="M20.5 11.6a8.5 8.5 0 0 1-12.5 7.5L3.5 20.5l1.4-4.3A8.5 8.5 0 1 1 20.5 11.6z"/><path d="M9 8.8c.3 2.6 2.6 5 5.2 5.4l1-1.4 2 .9c-.3 1.4-1.4 2-2.8 1.9-3.3-.5-6.1-3.3-6.5-6.6 0-1.4.6-2.4 2-2.7l.9 2-1.4 1z"/>',
    copiar: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
    imprimir: '<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>',
    editar: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/>',
    basura: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    llave: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M14 9l2 2"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
    alerta: '<path d="M12 3l9.5 17h-19L12 3z"/><path d="M12 10v4M12 17.5v.01"/>',
    buscar: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
    flecha: '<path d="M15 18l-6-6 6-6"/>',
    descargar: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    ruta: '<circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M8.5 18H15a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h6.5"/>',
    usuario: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    play: '<path d="M7 4.5v15l12-7.5-12-7.5z"/>',
    stop: '<rect x="5" y="5" width="14" height="14" rx="2"/>',
    refrescar: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
  };
  const icon = (name, cls) =>
    `<svg class="ico ${cls || ""}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ""}</svg>`;

  // ---------- Texto y formato ----------
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const fmt = (iso, opts) => iso ? new Intl.DateTimeFormat("es-CL", Object.assign({ timeZone: TZ }, opts)).format(new Date(iso)) : "—";
  const fecha = (iso) => fmt(iso, { weekday: "short", day: "numeric", month: "short" });
  const fechaLarga = (iso) => fmt(iso, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const hora = (iso) => fmt(iso, { hour: "2-digit", minute: "2-digit", hour12: false });
  const fechaHora = (iso) => iso ? `${fecha(iso)} · ${hora(iso)}` : "—";
  const fechaCorta = (d) => d ? new Intl.DateTimeFormat("es-CL", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }).format(new Date(d + "T00:00:00Z")) : "—";
  const diaKey = (iso) => fmt(iso, { year: "numeric", month: "2-digit", day: "2-digit" }); // dd-mm-aaaa en Chile

  function relativo(iso) {
    const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return "hace un momento";
    if (s < 3600) return `hace ${Math.round(s / 60)} min`;
    if (s < 86400) return `hace ${Math.round(s / 3600)} h`;
    return fechaHora(iso);
  }

  // Días hasta una fecha (aaaa-mm-dd). Negativo = vencida.
  function diasHasta(d) {
    if (!d) return null;
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    return Math.round((new Date(d + "T00:00:00") - hoy) / 86400000);
  }

  // <input type="datetime-local"> <-> ISO
  function toLocalInput(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  }
  const fromLocalInput = (v) => (v ? new Date(v).toISOString() : null);

  const telLimpio = (t) => String(t || "").replace(/[^\d+]/g, "");
  const waLink = (tel, texto) => {
    const n = telLimpio(tel).replace(/^\+/, "");
    return `https://wa.me/${n}${texto ? "?text=" + encodeURIComponent(texto) : ""}`;
  };
  const mapsLink = (q) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
  const mapsRuta = (o, d) => `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(o)}&destination=${encodeURIComponent(d)}`;
  const mapsPunto = (lat, lng) => `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

  const badge = (estado) => `<span class="badge badge--${esc(estado)}">${esc((ESTADOS[estado] || {}).label || estado)}</span>`;
  const portalUrl = (codigo) => new URL(`viaje.html?c=${encodeURIComponent(codigo)}`, location.href).href;

  // Fin estimado de un viaje (para detectar choques de horario).
  const finViaje = (v) => v.regreso ? new Date(v.regreso) : new Date(new Date(v.salida).getTime() + 4 * 3600000);

  // ---------- Avisos ----------
  function toast(msg, tipo) {
    let box = document.getElementById("toasts");
    if (!box) { box = document.createElement("div"); box.id = "toasts"; box.setAttribute("role", "status"); document.body.appendChild(box); }
    const t = document.createElement("div");
    t.className = "toast" + (tipo ? " toast--" + tipo : "");
    t.textContent = msg;
    box.appendChild(t);
    setTimeout(() => t.classList.add("out"), 3200);
    setTimeout(() => t.remove(), 3600);
  }
  const fallo = (e) => { console.error(e); toast(e && e.message ? e.message : String(e), "error"); };

  // ---------- Ventana modal ----------
  function modal({ titulo, cuerpo, acciones, ancho, onOpen }) {
    const dlg = document.createElement("dialog");
    dlg.className = "modal" + (ancho ? " modal--" + ancho : "");
    dlg.innerHTML = `
      <div class="modal__head"><h2>${esc(titulo)}</h2>
        <button class="icon-btn" data-close aria-label="Cerrar">${icon("cerrar")}</button></div>
      <div class="modal__body">${cuerpo}</div>
      ${acciones ? `<div class="modal__foot">${acciones}</div>` : ""}`;
    document.body.appendChild(dlg);
    const cerrar = () => { dlg.close(); };
    dlg.addEventListener("close", () => dlg.remove());
    dlg.addEventListener("click", (e) => {
      if (e.target === dlg || e.target.closest("[data-close]")) cerrar();
    });
    dlg.showModal();
    if (onOpen) onOpen(dlg, cerrar);
    const first = dlg.querySelector("input:not([type=hidden]),select,textarea");
    if (first && window.matchMedia("(pointer:fine)").matches) first.focus();
    return { dlg, cerrar };
  }

  function confirmar(texto, { ok = "Confirmar", peligro = false } = {}) {
    return new Promise((resolve) => {
      let res = false;
      const { dlg } = modal({
        titulo: "Confirmar", cuerpo: `<p>${esc(texto)}</p>`,
        acciones: `<button class="btn btn--ghost" data-close>Cancelar</button>
                   <button class="btn ${peligro ? "btn--danger" : "btn--primary"}" data-ok>${esc(ok)}</button>`,
      });
      dlg.querySelector("[data-ok]").addEventListener("click", () => { res = true; dlg.close(); });
      dlg.addEventListener("close", () => resolve(res));
    });
  }

  // Lee un <form> como objeto (respeta checkboxes y números).
  function formData(form) {
    const o = {};
    form.querySelectorAll("[name]").forEach((el) => {
      if (el.type === "checkbox") o[el.name] = el.checked;
      else if (el.type === "number") o[el.name] = el.value === "" ? null : Number(el.value);
      else if (el.type === "datetime-local") o[el.name] = fromLocalInput(el.value);
      else o[el.name] = el.value.trim();
    });
    return o;
  }

  async function copiar(texto, aviso) {
    try { await navigator.clipboard.writeText(texto); toast(aviso || "Copiado"); }
    catch (e) {
      const ta = document.createElement("textarea"); ta.value = texto; document.body.appendChild(ta);
      ta.select(); document.execCommand("copy"); ta.remove(); toast(aviso || "Copiado");
    }
  }

  // Ubicación del dispositivo (opcional; no bloquea si se rechaza).
  function ubicacion(timeout = 8000) {
    return new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: +p.coords.latitude.toFixed(5), lng: +p.coords.longitude.toFixed(5) }),
        () => resolve(null), { enableHighAccuracy: true, timeout, maximumAge: 60000 });
    });
  }

  function botonCargando(btn, cargando, texto) {
    if (!btn) return;
    if (cargando) { btn.dataset.txt = btn.innerHTML; btn.disabled = true; btn.innerHTML = `<span class="spin"></span>${texto ? " " + esc(texto) : ""}`; }
    else { btn.disabled = false; if (btn.dataset.txt) btn.innerHTML = btn.dataset.txt; }
  }

  function bannerDemo(container) {
    if (!window.CRM || window.CRM.mode !== "demo" || !container) return;
    container.innerHTML = `<div class="demo-banner">${icon("alerta")}<span><strong>Modo demostración.</strong>
      Los datos son de ejemplo y se guardan solo en este navegador. Conecta Supabase para usar datos reales.</span>
      <button class="link-btn" id="resetDemo">Restablecer datos</button></div>`;
    container.querySelector("#resetDemo").addEventListener("click", async () => {
      if (await confirmar("¿Volver a los datos de ejemplo? Se perderán los cambios hechos en la demostración.", { ok: "Restablecer" })) {
        window.CRM.resetDemo(); location.reload();
      }
    });
  }

  // Protege una página: exige sesión con el rol indicado.
  async function exigirSesion(rol) {
    let p = null;
    try { p = await window.CRM.auth.current(); } catch (e) { p = null; }
    if (!p) { location.replace("login.html"); return null; }
    if (rol && p.rol !== rol) { location.replace(p.rol === "admin" ? "admin.html" : "conductor.html"); return null; }
    return p;
  }

  window.UI = {
    ESTADOS, SERVICIOS, TIPOS_EVENTO, icon, esc, fecha, fechaLarga, hora, fechaHora, fechaCorta, diaKey,
    relativo, diasHasta, toLocalInput, fromLocalInput, telLimpio, waLink, mapsLink, mapsRuta, mapsPunto,
    badge, portalUrl, finViaje, toast, fallo, modal, confirmar, formData, copiar, ubicacion,
    botonCargando, bannerDemo, exigirSesion,
  };
})();

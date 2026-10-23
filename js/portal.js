// =====================================================================
//  TRANSYMEC · Portal del pasajero (sin cuenta: link + clave)
// =====================================================================
(function () {
  "use strict";
  const { icon, esc, fechaLarga, hora, fechaHora, diaKey, relativo, telLimpio, mapsLink, mapsRuta, mapsPunto,
    waLink, toast, fallo, confirmar, botonCargando } = window.UI;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const EMPRESA_TEL = "+56944373789";
  const KEY = "transymec_portal";
  let cred = null, data = null, timer = null;

  const guardar = (c) => { try { sessionStorage.setItem(KEY, JSON.stringify(c)); } catch (e) { /* */ } };
  const leer = () => { try { return JSON.parse(sessionStorage.getItem(KEY)); } catch (e) { return null; } };
  const olvidar = () => { try { sessionStorage.removeItem(KEY); } catch (e) { /* */ } };

  function init() {
    const codigo = (new URLSearchParams(location.search).get("c") || "").toUpperCase();
    const prev = leer();
    if (prev && (!codigo || prev.codigo === codigo)) { cred = prev; cargar(true); }
    else acceso(codigo);
  }

  // ---------- Pantalla de acceso ----------
  function acceso(codigo, error) {
    clearInterval(timer);
    $("#hero").innerHTML = `<div class="eyebrow">Seguimiento de viaje</div>
      <h1>Revisa el estado de tu viaje</h1>
      <p>Ingresa el código y la clave que te entregamos al confirmar tu viaje.</p>`;
    const demo = window.CRM.DEMO_INFO;
    $("#portal").innerHTML = `<div class="card card__pad login-card">
      <form class="form" id="fAcceso" novalidate>
        <div class="field"><label for="cod">Código del viaje</label>
          <input id="cod" class="code-input" autocomplete="off" autocapitalize="characters" placeholder="TX-XXXXXX" value="${esc(codigo || "")}" required /></div>
        <div class="field"><label for="clave">Clave de acceso</label>
          <input id="clave" class="code-input" autocomplete="off" autocapitalize="characters" placeholder="6 caracteres" required /></div>
        ${error ? `<div class="notice notice--bad">${esc(error)}</div>` : ""}
        <button class="btn btn--primary btn--lg btn--block" type="submit">Ver mi viaje</button>
        <p class="small muted" style="text-align:center">¿No tienes tu clave? <a target="_blank" rel="noopener" href="${esc(waLink(EMPRESA_TEL, "Hola TRANSYMEC, necesito la clave de acceso de mi viaje" + (codigo ? " " + codigo : "") + "."))}">Escríbenos por WhatsApp</a></p>
        ${demo ? `<div class="notice notice--warn small">Modo demostración: usa <strong>TX-DEMO24</strong> y clave <strong>DEMO24</strong>.</div>` : ""}
      </form></div>`;
    const f = $("#fAcceso");
    (codigo ? $("#clave") : $("#cod")).focus();
    f.addEventListener("submit", (e) => {
      e.preventDefault();
      const c = $("#cod").value.trim().toUpperCase();
      const k = $("#clave").value.trim().toUpperCase();
      if (!c || !k) return toast("Ingresa el código y la clave.", "error");
      cred = { codigo: c.startsWith("TX-") ? c : "TX-" + c.replace(/^TX/, ""), clave: k };
      botonCargando(f.querySelector("button[type=submit]"), true, "Verificando");
      cargar(false);
    });
  }

  async function cargar(silencioso) {
    try {
      data = await window.CRM.portal.ver(cred.codigo, cred.clave);
      guardar(cred);
      const url = new URL(location.href);
      if (url.searchParams.get("c") !== cred.codigo) { url.searchParams.set("c", cred.codigo); history.replaceState(null, "", url); }
      pintar();
      programarRefresco();
    } catch (e) {
      olvidar();
      if (silencioso && /conexión/i.test(e.message)) return toast(e.message, "error");
      acceso(cred && cred.codigo, e.message);
    }
  }

  function programarRefresco() {
    clearInterval(timer);
    const v = data.viaje;
    const cerca = Math.abs(new Date(v.salida) - Date.now()) < 6 * 3600000;
    if (v.estado === "en_curso" || (cerca && v.estado === "confirmado")) {
      timer = setInterval(async () => {
        if (document.hidden) return;
        try { data = await window.CRM.portal.ver(cred.codigo, cred.clave); pintar(); } catch (e) { /* reintenta en el próximo ciclo */ }
      }, 60000);
    }
  }

  // ---------- Vista del viaje ----------
  const PASOS = [["pendiente", "Reservado"], ["confirmado", "Confirmado"], ["en_curso", "En ruta"], ["finalizado", "Finalizado"]];
  const TITULOS = {
    pendiente: "Tu viaje está reservado y en proceso de confirmación.",
    confirmado: "Tu viaje está confirmado.",
    en_curso: "Tu viaje está en curso.",
    finalizado: "Tu viaje finalizó. ¡Gracias por viajar con nosotros!",
    cancelado: "Este viaje fue cancelado.",
  };

  function pintar() {
    const { viaje: v, conductor, vehiculo, eventos, pasajeros, cliente } = data;
    const idx = PASOS.findIndex(([k]) => k === v.estado);
    const editable = ["pendiente", "confirmado"].includes(v.estado);
    const encuentro = v.punto_encuentro || v.origen;
    const esHoy = diaKey(v.salida) === diaKey(new Date().toISOString());
    const llego = eventos.find((e) => e.tipo === "llegada");

    $("#hero").innerHTML = `<div class="eyebrow">Tu viaje · ${esc(v.codigo)}</div>
      <h1>${esc(v.origen)} → ${esc(v.destino)}</h1>
      <p>${esc(TITULOS[v.estado])}${cliente && (cliente.empresa || cliente.nombre) ? ` · ${esc(cliente.empresa || cliente.nombre)}` : ""}</p>`;

    $("#portal").innerHTML = `
      <div class="card">
        ${v.estado === "cancelado" ? `<div class="card__pad"><div class="notice notice--bad">Este viaje fue cancelado. Si tienes dudas, contáctanos.</div></div>`
          : `<div class="steps">${PASOS.map(([k, l], i) => `<div class="step ${i < idx ? "done" : i === idx ? (k === "finalizado" ? "done" : "now") : ""}"><i></i>${l}</div>`).join("")}</div>`}
        <div class="card__pad" style="border-top:1px solid var(--line)">
          <div class="small muted">${esHoy ? "Hoy" : "Salida"}</div>
          <div class="big-time"><strong>${hora(v.salida)}</strong><span>${esc(fechaLarga(v.salida))}</span></div>
          ${v.regreso ? `<div class="small muted" style="margin-top:2px">Regreso / término estimado: ${esc(fechaHora(v.regreso))}</div>` : ""}
          ${v.estado === "en_curso" ? `<div style="margin-top:10px" class="live">Se actualiza automáticamente</div>` : ""}
          ${llego && v.estado === "confirmado" ? `<div class="notice" style="margin-top:12px">${icon("check")} El bus ya está en el punto de encuentro (${esc(relativo(llego.created_at))}).</div>` : ""}
        </div>
      </div>

      ${v.estado === "en_curso" && v.ultima_lat != null ? `<div class="card card__pad" style="display:flex;gap:14px;align-items:center">
        <span style="color:var(--run)">${icon("pin")}</span>
        <div style="flex:1"><strong>Última ubicación del bus</strong><div class="small muted">Reportada ${esc(relativo(v.ultima_ubicacion_at))}</div></div>
        <a class="btn btn--primary btn--sm" target="_blank" rel="noopener" href="${esc(mapsPunto(v.ultima_lat, v.ultima_lng))}">Ver mapa</a></div>` : ""}

      <div class="card">
        <ul class="info-list">
          <li>${icon("pin")}<div style="flex:1"><div class="lbl">Punto de encuentro</div><div class="val">${esc(encuentro)}</div>
            <div class="small" style="margin-top:4px"><a target="_blank" rel="noopener" href="${esc(mapsLink(encuentro))}">Cómo llegar</a></div></div></li>
          <li>${icon("ruta")}<div style="flex:1"><div class="lbl">Destino</div><div class="val">${esc(v.destino)}</div>
            ${v.paradas ? `<div class="small muted">${esc(v.paradas)}</div>` : ""}
            <div class="small" style="margin-top:4px"><a target="_blank" rel="noopener" href="${esc(mapsRuta(encuentro, v.destino))}">Ver ruta</a></div></div></li>
          ${vehiculo ? `<li>${icon("flota")}<div><div class="lbl">Tu bus</div><div class="val" style="font-size:1.15rem;letter-spacing:.06em"><strong>${esc(vehiculo.patente)}</strong></div>
            <div class="small muted">${esc(vehiculo.tipo)}${vehiculo.marca_modelo ? " · " + esc(vehiculo.marca_modelo) : ""} · ${vehiculo.capacidad} asientos</div></div></li>` : ""}
          ${conductor ? `<li>${icon("conductores")}<div style="flex:1"><div class="lbl">Conductor</div><div class="val">${esc(conductor.nombre)}</div>
            ${conductor.telefono && ["confirmado", "en_curso"].includes(v.estado) ? `<div style="margin-top:8px"><a class="btn btn--ghost btn--sm" href="tel:${esc(telLimpio(conductor.telefono))}">${icon("tel")} Llamar al conductor</a></div>` : ""}</div></li>` : ""}
          ${!vehiculo && !conductor && v.estado !== "cancelado" ? `<li>${icon("reloj")}<div><div class="lbl">Bus y conductor</div><div class="val">Te informaremos aquí cuando estén asignados.</div></div></li>` : ""}
        </ul>
      </div>

      ${v.instrucciones ? `<div class="card card__pad"><div class="label" style="margin-bottom:6px">Indicaciones para tu viaje</div><p>${esc(v.instrucciones)}</p></div>` : ""}

      <div class="card">
        <div class="card__head"><h3>Novedades</h3></div>
        ${eventos.length ? `<ul class="timeline">${eventos.map((e) => `<li class="t-${esc(e.tipo)}"><div class="t-msg">${esc(e.mensaje)}</div>
          <div class="t-meta"><span>${esc(fechaHora(e.created_at))}</span>${e.lat != null && v.estado === "en_curso" ? `<a target="_blank" rel="noopener" href="${esc(mapsPunto(e.lat, e.lng))}">Ver ubicación</a>` : ""}</div></li>`).join("")}</ul>`
          : `<div class="empty small">Aquí verás los avisos del conductor y de TRANSYMEC.</div>`}
      </div>

      <div class="card">
        <div class="card__head"><h3>Nómina de pasajeros</h3><div class="right"><span class="small muted">${pasajeros.length}${v.pasajeros_estimados ? ` de ${v.pasajeros_estimados}` : ""}</span></div></div>
        ${editable ? `<form id="fPax" class="card__pad" style="display:grid;gap:10px;border-bottom:1px solid var(--line)">
          <p class="small muted">Agrega a cada persona que viaja. Es obligatorio para los viajes especiales y nos ayuda a confirmar el abordaje.</p>
          <input class="input" name="nombre" placeholder="Nombre completo *" required />
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <input class="input" name="documento" placeholder="RUT o pasaporte" />
            <input class="input" name="telefono" type="tel" placeholder="Teléfono" />
          </div>
          <button class="btn btn--primary">${icon("plus")} Agregar pasajero</button>
        </form>` : ""}
        ${pasajeros.length ? `<ul class="pax">${pasajeros.map((p, i) => `<li><span class="pax__n">${i + 1}</span><span class="pax__name">${esc(p.nombre)}</span>
          ${p.abordo ? `<span class="tag tag--ok">A bordo</span>` : ""}
          ${editable && p.origen === "portal" ? `<button class="icon-btn" data-del="${esc(p.id)}" title="Quitar" aria-label="Quitar a ${esc(p.nombre)}">${icon("basura")}</button>` : ""}</li>`).join("")}</ul>`
          : `<div class="empty small">Todavía no hay pasajeros en la nómina.</div>`}
      </div>

      <div class="card card__pad" style="display:flex;flex-direction:column;gap:10px">
        <strong>¿Necesitas ayuda?</strong>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <a class="btn btn--wa" target="_blank" rel="noopener" href="${esc(waLink(EMPRESA_TEL, `Hola TRANSYMEC, les escribo por mi viaje ${v.codigo}.`))}">${icon("whatsapp")} WhatsApp TRANSYMEC</a>
          <a class="btn btn--ghost" href="tel:${EMPRESA_TEL}">${icon("tel")} Llamar</a>
        </div>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
        <span class="small muted">Actualizado ${esc(hora(new Date().toISOString()))}</span>
        <div style="display:flex;gap:8px">
          <button class="btn btn--ghost btn--sm" id="refrescar">${icon("refrescar")} Actualizar</button>
          <button class="btn btn--ghost btn--sm" id="salir">Salir</button>
        </div>
      </div>`;

    $("#refrescar").addEventListener("click", async (e) => { botonCargando(e.currentTarget, true); await cargar(true); });
    $("#salir").addEventListener("click", () => { olvidar(); clearInterval(timer); acceso(cred.codigo); });
    const f = $("#fPax");
    if (f) f.addEventListener("submit", async (e) => {
      e.preventDefault();
      const p = { nombre: f.nombre.value.trim(), documento: f.documento.value.trim(), telefono: f.telefono.value.trim() };
      if (!p.nombre) return toast("Escribe el nombre del pasajero.", "error");
      botonCargando(f.querySelector("button"), true);
      try { await window.CRM.portal.agregarPasajero(cred.codigo, cred.clave, p); toast(`${p.nombre} agregado`); await cargar(true); $("#fPax") && $("#fPax").nombre.focus(); }
      catch (err) { fallo(err); botonCargando(f.querySelector("button"), false); }
    });
    $$("[data-del]").forEach((b) => b.addEventListener("click", async () => {
      const p = pasajeros.find((x) => x.id === b.dataset.del);
      if (!(await confirmar(`¿Quitar a ${p.nombre} de la nómina?`, { ok: "Quitar", peligro: true }))) return;
      try { await window.CRM.portal.quitarPasajero(cred.codigo, cred.clave, p.id); await cargar(true); } catch (err) { fallo(err); }
    }));
  }

  init();
})();

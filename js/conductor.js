// =====================================================================
//  TRANSYMEC · CRM — vista del conductor (pensada para el celular)
// =====================================================================
(function () {
  "use strict";
  const { icon, esc, badge, fecha, fechaLarga, hora, fechaHora, diaKey, relativo, telLimpio, waLink, mapsLink,
    mapsRuta, mapsPunto, finViaje, toast, fallo, modal, confirmar, ubicacion, botonCargando, TIPOS_EVENTO } = window.UI;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const S = { me: null, viajes: [], tab: "hoy" };

  async function init() {
    S.me = await window.UI.exigirSesion("conductor");
    if (!S.me) return;
    $("#meName").textContent = S.me.nombre;
    $("#logout").innerHTML = icon("salir");
    $("#logout").addEventListener("click", async () => { await window.CRM.auth.logout(); location.replace("login.html"); });
    window.UI.bannerDemo($("#demoSlot"));
    await cargar();
    $("#boot").hidden = true;
    $("#app").hidden = false;
    window.addEventListener("hashchange", route);
    route();
  }

  async function cargar() {
    try { S.viajes = await window.CRM.viajes.list(); } catch (e) { fallo(e); }
  }

  function route() {
    const m = location.hash.match(/^#\/viaje\/(.+)$/);
    window.scrollTo(0, 0);
    if (m) detalle(m[1]); else lista();
  }

  // ---------- Lista ----------
  function lista() {
    const hoy = diaKey(new Date().toISOString());
    const ahora = Date.now();
    const grupos = {
      hoy: S.viajes.filter((v) => v.estado === "en_curso" || (diaKey(v.salida) === hoy && v.estado !== "cancelado")),
      proximos: S.viajes.filter((v) => ["pendiente", "confirmado"].includes(v.estado) && diaKey(v.salida) !== hoy && new Date(v.salida) > ahora),
      historial: S.viajes.filter((v) => ["finalizado", "cancelado"].includes(v.estado) || (finViaje(v) < ahora - 86400000 && v.estado !== "en_curso" && diaKey(v.salida) !== hoy)).reverse(),
    };
    const etiquetas = { hoy: "Hoy", proximos: "Próximos", historial: "Historial" };
    const lst = grupos[S.tab];
    $("#view").innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;margin:6px 0 4px">
        <h1 style="font-size:1.3rem;color:var(--navy)">Hola, ${esc(S.me.nombre.split(" ")[0])}</h1>
        <button class="icon-btn" id="refresh" style="margin-left:auto" title="Actualizar" aria-label="Actualizar">${icon("refrescar")}</button>
      </div>
      <p class="muted small" style="margin-bottom:10px">${esc(fechaLarga(new Date().toISOString()))}</p>
      <div class="tabs" role="tablist">${Object.keys(etiquetas).map((k) => `<button role="tab" data-t="${k}" class="${S.tab === k ? "on" : ""}">${etiquetas[k]}${grupos[k].length ? ` · ${grupos[k].length}` : ""}</button>`).join("")}</div>
      ${lst.length ? lst.map(tarjeta).join("") : `<div class="card"><div class="empty">${icon("agenda")}<div>${S.tab === "hoy" ? "No tienes viajes para hoy." : S.tab === "proximos" ? "No tienes viajes próximos asignados." : "Aún no hay viajes en tu historial."}</div></div></div>`}`;
    $$("[data-t]").forEach((b) => b.addEventListener("click", () => { S.tab = b.dataset.t; lista(); }));
    $("#refresh").addEventListener("click", async () => { await cargar(); lista(); toast("Actualizado"); });
  }

  function tarjeta(v) {
    const hoy = diaKey(v.salida) === diaKey(new Date().toISOString());
    return `<a class="card d-card" href="#/viaje/${esc(v.id)}">
      <div class="d-card__top"><span class="d-card__when">${hoy ? "Hoy" : esc(fecha(v.salida))} · ${hora(v.salida)}</span><span style="margin-left:auto">${badge(v.estado)}</span></div>
      <div class="d-card__route">${esc(v.origen)} → ${esc(v.destino)}</div>
      <div class="d-card__meta">
        <span>${icon("pin", "")} ${esc(v.punto_encuentro || v.origen)}</span>
        ${v.vehiculo ? `<span>${esc(v.vehiculo.patente)}</span>` : ""}
        ${v.pasajeros_estimados ? `<span>${v.pasajeros_estimados} pasajeros</span>` : ""}
      </div></a>`;
  }

  // ---------- Detalle ----------
  async function detalle(id) {
    let v = S.viajes.find((x) => x.id === id);
    if (!v) { await cargar(); v = S.viajes.find((x) => x.id === id); }
    if (!v) { $("#view").innerHTML = `<a class="back" href="#/">${icon("flecha")} Mis viajes</a><div class="card"><div class="empty">Este viaje no existe o ya no está asignado a ti.</div></div>`; return; }
    let pax = [], evs = [];
    try { [pax, evs] = await Promise.all([window.CRM.pasajeros.list(id), window.CRM.eventos.list(id)]); } catch (e) { fallo(e); }
    if (!location.hash.endsWith(id)) return;
    const abordo = pax.filter((p) => p.abordo).length;
    const operable = ["confirmado", "en_curso"].includes(v.estado);
    const encuentro = v.punto_encuentro || v.origen;

    $("#view").innerHTML = `
      <a class="back" href="#/">${icon("flecha")} Mis viajes</a>
      <div class="card card__pad">
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">${badge(v.estado)}<span class="trip-hero__code">${esc(v.codigo)}</span><span class="tag">${esc(v.servicio)}</span></div>
        <div class="big-time" style="margin-top:10px"><strong>${hora(v.salida)}</strong><span class="muted">${esc(fechaLarga(v.salida))}</span></div>
        <div class="d-card__route" style="margin-top:4px">${esc(v.origen)} → ${esc(v.destino)}</div>
        ${v.regreso ? `<div class="small muted" style="margin-top:4px">Término estimado: ${esc(fechaHora(v.regreso))}</div>` : ""}
      </div>

      <div class="action-bar">
        ${v.estado === "pendiente" ? `<div class="notice notice--warn">Este viaje aún está pendiente de confirmación por administración.</div>` : ""}
        ${v.estado === "confirmado" ? `<button class="btn btn--ok btn--lg btn--block" id="iniciar">${icon("play")} Iniciar viaje</button>` : ""}
        ${v.estado === "en_curso" ? `<button class="btn btn--primary btn--lg btn--block" id="finalizar">${icon("stop")} Finalizar viaje</button>` : ""}
        ${v.estado === "cancelado" ? `<div class="notice notice--bad">Este viaje fue cancelado.</div>` : ""}
        ${operable ? `<div class="quick">
          <button data-ev="llegada">${icon("pin")} Llegué al punto de encuentro</button>
          <button data-ev="ubicacion">${icon("ruta")} Compartir ubicación</button>
          <button data-ev="retraso">${icon("reloj")} Reportar retraso</button>
          <button data-ev="incidencia">${icon("alerta")} Reportar incidencia</button>
        </div>` : ""}
      </div>

      <div class="card" style="margin-bottom:14px">
        <ul class="info-list">
          <li>${icon("pin")}<div style="flex:1"><div class="lbl">Punto de encuentro</div><div class="val">${esc(encuentro)}</div>
            <div class="small" style="margin-top:4px"><a target="_blank" rel="noopener" href="${esc(mapsLink(encuentro))}">Abrir en Maps</a> · <a target="_blank" rel="noopener" href="${esc(mapsRuta(encuentro, v.destino))}">Ruta al destino</a></div></div></li>
          ${v.paradas ? `<li>${icon("ruta")}<div><div class="lbl">Paradas / itinerario</div><div class="val">${esc(v.paradas)}</div></div></li>` : ""}
          ${v.cliente ? `<li>${icon("usuario")}<div style="flex:1"><div class="lbl">Contacto del grupo</div><div class="val">${esc(v.cliente.nombre)}${v.cliente.empresa ? " · " + esc(v.cliente.empresa) : ""}</div>
            ${v.cliente.telefono ? `<div style="display:flex;gap:8px;margin-top:8px"><a class="btn btn--ghost btn--sm" href="tel:${esc(telLimpio(v.cliente.telefono))}">${icon("tel")} Llamar</a><a class="btn btn--wa btn--sm" target="_blank" rel="noopener" href="${esc(waLink(v.cliente.telefono, `Hola ${v.cliente.nombre.split(" ")[0]}, soy ${S.me.nombre}, conductor de TRANSYMEC para su viaje de hoy.`))}">${icon("whatsapp")} WhatsApp</a></div>` : ""}</div></li>` : ""}
          ${v.vehiculo ? `<li>${icon("flota")}<div><div class="lbl">Bus asignado</div><div class="val">${esc(v.vehiculo.patente)} · ${esc(v.vehiculo.tipo)}</div><div class="small muted">${v.vehiculo.capacidad} asientos</div></div></li>` : ""}
          ${v.instrucciones ? `<li>${icon("alerta")}<div><div class="lbl">Instrucciones del viaje</div><div class="val">${esc(v.instrucciones)}</div></div></li>` : ""}
          ${v.notas_internas ? `<li>${icon("editar")}<div><div class="lbl">Notas de administración</div><div class="val">${esc(v.notas_internas)}</div></div></li>` : ""}
        </ul>
      </div>

      <div class="card" style="margin-bottom:14px">
        <div class="card__head"><h3>Pasajeros</h3><div class="right"><span class="small"><strong>${abordo}</strong> de ${pax.length} a bordo</span></div></div>
        ${pax.length ? `<div style="padding:12px 18px 0"><div class="progress"><span style="width:${Math.round(abordo / pax.length * 100)}%"></span></div></div>
          <ul class="pax pax-check" id="paxList">${pax.map((p, i) => `<li data-id="${esc(p.id)}" class="${p.abordo ? "on" : ""}" ${operable ? `role="checkbox" aria-checked="${p.abordo}" tabindex="0"` : ""}>
            <span class="box">${icon("check")}</span><span class="pax__name"><strong>${esc(p.nombre)}</strong>${p.documento ? `<small>${esc(p.documento)}</small>` : ""}</span><span class="pax__n">${i + 1}</span></li>`).join("")}</ul>
          ${operable ? `<p class="small muted" style="padding:10px 18px 14px">Toca un nombre para marcar que subió al bus.</p>` : ""}`
          : `<div class="empty small">No hay nómina cargada para este viaje.</div>`}
      </div>

      <div class="card">
        <div class="card__head"><h3>Bitácora</h3></div>
        ${evs.length ? `<ul class="timeline">${evs.map((e) => `<li class="t-${esc(e.tipo)}"><div class="t-msg">${esc(e.mensaje)}</div>
          <div class="t-meta"><span>${esc(fechaHora(e.created_at))}</span>${e.autor_nombre ? `<span>${esc(e.autor_nombre)}</span>` : ""}${e.lat != null ? `<a target="_blank" rel="noopener" href="${esc(mapsPunto(e.lat, e.lng))}">Ubicación</a>` : ""}</div></li>`).join("")}</ul>`
          : `<div class="empty small">Sin novedades todavía.</div>`}
      </div>`;

    const iniciar = $("#iniciar"), finalizar = $("#finalizar");
    if (iniciar) iniciar.addEventListener("click", () => cambiar(v, "en_curso", iniciar, pax));
    if (finalizar) finalizar.addEventListener("click", () => cambiar(v, "finalizado", finalizar, pax));
    $$("[data-ev]").forEach((b) => b.addEventListener("click", () => reportar(v, b.dataset.ev, b)));
    const pl = $("#paxList");
    if (pl && operable) {
      const toggle = async (li) => {
        const on = !li.classList.contains("on");
        li.classList.toggle("on", on); li.setAttribute("aria-checked", on);
        try { await window.CRM.pasajeros.abordo(li.dataset.id, on); actualizarConteo(); }
        catch (e) { li.classList.toggle("on", !on); fallo(e); }
      };
      pl.addEventListener("click", (e) => { const li = e.target.closest("li[data-id]"); if (li) toggle(li); });
      pl.addEventListener("keydown", (e) => { const li = e.target.closest("li[data-id]"); if (li && (e.key === " " || e.key === "Enter")) { e.preventDefault(); toggle(li); } });
    }
  }

  function actualizarConteo() {
    const all = $$("#paxList li"), on = $$("#paxList li.on");
    const head = $("#paxList").closest(".card").querySelector(".right .small");
    head.innerHTML = `<strong>${on.length}</strong> de ${all.length} a bordo`;
    const bar = $("#paxList").closest(".card").querySelector(".progress span");
    if (bar) bar.style.width = Math.round(on.length / all.length * 100) + "%";
  }

  async function cambiar(v, estado, btn, pax) {
    // Lee el conteo actual de la pantalla (puede haber cambiado desde que se abrió el viaje).
    const abordo = $("#paxList") ? $$("#paxList li.on").length : pax.filter((p) => p.abordo).length;
    const txt = estado === "en_curso"
      ? `¿Iniciar el viaje ahora?${pax.length ? ` Hay ${abordo} de ${pax.length} pasajeros marcados a bordo.` : ""} El pasajero verá que el viaje comenzó.`
      : "¿Finalizar el viaje? Confirma que todos los pasajeros llegaron a destino.";
    if (!(await confirmar(txt, { ok: estado === "en_curso" ? "Iniciar viaje" : "Finalizar viaje" }))) return;
    botonCargando(btn, true, "Obteniendo ubicación…");
    const pos = await ubicacion(6000);
    try {
      const nota = estado === "en_curso" && pax.length ? `${abordo} ${abordo === 1 ? "pasajero" : "pasajeros"} a bordo` : "";
      await window.CRM.viajes.cambiarEstado(v.id, estado, nota, pos && pos.lat, pos && pos.lng);
      toast(estado === "en_curso" ? "Viaje iniciado. ¡Buen viaje!" : "Viaje finalizado. ¡Gracias!");
      await cargar(); detalle(v.id);
    } catch (e) { fallo(e); botonCargando(btn, false); }
  }

  function reportar(v, tipo, btn) {
    if (tipo === "llegada" || tipo === "ubicacion") {
      (async () => {
        botonCargando(btn, true);
        const pos = await ubicacion();
        if (tipo === "ubicacion" && !pos) { botonCargando(btn, false); return toast("No se pudo obtener tu ubicación. Revisa los permisos del GPS.", "error"); }
        try {
          await window.CRM.eventos.add({ viaje_id: v.id, tipo, publico: true, lat: pos && pos.lat, lng: pos && pos.lng,
            mensaje: tipo === "llegada" ? "El bus llegó al punto de encuentro" : "Ubicación actualizada" });
          toast(tipo === "llegada" ? "Aviso enviado al pasajero" : "Ubicación compartida");
          await cargar(); detalle(v.id);
        } catch (e) { fallo(e); botonCargando(btn, false); }
      })();
      return;
    }
    const titulo = tipo === "retraso" ? "Reportar retraso" : "Reportar incidencia";
    const sugerencias = tipo === "retraso" ? ["Tráfico en la ruta", "Esperando pasajeros", "Desvío por obras", "Control policial"]
      : ["Falla mecánica", "Pasajero con malestar", "Accidente menor", "Neumático pinchado"];
    const { dlg, cerrar } = modal({
      titulo,
      cuerpo: `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">${sugerencias.map((s) => `<button type="button" class="btn btn--ghost btn--sm" data-s="${esc(s)}">${esc(s)}</button>`).join("")}</div>
        <div class="field"><label for="rmsg">Detalle</label><textarea id="rmsg" class="input" rows="3" placeholder="${tipo === "retraso" ? "Ej: llegamos con 15 minutos de retraso" : "Describe lo que pasó"}"></textarea></div>
        <label class="check" style="margin-top:10px"><input type="checkbox" id="rpub" ${tipo === "retraso" ? "checked" : ""} /> Avisar también al pasajero</label>`,
      acciones: `<button class="btn btn--ghost" data-close>Cancelar</button><button class="btn btn--primary" id="enviar">Enviar</button>`,
    });
    $$("[data-s]", dlg).forEach((b) => b.addEventListener("click", () => { $("#rmsg", dlg).value = b.dataset.s; }));
    $("#enviar", dlg).addEventListener("click", async (e) => {
      const mensaje = $("#rmsg", dlg).value.trim();
      if (!mensaje) return toast("Escribe el detalle.", "error");
      botonCargando(e.currentTarget, true);
      const pos = await ubicacion(5000);
      try {
        await window.CRM.eventos.add({ viaje_id: v.id, tipo, mensaje: `${TIPOS_EVENTO[tipo]}: ${mensaje}`,
          publico: $("#rpub", dlg).checked, lat: pos && pos.lat, lng: pos && pos.lng });
        cerrar(); toast("Reporte enviado"); await cargar(); detalle(v.id);
      } catch (err) { fallo(err); botonCargando(e.currentTarget, false); }
    });
  }

  init();
})();

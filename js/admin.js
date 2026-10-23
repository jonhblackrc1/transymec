// =====================================================================
//  TRANSYMEC · CRM — vista de administración
// =====================================================================
(function () {
  "use strict";
  const { icon, esc, badge, fecha, fechaLarga, hora, fechaHora, fechaCorta, diaKey, relativo, diasHasta,
    toLocalInput, waLink, mapsRuta, mapsPunto, portalUrl, finViaje, toast, fallo, modal, confirmar,
    formData, copiar, botonCargando, ESTADOS, SERVICIOS, TIPOS_EVENTO } = window.UI;

  const S = { me: null, viajes: [], clientes: [], vehiculos: [], usuarios: [], filtroViajes: "proximos", busqueda: "", agendaConductor: "" };
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const view = () => $("#view");

  const NAV = [
    ["panel", "Panel", "panel"],
    ["viajes", "Viajes", "viajes"],
    ["agenda", "Agenda", "agenda"],
    ["clientes", "Clientes", "clientes"],
    ["conductores", "Conductores", "conductores"],
    ["flota", "Flota", "flota"],
  ];

  // ---------------------------------------------------------------
  //  Arranque
  // ---------------------------------------------------------------
  async function init() {
    S.me = await window.UI.exigirSesion("admin");
    if (!S.me) return;
    $("#meName").textContent = S.me.nombre || S.me.usuario;
    $("#meAvatar").textContent = iniciales(S.me.nombre || S.me.usuario);
    $("#logout").innerHTML = icon("salir");
    $("#menuBtn").innerHTML = icon("menu");
    $("#logout").addEventListener("click", async () => { await window.CRM.auth.logout(); location.replace("login.html"); });
    $("#menuBtn").addEventListener("click", () => $("#shell").classList.toggle("nav-open"));
    $("#side").addEventListener("click", (e) => { if (e.target.closest("a")) $("#shell").classList.remove("nav-open"); });
    document.addEventListener("click", (e) => {
      const sh = $("#shell");
      if (sh.classList.contains("nav-open") && !e.target.closest("#side") && !e.target.closest("#menuBtn")) sh.classList.remove("nav-open");
    });
    window.UI.bannerDemo($("#demoSlot"));
    try { await recargar(); } catch (e) { fallo(e); }
    $("#boot").hidden = true;
    $("#shell").hidden = false;
    window.addEventListener("hashchange", route);
    route();
  }

  async function recargar() {
    const [v, c, ve, u] = await Promise.all([window.CRM.viajes.list(), window.CRM.clientes.list(),
      window.CRM.vehiculos.list(), window.CRM.usuarios.list()]);
    S.viajes = v; S.clientes = c; S.vehiculos = ve; S.usuarios = u;
  }

  const conductores = () => S.usuarios.filter((u) => u.rol === "conductor" && u.activo);
  const iniciales = (n) => String(n || "?").split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
  const ruta = (v) => `${v.origen} → ${v.destino}`;
  const activo = (v) => !["finalizado", "cancelado"].includes(v.estado);
  const sinAsignar = (v) => activo(v) && v.estado !== "en_curso" && (!v.conductor_id || !v.vehiculo_id);
  const hoyKey = () => diaKey(new Date().toISOString());

  // Viajes que chocan en horario con el mismo conductor o bus.
  function choques(v, lista) {
    if (!activo(v)) return [];
    const ini = new Date(v.salida), fin = finViaje(v);
    return (lista || S.viajes).filter((o) => o.id !== v.id && activo(o) &&
      ((v.conductor_id && o.conductor_id === v.conductor_id) || (v.vehiculo_id && o.vehiculo_id === v.vehiculo_id)) &&
      new Date(o.salida) < fin && finViaje(o) > ini);
  }

  // ---------------------------------------------------------------
  //  Router
  // ---------------------------------------------------------------
  function route() {
    const [, seccion, id] = (location.hash || "#/panel").split("/");
    const sec = seccion || "panel";
    $("#sideNav").innerHTML = NAV.map(([k, label, ic]) => {
      const n = k === "viajes" ? S.viajes.filter((v) => v.estado === "en_curso").length : 0;
      const on = sec === k || (sec === "viaje" && k === "viajes");
      return `<a class="side__link ${on ? "active" : ""}" href="#/${k}">${icon(ic)}<span>${label}</span>${n ? `<span class="side__count" title="En curso">${n}</span>` : ""}</a>`;
    }).join("");
    $("#actions").innerHTML = "";
    window.scrollTo(0, 0);
    const views = { panel: vPanel, viajes: vViajes, viaje: () => vViaje(id), agenda: vAgenda,
      clientes: vClientes, conductores: vConductores, flota: vFlota };
    (views[sec] || vPanel)();
  }

  function setHeader(titulo, acciones) {
    $("#title").textContent = titulo;
    document.title = `${titulo} · CRM Transymec`;
    $("#actions").innerHTML = acciones || "";
  }
  const btnNuevoViaje = `<button class="btn btn--primary" data-act="nuevo-viaje">${icon("plus")}<span>Nuevo viaje</span></button>`;
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-act='nuevo-viaje']");
    if (b) formViaje();
  });

  // ---------------------------------------------------------------
  //  Componentes
  // ---------------------------------------------------------------
  function filaViaje(v, opts) {
    const o = opts || {};
    const falta = [];
    if (activo(v) && v.estado !== "en_curso") {
      if (!v.conductor_id) falta.push("sin conductor");
      if (!v.vehiculo_id) falta.push("sin bus");
    }
    const ch = choques(v);
    return `<a class="trip-row" href="#/viaje/${esc(v.id)}">
      <div class="trip-row__time">${hora(v.salida)}<small>${o.conFecha ? fecha(v.salida) : esc(v.codigo)}</small></div>
      <div class="trip-row__main">
        <div class="trip-row__route">${esc(ruta(v))}</div>
        <div class="trip-row__meta">
          <span>${esc(v.cliente ? (v.cliente.empresa || v.cliente.nombre) : "Sin cliente")}</span>
          <span>${esc(v.conductor ? v.conductor.nombre : "")}${v.vehiculo ? " · " + esc(v.vehiculo.patente) : ""}</span>
          ${falta.length ? `<span class="warn">${esc(falta.join(" · "))}</span>` : ""}
          ${ch.length ? `<span class="warn">choque de horario</span>` : ""}
        </div>
      </div>
      <div>${badge(v.estado)}</div>
    </a>`;
  }

  const vacio = (texto, ic) => `<div class="empty">${icon(ic || "viajes")}<div>${esc(texto)}</div></div>`;
  const tagVence = (d) => {
    const n = diasHasta(d);
    if (n === null) return `<span class="muted">—</span>`;
    const cls = n < 0 ? "tag--bad" : n <= 30 ? "tag--warn" : "tag--ok";
    const txt = n < 0 ? `Vencida hace ${-n} d` : n === 0 ? "Vence hoy" : n <= 30 ? `Vence en ${n} d` : fechaCorta(d);
    return `<span class="tag ${cls}" title="${esc(fechaCorta(d))}">${esc(txt)}</span>`;
  };

  // ---------------------------------------------------------------
  //  Panel
  // ---------------------------------------------------------------
  function vPanel() {
    setHeader("Panel", btnNuevoViaje);
    const hoy = hoyKey();
    const manana = diaKey(new Date(Date.now() + 86400000).toISOString());
    const ahora = Date.now();
    const en7 = ahora + 7 * 86400000;
    const vHoy = S.viajes.filter((v) => diaKey(v.salida) === hoy && v.estado !== "cancelado");
    const enCurso = S.viajes.filter((v) => v.estado === "en_curso");
    const pend = S.viajes.filter((v) => v.estado === "pendiente" && new Date(v.salida) > ahora - 86400000);
    const prox = S.viajes.filter((v) => activo(v) && new Date(v.salida) >= ahora && new Date(v.salida) <= en7);
    const sinAs = S.viajes.filter((v) => sinAsignar(v) && new Date(v.salida) > ahora - 3600000);
    const proximos2 = S.viajes.filter((v) => [hoy, manana].includes(diaKey(v.salida)) && v.estado !== "cancelado");

    // Alertas
    const alertas = [];
    sinAs.forEach((v) => alertas.push({ nivel: "warn", href: `#/viaje/${v.id}`,
      txt: `<strong>${esc(v.codigo)}</strong> (${esc(fecha(v.salida))}) no tiene ${!v.conductor_id && !v.vehiculo_id ? "conductor ni bus" : !v.conductor_id ? "conductor" : "bus"} asignado.` }));
    const vistos = new Set();
    S.viajes.forEach((v) => {
      if (new Date(v.salida) < ahora - 86400000) return;
      choques(v).forEach((o) => {
        const k = [v.id, o.id].sort().join();
        if (vistos.has(k)) return; vistos.add(k);
        alertas.push({ nivel: "bad", href: `#/viaje/${v.id}`, txt: `Choque de horario entre <strong>${esc(v.codigo)}</strong> y <strong>${esc(o.codigo)}</strong> (mismo conductor o bus).` });
      });
    });
    S.vehiculos.forEach((x) => {
      [["revision_tecnica_vence", "Revisión técnica"], ["seguro_vence", "Seguro"]].forEach(([k, label]) => {
        const n = diasHasta(x[k]);
        if (n !== null && n <= 30) alertas.push({ nivel: n < 0 ? "bad" : "warn", href: "#/flota",
          txt: `${label} del bus <strong>${esc(x.patente)}</strong> ${n < 0 ? "vencida" : n === 0 ? "vence hoy" : `vence en ${n} días`}.` });
      });
    });
    conductores().forEach((u) => {
      const n = diasHasta(u.licencia_vence);
      if (n !== null && n <= 30) alertas.push({ nivel: n < 0 ? "bad" : "warn", href: "#/conductores",
        txt: `Licencia de <strong>${esc(u.nombre)}</strong> ${n < 0 ? "vencida" : `vence en ${n} días`}.` });
    });

    view().innerHTML = `
      <div class="grid grid--kpi">
        <a class="card kpi" href="#/agenda"><div class="kpi__label">Salidas hoy</div><div class="kpi__value">${vHoy.length}</div><div class="kpi__hint">${esc(fechaLarga(new Date().toISOString()))}</div></a>
        <a class="card kpi" href="#/viajes" data-f="en_curso"><div class="kpi__label">En curso ahora</div><div class="kpi__value">${enCurso.length}</div><div class="kpi__hint">Viajes en ruta</div></a>
        <a class="card kpi ${pend.length ? "kpi--alert" : ""}" href="#/viajes" data-f="pendientes"><div class="kpi__label">Por confirmar</div><div class="kpi__value">${pend.length}</div><div class="kpi__hint">Pendientes del cliente</div></a>
        <a class="card kpi" href="#/viajes" data-f="proximos"><div class="kpi__label">Próximos 7 días</div><div class="kpi__value">${prox.length}</div><div class="kpi__hint">${sinAs.length ? `${sinAs.length} sin asignar` : "Todos asignados"}</div></a>
      </div>
      <div class="grid grid--2" style="margin-top:16px">
        <div class="card">
          <div class="card__head"><h2>Hoy y mañana</h2><div class="right"><a href="#/agenda" class="small">Ver agenda</a></div></div>
          ${proximos2.length ? proximos2.map((v) => filaViaje(v, { conFecha: true })).join("") : vacio("No hay salidas programadas para hoy ni mañana.", "agenda")}
        </div>
        <div class="stack">
          <div class="card">
            <div class="card__head"><h2>Alertas</h2><div class="right">${alertas.length ? `<span class="tag tag--warn">${alertas.length}</span>` : ""}</div></div>
            ${alertas.length ? alertas.map((a) => `<a class="alert-row ${a.nivel === "bad" ? "alert-row--bad" : ""}" href="${a.href}" style="color:inherit">${icon("alerta")}<span>${a.txt}</span></a>`).join("")
              : vacio("Todo en orden. No hay alertas.", "check")}
          </div>
          ${enCurso.length ? `<div class="card"><div class="card__head"><h2>En ruta</h2></div>
            ${enCurso.map((v) => `<a class="alert-row" href="#/viaje/${esc(v.id)}" style="color:inherit">${icon("ruta")}
              <span><strong>${esc(v.codigo)}</strong> · ${esc(v.conductor ? v.conductor.nombre : "")}<br>
              <span class="small muted">${esc(ruta(v))}${v.ultima_ubicacion_at ? " · ubicación " + esc(relativo(v.ultima_ubicacion_at)) : ""}</span></span></a>`).join("")}</div>` : ""}
        </div>
      </div>`;
    $$("[data-f]").forEach((a) => a.addEventListener("click", () => { S.filtroViajes = a.dataset.f; }));
  }

  // ---------------------------------------------------------------
  //  Viajes
  // ---------------------------------------------------------------
  const FILTROS = {
    proximos: ["Próximos", (v) => v.estado === "en_curso" || (activo(v) && finViaje(v) >= Date.now() - 3600000)],
    hoy: ["Hoy", (v) => diaKey(v.salida) === hoyKey()],
    en_curso: ["En curso", (v) => v.estado === "en_curso"],
    pendientes: ["Por confirmar", (v) => v.estado === "pendiente"],
    sin_asignar: ["Sin asignar", sinAsignar],
    historial: ["Historial", (v) => !activo(v)],
    todos: ["Todos", () => true],
  };

  function vViajes() {
    setHeader("Viajes", `<button class="btn btn--ghost" id="csv">${icon("descargar")}<span>Exportar</span></button>${btnNuevoViaje}`);
    view().innerHTML = `<div class="card">
      <div class="toolbar">
        <div class="search">${icon("buscar")}<input type="search" id="q" placeholder="Buscar por código, cliente, destino, conductor…" value="${esc(S.busqueda)}" /></div>
        <div class="seg" id="seg">${Object.entries(FILTROS).map(([k, [l]]) => `<button data-k="${k}" class="${S.filtroViajes === k ? "on" : ""}">${l}</button>`).join("")}</div>
      </div>
      <div class="table-wrap"><table class="tbl"><thead><tr>
        <th>Salida</th><th>Código</th><th>Ruta</th><th class="hide-sm">Cliente</th><th class="hide-sm">Conductor / bus</th><th class="hide-sm">Pax</th><th>Estado</th>
      </tr></thead><tbody id="rows"></tbody></table></div>
    </div>`;
    const pintar = () => {
      const q = S.busqueda.toLowerCase();
      let lista = S.viajes.filter(FILTROS[S.filtroViajes][1]);
      if (q) lista = lista.filter((v) => [v.codigo, v.origen, v.destino, v.servicio, v.cliente && v.cliente.nombre,
        v.cliente && v.cliente.empresa, v.conductor && v.conductor.nombre, v.vehiculo && v.vehiculo.patente]
        .join(" ").toLowerCase().includes(q));
      if (S.filtroViajes === "historial") lista = lista.slice().reverse();
      S._lista = lista;
      $("#rows").innerHTML = lista.length ? lista.map((v) => `<tr class="click" data-id="${esc(v.id)}">
        <td class="nowrap"><span class="strong">${esc(fecha(v.salida))}</span><br><span class="muted small">${hora(v.salida)}${v.regreso ? "–" + hora(v.regreso) : ""}</span></td>
        <td class="nowrap"><span class="trip-hero__code">${esc(v.codigo)}</span></td>
        <td><span class="strong">${esc(ruta(v))}</span><br><span class="muted small">${esc(v.servicio)}</span></td>
        <td class="hide-sm">${esc(v.cliente ? v.cliente.nombre : "—")}${v.cliente && v.cliente.empresa ? `<br><span class="muted small">${esc(v.cliente.empresa)}</span>` : ""}</td>
        <td class="hide-sm">${v.conductor ? esc(v.conductor.nombre) : `<span class="tag tag--warn">Sin conductor</span>`}<br>
          ${v.vehiculo ? `<span class="muted small">${esc(v.vehiculo.patente)} · ${esc(v.vehiculo.tipo)}</span>` : `<span class="tag tag--warn">Sin bus</span>`}</td>
        <td class="hide-sm">${v.pasajeros_estimados ?? "—"}</td>
        <td>${badge(v.estado)}${choques(v).length ? `<br><span class="tag tag--bad" style="margin-top:4px">Choque</span>` : ""}</td>
      </tr>`).join("") : `<tr><td colspan="7">${vacio("No hay viajes que coincidan con el filtro.")}</td></tr>`;
    };
    pintar();
    $("#q").addEventListener("input", (e) => { S.busqueda = e.target.value; pintar(); });
    $("#seg").addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      S.filtroViajes = b.dataset.k;
      $$("#seg button").forEach((x) => x.classList.toggle("on", x === b));
      pintar();
    });
    $("#rows").addEventListener("click", (e) => {
      const tr = e.target.closest("tr[data-id]"); if (tr) location.hash = `#/viaje/${tr.dataset.id}`;
    });
    $("#csv").addEventListener("click", () => exportarCSV(S._lista || []));
  }

  function exportarCSV(lista) {
    const cols = [["Código", (v) => v.codigo], ["Estado", (v) => ESTADOS[v.estado].label], ["Servicio", (v) => v.servicio],
      ["Salida", (v) => fechaHora(v.salida)], ["Regreso", (v) => v.regreso ? fechaHora(v.regreso) : ""],
      ["Origen", (v) => v.origen], ["Destino", (v) => v.destino], ["Punto de encuentro", (v) => v.punto_encuentro],
      ["Cliente", (v) => v.cliente ? v.cliente.nombre : ""], ["Empresa", (v) => v.cliente ? v.cliente.empresa : ""],
      ["Conductor", (v) => v.conductor ? v.conductor.nombre : ""], ["Bus", (v) => v.vehiculo ? v.vehiculo.patente : ""],
      ["Pasajeros", (v) => v.pasajeros_estimados ?? ""]];
    const cell = (x) => `"${String(x ?? "").replace(/"/g, '""')}"`;
    const csv = "﻿" + [cols.map((c) => cell(c[0])).join(";"), ...lista.map((v) => cols.map((c) => cell(c[1](v))).join(";"))].join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `viajes-transymec-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  // ---------- Formulario de viaje ----------
  function formViaje(v) {
    const x = v || { estado: "pendiente", servicio: SERVICIOS[0] };
    const opt = (val, label, sel) => `<option value="${esc(val)}" ${sel ? "selected" : ""}>${esc(label)}</option>`;
    const { dlg, cerrar } = modal({
      titulo: v ? `Editar viaje ${v.codigo}` : "Nuevo viaje", ancho: "lg",
      cuerpo: `<form class="form" id="fv" novalidate>
        <h3>Cliente y servicio</h3>
        <div class="field"><label for="f-cli">Cliente</label>
          <select id="f-cli" name="cliente_id">${opt("", "— Sin cliente —")}${S.clientes.map((c) => opt(c.id, c.empresa ? `${c.nombre} · ${c.empresa}` : c.nombre, c.id === x.cliente_id)).join("")}${opt("__nuevo", "+ Crear cliente nuevo")}</select></div>
        <div class="field"><label for="f-srv">Servicio</label>
          <select id="f-srv" name="servicio">${[...new Set([...SERVICIOS, x.servicio])].map((s) => opt(s, s, s === x.servicio)).join("")}</select></div>
        <div class="full form" id="nuevoCli" hidden style="background:var(--bg);padding:14px;border-radius:12px">
          <div class="field"><label for="nc-n">Nombre del cliente *</label><input id="nc-n" data-nc="nombre" /></div>
          <div class="field"><label for="nc-e">Empresa / institución</label><input id="nc-e" data-nc="empresa" /></div>
          <div class="field"><label for="nc-t">Teléfono</label><input id="nc-t" data-nc="telefono" type="tel" placeholder="+56 9 …" /></div>
          <div class="field"><label for="nc-m">Correo</label><input id="nc-m" data-nc="email" type="email" /></div>
        </div>
        <h3>Ruta y horario</h3>
        <div class="field"><label for="f-o">Origen *</label><input id="f-o" name="origen" required value="${esc(x.origen)}" placeholder="Ej: Metro Los Héroes, Santiago" /></div>
        <div class="field"><label for="f-d">Destino *</label><input id="f-d" name="destino" required value="${esc(x.destino)}" placeholder="Ej: Viña del Mar" /></div>
        <div class="field full"><label for="f-pe">Punto de encuentro</label><input id="f-pe" name="punto_encuentro" value="${esc(x.punto_encuentro)}" placeholder="Dirección exacta donde suben los pasajeros" /></div>
        <div class="field"><label for="f-s">Salida *</label><input id="f-s" name="salida" type="datetime-local" required value="${esc(toLocalInput(x.salida))}" /></div>
        <div class="field"><label for="f-r">Regreso / término</label><input id="f-r" name="regreso" type="datetime-local" value="${esc(toLocalInput(x.regreso))}" /></div>
        <div class="field full"><label for="f-p">Paradas o itinerario</label><input id="f-p" name="paradas" value="${esc(x.paradas)}" placeholder="Opcional" /></div>
        <h3>Asignación</h3>
        <div class="field"><label for="f-c">Conductor</label>
          <select id="f-c" name="conductor_id">${opt("", "— Sin asignar —")}${conductores().map((u) => opt(u.id, u.nombre, u.id === x.conductor_id)).join("")}</select></div>
        <div class="field"><label for="f-v">Bus</label>
          <select id="f-v" name="vehiculo_id">${opt("", "— Sin asignar —")}${S.vehiculos.map((b) => opt(b.id, `${b.patente} · ${b.tipo} (${b.capacidad} pax)${b.estado !== "disponible" ? " — " + (b.estado === "mantencion" ? "en mantención" : "fuera de servicio") : ""}`, b.id === x.vehiculo_id)).join("")}</select></div>
        <div class="field"><label for="f-pax">Pasajeros estimados</label><input id="f-pax" name="pasajeros_estimados" type="number" min="1" max="200" value="${esc(x.pasajeros_estimados ?? "")}" /></div>
        <div class="field"><label for="f-e">Estado</label>
          <select id="f-e" name="estado">${Object.entries(ESTADOS).map(([k, e]) => opt(k, e.label, k === x.estado)).join("")}</select></div>
        <div class="full" id="avisos"></div>
        <h3>Información</h3>
        <div class="field full"><label for="f-i">Instrucciones para el pasajero</label><textarea id="f-i" name="instrucciones" placeholder="Las verá el pasajero en su portal. Ej: llegar 15 minutos antes, llevar cédula…">${esc(x.instrucciones)}</textarea></div>
        <div class="field full"><label for="f-n">Notas internas</label><textarea id="f-n" name="notas_internas" placeholder="Solo las ven el administrador y el conductor.">${esc(x.notas_internas)}</textarea></div>
      </form>`,
      acciones: `<button class="btn btn--ghost" data-close>Cancelar</button><button class="btn btn--primary" id="guardar">${v ? "Guardar cambios" : "Crear viaje"}</button>`,
    });
    const f = $("#fv", dlg);
    const revisar = () => {
      const d = formData(f);
      const avisos = [];
      if (d.salida && d.regreso && new Date(d.regreso) <= new Date(d.salida)) avisos.push(["bad", "El regreso debe ser posterior a la salida."]);
      if (d.salida) {
        const tmp = Object.assign({}, d, { id: x.id });
        choques(tmp).forEach((o) => avisos.push(["bad", `Choca con ${o.codigo} (${fechaHora(o.salida)}): ${o.conductor_id === d.conductor_id ? "mismo conductor" : "mismo bus"}.`]));
      }
      const bus = S.vehiculos.find((b) => b.id === d.vehiculo_id);
      if (bus && d.pasajeros_estimados && d.pasajeros_estimados > bus.capacidad) avisos.push(["warn", `El bus ${bus.patente} tiene ${bus.capacidad} asientos y hay ${d.pasajeros_estimados} pasajeros.`]);
      if (bus && bus.estado !== "disponible") avisos.push(["warn", `El bus ${bus.patente} está ${bus.estado === "mantencion" ? "en mantención" : "fuera de servicio"}.`]);
      const cond = S.usuarios.find((u) => u.id === d.conductor_id);
      if (cond && d.salida && cond.licencia_vence && new Date(cond.licencia_vence) < new Date(d.salida)) avisos.push(["warn", `La licencia de ${cond.nombre} vence antes de este viaje.`]);
      if (bus && d.salida && bus.revision_tecnica_vence && new Date(bus.revision_tecnica_vence) < new Date(d.salida)) avisos.push(["warn", `La revisión técnica del bus ${bus.patente} vence antes de este viaje.`]);
      $("#avisos", dlg).innerHTML = avisos.map(([n, t]) => `<div class="notice ${n === "bad" ? "notice--bad" : "notice--warn"}" style="margin-bottom:6px">${esc(t)}</div>`).join("");
    };
    f.addEventListener("change", revisar);
    revisar();
    $("#f-cli", dlg).addEventListener("change", (e) => { $("#nuevoCli", dlg).hidden = e.target.value !== "__nuevo"; });
    $("#guardar", dlg).addEventListener("click", async (e) => {
      const d = formData(f);
      if (!d.origen || !d.destino || !d.salida) return toast("Completa origen, destino y fecha de salida.", "error");
      if (d.regreso && new Date(d.regreso) <= new Date(d.salida)) return toast("El regreso debe ser posterior a la salida.", "error");
      botonCargando(e.currentTarget, true, "Guardando");
      try {
        if (d.cliente_id === "__nuevo") {
          const nc = {}; $$("[data-nc]", dlg).forEach((i) => { nc[i.dataset.nc] = i.value.trim(); });
          if (!nc.nombre) throw new Error("Escribe el nombre del cliente nuevo.");
          const c = await window.CRM.clientes.save(nc);
          d.cliente_id = c.id;
        }
        if (v) d.id = v.id;
        const guardado = await window.CRM.viajes.save(d);
        let clave = null;
        if (!v) clave = await window.CRM.viajes.nuevaClave(guardado.id);
        await recargar();
        cerrar();
        toast(v ? "Viaje actualizado" : `Viaje ${guardado.codigo} creado`);
        if (location.hash === `#/viaje/${guardado.id}`) route(); else location.hash = `#/viaje/${guardado.id}`;
        if (clave) setTimeout(() => mostrarClave(S.viajes.find((t) => t.id === guardado.id) || guardado, clave), 250);
      } catch (err) { fallo(err); botonCargando(e.currentTarget, false); }
    });
  }

  // ---------- Detalle de viaje ----------
  async function vViaje(id) {
    const v = S.viajes.find((x) => x.id === id);
    if (!v) { setHeader("Viaje"); view().innerHTML = `<div class="card">${vacio("Este viaje no existe o fue eliminado.")}</div>`; return; }
    setHeader("Detalle del viaje", btnNuevoViaje);
    view().innerHTML = `<a class="back" href="#/viajes">${icon("flecha")} Volver a viajes</a><div class="card"><div class="empty"><span class="spin"></span></div></div>`;
    let pax = [], evs = [], claveAt = null;
    try {
      [pax, evs, claveAt] = await Promise.all([window.CRM.pasajeros.list(id), window.CRM.eventos.list(id), window.CRM.viajes.tieneClave(id)]);
    } catch (e) { fallo(e); }
    if (!location.hash.endsWith(id)) return; // el usuario ya navegó a otra parte
    const abordo = pax.filter((p) => p.abordo).length;
    const ch = choques(v);
    const acciones = [];
    if (v.estado === "pendiente") acciones.push(`<button class="btn btn--primary" data-estado="confirmado">${icon("check")} Confirmar</button>`);
    if (v.estado === "confirmado") acciones.push(`<button class="btn btn--ok" data-estado="en_curso">${icon("play")} Iniciar</button>`);
    if (v.estado === "en_curso") acciones.push(`<button class="btn btn--ok" data-estado="finalizado">${icon("stop")} Finalizar</button>`);
    acciones.push(`<button class="btn btn--ghost" id="editar">${icon("editar")} Editar</button>`);
    acciones.push(`<button class="btn btn--ghost" id="imprimir">${icon("imprimir")} Hoja de ruta</button>`);

    view().innerHTML = `
      <a class="back" href="#/viajes">${icon("flecha")} Volver a viajes</a>
      <div class="card" style="margin-bottom:16px">
        <div class="trip-hero">
          <div>
            <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><span class="trip-hero__code">${esc(v.codigo)}</span>${badge(v.estado)}<span class="tag">${esc(v.servicio)}</span></div>
            <h2>${esc(ruta(v))}</h2>
            <div class="muted">${esc(fechaLarga(v.salida))} · ${hora(v.salida)}${v.regreso ? ` → ${diaKey(v.regreso) !== diaKey(v.salida) ? fecha(v.regreso) + " " : ""}${hora(v.regreso)}` : ""}</div>
          </div>
          <div class="trip-hero__actions">${acciones.join("")}</div>
        </div>
        ${ch.length ? `<div style="padding:0 22px 16px">${ch.map((o) => `<div class="notice notice--bad">Choque de horario con <a href="#/viaje/${esc(o.id)}">${esc(o.codigo)}</a> (${esc(fechaHora(o.salida))}).</div>`).join("")}</div>` : ""}
      </div>

      <div class="grid grid--2">
        <div class="stack">
          <div class="card">
            <div class="card__head"><h3>Datos del viaje</h3><div class="right"><a class="small" target="_blank" rel="noopener" href="${esc(mapsRuta(v.punto_encuentro || v.origen, v.destino))}">Ver ruta en Maps</a></div></div>
            <dl class="dl card__pad">
              <dt>Origen</dt><dd>${esc(v.origen)}</dd>
              <dt>Destino</dt><dd>${esc(v.destino)}</dd>
              <dt>Punto de encuentro</dt><dd>${esc(v.punto_encuentro || "—")}</dd>
              <dt>Paradas</dt><dd>${esc(v.paradas || "—")}</dd>
              <dt>Pasajeros</dt><dd>${v.pasajeros_estimados ?? "—"} estimados · ${pax.length} en nómina</dd>
              <dt>Instrucciones</dt><dd>${esc(v.instrucciones || "—")}</dd>
              <dt>Notas internas</dt><dd>${esc(v.notas_internas || "—")}</dd>
            </dl>
          </div>

          <div class="card">
            <div class="card__head"><h3>Nómina de pasajeros</h3>
              <div class="right"><span class="small muted">${abordo}/${pax.length} a bordo</span>
              <button class="btn btn--ghost btn--sm" id="paxLista">Pegar lista</button>
              <button class="btn btn--primary btn--sm" id="paxAdd">${icon("plus")} Agregar</button></div></div>
            ${pax.length ? `<div style="padding:12px 20px 0"><div class="progress"><span style="width:${pax.length ? Math.round(abordo / pax.length * 100) : 0}%"></span></div></div>` : ""}
            <ul class="pax">${pax.length ? pax.map((p, i) => `<li>
              <span class="pax__n">${i + 1}</span>
              <span class="pax__name"><strong>${esc(p.nombre)}</strong><small>${esc([p.documento, p.telefono].filter(Boolean).join(" · ") || (p.origen === "portal" ? "Agregado por el pasajero" : ""))}</small></span>
              ${p.abordo ? `<span class="tag tag--ok">A bordo</span>` : ""}
              <button class="icon-btn" data-pax-ed="${esc(p.id)}" title="Editar">${icon("editar")}</button>
              <button class="icon-btn" data-pax-del="${esc(p.id)}" title="Quitar">${icon("basura")}</button></li>`).join("")
              : `<li class="muted small">Aún no hay pasajeros. El cliente también puede agregarlos desde su portal.</li>`}</ul>
          </div>

          <div class="card">
            <div class="card__head"><h3>Bitácora</h3></div>
            <form id="evForm" class="card__pad" style="display:flex;flex-direction:column;gap:10px;border-bottom:1px solid var(--line)">
              <textarea class="input" name="mensaje" rows="2" placeholder="Agregar una nota o novedad…" required></textarea>
              <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
                <select class="input" name="tipo" style="width:auto">${Object.entries(TIPOS_EVENTO).filter(([k]) => k !== "estado").map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}</select>
                <label class="check"><input type="checkbox" name="publico" /> Visible para el pasajero</label>
                <button class="btn btn--primary btn--sm" style="margin-left:auto">Agregar</button>
              </div>
            </form>
            ${evs.length ? `<ul class="timeline">${evs.map((e) => `<li class="t-${esc(e.tipo)}">
              <div class="t-msg">${esc(e.mensaje)}</div>
              <div class="t-meta"><span>${esc(fechaHora(e.created_at))}</span><span>${esc(TIPOS_EVENTO[e.tipo] || e.tipo)}</span>
                ${e.autor_nombre ? `<span>${esc(e.autor_nombre)}</span>` : ""}
                ${e.publico ? `<span class="tag tag--ok">Visible al pasajero</span>` : `<span class="tag">Interna</span>`}
                ${e.lat != null ? `<a target="_blank" rel="noopener" href="${esc(mapsPunto(e.lat, e.lng))}">Ver ubicación</a>` : ""}
                <button class="link-btn small" data-ev-del="${esc(e.id)}" style="color:var(--muted)">Eliminar</button></div></li>`).join("")}</ul>`
              : vacio("Sin novedades todavía.", "reloj")}
          </div>
        </div>

        <div class="stack">
          <div class="card">
            <div class="card__head"><h3>Asignación</h3><div class="right"><button class="link-btn small" id="editar2">Cambiar</button></div></div>
            <ul class="info-list">
              <li>${icon("conductores")}<div><div class="lbl">Conductor</div>
                ${v.conductor ? `<div class="val">${esc(v.conductor.nombre)}</div>${v.conductor.telefono ? `<div class="small"><a href="tel:${esc(window.UI.telLimpio(v.conductor.telefono))}">${esc(v.conductor.telefono)}</a> · <a target="_blank" rel="noopener" href="${esc(waLink(v.conductor.telefono, `Hola ${v.conductor.nombre}, te escribo por el viaje ${v.codigo} (${fechaHora(v.salida)}).`))}">WhatsApp</a></div>` : ""}`
                : `<div class="val"><span class="tag tag--warn">Sin asignar</span></div>`}</div></li>
              <li>${icon("flota")}<div><div class="lbl">Bus</div>
                ${v.vehiculo ? `<div class="val">${esc(v.vehiculo.patente)} · ${esc(v.vehiculo.tipo)}</div><div class="small muted">${esc(v.vehiculo.marca_modelo || "")} · ${v.vehiculo.capacidad} asientos</div>`
                : `<div class="val"><span class="tag tag--warn">Sin asignar</span></div>`}</div></li>
              ${v.estado === "en_curso" && v.ultima_lat != null ? `<li>${icon("pin")}<div><div class="lbl">Última ubicación</div><div class="val"><a target="_blank" rel="noopener" href="${esc(mapsPunto(v.ultima_lat, v.ultima_lng))}">Ver en el mapa</a></div><div class="small muted">${esc(relativo(v.ultima_ubicacion_at))}</div></div></li>` : ""}
            </ul>
          </div>

          <div class="card">
            <div class="card__head"><h3>Acceso del pasajero</h3></div>
            <div class="access-box">
              <div class="small muted">El cliente sigue su viaje con este link y su clave. No necesita crear cuenta.</div>
              <div class="code-pill"><span>${esc(portalUrl(v.codigo))}</span>
                <button class="icon-btn" id="copyLink" title="Copiar link">${icon("copiar")}</button></div>
              <div class="small">${claveAt ? `Clave creada ${esc(relativo(claveAt))}. Por seguridad no se puede volver a mostrar.` : `<span class="tag tag--warn">Sin clave</span> Genera una para entregarla al cliente.`}</div>
              <div style="display:flex;gap:8px;flex-wrap:wrap">
                <button class="btn btn--primary btn--sm" id="nuevaClave">${icon("llave")} ${claveAt ? "Generar nueva clave" : "Generar clave"}</button>
                <a class="btn btn--ghost btn--sm" target="_blank" rel="noopener" href="${esc(portalUrl(v.codigo))}">Abrir portal</a>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card__head"><h3>Cliente</h3></div>
            ${v.cliente ? `<ul class="info-list">
              <li>${icon("usuario")}<div><div class="val">${esc(v.cliente.nombre)}</div><div class="small muted">${esc(v.cliente.empresa || "")}</div></div></li>
              ${v.cliente.telefono ? `<li>${icon("tel")}<div><div class="val"><a href="tel:${esc(window.UI.telLimpio(v.cliente.telefono))}">${esc(v.cliente.telefono)}</a> · <a target="_blank" rel="noopener" href="${esc(waLink(v.cliente.telefono))}">WhatsApp</a></div></div></li>` : ""}
              ${v.cliente.email ? `<li>${icon("clientes")}<div><div class="val"><a href="mailto:${esc(v.cliente.email)}">${esc(v.cliente.email)}</a></div></div></li>` : ""}
            </ul>` : vacio("Sin cliente asociado.", "clientes")}
          </div>

          <div style="display:flex;gap:8px;flex-wrap:wrap">
            ${activo(v) ? `<button class="btn btn--ghost btn--sm" data-estado="cancelado" style="color:var(--bad)">Cancelar viaje</button>` : ""}
            <button class="btn btn--ghost btn--sm" id="eliminar" style="color:var(--bad)">${icon("basura")} Eliminar</button>
          </div>
        </div>
      </div>`;

    const r = view();
    $("#editar", r).addEventListener("click", () => formViaje(v));
    $("#editar2", r).addEventListener("click", () => formViaje(v));
    $("#imprimir", r).addEventListener("click", () => imprimir(v, pax));
    $("#copyLink", r).addEventListener("click", () => copiar(portalUrl(v.codigo), "Link copiado"));
    $("#nuevaClave", r).addEventListener("click", async (e) => {
      if (claveAt && !(await confirmar("La clave anterior dejará de funcionar. ¿Generar una nueva?", { ok: "Generar" }))) return;
      botonCargando(e.currentTarget, true);
      try { const c = await window.CRM.viajes.nuevaClave(v.id); mostrarClave(v, c); vViaje(v.id); }
      catch (err) { fallo(err); botonCargando(e.currentTarget, false); }
    });
    $$("[data-estado]", r).forEach((b) => b.addEventListener("click", () => cambiarEstado(v, b.dataset.estado)));
    $("#eliminar", r).addEventListener("click", async () => {
      if (!(await confirmar(`¿Eliminar el viaje ${v.codigo}? Se borrarán su nómina y bitácora. Esta acción no se puede deshacer.`, { ok: "Eliminar", peligro: true }))) return;
      try { await window.CRM.viajes.remove(v.id); await recargar(); toast("Viaje eliminado"); location.hash = "#/viajes"; } catch (e) { fallo(e); }
    });
    $("#paxAdd", r).addEventListener("click", () => formPasajero(v));
    $("#paxLista", r).addEventListener("click", () => formListaPasajeros(v));
    $$("[data-pax-ed]", r).forEach((b) => b.addEventListener("click", () => formPasajero(v, pax.find((p) => p.id === b.dataset.paxEd))));
    $$("[data-pax-del]", r).forEach((b) => b.addEventListener("click", async () => {
      const p = pax.find((x) => x.id === b.dataset.paxDel);
      if (!(await confirmar(`¿Quitar a ${p.nombre} de la nómina?`, { ok: "Quitar", peligro: true }))) return;
      try { await window.CRM.pasajeros.remove(p.id); vViaje(v.id); } catch (e) { fallo(e); }
    }));
    $$("[data-ev-del]", r).forEach((b) => b.addEventListener("click", async () => {
      if (!(await confirmar("¿Eliminar esta entrada de la bitácora?", { ok: "Eliminar", peligro: true }))) return;
      try { await window.CRM.eventos.remove(b.dataset.evDel); vViaje(v.id); } catch (e) { fallo(e); }
    }));
    $("#evForm", r).addEventListener("submit", async (e) => {
      e.preventDefault();
      const d = formData(e.target);
      if (!d.mensaje) return;
      try { await window.CRM.eventos.add(Object.assign(d, { viaje_id: v.id })); toast("Nota agregada"); vViaje(v.id); } catch (err) { fallo(err); }
    });
  }

  async function cambiarEstado(v, estado) {
    const textos = {
      confirmado: [`¿Confirmar el viaje ${v.codigo}?`, "Confirmar"],
      en_curso: [`¿Marcar el viaje ${v.codigo} como iniciado?`, "Iniciar"],
      finalizado: [`¿Marcar el viaje ${v.codigo} como finalizado?`, "Finalizar"],
      cancelado: [`¿Cancelar el viaje ${v.codigo}? El pasajero verá el viaje como cancelado.`, "Cancelar viaje"],
    };
    const [t, ok] = textos[estado];
    if (estado === "confirmado" && (!v.conductor_id || !v.vehiculo_id)) {
      if (!(await confirmar(`${v.codigo} aún no tiene ${!v.conductor_id ? "conductor" : "bus"} asignado. ¿Confirmar de todas formas?`, { ok: "Confirmar" }))) return;
    } else if (!(await confirmar(t, { ok, peligro: estado === "cancelado" }))) return;
    try {
      if (estado === "en_curso" || estado === "finalizado") await window.CRM.viajes.cambiarEstado(v.id, estado);
      else {
        await window.CRM.viajes.save({ id: v.id, estado });
        await window.CRM.eventos.add({ viaje_id: v.id, tipo: "estado", publico: true,
          mensaje: estado === "confirmado" ? "Viaje confirmado" : "Viaje cancelado" });
      }
      await recargar();
      toast(`Viaje ${ESTADOS[estado].label.toLowerCase()}`);
      vViaje(v.id);
    } catch (e) { fallo(e); }
  }

  function mostrarClave(v, clave) {
    const link = portalUrl(v.codigo);
    const nombre = v.cliente ? v.cliente.nombre.split(" ")[0] : "";
    const mensaje = `Hola${nombre ? " " + nombre : ""}, tu viaje con TRANSYMEC (${v.codigo}) está registrado.\n` +
      `Salida: ${fechaHora(v.salida)}\n${v.punto_encuentro ? `Punto de encuentro: ${v.punto_encuentro}\n` : ""}` +
      `\nPuedes seguir tu viaje y completar la nómina de pasajeros aquí:\n${link}\nClave de acceso: ${clave}`;
    const { dlg } = modal({
      titulo: "Clave de acceso del pasajero",
      cuerpo: `<p class="small muted" style="margin-bottom:12px">Entrega esta clave al cliente junto con el link. <strong>Guárdala ahora:</strong> por seguridad no se volverá a mostrar.</p>
        <div class="secret">${esc(clave)}</div>
        <div class="code-pill" style="margin-top:12px"><span>${esc(link)}</span></div>
        <div class="field" style="margin-top:14px"><label>Mensaje para el cliente</label><textarea class="input" rows="7" readonly id="msgCli">${esc(mensaje)}</textarea></div>`,
      acciones: `<button class="btn btn--ghost" id="cpMsg">${icon("copiar")} Copiar mensaje</button>
        ${v.cliente && v.cliente.telefono ? `<a class="btn btn--wa" target="_blank" rel="noopener" href="${esc(waLink(v.cliente.telefono, mensaje))}">${icon("whatsapp")} Enviar por WhatsApp</a>` : ""}
        <button class="btn btn--primary" data-close>Listo</button>`,
    });
    $("#cpMsg", dlg).addEventListener("click", () => copiar(mensaje, "Mensaje copiado"));
  }

  function formPasajero(v, p) {
    const x = p || {};
    const { dlg, cerrar } = modal({
      titulo: p ? "Editar pasajero" : "Agregar pasajero",
      cuerpo: `<form class="form" id="fp"><div class="field full"><label>Nombre completo *</label><input name="nombre" required value="${esc(x.nombre)}" /></div>
        <div class="field"><label>RUT / documento</label><input name="documento" value="${esc(x.documento)}" /></div>
        <div class="field"><label>Teléfono</label><input name="telefono" type="tel" value="${esc(x.telefono)}" /></div></form>`,
      acciones: `<button class="btn btn--ghost" data-close>Cancelar</button><button class="btn btn--primary" id="ok">${p ? "Guardar" : "Agregar"}</button>`,
    });
    const enviar = async () => {
      const d = formData($("#fp", dlg));
      if (!d.nombre) return toast("Escribe el nombre.", "error");
      try { await window.CRM.pasajeros.save(Object.assign(d, { id: x.id, viaje_id: v.id })); cerrar(); vViaje(v.id); } catch (e) { fallo(e); }
    };
    $("#ok", dlg).addEventListener("click", enviar);
    $("#fp", dlg).addEventListener("submit", (e) => { e.preventDefault(); enviar(); });
  }

  function formListaPasajeros(v) {
    const { dlg, cerrar } = modal({
      titulo: "Pegar lista de pasajeros",
      cuerpo: `<p class="small muted" style="margin-bottom:10px">Un pasajero por línea. Opcionalmente separa nombre, RUT y teléfono con coma o punto y coma (sirve copiar directo desde Excel).</p>
        <textarea class="input" id="lista" rows="10" placeholder="María González, 12.345.678-9, +56 9 1111 2222&#10;Pedro Soto&#10;…"></textarea>`,
      acciones: `<button class="btn btn--ghost" data-close>Cancelar</button><button class="btn btn--primary" id="ok">Agregar a la nómina</button>`,
    });
    $("#ok", dlg).addEventListener("click", async () => {
      const lista = $("#lista", dlg).value.split(/\r?\n/).map((l) => l.split(/[;,\t]/).map((s) => s.trim()))
        .filter((c) => c[0]).map((c) => ({ nombre: c[0], documento: c[1] || "", telefono: c[2] || "" }));
      if (!lista.length) return toast("La lista está vacía.", "error");
      try { await window.CRM.pasajeros.addMany(v.id, lista); cerrar(); toast(`${lista.length} pasajeros agregados`); vViaje(v.id); } catch (e) { fallo(e); }
    });
  }

  function imprimir(v, pax) {
    const old = document.querySelector(".print-sheet"); if (old) old.remove();
    const el = document.createElement("div");
    el.className = "print-sheet";
    const filas = pax.length ? pax : Array.from({ length: Math.max(10, v.pasajeros_estimados || 10) }, () => ({ nombre: "" }));
    el.innerHTML = `
      <div class="ps-head"><img src="assets/logo/transymec-logo.svg" alt="TRANSYMEC" /><div style="text-align:right"><strong>Hoja de ruta</strong><br>${esc(v.codigo)}</div></div>
      <h1>${esc(ruta(v))}</h1>
      <div class="ps-grid">
        <div><b>Servicio</b>${esc(v.servicio)}</div><div><b>Estado</b>${esc(ESTADOS[v.estado].label)}</div>
        <div><b>Salida</b>${esc(fechaLarga(v.salida))} ${hora(v.salida)}</div><div><b>Regreso</b>${v.regreso ? esc(fechaHora(v.regreso)) : "—"}</div>
        <div><b>Punto de encuentro</b>${esc(v.punto_encuentro || "—")}</div><div><b>Paradas</b>${esc(v.paradas || "—")}</div>
        <div><b>Cliente</b>${esc(v.cliente ? v.cliente.nombre + (v.cliente.empresa ? " · " + v.cliente.empresa : "") : "—")}</div><div><b>Teléfono cliente</b>${esc(v.cliente && v.cliente.telefono || "—")}</div>
        <div><b>Conductor</b>${esc(v.conductor ? v.conductor.nombre : "—")}</div><div><b>Bus</b>${esc(v.vehiculo ? `${v.vehiculo.patente} · ${v.vehiculo.tipo} (${v.vehiculo.capacidad} asientos)` : "—")}</div>
      </div>
      ${v.instrucciones ? `<p><b>Instrucciones:</b> ${esc(v.instrucciones)}</p>` : ""}
      ${v.notas_internas ? `<p><b>Notas:</b> ${esc(v.notas_internas)}</p>` : ""}
      <h3 style="margin-top:14px">Nómina de pasajeros</h3>
      <table><thead><tr><th style="width:30px">#</th><th>Nombre</th><th>RUT / documento</th><th>Teléfono</th><th style="width:60px">Abordó</th></tr></thead>
      <tbody>${filas.map((p, i) => `<tr><td>${i + 1}</td><td>${esc(p.nombre)}</td><td>${esc(p.documento || "")}</td><td>${esc(p.telefono || "")}</td><td>${p.abordo ? "✓" : ""}</td></tr>`).join("")}</tbody></table>
      <div class="ps-sign"><div>Firma conductor</div><div>Firma responsable del grupo</div></div>
      <p style="margin-top:20px;font-size:9pt;color:#666">TRANSYMEC · +56 9 4437 3789 · transymec@gmail.com · Impreso el ${esc(fechaHora(new Date().toISOString()))}</p>`;
    document.body.appendChild(el);
    document.body.classList.add("printing");
    const fin = () => { document.body.classList.remove("printing"); el.remove(); window.removeEventListener("afterprint", fin); };
    window.addEventListener("afterprint", fin);
    const img = el.querySelector("img");
    const go = () => setTimeout(() => window.print(), 50);
    if (img.complete) go(); else { img.onload = go; img.onerror = go; }
  }

  // ---------------------------------------------------------------
  //  Agenda
  // ---------------------------------------------------------------
  function vAgenda() {
    setHeader("Agenda", btnNuevoViaje);
    const desde = new Date(); desde.setHours(0, 0, 0, 0);
    const hasta = new Date(desde.getTime() + 31 * 86400000);
    view().innerHTML = `
      <div style="display:flex;gap:10px;align-items:center;margin-bottom:14px;flex-wrap:wrap">
        <span class="muted small">Próximos 30 días</span>
        <select class="input" id="fc" style="width:auto;margin-left:auto">
          <option value="">Todos los conductores</option>
          <option value="__sin" ${S.agendaConductor === "__sin" ? "selected" : ""}>Sin conductor</option>
          ${conductores().map((u) => `<option value="${esc(u.id)}" ${S.agendaConductor === u.id ? "selected" : ""}>${esc(u.nombre)}</option>`).join("")}
        </select>
      </div><div id="dias"></div>`;
    const pintar = () => {
      let lista = S.viajes.filter((v) => v.estado !== "cancelado" && new Date(v.salida) >= desde && new Date(v.salida) < hasta);
      if (S.agendaConductor === "__sin") lista = lista.filter((v) => !v.conductor_id);
      else if (S.agendaConductor) lista = lista.filter((v) => v.conductor_id === S.agendaConductor);
      const grupos = {};
      lista.forEach((v) => { (grupos[diaKey(v.salida)] = grupos[diaKey(v.salida)] || []).push(v); });
      const hoy = hoyKey();
      $("#dias").innerHTML = Object.keys(grupos).length ? Object.entries(grupos).map(([k, vs]) => `
        <div class="day"><div class="day__title ${k === hoy ? "today" : ""}">${k === hoy ? "Hoy · " : ""}${esc(fechaLarga(vs[0].salida))} · ${vs.length} ${vs.length === 1 ? "viaje" : "viajes"}</div>
        <div class="card">${vs.map((v) => filaViaje(v)).join("")}</div></div>`).join("")
        : `<div class="card">${vacio("No hay viajes en los próximos 30 días.", "agenda")}</div>`;
    };
    pintar();
    $("#fc").addEventListener("change", (e) => { S.agendaConductor = e.target.value; pintar(); });
  }

  // ---------------------------------------------------------------
  //  Clientes
  // ---------------------------------------------------------------
  function vClientes() {
    setHeader("Clientes", `<button class="btn btn--primary" id="nuevo">${icon("plus")}<span>Nuevo cliente</span></button>`);
    const cuenta = (id) => S.viajes.filter((v) => v.cliente_id === id).length;
    const ultimo = (id) => S.viajes.filter((v) => v.cliente_id === id).map((v) => v.salida).sort().pop();
    view().innerHTML = `<div class="card">
      <div class="toolbar"><div class="search">${icon("buscar")}<input type="search" id="q" placeholder="Buscar cliente…" /></div></div>
      <div class="table-wrap"><table class="tbl"><thead><tr><th>Cliente</th><th class="hide-sm">Contacto</th><th>Viajes</th><th class="hide-sm">Último viaje</th><th></th></tr></thead><tbody id="rows"></tbody></table></div></div>`;
    const pintar = (q) => {
      const lista = S.clientes.filter((c) => !q || [c.nombre, c.empresa, c.telefono, c.email, c.rut].join(" ").toLowerCase().includes(q));
      $("#rows").innerHTML = lista.length ? lista.map((c) => `<tr>
        <td><span class="strong">${esc(c.nombre)}</span><br><span class="muted small">${esc(c.empresa || "Particular")}${c.rut ? " · " + esc(c.rut) : ""}</span></td>
        <td class="hide-sm">${c.telefono ? `<a href="${esc(waLink(c.telefono))}" target="_blank" rel="noopener">${esc(c.telefono)}</a>` : "—"}<br><span class="muted small">${esc(c.email || "")}</span></td>
        <td>${cuenta(c.id)}</td>
        <td class="hide-sm">${ultimo(c.id) ? esc(fecha(ultimo(c.id))) : "—"}</td>
        <td class="actions"><button class="icon-btn" data-ed="${esc(c.id)}" title="Editar">${icon("editar")}</button><button class="icon-btn" data-del="${esc(c.id)}" title="Eliminar">${icon("basura")}</button></td>
      </tr>`).join("") : `<tr><td colspan="5">${vacio("No hay clientes registrados.", "clientes")}</td></tr>`;
    };
    pintar("");
    $("#q").addEventListener("input", (e) => pintar(e.target.value.toLowerCase()));
    $("#nuevo").addEventListener("click", () => formCliente());
    $("#rows").addEventListener("click", async (e) => {
      const ed = e.target.closest("[data-ed]"), del = e.target.closest("[data-del]");
      if (ed) formCliente(S.clientes.find((c) => c.id === ed.dataset.ed));
      if (del) {
        const c = S.clientes.find((x) => x.id === del.dataset.del);
        const n = cuenta(c.id);
        if (!(await confirmar(`¿Eliminar a ${c.nombre}?${n ? ` Sus ${n} viajes quedarán sin cliente asociado.` : ""}`, { ok: "Eliminar", peligro: true }))) return;
        try { await window.CRM.clientes.remove(c.id); await recargar(); toast("Cliente eliminado"); vClientes(); } catch (err) { fallo(err); }
      }
    });
  }

  function formCliente(c) {
    const x = c || {};
    const { dlg, cerrar } = modal({
      titulo: c ? "Editar cliente" : "Nuevo cliente",
      cuerpo: `<form class="form" id="fc">
        <div class="field"><label>Nombre de contacto *</label><input name="nombre" required value="${esc(x.nombre)}" /></div>
        <div class="field"><label>Empresa / institución</label><input name="empresa" value="${esc(x.empresa)}" /></div>
        <div class="field"><label>Teléfono</label><input name="telefono" type="tel" placeholder="+56 9 …" value="${esc(x.telefono)}" /></div>
        <div class="field"><label>Correo</label><input name="email" type="email" value="${esc(x.email)}" /></div>
        <div class="field"><label>RUT</label><input name="rut" value="${esc(x.rut)}" /></div>
        <div class="field full"><label>Notas</label><textarea name="notas">${esc(x.notas)}</textarea></div></form>`,
      acciones: `<button class="btn btn--ghost" data-close>Cancelar</button><button class="btn btn--primary" id="ok">Guardar</button>`,
    });
    $("#ok", dlg).addEventListener("click", async () => {
      const d = formData($("#fc", dlg));
      if (!d.nombre) return toast("Escribe el nombre del cliente.", "error");
      try { await window.CRM.clientes.save(Object.assign(d, { id: x.id })); await recargar(); cerrar(); toast("Cliente guardado"); vClientes(); } catch (e) { fallo(e); }
    });
  }

  // ---------------------------------------------------------------
  //  Conductores y usuarios
  // ---------------------------------------------------------------
  function vConductores() {
    setHeader("Conductores", `<button class="btn btn--primary" id="nuevo">${icon("plus")}<span>Nuevo usuario</span></button>`);
    const proximos = (id) => S.viajes.filter((v) => v.conductor_id === id && activo(v)).length;
    const lista = S.usuarios.slice().sort((a, b) => (a.rol === b.rol ? 0 : a.rol === "admin" ? 1 : -1) || (b.activo - a.activo) || a.nombre.localeCompare(b.nombre));
    view().innerHTML = `<div class="card"><div class="table-wrap"><table class="tbl"><thead><tr>
      <th>Nombre</th><th class="hide-sm">Usuario</th><th class="hide-sm">Teléfono</th><th>Licencia</th><th class="hide-sm">Viajes activos</th><th>Estado</th><th></th></tr></thead>
      <tbody>${lista.map((u) => `<tr>
        <td><div style="display:flex;gap:10px;align-items:center"><span class="avatar" style="${u.rol === "admin" ? "background:var(--navy)" : ""}">${esc(iniciales(u.nombre))}</span>
          <div><span class="strong">${esc(u.nombre)}</span><br><span class="muted small">${u.rol === "admin" ? "Administrador" : "Conductor"}</span></div></div></td>
        <td class="hide-sm">${esc(u.usuario || "")}</td>
        <td class="hide-sm">${u.telefono ? `<a href="${esc(waLink(u.telefono))}" target="_blank" rel="noopener">${esc(u.telefono)}</a>` : "—"}</td>
        <td>${u.rol === "conductor" ? `${esc(u.licencia_clase || "")} ${tagVence(u.licencia_vence)}` : "—"}</td>
        <td class="hide-sm">${u.rol === "conductor" ? proximos(u.id) : "—"}</td>
        <td>${u.activo ? `<span class="tag tag--ok">Activo</span>` : `<span class="tag">Inactivo</span>`}</td>
        <td class="actions"><button class="icon-btn" data-ed="${esc(u.id)}" title="Editar">${icon("editar")}</button></td>
      </tr>`).join("")}</tbody></table></div></div>
      <p class="small muted" style="margin-top:12px">Los conductores entran en <strong>login.html</strong> con su usuario y contraseña, y solo ven los viajes que tienen asignados.${window.CRM.mode === "supabase" ? " Para cambiar una contraseña usa Supabase → Authentication → Users." : ""}</p>`;
    $("#nuevo").addEventListener("click", () => formUsuario());
    $$("[data-ed]").forEach((b) => b.addEventListener("click", () => formUsuario(S.usuarios.find((u) => u.id === b.dataset.ed))));
  }

  function formUsuario(u) {
    const x = u || { rol: "conductor", activo: true };
    const esYo = u && u.id === S.me.id;
    const { dlg, cerrar } = modal({
      titulo: u ? `Editar ${u.nombre}` : "Nuevo usuario",
      cuerpo: `<form class="form" id="fu">
        <div class="field full"><label>Nombre completo *</label><input name="nombre" required value="${esc(x.nombre)}" /></div>
        ${u ? `<div class="field"><label>Usuario</label><input value="${esc(x.usuario)}" disabled /></div>`
            : `<div class="field"><label>Usuario *</label><input name="usuario" required autocomplete="off" placeholder="ej: jperez" /><span class="hint">Con esto inicia sesión.</span></div>
               <div class="field"><label>Contraseña *</label><input name="password" type="text" required autocomplete="new-password" minlength="6" /><span class="hint">Mínimo 6 caracteres.</span></div>`}
        <div class="field"><label>Rol</label><select name="rol" ${esYo ? "disabled" : ""}>
          <option value="conductor" ${x.rol === "conductor" ? "selected" : ""}>Conductor</option>
          <option value="admin" ${x.rol === "admin" ? "selected" : ""}>Administrador</option></select></div>
        <div class="field"><label>Teléfono</label><input name="telefono" type="tel" placeholder="+56 9 …" value="${esc(x.telefono)}" /></div>
        <div class="field"><label>Clase de licencia</label><input name="licencia_clase" placeholder="A3" value="${esc(x.licencia_clase)}" /></div>
        <div class="field"><label>Licencia vence</label><input name="licencia_vence" type="date" value="${esc(x.licencia_vence || "")}" /></div>
        ${u && !esYo ? `<label class="check full"><input type="checkbox" name="activo" ${x.activo ? "checked" : ""} /> Cuenta activa (puede iniciar sesión)</label>` : ""}
      </form>`,
      acciones: `<button class="btn btn--ghost" data-close>Cancelar</button><button class="btn btn--primary" id="ok">${u ? "Guardar" : "Crear usuario"}</button>`,
    });
    $("#ok", dlg).addEventListener("click", async (e) => {
      const d = formData($("#fu", dlg));
      if (!d.nombre) return toast("Escribe el nombre.", "error");
      if (esYo) delete d.rol;
      botonCargando(e.currentTarget, true);
      try {
        if (u) await window.CRM.usuarios.save(Object.assign(d, { id: u.id }));
        else {
          if (!d.usuario || !d.password) throw new Error("Completa usuario y contraseña.");
          if (d.password.length < 6) throw new Error("La contraseña debe tener al menos 6 caracteres.");
          await window.CRM.usuarios.crear(d);
        }
        await recargar(); cerrar();
        toast(u ? "Usuario actualizado" : `Usuario ${d.usuario} creado`);
        vConductores();
      } catch (err) { fallo(err); botonCargando(e.currentTarget, false); }
    });
  }

  // ---------------------------------------------------------------
  //  Flota
  // ---------------------------------------------------------------
  function vFlota() {
    setHeader("Flota", `<button class="btn btn--primary" id="nuevo">${icon("plus")}<span>Nuevo bus</span></button>`);
    const est = { disponible: ["Disponible", "tag--ok"], mantencion: ["En mantención", "tag--warn"], fuera_servicio: ["Fuera de servicio", "tag--bad"] };
    const prox = (id) => S.viajes.filter((v) => v.vehiculo_id === id && activo(v) && new Date(v.salida) > Date.now()).sort((a, b) => a.salida.localeCompare(b.salida))[0];
    view().innerHTML = `<div class="card"><div class="table-wrap"><table class="tbl"><thead><tr>
      <th>Patente</th><th>Tipo</th><th>Asientos</th><th>Estado</th><th>Revisión técnica</th><th>Seguro</th><th class="hide-sm">Próximo viaje</th><th></th></tr></thead>
      <tbody>${S.vehiculos.length ? S.vehiculos.map((b) => { const p = prox(b.id); return `<tr>
        <td><span class="strong">${esc(b.patente)}</span></td>
        <td>${esc(b.tipo)}<br><span class="muted small">${esc(b.marca_modelo || "")}</span></td>
        <td>${b.capacidad}</td>
        <td><span class="tag ${est[b.estado][1]}">${est[b.estado][0]}</span></td>
        <td>${tagVence(b.revision_tecnica_vence)}</td>
        <td>${tagVence(b.seguro_vence)}</td>
        <td class="hide-sm">${p ? `<a href="#/viaje/${esc(p.id)}">${esc(fechaHora(p.salida))}</a>` : "—"}</td>
        <td class="actions"><button class="icon-btn" data-ed="${esc(b.id)}" title="Editar">${icon("editar")}</button><button class="icon-btn" data-del="${esc(b.id)}" title="Eliminar">${icon("basura")}</button></td>
      </tr>`; }).join("") : `<tr><td colspan="8">${vacio("Agrega tu primer bus.", "flota")}</td></tr>`}</tbody></table></div></div>`;
    $("#nuevo").addEventListener("click", () => formBus());
    $$("[data-ed]").forEach((b) => b.addEventListener("click", () => formBus(S.vehiculos.find((x) => x.id === b.dataset.ed))));
    $$("[data-del]").forEach((b) => b.addEventListener("click", async () => {
      const x = S.vehiculos.find((y) => y.id === b.dataset.del);
      if (!(await confirmar(`¿Eliminar el bus ${x.patente}? Los viajes que lo usan quedarán sin bus asignado.`, { ok: "Eliminar", peligro: true }))) return;
      try { await window.CRM.vehiculos.remove(x.id); await recargar(); toast("Bus eliminado"); vFlota(); } catch (e) { fallo(e); }
    }));
  }

  function formBus(b) {
    const x = b || { tipo: "Bus pullman", capacidad: 45, estado: "disponible" };
    const tipos = ["Minibús", "Bus intermedio", "Bus pullman", "Bus de dos pisos", "Van"];
    const { dlg, cerrar } = modal({
      titulo: b ? `Editar bus ${b.patente}` : "Nuevo bus",
      cuerpo: `<form class="form" id="fb">
        <div class="field"><label>Patente *</label><input name="patente" required value="${esc(x.patente)}" style="text-transform:uppercase" placeholder="ABCD12" /></div>
        <div class="field"><label>Tipo</label><select name="tipo">${[...new Set([...tipos, x.tipo])].map((t) => `<option ${t === x.tipo ? "selected" : ""}>${esc(t)}</option>`).join("")}</select></div>
        <div class="field"><label>Marca y modelo</label><input name="marca_modelo" value="${esc(x.marca_modelo)}" /></div>
        <div class="field"><label>Asientos *</label><input name="capacidad" type="number" min="1" max="120" required value="${esc(x.capacidad)}" /></div>
        <div class="field"><label>Estado</label><select name="estado">
          <option value="disponible" ${x.estado === "disponible" ? "selected" : ""}>Disponible</option>
          <option value="mantencion" ${x.estado === "mantencion" ? "selected" : ""}>En mantención</option>
          <option value="fuera_servicio" ${x.estado === "fuera_servicio" ? "selected" : ""}>Fuera de servicio</option></select></div>
        <div class="field"></div>
        <div class="field"><label>Revisión técnica vence</label><input name="revision_tecnica_vence" type="date" value="${esc(x.revision_tecnica_vence || "")}" /></div>
        <div class="field"><label>Seguro vence</label><input name="seguro_vence" type="date" value="${esc(x.seguro_vence || "")}" /></div>
        <div class="field full"><label>Notas</label><textarea name="notas">${esc(x.notas)}</textarea></div></form>`,
      acciones: `<button class="btn btn--ghost" data-close>Cancelar</button><button class="btn btn--primary" id="ok">Guardar</button>`,
    });
    $("#ok", dlg).addEventListener("click", async () => {
      const d = formData($("#fb", dlg));
      if (!d.patente || !d.capacidad) return toast("Completa la patente y los asientos.", "error");
      try { await window.CRM.vehiculos.save(Object.assign(d, { id: x.id })); await recargar(); cerrar(); toast("Bus guardado"); vFlota(); } catch (e) { fallo(e); }
    });
  }

  init();
})();

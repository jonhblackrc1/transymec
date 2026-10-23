// =====================================================================
//  TRANSYMEC · CRM de viajes — capa de datos
// ---------------------------------------------------------------------
//  Expone window.CRM con la misma API en dos modos:
//   · "supabase": datos reales (cuando auth-config.js está completo)
//   · "demo":     datos de ejemplo guardados en este navegador
// =====================================================================
(function () {
  "use strict";

  const cfg = window.SUPABASE_CONFIG || {};
  const CONFIGURED =
    !!cfg.url && !!cfg.anonKey &&
    !cfg.url.includes("TU_PROYECTO") && !cfg.anonKey.includes("TU_ANON_KEY") &&
    !!window.supabase;

  const DOMAIN = "transymec.cl";
  const ALPH = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin 0/O/1/I para evitar confusiones

  const rand = (n) =>
    Array.from(crypto.getRandomValues(new Uint32Array(n)), (x) => ALPH[x % ALPH.length]).join("");
  const genCodigo = () => "TX-" + rand(6);
  const genClave = () => rand(6);
  const toEmail = (u) => {
    const s = String(u || "").trim().toLowerCase();
    return s.includes("@") ? s : `${s}@${DOMAIN}`;
  };
  const pick = (obj, keys) => {
    const out = {};
    keys.forEach((k) => {
      if (obj[k] !== undefined) out[k] = obj[k] === "" ? null : obj[k];
    });
    return out;
  };

  const F_VIAJE = ["cliente_id", "servicio", "origen", "destino", "punto_encuentro", "paradas",
    "salida", "regreso", "pasajeros_estimados", "vehiculo_id", "conductor_id", "estado",
    "instrucciones", "notas_internas"];
  const F_CLIENTE = ["nombre", "empresa", "rut", "telefono", "email", "notas"];
  const F_VEHICULO = ["patente", "tipo", "marca_modelo", "capacidad", "estado",
    "revision_tecnica_vence", "seguro_vence", "notas"];
  const F_PERFIL = ["nombre", "rol", "telefono", "licencia_clase", "licencia_vence", "activo"];
  const F_PASAJERO = ["viaje_id", "nombre", "documento", "telefono", "abordo"];

  // Traduce los errores más comunes a mensajes claros.
  function traducir(msg) {
    const m = String(msg || "");
    if (/duplicate key.*patente/i.test(m)) return "Ya existe un vehículo con esa patente.";
    if (/duplicate key/i.test(m)) return "Ese registro ya existe.";
    if (/already registered|already been registered/i.test(m)) return "Ese usuario ya existe.";
    if (/Password should be/i.test(m)) return "La contraseña debe tener al menos 6 caracteres.";
    if (/violates row-level security|permission denied/i.test(m)) return "No tienes permiso para hacer esto.";
    if (/Failed to fetch|NetworkError/i.test(m)) return "Sin conexión. Revisa tu internet e inténtalo de nuevo.";
    return m || "Ocurrió un error inesperado.";
  }

  // ===================================================================
  //  Modo SUPABASE
  // ===================================================================
  function supabaseBackend() {
    const sb = window.supabase.createClient(cfg.url, cfg.anonKey);
    const SEL =
      "*, cliente:clientes(id,nombre,empresa,telefono,email), " +
      "conductor:profiles(id,nombre,telefono), " +
      "vehiculo:vehiculos(id,patente,tipo,marca_modelo,capacidad)";

    const q = async (promise) => {
      const { data, error } = await promise;
      if (error) throw new Error(traducir(error.message));
      return data;
    };
    const portal = async (fn, args) => {
      const data = await q(sb.rpc(fn, args));
      if (data && data.error) throw new Error(data.error);
      return data;
    };

    async function insertViaje(row) {
      for (let i = 0; i < 4; i++) {
        row.codigo = genCodigo();
        const { data, error } = await sb.from("viajes").insert(row).select(SEL).single();
        if (!error) return data;
        if (!/duplicate key.*codigo/i.test(error.message)) throw new Error(traducir(error.message));
      }
      throw new Error("No se pudo generar un código único. Inténtalo de nuevo.");
    }

    return {
      mode: "supabase",
      auth: {
        async login(usuario, password) {
          const { error } = await sb.auth.signInWithPassword({ email: toEmail(usuario), password });
          if (error) throw new Error("Usuario o contraseña incorrectos.");
          const perfil = await this.current();
          if (!perfil) {
            await sb.auth.signOut();
            throw new Error("Tu cuenta no está activa. Pide al administrador que la habilite.");
          }
          return perfil;
        },
        async current() {
          const { data } = await sb.auth.getSession();
          if (!data.session) return null;
          const { data: p } = await sb.from("profiles").select("*")
            .eq("id", data.session.user.id).maybeSingle();
          return p && p.activo ? p : null;
        },
        async logout() { await sb.auth.signOut(); },
      },

      viajes: {
        list: () => q(sb.from("viajes").select(SEL).order("salida", { ascending: true })),
        get: (id) => q(sb.from("viajes").select(SEL).eq("id", id).single()),
        async save(v) {
          const row = pick(v, F_VIAJE);
          if (v.id) return q(sb.from("viajes").update(row).eq("id", v.id).select(SEL).single());
          return insertViaje(row);
        },
        remove: (id) => q(sb.from("viajes").delete().eq("id", id)),
        async nuevaClave(id) {
          const clave = genClave();
          await q(sb.rpc("admin_set_clave", { p_viaje: id, p_clave: clave }));
          return clave;
        },
        async tieneClave(id) {
          const d = await q(sb.from("viaje_accesos").select("updated_at").eq("viaje_id", id).maybeSingle());
          return d ? d.updated_at : null;
        },
        cambiarEstado: (id, estado, nota, lat, lng) =>
          q(sb.rpc("cambiar_estado_viaje", { p_viaje: id, p_estado: estado, p_nota: nota || null,
            p_lat: lat ?? null, p_lng: lng ?? null })),
      },

      eventos: {
        list: (viajeId) => q(sb.from("viaje_eventos").select("*").eq("viaje_id", viajeId)
          .order("created_at", { ascending: false })),
        add: (e) => q(sb.rpc("registrar_evento", { p_viaje: e.viaje_id, p_tipo: e.tipo || "nota",
          p_mensaje: e.mensaje, p_publico: !!e.publico, p_lat: e.lat ?? null, p_lng: e.lng ?? null })),
        remove: (id) => q(sb.from("viaje_eventos").delete().eq("id", id)),
      },

      pasajeros: {
        list: (viajeId) => q(sb.from("pasajeros").select("*").eq("viaje_id", viajeId)
          .order("created_at", { ascending: true })),
        save(p) {
          const row = pick(p, F_PASAJERO);
          return p.id ? q(sb.from("pasajeros").update(row).eq("id", p.id))
                      : q(sb.from("pasajeros").insert(row));
        },
        addMany: (viajeId, lista) => q(sb.from("pasajeros").insert(
          lista.map((p) => ({ viaje_id: viajeId, nombre: p.nombre, documento: p.documento || null,
            telefono: p.telefono || null })))),
        remove: (id) => q(sb.from("pasajeros").delete().eq("id", id)),
        abordo: (id, valor) => q(sb.rpc("marcar_abordo", { p_pasajero: id, p_abordo: valor })),
      },

      clientes: {
        list: () => q(sb.from("clientes").select("*").order("nombre")),
        save(c) {
          const row = pick(c, F_CLIENTE);
          return c.id ? q(sb.from("clientes").update(row).eq("id", c.id).select().single())
                      : q(sb.from("clientes").insert(row).select().single());
        },
        remove: (id) => q(sb.from("clientes").delete().eq("id", id)),
      },

      vehiculos: {
        list: () => q(sb.from("vehiculos").select("*").order("patente")),
        save(v) {
          const row = pick(v, F_VEHICULO);
          if (row.patente) row.patente = row.patente.toUpperCase().replace(/\s|-/g, "");
          return v.id ? q(sb.from("vehiculos").update(row).eq("id", v.id).select().single())
                      : q(sb.from("vehiculos").insert(row).select().single());
        },
        remove: (id) => q(sb.from("vehiculos").delete().eq("id", id)),
      },

      usuarios: {
        list: () => q(sb.from("profiles").select("*").order("nombre")),
        save: (p) => q(sb.from("profiles").update(pick(p, F_PERFIL)).eq("id", p.id)),
        // Crea la cuenta: primero la invitación (define rol), luego el registro.
        async crear(u) {
          const email = toEmail(u.usuario);
          await q(sb.from("invitaciones").upsert({
            email, rol: u.rol || "conductor", nombre: u.nombre,
            telefono: u.telefono || null, licencia_clase: u.licencia_clase || null,
            licencia_vence: u.licencia_vence || null,
          }));
          const tmp = window.supabase.createClient(cfg.url, cfg.anonKey, {
            auth: { persistSession: false, autoRefreshToken: false, storageKey: "tx-alta-usuario" },
          });
          const { data, error } = await tmp.auth.signUp({ email, password: u.password });
          if (error) {
            await sb.from("invitaciones").delete().eq("email", email);
            throw new Error(traducir(error.message));
          }
          if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
            await sb.from("invitaciones").delete().eq("email", email);
            throw new Error("Ese usuario ya existe.");
          }
          return true;
        },
      },

      portal: {
        ver: (codigo, clave) => portal("portal_ver", { p_codigo: codigo, p_clave: clave }),
        agregarPasajero: (codigo, clave, p) => portal("portal_agregar_pasajero", {
          p_codigo: codigo, p_clave: clave, p_nombre: p.nombre,
          p_documento: p.documento || null, p_telefono: p.telefono || null }),
        quitarPasajero: (codigo, clave, id) => portal("portal_quitar_pasajero",
          { p_codigo: codigo, p_clave: clave, p_pasajero: id }),
      },
    };
  }

  // ===================================================================
  //  Modo DEMO (localStorage)
  // ===================================================================
  function demoBackend() {
    const KEY = "transymec_crm_demo_v1";
    const SESSION = "transymec_crm_demo_session";
    const uid = () => crypto.randomUUID ? crypto.randomUUID()
      : "id-" + Date.now().toString(36) + Math.random().toString(36).slice(2);
    const now = () => new Date().toISOString();
    const delay = (v) => new Promise((r) => setTimeout(() => r(v), 80));
    const clone = (x) => JSON.parse(JSON.stringify(x));

    async function hash(text) {
      const buf = await crypto.subtle.digest("SHA-256",
        new TextEncoder().encode(String(text || "").trim().toUpperCase()));
      return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
    }

    function at(days, hour, min) {
      const d = new Date();
      d.setDate(d.getDate() + days);
      d.setHours(hour, min || 0, 0, 0);
      return d.toISOString();
    }

    function seed() {
      const U = { admin: uid(), juan: uid(), marcela: uid(), luis: uid() };
      const C = { colegio: uid(), minera: uid(), familia: uid(), agencia: uid() };
      const V = { bus1: uid(), bus2: uid(), mini: uid() };
      const T = Array.from({ length: 8 }, uid);
      const enDias = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
      const db = {
        users: [
          { id: U.admin, usuario: "admin", password: "admin123", nombre: "Administración Transymec",
            rol: "admin", telefono: "+56944373789", activo: true, created_at: now() },
          { id: U.juan, usuario: "jperez", password: "1234", nombre: "Juan Pérez", rol: "conductor",
            telefono: "+56911112222", licencia_clase: "A3", licencia_vence: enDias(20), activo: true, created_at: now() },
          { id: U.marcela, usuario: "mrojas", password: "1234", nombre: "Marcela Rojas", rol: "conductor",
            telefono: "+56933334444", licencia_clase: "A3", licencia_vence: enDias(400), activo: true, created_at: now() },
          { id: U.luis, usuario: "lsoto", password: "1234", nombre: "Luis Soto", rol: "conductor",
            telefono: "+56955556666", licencia_clase: "A1", licencia_vence: enDias(800), activo: true, created_at: now() },
        ],
        clientes: [
          { id: C.colegio, nombre: "Carolina Muñoz", empresa: "Colegio San Andrés", telefono: "+56922223333",
            email: "cmunoz@colegio.cl", notas: "Gira de estudios anual.", created_at: now() },
          { id: C.minera, nombre: "Rodrigo Vera", empresa: "Constructora Andes", telefono: "+56977778888",
            email: "rvera@andes.cl", notas: "Traslado de personal lunes a viernes.", created_at: now() },
          { id: C.familia, nombre: "Patricia González", empresa: "", telefono: "+56966667777",
            email: "", notas: "", created_at: now() },
          { id: C.agencia, nombre: "Felipe Lagos", empresa: "Andes Tour", telefono: "+56988889999",
            email: "reservas@andestour.cl", notas: "Agencia de turismo.", created_at: now() },
        ],
        vehiculos: [
          { id: V.bus1, patente: "RTKL45", tipo: "Bus pullman", marca_modelo: "Marcopolo Paradiso 1200",
            capacidad: 45, estado: "disponible", revision_tecnica_vence: enDias(15), seguro_vence: enDias(200), created_at: now() },
          { id: V.bus2, patente: "PZHJ81", tipo: "Bus intermedio", marca_modelo: "Mercedes-Benz OF-1721",
            capacidad: 32, estado: "disponible", revision_tecnica_vence: enDias(120), seguro_vence: enDias(25), created_at: now() },
          { id: V.mini, patente: "LKWS27", tipo: "Minibús", marca_modelo: "Mercedes-Benz Sprinter 515",
            capacidad: 19, estado: "mantencion", revision_tecnica_vence: enDias(300), seguro_vence: enDias(300), created_at: now() },
        ],
        viajes: [
          { id: T[0], codigo: "TX-DEMO24", cliente_id: C.colegio, servicio: "Gira de estudios",
            origen: "Colegio San Andrés, Ñuñoa, Santiago", destino: "Viña del Mar",
            punto_encuentro: "Av. Irarrázaval 3500, Ñuñoa", paradas: "Parada técnica en Casablanca",
            salida: at(0, 8, 30), regreso: at(0, 19, 0), pasajeros_estimados: 40,
            vehiculo_id: V.bus1, conductor_id: U.juan, estado: "en_curso",
            instrucciones: "Llegar 15 minutos antes. Cada alumno debe portar su cédula y autorización firmada.",
            notas_internas: "Cobrar estacionamiento en Viña al cliente.",
            ultima_lat: -33.2, ultima_lng: -71.4, ultima_ubicacion_at: at(0, 9, 40), created_at: now(), updated_at: now() },
          { id: T[1], codigo: "TX-K7P2QM", cliente_id: C.minera, servicio: "Traslado de personal",
            origen: "Metro Los Héroes, Santiago", destino: "Obra Colina, Ruta 57",
            punto_encuentro: "Salida Metro Los Héroes, costado poniente", salida: at(1, 6, 45), regreso: at(1, 8, 15),
            pasajeros_estimados: 28, vehiculo_id: V.bus2, conductor_id: U.marcela, estado: "confirmado",
            instrucciones: "Uso obligatorio de cinturón.", notas_internas: "", created_at: now(), updated_at: now() },
          { id: T[2], codigo: "TX-W3N8RT", cliente_id: C.agencia, servicio: "Turismo y excursiones",
            origen: "Hotel Plaza, Santiago Centro", destino: "Cajón del Maipo",
            punto_encuentro: "Lobby Hotel Plaza", salida: at(2, 9, 0), regreso: at(2, 18, 30),
            pasajeros_estimados: 30, vehiculo_id: V.bus1, conductor_id: U.juan, estado: "confirmado",
            instrucciones: "Llevar ropa de abrigo y bloqueador.", notas_internas: "Guía de la agencia sube en el hotel.",
            created_at: now(), updated_at: now() },
          { id: T[3], codigo: "TX-H5F9XC", cliente_id: C.familia, servicio: "Evento / matrimonio",
            origen: "Parroquia Los Dominicos, Las Condes", destino: "Centro de eventos Casona Lo Aguirre",
            punto_encuentro: "Estacionamiento de la parroquia", salida: at(4, 17, 0), regreso: at(5, 2, 0),
            pasajeros_estimados: 45, vehiculo_id: null, conductor_id: null, estado: "pendiente",
            instrucciones: "", notas_internas: "Confirmar cantidad final de invitados.", created_at: now(), updated_at: now() },
          { id: T[4], codigo: "TX-M2B6YD", cliente_id: C.agencia, servicio: "Transfer aeropuerto",
            origen: "Aeropuerto SCL, Pudahuel", destino: "Hotel Cumbres, Vitacura",
            punto_encuentro: "Puerta 3, nivel llegadas internacionales", salida: at(6, 11, 30), regreso: at(6, 13, 0),
            pasajeros_estimados: 15, vehiculo_id: V.bus2, conductor_id: U.luis, estado: "confirmado",
            instrucciones: "El conductor esperará con un cartel con el nombre del grupo.", notas_internas: "Vuelo LA 601.",
            created_at: now(), updated_at: now() },
          { id: T[5], codigo: "TX-R8T4GZ", cliente_id: C.minera, servicio: "Traslado de personal",
            origen: "Metro Los Héroes, Santiago", destino: "Obra Colina, Ruta 57",
            punto_encuentro: "Salida Metro Los Héroes, costado poniente", salida: at(-1, 6, 45), regreso: at(-1, 8, 15),
            pasajeros_estimados: 26, vehiculo_id: V.bus2, conductor_id: U.marcela, estado: "finalizado",
            instrucciones: "", notas_internas: "", created_at: now(), updated_at: now() },
          { id: T[6], codigo: "TX-C9V3LN", cliente_id: C.colegio, servicio: "Paseo de curso",
            origen: "Colegio San Andrés, Ñuñoa", destino: "Parque Safari, Rancagua",
            punto_encuentro: "Portón principal del colegio", salida: at(-5, 8, 0), regreso: at(-5, 18, 0),
            pasajeros_estimados: 38, vehiculo_id: V.bus1, conductor_id: U.juan, estado: "finalizado",
            instrucciones: "", notas_internas: "", created_at: now(), updated_at: now() },
          { id: T[7], codigo: "TX-P4J7SE", cliente_id: C.familia, servicio: "Viaje especial",
            origen: "Puente Alto", destino: "Pichilemu", punto_encuentro: "Plaza de Puente Alto",
            salida: at(-3, 7, 0), regreso: null, pasajeros_estimados: 18, vehiculo_id: null,
            conductor_id: null, estado: "cancelado", instrucciones: "", notas_internas: "Cliente canceló por clima.",
            created_at: now(), updated_at: now() },
        ],
        accesos: {},
        pasajeros: [],
        eventos: [],
      };
      const nombres = ["Martina Soto", "Benjamín Rojas", "Sofía Fuentes", "Vicente Araya", "Isidora Silva",
        "Tomás Contreras", "Florencia Díaz", "Agustín Morales", "Emilia Castro", "Joaquín Reyes"];
      nombres.forEach((n, i) => db.pasajeros.push({ id: uid(), viaje_id: T[0], nombre: n,
        documento: "", telefono: "", abordo: i < 8, origen: i < 6 ? "admin" : "portal", created_at: now() }));
      ["Ana Pérez", "Luis Torres", "Camila Núñez"].forEach((n) => db.pasajeros.push({ id: uid(),
        viaje_id: T[1], nombre: n, documento: "", telefono: "", abordo: false, origen: "admin", created_at: now() }));
      const ev = (viaje, tipo, mensaje, publico, cuando, autor, lat, lng) => db.eventos.push({ id: uid(),
        viaje_id: viaje, tipo, mensaje, publico, lat: lat ?? null, lng: lng ?? null,
        autor_id: autor, autor_nombre: db.users.find((u) => u.id === autor).nombre, created_at: cuando });
      ev(T[0], "nota", "Viaje confirmado con la profesora jefe.", false, at(-2, 12), U.admin);
      ev(T[0], "llegada", "Bus en el punto de encuentro", true, at(0, 8, 10), U.juan, -33.456, -70.598);
      ev(T[0], "estado", "Viaje iniciado · 38 pasajeros a bordo", true, at(0, 8, 35), U.juan, -33.456, -70.598);
      ev(T[0], "ubicacion", "Pasando por Casablanca, todo en orden", true, at(0, 9, 40), U.juan, -33.2, -71.4);
      ev(T[5], "estado", "Viaje iniciado", true, at(-1, 6, 50), U.marcela);
      ev(T[5], "estado", "Viaje finalizado", true, at(-1, 8, 10), U.marcela);
      return db;
    }

    let db;
    function load() {
      try { db = JSON.parse(localStorage.getItem(KEY)); } catch (e) { db = null; }
      if (!db || !db.users) { db = seed(); save(); seedClaves(); }
    }
    function save() { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* sin almacenamiento */ } }
    async function seedClaves() {
      for (const v of db.viajes) {
        db.accesos[v.id] = { hash: await hash(v.codigo === "TX-DEMO24" ? "DEMO24" : "123456"), updated_at: now() };
      }
      save();
    }
    load();

    const meId = () => { try { return localStorage.getItem(SESSION); } catch (e) { return null; } };
    const me = () => db.users.find((u) => u.id === meId() && u.activo) || null;
    const perfil = (u) => { if (!u) return null; const { password, ...p } = u; return clone(p); };
    const esAdmin = () => me() && me().rol === "admin";
    const puedeViaje = (id) => {
      const v = db.viajes.find((x) => x.id === id);
      return v && (esAdmin() || (me() && v.conductor_id === me().id));
    };
    const requireAdmin = () => { if (!esAdmin()) throw new Error("No tienes permiso para hacer esto."); };
    const requireViaje = (id) => { if (!puedeViaje(id)) throw new Error("No tienes permiso sobre este viaje."); };

    function hydrate(v) {
      const c = db.clientes.find((x) => x.id === v.cliente_id);
      const u = db.users.find((x) => x.id === v.conductor_id);
      const ve = db.vehiculos.find((x) => x.id === v.vehiculo_id);
      return Object.assign(clone(v), {
        cliente: c ? { id: c.id, nombre: c.nombre, empresa: c.empresa, telefono: c.telefono, email: c.email } : null,
        conductor: u ? { id: u.id, nombre: u.nombre, telefono: u.telefono } : null,
        vehiculo: ve ? { id: ve.id, patente: ve.patente, tipo: ve.tipo, marca_modelo: ve.marca_modelo, capacidad: ve.capacidad } : null,
      });
    }
    const visibles = () => db.viajes.filter((v) => esAdmin() || (me() && v.conductor_id === me().id));

    function addEvento(e) {
      const u = me();
      db.eventos.push({ id: uid(), viaje_id: e.viaje_id, tipo: e.tipo || "nota",
        mensaje: String(e.mensaje).trim().slice(0, 500), publico: !!e.publico, lat: e.lat ?? null, lng: e.lng ?? null,
        autor_id: u && u.id, autor_nombre: u && u.nombre, created_at: now() });
      if (e.lat != null && e.lng != null) {
        const v = db.viajes.find((x) => x.id === e.viaje_id);
        Object.assign(v, { ultima_lat: e.lat, ultima_lng: e.lng, ultima_ubicacion_at: now() });
      }
    }

    async function portalValidar(codigo, clave) {
      const v = db.viajes.find((x) => x.codigo === String(codigo || "").trim().toUpperCase());
      const a = v && db.accesos[v.id];
      if (!v || !a || a.hash !== (await hash(clave))) throw new Error("El código o la clave no son correctos.");
      return v;
    }
    const crud = (col, fields, norm) => ({
      list: () => { requireAdmin(); return delay(clone(db[col])); },
      save(o) {
        requireAdmin();
        const row = pick(o, fields);
        if (norm) norm(row);
        if (row.patente && db[col].some((x) => x.patente === row.patente && x.id !== o.id))
          throw new Error("Ya existe un vehículo con esa patente.");
        let r;
        if (o.id) { r = db[col].find((x) => x.id === o.id); Object.assign(r, row); }
        else { r = Object.assign({ id: uid(), created_at: now() }, row); db[col].push(r); }
        save();
        return delay(clone(r));
      },
      remove(id) {
        requireAdmin();
        db[col] = db[col].filter((x) => x.id !== id);
        const ref = col === "clientes" ? "cliente_id" : "vehiculo_id";
        db.viajes.forEach((v) => { if (v[ref] === id) v[ref] = null; });
        save();
        return delay(true);
      },
    });

    return {
      mode: "demo",
      resetDemo() { localStorage.removeItem(KEY); load(); },
      auth: {
        async login(usuario, password) {
          const u = db.users.find((x) => x.usuario === String(usuario).trim().toLowerCase().split("@")[0]);
          if (!u || u.password !== password) throw new Error("Usuario o contraseña incorrectos.");
          if (!u.activo) throw new Error("Tu cuenta no está activa. Pide al administrador que la habilite.");
          localStorage.setItem(SESSION, u.id);
          return delay(perfil(u));
        },
        current: () => delay(perfil(me())),
        logout: () => { localStorage.removeItem(SESSION); return delay(true); },
      },

      viajes: {
        list: () => delay(visibles().map(hydrate).sort((a, b) => a.salida.localeCompare(b.salida))),
        get(id) {
          const v = visibles().find((x) => x.id === id);
          if (!v) throw new Error("Viaje no encontrado.");
          return delay(hydrate(v));
        },
        save(o) {
          requireAdmin();
          const row = pick(o, F_VIAJE);
          let v;
          if (o.id) { v = db.viajes.find((x) => x.id === o.id); Object.assign(v, row, { updated_at: now() }); }
          else {
            v = Object.assign({ id: uid(), codigo: genCodigo(), estado: "pendiente", created_at: now(), updated_at: now() }, row);
            db.viajes.push(v);
          }
          save();
          return delay(hydrate(v));
        },
        remove(id) {
          requireAdmin();
          db.viajes = db.viajes.filter((x) => x.id !== id);
          db.pasajeros = db.pasajeros.filter((x) => x.viaje_id !== id);
          db.eventos = db.eventos.filter((x) => x.viaje_id !== id);
          delete db.accesos[id];
          save();
          return delay(true);
        },
        async nuevaClave(id) {
          requireAdmin();
          const clave = genClave();
          db.accesos[id] = { hash: await hash(clave), updated_at: now() };
          save();
          return clave;
        },
        tieneClave: (id) => delay(db.accesos[id] ? db.accesos[id].updated_at : null),
        cambiarEstado(id, estado, nota, lat, lng) {
          requireViaje(id);
          const v = db.viajes.find((x) => x.id === id);
          const ok = (v.estado === "confirmado" && estado === "en_curso") || (v.estado === "en_curso" && estado === "finalizado");
          if (!ok) throw new Error("Este cambio de estado no está permitido.");
          v.estado = estado; v.updated_at = now();
          addEvento({ viaje_id: id, tipo: "estado", publico: true, lat, lng,
            mensaje: (estado === "en_curso" ? "Viaje iniciado" : "Viaje finalizado") + (nota ? " · " + nota : "") });
          save();
          return delay(true);
        },
      },

      eventos: {
        list(viajeId) {
          requireViaje(viajeId);
          return delay(clone(db.eventos.filter((e) => e.viaje_id === viajeId)
            .sort((a, b) => b.created_at.localeCompare(a.created_at))));
        },
        add(e) {
          requireViaje(e.viaje_id);
          if (!String(e.mensaje || "").trim()) throw new Error("El mensaje está vacío.");
          addEvento(e); save(); return delay(true);
        },
        remove(id) { requireAdmin(); db.eventos = db.eventos.filter((e) => e.id !== id); save(); return delay(true); },
      },

      pasajeros: {
        list(viajeId) {
          requireViaje(viajeId);
          return delay(clone(db.pasajeros.filter((p) => p.viaje_id === viajeId)));
        },
        save(p) {
          requireAdmin();
          const row = pick(p, F_PASAJERO);
          if (p.id) Object.assign(db.pasajeros.find((x) => x.id === p.id), row);
          else db.pasajeros.push(Object.assign({ id: uid(), abordo: false, origen: "admin", created_at: now() }, row));
          save(); return delay(true);
        },
        addMany(viajeId, lista) {
          requireAdmin();
          lista.forEach((p) => db.pasajeros.push({ id: uid(), viaje_id: viajeId, nombre: p.nombre,
            documento: p.documento || "", telefono: p.telefono || "", abordo: false, origen: "admin", created_at: now() }));
          save(); return delay(true);
        },
        remove(id) { requireAdmin(); db.pasajeros = db.pasajeros.filter((x) => x.id !== id); save(); return delay(true); },
        abordo(id, valor) {
          const p = db.pasajeros.find((x) => x.id === id);
          if (!p) throw new Error("Pasajero no encontrado.");
          requireViaje(p.viaje_id);
          p.abordo = !!valor; save(); return delay(true);
        },
      },

      clientes: crud("clientes", F_CLIENTE),
      vehiculos: crud("vehiculos", F_VEHICULO, (r) => {
        if (r.patente) r.patente = r.patente.toUpperCase().replace(/\s|-/g, "");
        if (r.capacidad) r.capacidad = Number(r.capacidad);
      }),

      usuarios: {
        list: () => { requireAdmin(); return delay(db.users.map(perfil)); },
        save(p) {
          requireAdmin();
          Object.assign(db.users.find((x) => x.id === p.id), pick(p, F_PERFIL));
          save(); return delay(true);
        },
        crear(u) {
          requireAdmin();
          const usuario = String(u.usuario || "").trim().toLowerCase().split("@")[0];
          if (!/^[a-z0-9._-]{3,}$/.test(usuario)) throw new Error("El usuario debe tener al menos 3 letras o números, sin espacios.");
          if (db.users.some((x) => x.usuario === usuario)) throw new Error("Ese usuario ya existe.");
          if (String(u.password || "").length < 6) throw new Error("La contraseña debe tener al menos 6 caracteres.");
          db.users.push({ id: uid(), usuario, password: u.password, nombre: u.nombre, rol: u.rol || "conductor",
            telefono: u.telefono || "", licencia_clase: u.licencia_clase || "", licencia_vence: u.licencia_vence || null,
            activo: true, created_at: now() });
          save(); return delay(true);
        },
      },

      portal: {
        async ver(codigo, clave) {
          const v = await portalValidar(codigo, clave);
          const h = hydrate(v);
          const enCurso = v.estado === "en_curso";
          return delay({
            viaje: { codigo: v.codigo, servicio: v.servicio, origen: v.origen, destino: v.destino,
              punto_encuentro: v.punto_encuentro, paradas: v.paradas, salida: v.salida, regreso: v.regreso,
              pasajeros_estimados: v.pasajeros_estimados, estado: v.estado, instrucciones: v.instrucciones,
              ultima_lat: enCurso ? v.ultima_lat : null, ultima_lng: enCurso ? v.ultima_lng : null,
              ultima_ubicacion_at: enCurso ? v.ultima_ubicacion_at : null },
            cliente: h.cliente && { nombre: h.cliente.nombre, empresa: h.cliente.empresa },
            conductor: h.conductor && { nombre: h.conductor.nombre, telefono: h.conductor.telefono },
            vehiculo: h.vehiculo && { tipo: h.vehiculo.tipo, marca_modelo: h.vehiculo.marca_modelo,
              patente: h.vehiculo.patente, capacidad: h.vehiculo.capacidad },
            eventos: db.eventos.filter((e) => e.viaje_id === v.id && e.publico)
              .sort((a, b) => b.created_at.localeCompare(a.created_at))
              .map((e) => ({ tipo: e.tipo, mensaje: e.mensaje, created_at: e.created_at, lat: e.lat, lng: e.lng })),
            pasajeros: db.pasajeros.filter((p) => p.viaje_id === v.id)
              .map((p) => ({ id: p.id, nombre: p.nombre, abordo: p.abordo, origen: p.origen })),
          });
        },
        async agregarPasajero(codigo, clave, p) {
          const v = await portalValidar(codigo, clave);
          if (!["pendiente", "confirmado"].includes(v.estado))
            throw new Error("La nómina ya no se puede modificar porque el viaje comenzó o terminó.");
          if (!String(p.nombre || "").trim()) throw new Error("Escribe el nombre del pasajero.");
          db.pasajeros.push({ id: uid(), viaje_id: v.id, nombre: p.nombre.trim(), documento: p.documento || "",
            telefono: p.telefono || "", abordo: false, origen: "portal", created_at: now() });
          save(); return true;
        },
        async quitarPasajero(codigo, clave, id) {
          const v = await portalValidar(codigo, clave);
          if (!["pendiente", "confirmado"].includes(v.estado)) throw new Error("La nómina ya no se puede modificar.");
          db.pasajeros = db.pasajeros.filter((p) => !(p.id === id && p.viaje_id === v.id && p.origen === "portal"));
          save(); return true;
        },
      },
    };
  }

  const api = CONFIGURED ? supabaseBackend() : demoBackend();

  // Envuelve todo para que los errores síncronos también lleguen como promesas rechazadas.
  function wrap(obj) {
    Object.keys(obj).forEach((k) => {
      const val = obj[k];
      if (typeof val === "function") {
        obj[k] = function () {
          try { return Promise.resolve(val.apply(this, arguments)); }
          catch (e) { return Promise.reject(e); }
        };
      } else if (val && typeof val === "object") wrap(val);
    });
    return obj;
  }

  window.CRM = wrap(api);
  window.CRM.DEMO_INFO = api.mode === "demo" ? {
    admin: "admin / admin123", conductor: "jperez / 1234", pasajero: "Código TX-DEMO24 · Clave DEMO24",
  } : null;
})();

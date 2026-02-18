// Comentario: Activamos modo estricto para mejores prácticas y detección de errores.
'use strict';

// Comentario: Configuración central del proyecto (URLs y parámetros).
const CONFIG = {
  // Comentario: URL pública que devuelve el JSON del directorio (Google Apps Script Web App o similar).
  //directoryJsonUrl: 'https://script.google.com/macros/s/AKfycbx-kYSHUL0uwJc3pt5sv1nK6KmrPo4EHdKeIbC0Ek2vRoSFFYEgT9fS_E60-6M0XfFMjg/exec',
  directoryJsonUrl: 'https://script.google.com/macros/s/AKfycbxmMbjgw1a4M0qpObDBUqIUXCohEFu3qFjl5S8issFRbS8mwSAqYuLE8sdVkaCbcWy_yA/exec',
  // Comentario: URL del Google Form para sugerir altas/cambios (enlace normal).
  generalReportFormUrl: 'PEGA_AQUI_TU_URL_GOOGLE_FORM_GENERAL',
  // Comentario: Plantilla del Google Form pre-rellenado para incidencias (prefilled link base).
  // Comentario: Debe incluir el 'viewform' y luego usaremos entry.<id>=... en la querystring.
  prefilledIssueFormBaseUrl: 'PEGA_AQUI_TU_PREFILLED_LINK_BASE',
  // Comentario: Mapeo de IDs "entry" del Google Form para el prefill (tienes que pegar los tuyos).
  prefilledEntryIds: {
    // Comentario: ID del campo "Servicio" del Form.
    serviceName: 'ENTRY_ID_SERVICIO',
    // Comentario: ID del campo "Teléfono" del Form.
    phone: 'ENTRY_ID_TELEFONO',
    // Comentario: ID del campo "Categoría" del Form.
    category: 'ENTRY_ID_CATEGORIA',
    // Comentario: ID del campo "Dirección" del Form (opcional si lo creas).
    address: 'ENTRY_ID_DIRECCION',
    // Comentario: ID del campo "Enlace/Origen" del Form (opcional para debug).
    sourceUrl: 'ENTRY_ID_ORIGEN'
  }
};

// Comentario: Referencias a elementos del DOM para interacción.
const dom = {
  // Comentario: Contenedor donde se renderizan tarjetas.
  cards: document.getElementById('cards'),
  // Comentario: Texto de estado para mensajes a usuario.
  statusText: document.getElementById('statusText'),
  // Comentario: Campo de búsqueda.
  searchInput: document.getElementById('searchInput'),
  // Comentario: Selector de categoría.
  categorySelect: document.getElementById('categorySelect'),
  // Comentario: Botón para recargar datos.
  refreshButton: document.getElementById('refreshButton'),
  // Comentario: Link a formulario general.
  generalReportLink: document.getElementById('generalReportLink'),
  // Comentario: Span de última actualización.
  lastUpdated: document.getElementById('lastUpdated')
};

// Comentario: Estado en memoria del directorio completo.
let directoryRecords = [];
// Comentario: Categorías disponibles en el dataset.
let categories = [];

// Comentario: Inicializamos enlaces y escuchas de eventos.
init();

// Comentario: Función de arranque para preparar UI y cargar datos.
function init() {
  // Comentario: Configuramos el enlace del formulario general (si está configurado).
  dom.generalReportLink.href = CONFIG.generalReportFormUrl !== 'PEGA_AQUI_TU_URL_GOOGLE_FORM_GENERAL'
    ? CONFIG.generalReportFormUrl
    : '#';

  // Comentario: Escuchamos cambios en el buscador.
  dom.searchInput.addEventListener('input', () => {
    // Comentario: Re-renderizamos según filtros actuales.
    render();
  });

  // Comentario: Escuchamos cambios en el selector de categoría.
  dom.categorySelect.addEventListener('change', () => {
    // Comentario: Re-renderizamos según filtros actuales.
    render();
  });

  // Comentario: Escuchamos clic en recargar.
  dom.refreshButton.addEventListener('click', async () => {
    // Comentario: Forzamos recarga del directorio.
    await loadDirectory();
  });

  // Comentario: Cargamos datos iniciales.
  void loadDirectory();
}

// Comentario: Cargamos el directorio desde la URL JSON.
async function loadDirectory() {
  // Comentario: Validamos que el usuario haya configurado la URL.
  if (CONFIG.directoryJsonUrl === 'https://script.google.com/macros/s/AKfycbx-kYSHUL0uwJc3pt5sv1nK6KmrPo4EHdKeIbC0Ek2vRoSFFYEgT9fS_E60-6M0XfFMjg/exec') {
    // Comentario: Mostramos estado de configuración pendiente.
    setStatus('⚠️ Falta configurar la URL JSON del directorio (CONFIG.directoryJsonUrl).');
    // Comentario: Limpiamos tarjetas.
    dom.cards.innerHTML = '';
    // Comentario: Salimos.
    return;
  }

  // Comentario: Mostramos estado de carga.
  setStatus('Cargando directorio…');

  try {
    // Comentario: Pedimos los datos a la fuente JSON.
    const response = await fetch(CONFIG.directoryJsonUrl, { method: 'GET' });

    // Comentario: Si la respuesta no es OK, lanzamos error.
    if (!response.ok) {
      // Comentario: Lanzamos excepción con el estado HTTP para diagnóstico.
      throw new Error(`Error HTTP ${response.status}`);
    }

    // Comentario: Parseamos JSON de respuesta.
    const data = await response.json();

    // Comentario: Normalizamos datos a un array, por si el backend devuelve {items:[...]}.
    const items = Array.isArray(data) ? data : (Array.isArray(data.items) ? data.items : []);

    // Comentario: Guardamos dataset en memoria, filtrando entradas inactivas si existe el campo.
    directoryRecords = items
      .filter((r) => {
        // Comentario: Si no existe "activo", asumimos que está activo.
        if (typeof r.activo === 'undefined' || r.activo === null) {
          return true;
        }
        // Comentario: Aceptamos valores booleanos o strings tipo "TRUE".
        return String(r.activo).toLowerCase() === 'true';
      })
      .map(normalizeRecord);

    // Comentario: Extraemos categorías únicas.
    categories = getUniqueCategories(directoryRecords);

    // Comentario: Rellenamos selector de categorías.
    populateCategorySelect(categories);

    // Comentario: Mostramos fecha de actualización si llega en la payload.
    setLastUpdated(data);

    // Comentario: Renderizamos la vista inicial.
    render();

    // Comentario: Indicamos total cargado en estado.
    setStatus(`✅ Directorio cargado: ${directoryRecords.length} entradas.`);
  } catch (error) {
    // Comentario: Mostramos error en consola para depuración.
    // eslint-disable-next-line no-console
    console.error(error);

    // Comentario: Informamos al usuario.
    setStatus(`❌ No se pudo cargar el directorio (${String(error.message || error)}).`);
    // Comentario: Limpiamos tarjetas para evitar mostrar datos inconsistentes.
    dom.cards.innerHTML = '';
  }
}

// Comentario: Normalizamos y limpiamos un registro para evitar nulls y mejorar UX.
function normalizeRecord(raw) {
  // Comentario: Aseguramos que el objeto existe.
  const r = raw || {};

  // Comentario: Devolvemos el objeto normalizado.
  return {
    // Comentario: Categoría del registro.
    categoria: safeText(r.categoria),
    // Comentario: Nombre del servicio.
    nombre: safeText(r.nombre),
    // Comentario: Teléfono del servicio.
    telefono: safeText(r.telefono),
    // Comentario: Dirección postal.
    direccion: safeText(r.direccion),
    // Comentario: Email del servicio.
    email: safeText(r.email),
    // Comentario: Web del servicio.
    web: safeText(r.web),
    // Comentario: Horario orientativo.
    horario: safeText(r.horario),
    // Comentario: Notas adicionales.
    notas: safeText(r.notas)
  };
}

// Comentario: Convertimos un valor a texto seguro y recortado.
function safeText(value) {
  // Comentario: Convertimos null/undefined a cadena vacía.
  const text = value === null || typeof value === 'undefined' ? '' : String(value);
  // Comentario: Recortamos espacios.
  return text.trim();
}

// Comentario: Obtenemos categorías únicas, ordenadas.
function getUniqueCategories(records) {
  // Comentario: Creamos un set para evitar duplicados.
  const set = new Set();

  // Comentario: Recorremos registros y acumulamos categorías.
  records.forEach((r) => {
    // Comentario: Añadimos categoría si existe.
    if (r.categoria) {
      set.add(r.categoria);
    }
  });

  // Comentario: Convertimos a array y ordenamos alfabéticamente.
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
}

// Comentario: Rellenamos el selector de categorías con opciones.
function populateCategorySelect(categoryList) {
  // Comentario: Guardamos selección actual para mantenerla si existe.
  const current = dom.categorySelect.value;

  // Comentario: Reseteamos opciones dejando "Todas".
  dom.categorySelect.innerHTML = '<option value="__all__">Todas</option>';

  // Comentario: Añadimos cada categoría como opción.
  categoryList.forEach((cat) => {
    // Comentario: Creamos option.
    const opt = document.createElement('option');
    // Comentario: Asignamos value.
    opt.value = cat;
    // Comentario: Asignamos texto visible.
    opt.textContent = cat;
    // Comentario: Insertamos en select.
    dom.categorySelect.appendChild(opt);
  });

  // Comentario: Restauramos la selección si sigue disponible.
  if (current && (current === '__all__' || categoryList.includes(current))) {
    dom.categorySelect.value = current;
  }
}

// Comentario: Ajustamos el texto de última actualización si el backend lo aporta.
function setLastUpdated(payload) {
  // Comentario: Extraemos la fecha si existe en payload.lastUpdated o payload.updatedAt.
  const raw = payload && (payload.lastUpdated || payload.updatedAt) ? String(payload.lastUpdated || payload.updatedAt) : '';
  // Comentario: Si no hay fecha, dejamos por defecto.
  if (!raw) {
    dom.lastUpdated.textContent = 'Última actualización: —';
    return;
  }
  // Comentario: Pintamos la fecha tal cual (puedes formatearla si tu backend devuelve ISO).
  dom.lastUpdated.textContent = `Última actualización: ${raw}`;
}

// Comentario: Renderiza tarjetas según filtros actuales.
function render() {
  // Comentario: Tomamos texto de búsqueda en minúsculas.
  const query = dom.searchInput.value.trim().toLowerCase();
  // Comentario: Tomamos categoría seleccionada.
  const selectedCategory = dom.categorySelect.value;

  // Comentario: Filtramos registros por categoría y por query.
  const filtered = directoryRecords.filter((r) => {
    // Comentario: Aplicamos filtro por categoría si no es "todas".
    const categoryOk = selectedCategory === '__all__' || r.categoria === selectedCategory;
    // Comentario: Si no pasa categoría, descartamos.
    if (!categoryOk) {
      return false;
    }
    // Comentario: Si no hay búsqueda, aceptamos.
    if (!query) {
      return true;
    }
    // Comentario: Creamos un bloque de texto para búsqueda global.
    const haystack = [
      r.categoria,
      r.nombre,
      r.telefono,
      r.direccion,
      r.email,
      r.web,
      r.horario,
      r.notas
    ].join(' ').toLowerCase();

    // Comentario: Evaluamos coincidencia.
    return haystack.includes(query);
  });

  // Comentario: Si no hay resultados, mostramos un mensaje amigable.
  if (filtered.length === 0) {
    dom.cards.innerHTML = '<p class="status-text">No hay resultados con esos filtros.</p>';
    return;
  }

  // Comentario: Construimos HTML de tarjetas.
  dom.cards.innerHTML = filtered.map(buildCardHtml).join('');
}

// Comentario: Construye el HTML de una tarjeta.
function buildCardHtml(r) {
  // Comentario: Construimos enlace tel si hay teléfono.
  const telLink = r.telefono ? `<a href="tel:${escapeAttr(cleanPhone(r.telefono))}">${escapeHtml(r.telefono)}</a>` : '—';

  // Comentario: Construimos enlace mailto si hay email (con asunto útil).
  const mailLink = r.email
    ? `<a href="${escapeAttr(buildMailto(r.email, r.nombre))}">${escapeHtml(r.email)}</a>`
    : '—';

  // Comentario: Construimos enlace web si hay web.
  const webLink = r.web
    ? `<a href="${escapeAttr(normalizeUrl(r.web))}" target="_blank" rel="noopener noreferrer">Abrir web</a>`
    : '—';

  // Comentario: Construimos URL de Google Maps para "cómo llegar" si hay dirección.
  const mapsUrl = r.direccion ? buildMapsDirectionsUrl(r.direccion) : '';

  // Comentario: Construimos URL del Google Form pre-rellenado para incidencias.
  const issueUrl = buildPrefilledIssueFormUrl(r);

  // Comentario: Devolvemos la tarjeta con campos y acciones.
  return `
    <article class="card">
      <div class="card-header">
        <h3 class="card-title">${escapeHtml(r.nombre || 'Sin nombre')}</h3>
        <span class="badge">${escapeHtml(r.categoria || 'Sin categoría')}</span>
      </div>

      <div class="card-row">📞 <strong>Tel:</strong> ${telLink}</div>
      <div class="card-row">📍 <strong>Dirección:</strong> ${r.direccion ? escapeHtml(r.direccion) : '—'}</div>
      <div class="card-row">✉️ <strong>Email:</strong> ${mailLink}</div>
      <div class="card-row">🌐 <strong>Web:</strong> ${webLink}</div>
      <div class="card-row">🕘 <strong>Horario:</strong> ${r.horario ? escapeHtml(r.horario) : '—'}</div>
      <div class="card-row">📝 <strong>Notas:</strong> ${r.notas ? escapeHtml(r.notas) : '—'}</div>

      <div class="card-actions">
        <a class="button" href="tel:${escapeAttr(cleanPhone(r.telefono))}" ${r.telefono ? '' : 'aria-disabled="true"'}>📞 Llamar</a>
        <a class="button button-secondary" href="${mapsUrl ? escapeAttr(mapsUrl) : '#'}" target="_blank" rel="noopener noreferrer" ${mapsUrl ? '' : 'aria-disabled="true"'}>🧭 Cómo llegar</a>
        <a class="button button-secondary" href="${r.email ? escapeAttr(buildMailto(r.email, r.nombre)) : '#'}" ${r.email ? '' : 'aria-disabled="true"'}>✉️ Email</a>
        <a class="button button-warn" href="${escapeAttr(issueUrl)}" target="_blank" rel="noopener noreferrer">⚠️ Dato incorrecto</a>
      </div>
    </article>
  `;
}

// Comentario: Construye un mailto con asunto y cuerpo pre-rellenado.
function buildMailto(email, serviceName) {
  // Comentario: Definimos asunto informativo.
  const subject = `Consulta sobre ${serviceName || 'servicio'}`;
  // Comentario: Definimos cuerpo básico.
  const body = `Hola,\n\nQuería hacer una consulta sobre ${serviceName || 'este servicio'}.\n\nGracias.`;
  // Comentario: Construimos URL mailto con parámetros, codificados.
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

// Comentario: Construye una URL de Google Maps para rutas hasta la dirección.
function buildMapsDirectionsUrl(address) {
  // Comentario: Codificamos destino para URL.
  const destination = encodeURIComponent(address);
  // Comentario: Construimos URL recomendada por Google con api=1.
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
}

// Comentario: Construye la URL del Form de incidencias con prefill usando entry.<id>=valor.
function buildPrefilledIssueFormUrl(record) {
  // Comentario: Si falta configurar el prefilled link base, devolvemos el formulario general como fallback.
  if (CONFIG.prefilledIssueFormBaseUrl === 'PEGA_AQUI_TU_PREFILLED_LINK_BASE') {
    return CONFIG.generalReportFormUrl !== 'PEGA_AQUI_TU_URL_GOOGLE_FORM_GENERAL'
      ? CONFIG.generalReportFormUrl
      : '#';
  }

  // Comentario: Creamos un objeto con parámetros.
  const params = new URLSearchParams();

  // Comentario: Añadimos servicio.
  params.set(`entry.${CONFIG.prefilledEntryIds.serviceName}`, record.nombre || '');
  // Comentario: Añadimos teléfono.
  params.set(`entry.${CONFIG.prefilledEntryIds.phone}`, record.telefono || '');
  // Comentario: Añadimos categoría.
  params.set(`entry.${CONFIG.prefilledEntryIds.category}`, record.categoria || '');
  // Comentario: Añadimos dirección si existe y está configurado el entry.
  if (CONFIG.prefilledEntryIds.address && CONFIG.prefilledEntryIds.address !== 'ENTRY_ID_DIRECCION') {
    params.set(`entry.${CONFIG.prefilledEntryIds.address}`, record.direccion || '');
  }
  // Comentario: Añadimos URL de origen si existe y está configurado el entry.
  if (CONFIG.prefilledEntryIds.sourceUrl && CONFIG.prefilledEntryIds.sourceUrl !== 'ENTRY_ID_ORIGEN') {
    params.set(`entry.${CONFIG.prefilledEntryIds.sourceUrl}`, window.location.href);
  }

  // Comentario: Devolvemos la URL final (base + parámetros).
  return `${CONFIG.prefilledIssueFormBaseUrl}${CONFIG.prefilledIssueFormBaseUrl.includes('?') ? '&' : '?'}${params.toString()}`;
}

// Comentario: Limpia un teléfono para usarlo en tel: (elimina espacios y caracteres no numéricos salvo +).
function cleanPhone(phone) {
  // Comentario: Si no hay teléfono, devolvemos cadena vacía.
  if (!phone) {
    return '';
  }
  // Comentario: Mantenemos dígitos y el signo +.
  return String(phone).replace(/[^0-9+]/g, '');
}

// Comentario: Normaliza una URL si el usuario puso sin protocolo.
function normalizeUrl(url) {
  // Comentario: Si no hay url, devolvemos cadena vacía.
  if (!url) {
    return '';
  }
  // Comentario: Si ya tiene protocolo, la devolvemos.
  if (/^https?:\/\//i.test(url)) {
    return url;
  }
  // Comentario: Si no tiene, añadimos https.
  return `https://${url}`;
}

// Comentario: Escapamos HTML para evitar inyección en el renderizado.
function escapeHtml(text) {
  // Comentario: Convertimos a string seguro.
  const s = String(text || '');
  // Comentario: Reemplazamos caracteres especiales.
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Comentario: Escapamos atributos para evitar romper HTML.
function escapeAttr(text) {
  // Comentario: Reutilizamos escapeHtml para atributos.
  return escapeHtml(text);
}

// Comentario: Actualiza el texto de estado en UI.
function setStatus(message) {
  // Comentario: Pintamos el mensaje.
  dom.statusText.textContent = message;
}

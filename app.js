//Activamos modo estricto para mejores prácticas y detección de errores.
'use strict';

//Configuración central del proyecto (URLs y parámetros).
const CONFIG = {
  //URL pública que devuelve el JSON del directorio (Google Apps Script Web App o similar).
  directoryJsonUrl: 'https://script.google.com/macros/s/AKfycbxmMbjgw1a4M0qpObDBUqIUXCohEFu3qFjl5S8issFRbS8mwSAqYuLE8sdVkaCbcWy_yA/exec',

  //URL del Google Form para sugerir altas/cambios (enlace normal).
  generalReportFormUrl: 'https://docs.google.com/forms/d/e/1FAIpQLSfBF6dHuGS07b27gE-huc2TSxGrq95s6yggiZn9bGy5Oumokg/viewform',

  //URL base del Google Form “Datos incorrectos” (viewform público).
  incorrectDataFormBaseUrl: 'https://docs.google.com/forms/d/e/1FAIpQLSdnZz0mIoIOjxgXQYH8EXrWOJp4CM9UaOyW9-VLu0fxi1TiFw/viewform',

  //Mapeo de IDs "entry" del Google Form “Datos incorrectos” para el prefill.
  incorrectDataEntryIds: {
    //ID del campo "Servicio (auto desde la web)".
    service: '565027741',
    //ID del campo "Categoría (auto desde la web)".
    category: '1781634916',
    //ID del campo "Qué dato está mal".
    wrongField: '1519443588',
    //ID del campo "Dato actual (el que aparece ahora)".
    currentValue: '2118255125',
    //ID del campo "Dato correcto (o sugerencia)".
    correctValue: '214689891',
    //ID del campo "Explica un poco (si hace falta)".
    details: '136295022',
    //ID del campo "Fuente".
    source: '1979791452',
    //ID del campo "Tu contacto (opcional)".
    contact: '1914913705',
    //ID del campo "ID interno del registro (auto desde la web)".
    internalId: '224590926',
    //ID del campo "URL de la página donde lo viste (auto desde la web)".
    pageUrl: '833193537'
  }
};

//Referencias a elementos del DOM para interacción.
const dom = {
  //Contenedor donde se renderizan tarjetas.
  cards: document.getElementById('cards'),
  //Texto de estado para mensajes a usuario.
  statusText: document.getElementById('statusText'),
  //Campo de búsqueda.
  searchInput: document.getElementById('searchInput'),
  //Selector de categoría.
  categorySelect: document.getElementById('categorySelect'),
  //Botón para recargar datos.
  refreshButton: document.getElementById('refreshButton'),
  //Link a formulario general.
  generalReportLink: document.getElementById('generalReportLink'),
  //Span de última actualización.
  lastUpdated: document.getElementById('lastUpdated')
};

//Estado en memoria del directorio completo.
let directoryRecords = [];
//Categorías disponibles en el dataset.
let categories = [];

//Inicializamos enlaces y escuchas de eventos.
init();

//Función de arranque para preparar UI y cargar datos.
function init() {
  //Configuramos el enlace del formulario general si existe el elemento en el DOM.
  if (dom.generalReportLink) {
    //Asignamos el href si la URL está configurada.
    dom.generalReportLink.href = CONFIG.generalReportFormUrl ? CONFIG.generalReportFormUrl : '#';
  }

  //Escuchamos cambios en el buscador.
  dom.searchInput.addEventListener('input', () => {
    //Re-renderizamos según filtros actuales.
    render();
  });

  //Escuchamos el submit del teclado móvil (Enter/Lupa) para ocultar teclado y mostrar resultados.
  dom.searchInput.addEventListener('keydown', (ev) => {
    //Si el usuario pulsa Enter, evitamos submit y cerramos teclado.
    if (ev.key === 'Enter') {
      //Evitamos comportamiento por defecto.
      ev.preventDefault();
      //Quitamos foco para ocultar teclado móvil.
      dom.searchInput.blur();
      //Forzamos render por si se quedó pendiente.
      render();
    }
  });

  //Escuchamos cambios en el selector de categoría.
  dom.categorySelect.addEventListener('change', () => {
    //Re-renderizamos según filtros actuales.
    render();
  });

  //Escuchamos clic en recargar.
  dom.refreshButton.addEventListener('click', async () => {
    //Forzamos recarga del directorio.
    await loadDirectory();
  });

  //Cargamos datos iniciales.
  void loadDirectory();
}

//Cargamos el directorio desde la URL JSON.
async function loadDirectory() {
  //Validamos que exista una URL válida configurada.
  if (!CONFIG.directoryJsonUrl) {
    //Mostramos estado de configuración pendiente.
    setStatus('⚠️ Falta configurar la URL JSON del directorio (CONFIG.directoryJsonUrl).');
    //Limpiamos tarjetas.
    dom.cards.innerHTML = '';
    //Salimos.
    return;
  }

  //Mostramos estado de carga.
  setStatus('Cargando directorio…');

  try {
    //Pedimos los datos a la fuente JSON.
    const response = await fetch(CONFIG.directoryJsonUrl, { method: 'GET' });

    //Si la respuesta no es OK, lanzamos error.
    if (!response.ok) {
      //Lanzamos excepción con el estado HTTP para diagnóstico.
      throw new Error(`Error HTTP ${response.status}`);
    }

    //Parseamos JSON de respuesta.
    const data = await response.json();

    //Normalizamos datos a un array, por si el backend devuelve {items:[...]}.
    const items = Array.isArray(data) ? data : (Array.isArray(data.items) ? data.items : []);

    //Guardamos dataset en memoria, filtrando entradas inactivas si existe el campo.
    directoryRecords = items
      .filter((r) => {
        //Si no existe "activo", asumimos que está activo.
        if (typeof r.activo === 'undefined' || r.activo === null || String(r.activo).trim() === '') {
          return true;
        }
        //Aceptamos valores booleanos o strings tipo "TRUE", "1", "si".
        const v = String(r.activo).trim().toLowerCase();
        return v === 'true' || v === '1' || v === 'si' || v === 'sí';
      })
      .map(normalizeRecord)
      .map(addSearchIndex_);

    //Extraemos categorías únicas.
    categories = getUniqueCategories(directoryRecords);

    //Rellenamos selector de categorías.
    populateCategorySelect(categories);

    //Mostramos fecha de actualización si llega en la payload.
    setLastUpdated(data);

    //Renderizamos la vista inicial.
    render();

    //Indicamos total cargado en estado.
    setStatus(`✅ Directorio cargado: ${directoryRecords.length} entradas.`);
  } catch (error) {
    //Mostramos error en consola solo cuando hay problema.
    // eslint-disable-next-line no-console
    console.error(error);

    //Informamos al usuario.
    setStatus(`❌ No se pudo cargar el directorio (${String(error.message || error)}).`);
    //Limpiamos tarjetas para evitar mostrar datos inconsistentes.
    dom.cards.innerHTML = '';
  }
}

//Normalizamos y limpiamos un registro para evitar nulls y mejorar UX.
function normalizeRecord(raw) {
  //Aseguramos que el objeto existe.
  const r = raw || {};

  //Devolvemos el objeto normalizado.
  return {
    //Categoría del registro.
    categoria: safeText(r.categoria),
    //Nombre del servicio.
    nombre: safeText(r.nombre),
    //Teléfono del servicio.
    telefono: safeText(r.telefono),
    //Dirección postal.
    direccion: safeText(r.direccion),
    //Email del servicio.
    email: safeText(r.email),
    //Web del servicio.
    web: safeText(r.web),
    //Horario orientativo.
    horario: safeText(r.horario),
    //Notas adicionales.
    notas: safeText(r.notas),
    //ID interno opcional si existe en el JSON.
    id: safeText(r.id)
  };
}

//Añadimos un índice de búsqueda normalizado (sin acentos) para búsquedas tolerantes.
function addSearchIndex_(record) {
  //Creamos un bloque de texto con los campos relevantes.
  const haystack = [
    record.categoria,
    record.nombre,
    record.telefono,
    record.direccion,
    record.email,
    record.web,
    record.horario,
    record.notas
  ].join(' ');

  //Devolvemos el registro con un campo interno de búsqueda.
  return {
    ...record,
    _search: normalizeForSearch_(haystack)
  };
}

//Normaliza un texto para búsquedas ignorando acentos y mayúsculas.
function normalizeForSearch_(text) {
  //Convertimos a string seguro.
  const s = String(text || '');
  //Pasamos a minúsculas.
  const lower = s.toLowerCase();
  //Eliminamos acentos usando Unicode normalization.
  const noAccents = lower.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  //Compactamos espacios.
  return noAccents.replace(/\s+/g, ' ').trim();
}

//Convertimos un valor a texto seguro y recortado.
function safeText(value) {
  //Convertimos null/undefined a cadena vacía.
  const text = value === null || typeof value === 'undefined' ? '' : String(value);
  //Recortamos espacios.
  return text.trim();
}

//Obtenemos categorías únicas, ordenadas.
function getUniqueCategories(records) {
  //Creamos un set para evitar duplicados.
  const set = new Set();

  //Recorremos registros y acumulamos categorías.
  records.forEach((r) => {
    //Añadimos categoría si existe.
    if (r.categoria) {
      set.add(r.categoria);
    }
  });

  //Convertimos a array y ordenamos alfabéticamente.
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
}

//Rellenamos el selector de categorías con opciones.
function populateCategorySelect(categoryList) {
  //Guardamos selección actual para mantenerla si existe.
  const current = dom.categorySelect.value;

  //Reseteamos opciones dejando "Todas".
  dom.categorySelect.innerHTML = '<option value="__all__">Todas</option>';

  //Añadimos cada categoría como opción.
  categoryList.forEach((cat) => {
    //Creamos option.
    const opt = document.createElement('option');
    //Asignamos value.
    opt.value = cat;
    //Asignamos texto visible.
    opt.textContent = cat;
    //Insertamos en select.
    dom.categorySelect.appendChild(opt);
  });

  //Restauramos la selección si sigue disponible.
  if (current && (current === '__all__' || categoryList.includes(current))) {
    dom.categorySelect.value = current;
  }
}

//Ajustamos el texto de última actualización si el backend lo aporta.
function setLastUpdated(payload) {
  //Extraemos la fecha si existe en payload.lastUpdated o payload.updatedAt.
  const raw = payload && (payload.lastUpdated || payload.updatedAt) ? String(payload.lastUpdated || payload.updatedAt) : '';
  //Si no hay fecha, dejamos por defecto.
  if (!raw) {
    dom.lastUpdated.textContent = 'Última actualización: —';
    return;
  }
  //Pintamos la fecha tal cual.
  dom.lastUpdated.textContent = `Última actualización: ${raw}`;
}

//Renderiza tarjetas según filtros actuales.
function render() {
  //Tomamos texto de búsqueda.
  const rawQuery = dom.searchInput.value.trim();
  //Normalizamos query para búsqueda tolerante.
  const query = normalizeForSearch_(rawQuery);
  //Tomamos categoría seleccionada.
  const selectedCategory = dom.categorySelect.value;

  //Filtramos registros por categoría y por query.
  const filtered = directoryRecords.filter((r) => {
    //Aplicamos filtro por categoría si no es "todas".
    const categoryOk = selectedCategory === '__all__' || r.categoria === selectedCategory;
    //Si no pasa categoría, descartamos.
    if (!categoryOk) {
      return false;
    }
    //Si no hay búsqueda, aceptamos.
    if (!query) {
      return true;
    }
    //Evaluamos coincidencia en el índice normalizado.
    return r._search.includes(query);
  });

  //Si no hay resultados, mostramos un mensaje amigable.
  if (filtered.length === 0) {
    dom.cards.innerHTML = '<p class="status-text">No hay resultados con esos filtros.</p>';
    return;
  }

  //Construimos HTML de tarjetas.
  dom.cards.innerHTML = filtered.map(buildCardHtml).join('');
}

//Construye el HTML de una tarjeta.
function buildCardHtml(r) {
  //Construimos enlaces tel: (varios teléfonos si aplica).
  const phoneLinksHtml = r.telefono ? buildPhoneLinksHtml(r.telefono) : '';

  //Construimos URL de Google Maps para "cómo llegar" si hay dirección.
  const mapsUrl = r.direccion ? buildMapsDirectionsUrl(r.direccion) : '';

  //Construimos mailto para el botón de email si hay correo.
  const mailtoUrl = r.email ? buildMailto(r.email, r.nombre) : '';

  //Normalizamos URL para enlazar la web visible.
  const normalizedWebUrl = r.web ? normalizeUrl(r.web) : '';

  //Construimos URL del Form “Datos incorrectos” pre-rellenado.
  const incorrectUrl = buildPrefilledIncorrectDataFormUrl(r);

  //Construimos filas solo si hay dato (si falta, no se muestra nada).
  const rowPhone = r.telefono
    ? `<div class="card-row">📞 <strong>Tel:</strong> ${phoneLinksHtml}</div>`
    : '';

  //Mostramos la dirección como texto plano.
  const rowAddress = r.direccion
    ? `<div class="card-row">📍 <strong>Dirección:</strong> ${escapeHtml(r.direccion)}</div>`
    : '';

  //Mostramos el email como texto plano.
  const rowEmail = r.email
    ? `<div class="card-row">✉️ <strong>Email:</strong> ${escapeHtml(r.email)}</div>`
    : '';

  //Mostramos la web como enlace clicable con el texto tal cual.
  const rowWeb = r.web
    ? `<div class="card-row">🌐 <strong>Web:</strong> <a href="${escapeAttr(normalizedWebUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(r.web)}</a></div>`
    : '';

  //Mostramos horario si existe.
  const rowSchedule = r.horario
    ? `<div class="card-row">🕘 <strong>Horario:</strong> ${escapeHtml(r.horario)}</div>`
    : '';

  //Mostramos notas si existen.
  const rowNotes = r.notas
    ? `<div class="card-row">📝 <strong>Notas:</strong> ${escapeHtml(r.notas)}</div>`
    : '';

  //Construimos botón “Cómo llegar” solo si hay dirección.
  const mapsButton = mapsUrl
    ? `<a class="button button-secondary" href="${escapeAttr(mapsUrl)}" target="_blank" rel="noopener noreferrer">🧭 Cómo llegar</a>`
    : '';

  //Construimos botón “Email” solo si hay email.
  const emailButton = mailtoUrl
    ? `<a class="button button-secondary" href="${escapeAttr(mailtoUrl)}">✉️ Email</a>`
    : '';

  //Devolvemos la tarjeta con campos y acciones.
  return `
    <article class="card">
      <div class="card-header">
        <h3 class="card-title">${escapeHtml(r.nombre || 'Sin nombre')}</h3>
        <span class="badge">${escapeHtml(r.categoria || 'Sin categoría')}</span>
      </div>

      ${rowPhone}
      ${rowAddress}
      ${rowEmail}
      ${rowWeb}
      ${rowSchedule}
      ${rowNotes}

      <div class="card-actions">
        ${mapsButton}
        ${emailButton}
        <a class="button button-warn" href="${escapeAttr(incorrectUrl)}" target="_blank" rel="noopener noreferrer" ${incorrectUrl !== '#' ? '' : 'aria-disabled="true"'}>⚠️ Dato incorrecto</a>
      </div>
    </article>
  `;
}

//Convierte una cadena de teléfonos en una lista de teléfonos individuales.
function splitPhones_(phonesRaw) {
  //Normalizamos a texto.
  const raw = String(phonesRaw || '');
  //Separamos por barras, comas, punto y coma o saltos de línea.
  const parts = raw.split(/[\/,;\n]+/g);
  //Limpiamos espacios y descartamos vacíos.
  return parts
    .map((p) => String(p || '').trim())
    .filter((p) => Boolean(p));
}

//Construye HTML con enlaces tel: para uno o varios teléfonos.
function buildPhoneLinksHtml(phonesRaw) {
  //Obtenemos lista de teléfonos.
  const phones = splitPhones_(phonesRaw);
  //Si no hay teléfonos, devolvemos vacío.
  if (phones.length === 0) {
    return '';
  }
  //Construimos enlaces individuales.
  const links = phones.map((p) => {
    //Calculamos teléfono limpio para el href tel:.
    const clean = cleanPhone(p);
    //Si no hay dígitos, devolvemos texto plano.
    if (!clean) {
      return escapeHtml(p);
    }
    //Devolvemos enlace tel: con texto original.
    return `<a href="tel:${escapeAttr(clean)}">${escapeHtml(p)}</a>`;
  });
  //Unimos con separador visual.
  return links.join(' / ');
}

//Construye un mailto con asunto y cuerpo pre-rellenado.
function buildMailto(email, serviceName) {
  //Definimos asunto informativo.
  const subject = `Consulta sobre ${serviceName || 'servicio'}`;
  //Definimos cuerpo básico.
  const body = `Hola,\n\nQuería hacer una consulta sobre ${serviceName || 'este servicio'}.\n\nGracias.`;
  //Construimos URL mailto con parámetros, codificados.
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

//Construye una URL de Google Maps para rutas hasta la dirección.
function buildMapsDirectionsUrl(address) {
  //Codificamos destino para URL.
  const destination = encodeURIComponent(address);
  //Construimos URL recomendada por Google con api=1.
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
}

//Construye la URL del Form “Datos incorrectos” con prefill usando entry.<id>=valor.
function buildPrefilledIncorrectDataFormUrl(record) {
  //Si falta configurar la base del formulario, devolvemos '#'.
  if (!CONFIG.incorrectDataFormBaseUrl) {
    return '#';
  }

  //Validamos que el mapeo de entry IDs exista.
  if (!CONFIG.incorrectDataEntryIds || !CONFIG.incorrectDataEntryIds.service) {
    // eslint-disable-next-line no-console
    console.error('Configuración incompleta: faltan incorrectDataEntryIds para el formulario de “Datos incorrectos”.');
    return CONFIG.incorrectDataFormBaseUrl;
  }

  //Creamos parámetros de querystring.
  const params = new URLSearchParams();

  //Añadimos servicio.
  params.set(`entry.${CONFIG.incorrectDataEntryIds.service}`, record.nombre || '');

  //Añadimos categoría.
  params.set(`entry.${CONFIG.incorrectDataEntryIds.category}`, record.categoria || '');

  //Prefill por defecto del campo “Qué dato está mal”.
  const defaultWrongField = record.telefono ? 'Teléfono' : (record.direccion ? 'Dirección' : 'Otro');
  params.set(`entry.${CONFIG.incorrectDataEntryIds.wrongField}`, defaultWrongField);

  //Añadimos dato actual (prioridad teléfono, luego dirección).
  params.set(`entry.${CONFIG.incorrectDataEntryIds.currentValue}`, record.telefono || record.direccion || '');

  //Dejamos el dato correcto vacío para que lo rellenen.
  params.set(`entry.${CONFIG.incorrectDataEntryIds.correctValue}`, '');

  //Dejamos detalles vacío.
  params.set(`entry.${CONFIG.incorrectDataEntryIds.details}`, '');

  //Dejamos fuente vacía.
  params.set(`entry.${CONFIG.incorrectDataEntryIds.source}`, '');

  //Dejamos contacto vacío.
  params.set(`entry.${CONFIG.incorrectDataEntryIds.contact}`, '');

  //Calculamos ID interno a partir de record.id o slug del nombre.
  const internalId = record.id ? String(record.id).trim() : slugify(record.nombre || '');
  params.set(`entry.${CONFIG.incorrectDataEntryIds.internalId}`, internalId);

  //Añadimos URL de la página donde se reporta.
  params.set(`entry.${CONFIG.incorrectDataEntryIds.pageUrl}`, window.location.href);

  //Devolvemos URL final.
  return `${CONFIG.incorrectDataFormBaseUrl}?usp=pp_url&${params.toString()}`;
}

//Convierte un texto a slug seguro para IDs internos.
function slugify(text) {
  //Normalizamos a minúsculas y recortamos.
  const s = String(text || '').toLowerCase().trim();
  //Eliminamos acentos y caracteres no alfanuméricos.
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

//Limpia un teléfono para usarlo en tel: (elimina espacios y caracteres no numéricos salvo +).
function cleanPhone(phone) {
  //Si no hay teléfono, devolvemos cadena vacía.
  if (!phone) {
    return '';
  }
  //Mantenemos dígitos y el signo +.
  return String(phone).replace(/[^0-9+]/g, '');
}

//Normaliza una URL si el usuario puso sin protocolo.
function normalizeUrl(url) {
  //Si no hay url, devolvemos cadena vacía.
  if (!url) {
    return '';
  }
  //Si ya tiene protocolo, la devolvemos.
  if (/^https?:\/\//i.test(url)) {
    return url;
  }
  //Si no tiene, añadimos https.
  return `https://${url}`;
}

//Escapamos HTML para evitar inyección en el renderizado.
function escapeHtml(text) {
  //Convertimos a string seguro.
  const s = String(text || '');
  //Reemplazamos caracteres especiales.
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

//Escapamos atributos para evitar romper HTML.
function escapeAttr(text) {
  //Reutilizamos escapeHtml para atributos.
  return escapeHtml(text);
}

//Actualiza el texto de estado en UI.
function setStatus(message) {
  //Pintamos el mensaje.
  dom.statusText.textContent = message;
}

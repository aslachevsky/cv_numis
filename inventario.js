/**
 * inventario.js — módulo de inventario de coleccionables
 * Uso: import { initInventario } from './inventario.js';
 *      initInventario({ db, fmtFecha, fmtGs, toast, hoy, toTs });
 */
import {
  collection, addDoc, getDocs, query,
  orderBy, doc, updateDoc
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

// ─── Dependencias inyectadas desde el módulo principal ───────────
let _db, _fmtFecha, _fmtGs, _toast, _hoy, _toTs;

// ─── Estado del módulo ───────────────────────────────────────────
let inventarioCache  = [];
let inventarioPagina = 1;
const INV_POR_PAG    = 25;
let invModo   = 'nuevo';
let invEditId = null;
let cambioUSD = 0;

const $ = id => document.getElementById(id);

// ─── Constantes de etiquetas ─────────────────────────────────────
const RUBROS_LABEL = {
  monedas: 'Monedas', billetes: 'Billetes', medallas: 'Medallas',
  estampillas: 'Estampillas', token: 'Token', otros: 'Otros'
};

const ESTADOS_LABEL = {
  en_stock: 'En Stock', vendido: 'Vendido',
  entregado: 'Entregado', recuperado: 'Recuperado', anulado: 'Anulado'
};

// ─── Punto de entrada ────────────────────────────────────────────
export function initInventario({ db, fmtFecha, fmtGs, toast, hoy, toTs }) {
  _db = db; _fmtFecha = fmtFecha; _fmtGs = fmtGs;
  _toast = toast; _hoy = hoy; _toTs = toTs;

  // Exponer funciones para onclick inline en el HTML
  window.cargarInventario      = cargarInventario;
  window.filtrarInventario     = filtrarInventario;
  window.cambiarPaginaInv      = cambiarPaginaInv;
  window.actualizarEquivCompra = actualizarEquivCompra;
  window.actualizarEquivRef    = actualizarEquivRef;
  window.actualizarEquivVenta  = actualizarEquivVenta;
  window.actualizarFechaVenta  = actualizarFechaVenta;
  window.abrirModalNuevoInv    = abrirModalNuevoInv;
  window.abrirModalEditarInv   = abrirModalEditarInv;
  window.cerrarModalInv        = cerrarModalInv;
  window.cambiarEstadoInv      = cambiarEstadoInv;
  window.guardarModalInv       = guardarModalInv;
}

// ─── Cambio USD/PYG ─────────────────────────────────────────────
async function fetchCambio() {
  try {
    const r    = await fetch('https://open.er-api.com/v6/latest/USD');
    const data = await r.json();
    if (data.result === 'success' && data.rates?.PYG) {
      cambioUSD = Math.round(data.rates.PYG);
    }
  } catch {
    cambioUSD = 7500;
  }
}

// ─── Formatters locales ──────────────────────────────────────────
function fmtUSD(n) {
  if (n == null || isNaN(n)) return 'US$ 0,00';
  const num    = Number(n);
  const abs    = Math.abs(num).toFixed(2);
  const [int, frac] = abs.split('.');
  const intFmt = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (num < 0 ? '-' : '') + 'US$ ' + intFmt + ',' + frac;
}

function fmtGsRaw(n) {
  const abs = String(Math.round(Math.abs(n || 0)));
  return abs.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// ─── Carga principal ─────────────────────────────────────────────
async function cargarInventario(resetFiltros = true) {
  inventarioPagina = 1;
  if (!cambioUSD) await fetchCambio();

  const secEl = $('inv-cambio-section');
  if (secEl) secEl.textContent = `Cambio del día: ₲ ${fmtGsRaw(cambioUSD)} / USD`;

  if (resetFiltros) {
    const fil = $('inv-fil-estado');
    if (fil) fil.value = 'en_stock';
  }

  $('lista-inventario').innerHTML = '<div class="cargando">Cargando...</div>';
  try {
    const snap = await getDocs(query(collection(_db, 'inventario'), orderBy('fechaCompra', 'desc')));
    inventarioCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    filtrarInventario();
  } catch(e) {
    $('lista-inventario').innerHTML = `<div class="empty">Error: ${e.message}</div>`;
  }
}

// ─── Filtrado y paginación ───────────────────────────────────────
function filtrarInventario() {
  const q      = ($('inv-buscar')?.value    || '').toLowerCase().trim();
  const rubro  = $('inv-fil-rubro')?.value  || '';
  const estado = $('inv-fil-estado')?.value || '';

  const lista = inventarioCache.filter(item => {
    const okQ      = !q || (item.descripcion||'').toLowerCase().includes(q)
                        || (item.comentario ||'').toLowerCase().includes(q);
    const okRubro  = !rubro  || item.rubro  === rubro;
    const okEstado = !estado || item.estado === estado;
    return okQ && okRubro && okEstado;
  });

  const total   = lista.length;
  const paginas = Math.max(1, Math.ceil(total / INV_POR_PAG));
  if (inventarioPagina > paginas) inventarioPagina = paginas;
  const paginada = lista.slice((inventarioPagina - 1) * INV_POR_PAG, inventarioPagina * INV_POR_PAG);

  const countEl = $('inv-count');
  if (countEl) countEl.textContent = `${total} ítem${total !== 1 ? 's' : ''}${q ? ' encontrados' : ''}`;

  renderTabla(paginada);
  renderPaginacion(total, paginas);
}

function cambiarPaginaInv(delta) {
  inventarioPagina = Math.max(1, inventarioPagina + delta);
  filtrarInventario();
}

// ─── Renderizado de tabla ────────────────────────────────────────
function renderTabla(lista) {
  const el = $('lista-inventario');
  if (!lista.length) { el.innerHTML = '<div class="empty">Sin resultados</div>'; return; }

  el.innerHTML = `
    <table class="cl-tabla" style="font-size:12.5px">
      <thead><tr>
        <th>Rubro</th>
        <th>Descripción</th>
        <th>F.Compra</th>
        <th style="text-align:right">P.Compra</th>
        <th style="text-align:right">P.Referencia</th>
        <th style="text-align:right">P.Venta</th>
        <th>Estado</th>
        <th></th>
      </tr></thead>
      <tbody>
        ${lista.map(item => filaItem(item)).join('')}
      </tbody>
    </table>`;
}

function filaItem(item) {
  const pCompraGs = cambioUSD ? Math.round((item.precioCompraUSD     || 0) * cambioUSD) : 0;
  const pRefGs    = cambioUSD ? Math.round((item.precioReferenciaUSD || 0) * cambioUSD) : 0;
  const pVentaUSD = cambioUSD && item.precioVentaGs ? item.precioVentaGs / cambioUSD : 0;
  const tenFecha  = item.fechaVenta && (item.estado === 'vendido' || item.estado === 'entregado');

  return `
    <tr>
      <td>
        <span class="badge" style="background:rgba(255,255,255,.06);color:var(--text2);border:1px solid var(--border)">
          ${RUBROS_LABEL[item.rubro] || item.rubro}
        </span>
      </td>
      <td>
        <div class="td-nombre" style="max-width:220px" title="${esc(item.descripcion)}">${esc(item.descripcion) || '—'}</div>
        ${item.comentario
          ? `<div class="td-id" style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
                  title="${esc(item.comentario)}">${esc(item.comentario)}</div>` : ''}
      </td>
      <td class="td-id" style="white-space:nowrap">
        ${_fmtFecha(item.fechaCompra)}
        ${tenFecha ? `<div class="td-id">→ ${_fmtFecha(item.fechaVenta)}</div>` : ''}
      </td>
      <td style="text-align:right">
        <div style="font-weight:600;color:#e0a050">${fmtUSD(item.precioCompraUSD || 0)}</div>
        ${pCompraGs ? `<div class="td-id">${_fmtGs(pCompraGs)}</div>` : ''}
      </td>
      <td style="text-align:right">
        <div style="font-weight:600;color:var(--gold)">${fmtUSD(item.precioReferenciaUSD || 0)}</div>
        ${pRefGs ? `<div class="td-id">${_fmtGs(pRefGs)}</div>` : ''}
      </td>
      <td style="text-align:right">
        <div style="font-weight:600;color:var(--pagos)">${item.precioVentaGs ? _fmtGs(item.precioVentaGs) : '₲ 0'}</div>
        ${pVentaUSD ? `<div class="td-id">${fmtUSD(pVentaUSD)}</div>` : ''}
      </td>
      <td>
        <span class="badge badge-inv-${item.estado}">${ESTADOS_LABEL[item.estado] || item.estado}</span>
      </td>
      <td class="td-acc" style="white-space:normal;min-width:110px;vertical-align:middle">
        <div style="display:flex;flex-wrap:wrap;gap:3px;justify-content:flex-end;align-items:center">
          ${botonesEstado(item)}
          <button class="btn-editar" data-invid="${item.id}" style="margin-left:2px">Editar</button>
        </div>
      </td>
    </tr>`;
}

function botonesEstado(item) {
  const id = item.id;
  switch (item.estado) {
    case 'en_stock':
      return `
        <button class="btn-inv-acc btn-inv-vendido"   onclick="cambiarEstadoInv('${id}','vendido')">Vendido</button>
        <button class="btn-inv-acc btn-inv-entregado" onclick="cambiarEstadoInv('${id}','entregado')">Entregado</button>
        <button class="btn-inv-acc btn-inv-anular"    onclick="cambiarEstadoInv('${id}','anulado')">Anular</button>`;
    case 'vendido':
      return `
        <button class="btn-inv-acc btn-inv-entregado"  onclick="cambiarEstadoInv('${id}','entregado')">Entregado</button>
        <button class="btn-inv-acc btn-inv-recuperado" onclick="cambiarEstadoInv('${id}','recuperado')">Recuperado</button>`;
    case 'entregado':
      return `
        <button class="btn-inv-acc btn-inv-recuperado" onclick="cambiarEstadoInv('${id}','recuperado')">Recuperado</button>`;
    case 'recuperado':
      return `
        <button class="btn-inv-acc btn-inv-stock"  onclick="cambiarEstadoInv('${id}','en_stock')">En Stock</button>
        <button class="btn-inv-acc btn-inv-anular" onclick="cambiarEstadoInv('${id}','anulado')">Anular</button>`;
    default:
      return '';
  }
}

function esc(s) {
  return (s || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
}

function renderPaginacion(total, paginas) {
  const pager = $('inv-pager');
  if (!pager) return;
  if (total === 0) { pager.innerHTML = ''; return; }
  pager.innerHTML = `
    <span>Página ${inventarioPagina} de ${paginas}</span>
    <div>
      <button type="button" onclick="cambiarPaginaInv(-1)" ${inventarioPagina === 1        ? 'disabled' : ''}>Anterior</button>
      <button type="button" onclick="cambiarPaginaInv(1)"  ${inventarioPagina === paginas  ? 'disabled' : ''}>Siguiente</button>
    </div>`;
}

// ─── Equivalencias en tiempo real (modal) ────────────────────────
function actualizarEquivCompra() {
  const usd = parseFloat($('inv-precio-compra-usd')?.value) || 0;
  const el  = $('inv-equiv-compra');
  if (el) el.textContent = (cambioUSD && usd > 0) ? '≈ ' + _fmtGs(Math.round(usd * cambioUSD)) : '';
}

function actualizarEquivRef() {
  const usd = parseFloat($('inv-precio-ref-usd')?.value) || 0;
  const el  = $('inv-equiv-ref');
  if (el) el.textContent = (cambioUSD && usd > 0) ? '≈ ' + _fmtGs(Math.round(usd * cambioUSD)) : '';
}

function actualizarEquivVenta() {
  const gs = parseInt($('inv-precio-venta-gs')?.value || '0', 10) || 0;
  const el = $('inv-equiv-venta');
  if (el) el.textContent = (cambioUSD && gs > 0) ? '≈ ' + fmtUSD(gs / cambioUSD) : '';
}

function actualizarFechaVenta() {
  const estado = $('inv-estado')?.value;
  const grupo  = $('inv-fecha-venta-grupo');
  if (grupo) grupo.style.display = (estado === 'vendido' || estado === 'entregado') ? 'block' : 'none';
}

function actualizarCambioModal() {
  const el = $('inv-cambio-modal');
  if (el) el.textContent = cambioUSD ? `Cambio del día: ₲ ${fmtGsRaw(cambioUSD)} por USD` : '';
}

// ─── Abrir modal nuevo ───────────────────────────────────────────
function abrirModalNuevoInv() {
  invModo = 'nuevo'; invEditId = null;
  $('inv-modal-titulo').textContent  = 'Nuevo ítem de inventario';
  $('inv-rubro').value               = 'monedas';
  $('inv-estado').value              = 'en_stock';
  $('inv-desc').value                = '';
  $('inv-fecha-compra').value        = _hoy();
  $('inv-precio-compra-usd').value   = '';
  $('inv-precio-ref-usd').value      = '';
  $('inv-precio-venta-gs').value     = '0';
  $('inv-fecha-venta').value         = '';
  $('inv-comentario').value          = '';
  $('inv-equiv-compra').textContent  = '';
  $('inv-equiv-ref').textContent     = '';
  $('inv-equiv-venta').textContent   = '';
  actualizarFechaVenta();
  actualizarCambioModal();
  $('btn-inv-guardar').textContent   = 'Guardar';
  $('modal-inv-overlay').classList.remove('hidden');
  setTimeout(() => $('inv-desc').focus(), 100);
}

// ─── Abrir modal editar ──────────────────────────────────────────
function abrirModalEditarInv(id) {
  const item = inventarioCache.find(x => x.id === id);
  if (!item) return;
  invModo = 'editar'; invEditId = id;

  $('inv-modal-titulo').textContent  = 'Editar ítem';
  $('inv-rubro').value               = item.rubro  || 'monedas';
  $('inv-estado').value              = item.estado || 'en_stock';
  $('inv-desc').value                = item.descripcion || '';
  $('inv-fecha-compra').value        = item.fechaCompra?.toDate
                                         ? item.fechaCompra.toDate().toISOString().split('T')[0] : _hoy();
  $('inv-precio-compra-usd').value   = item.precioCompraUSD     ?? '';
  $('inv-precio-ref-usd').value      = item.precioReferenciaUSD ?? '';
  $('inv-precio-venta-gs').value     = item.precioVentaGs || 0;
  $('inv-fecha-venta').value         = item.fechaVenta?.toDate
                                         ? item.fechaVenta.toDate().toISOString().split('T')[0] : '';
  $('inv-comentario').value          = item.comentario || '';
  actualizarEquivCompra();
  actualizarEquivRef();
  actualizarEquivVenta();
  actualizarFechaVenta();
  actualizarCambioModal();
  $('btn-inv-guardar').textContent   = 'Actualizar';
  $('modal-inv-overlay').classList.remove('hidden');
}

// ─── Cerrar modal ────────────────────────────────────────────────
function cerrarModalInv() {
  $('modal-inv-overlay').classList.add('hidden');
}

// ─── Cambio rápido de estado desde la tabla ──────────────────────
async function cambiarEstadoInv(id, nuevoEstado) {
  const item = inventarioCache.find(x => x.id === id);
  if (!item) return;

  if (nuevoEstado === 'anulado') {
    if (!confirm('¿Marcar este ítem como Anulado? Esta acción no se puede revertir fácilmente.')) return;
  }

  const esVenta = nuevoEstado === 'vendido' || nuevoEstado === 'entregado';
  const updates = { estado: nuevoEstado };

  if (esVenta && !item.fechaVenta) updates.fechaVenta = _toTs(_hoy());
  if (esVenta && item.precioVentaGs > 0 && cambioUSD && !item.precioVentaUSD) {
    updates.precioVentaUSD = parseFloat((item.precioVentaGs / cambioUSD).toFixed(2));
  }
  if (nuevoEstado === 'en_stock') updates.fechaVenta = null;

  const filtroActual = $('inv-fil-estado')?.value || 'en_stock';
  try {
    await updateDoc(doc(_db, 'inventario', id), updates);
    _toast(`Estado cambiado a ${ESTADOS_LABEL[nuevoEstado]} ✓`);
    await cargarInventario(false);
    const fil = $('inv-fil-estado');
    if (fil) fil.value = filtroActual;
    filtrarInventario();
  } catch(e) {
    _toast('Error: ' + e.message, 'err');
  }
}

// ─── Guardar desde modal ─────────────────────────────────────────
async function guardarModalInv() {
  const rubro      = $('inv-rubro').value;
  const estado     = $('inv-estado').value;
  const desc       = $('inv-desc').value.trim();
  const fechaComp  = $('inv-fecha-compra').value;
  const pCompraUSD = parseFloat($('inv-precio-compra-usd').value) || 0;
  const pRefUSD    = parseFloat($('inv-precio-ref-usd').value)    || 0;
  const pVentaGs   = parseInt($('inv-precio-venta-gs').value  || '0', 10) || 0;
  const fechaVenta = $('inv-fecha-venta').value;
  const comentario = $('inv-comentario').value.trim();

  if (!desc)      { _toast('La descripción es obligatoria', 'err'); return; }
  if (!fechaComp) { _toast('La fecha de compra es obligatoria', 'err');   return; }

  const esVenta   = estado === 'vendido' || estado === 'entregado';
  const pVentaUSD = (esVenta && pVentaGs > 0 && cambioUSD)
    ? parseFloat((pVentaGs / cambioUSD).toFixed(2)) : 0;

  const datos = {
    rubro, estado, descripcion: desc,
    fechaCompra:         _toTs(fechaComp),
    precioCompraUSD:     pCompraUSD,
    precioReferenciaUSD: pRefUSD,
    precioVentaGs:       pVentaGs,
    precioVentaUSD:      pVentaUSD,
    fechaVenta: (esVenta && fechaVenta) ? _toTs(fechaVenta) : null,
    comentario
  };

  const btn = $('btn-inv-guardar');
  btn.disabled = true; btn.textContent = 'Guardando...';

  const filtroActual = $('inv-fil-estado')?.value || 'en_stock';
  try {
    if (invModo === 'nuevo') {
      await addDoc(collection(_db, 'inventario'), datos);
      _toast('Ítem guardado ✓');
    } else {
      await updateDoc(doc(_db, 'inventario', invEditId), datos);
      _toast('Ítem actualizado ✓');
    }
    cerrarModalInv();
    await cargarInventario(false);
    const fil = $('inv-fil-estado');
    if (fil) fil.value = filtroActual;
    filtrarInventario();
  } catch(e) {
    _toast('Error: ' + e.message, 'err');
  }

  btn.disabled = false;
  btn.textContent = invModo === 'nuevo' ? 'Guardar' : 'Actualizar';
}

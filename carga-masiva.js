/**
 * carga-masiva.js — módulo independiente de carga masiva de inventario
 * Uso: import { initCargaMasiva } from './carga-masiva.js';
 *      initCargaMasiva({ db, toast, hoy, toTs });
 */
import {
  collection, addDoc, writeBatch, doc
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

let _db, _toast, _hoy, _toTs;
let itemsParseados = [];

const $ = id => document.getElementById(id);

export function initCargaMasiva({ db, toast, hoy, toTs }) {
  _db = db; _toast = toast; _hoy = hoy; _toTs = toTs;

  window.abrirCargaMasiva   = abrirCargaMasiva;
  window.cerrarCargaMasiva  = cerrarCargaMasiva;
  window.cmPrevisualizar    = cmPrevisualizar;
  window.cmImportar         = cmImportar;
  window.cmContarLineas     = cmContarLineas;

  const ta = $('cm-texto');
  if (ta) ta.addEventListener('input', cmContarLineas);
}

function abrirCargaMasiva() {
  $('cm-rubro').value       = 'monedas';
  $('cm-estado').value      = 'en_stock';
  $('cm-fecha').value       = _hoy();
  $('cm-texto').value       = '';
  $('cm-preview').innerHTML = '';
  $('cm-counter').innerHTML = '0 líneas';
  $('cm-progress').style.display = 'none';
  $('btn-cm-importar').disabled  = true;
  itemsParseados = [];
  $('modal-cm-overlay').classList.remove('hidden');
  setTimeout(() => $('cm-texto').focus(), 100);
}

function cerrarCargaMasiva() {
  $('modal-cm-overlay').classList.add('hidden');
}

function cmContarLineas() {
  const lineas = contarLineasValidas($('cm-texto').value);
  $('cm-counter').innerHTML = `<strong>${lineas}</strong> línea${lineas !== 1 ? 's' : ''} con datos`;
  if (lineas === 0) {
    $('btn-cm-importar').disabled = true;
    $('cm-preview').innerHTML = '';
    itemsParseados = [];
  }
}

function contarLineasValidas(texto) {
  return texto.split('\n').filter(l => l.trim().length > 0).length;
}

function parsearLineas(texto, rubro, estado, fecha) {
  const lineas = texto.split('\n');
  const items = [];

  for (let i = 0; i < lineas.length; i++) {
    const raw = lineas[i].trim();
    if (!raw) continue;

    const partes = raw.split('|').map(p => p.trim());
    const desc = partes[0] || '';
    const pCompra = parseFloat(partes[1]) || 0;
    const pRef = parseFloat(partes[2]) || 0;
    const comentario = partes[3] || '';

    items.push({
      linea: i + 1,
      descripcion: desc,
      rubro,
      estado,
      fechaCompra: fecha,
      precioCompraUSD: pCompra,
      precioReferenciaUSD: pRef,
      precioVentaGs: 0,
      precioVentaUSD: 0,
      fechaVenta: null,
      comentario,
      error: !desc ? 'Sin descripción' : null
    });
  }
  return items;
}

function cmPrevisualizar() {
  const texto  = $('cm-texto').value;
  const rubro  = $('cm-rubro').value;
  const estado = $('cm-estado').value;
  const fecha  = $('cm-fecha').value;

  if (!fecha) { _toast('Elegí una fecha de compra', 'err'); return; }

  itemsParseados = parsearLineas(texto, rubro, estado, fecha);

  if (!itemsParseados.length) {
    _toast('No hay líneas para previsualizar', 'err');
    return;
  }

  const validos = itemsParseados.filter(x => !x.error).length;
  const errores = itemsParseados.filter(x => x.error).length;

  let html = `<table class="cm-preview-tabla">
    <thead><tr>
      <th>#</th>
      <th>Descripción</th>
      <th style="text-align:right">Compra USD</th>
      <th style="text-align:right">Ref. USD</th>
      <th>Comentario</th>
    </tr></thead><tbody>`;

  for (const it of itemsParseados) {
    const cls = it.error ? ' class="cm-row-err"' : '';
    html += `<tr${cls}>
      <td class="cm-td-idx">${it.linea}</td>
      <td>${esc(it.descripcion) || '<em>vacío</em>'}</td>
      <td class="cm-td-num">${it.precioCompraUSD ? it.precioCompraUSD.toFixed(2) : '—'}</td>
      <td class="cm-td-num">${it.precioReferenciaUSD ? it.precioReferenciaUSD.toFixed(2) : '—'}</td>
      <td style="max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
          title="${esc(it.comentario)}">${esc(it.comentario) || '—'}</td>
    </tr>`;
  }
  html += '</tbody></table>';

  $('cm-preview').innerHTML = html;
  $('btn-cm-importar').disabled = validos === 0;

  let msg = `${validos} ítem${validos !== 1 ? 's' : ''} listo${validos !== 1 ? 's' : ''}`;
  if (errores) msg += ` · ${errores} con error (se omitirán)`;
  $('cm-counter').innerHTML = msg;
}

async function cmImportar() {
  const validos = itemsParseados.filter(x => !x.error);
  if (!validos.length) { _toast('No hay ítems válidos', 'err'); return; }

  const btn = $('btn-cm-importar');
  const btnPrev = $('btn-cm-previsualizar');
  btn.disabled = true;
  btn.textContent = 'Importando...';
  btnPrev.disabled = true;
  $('cm-texto').disabled = true;

  $('cm-progress').style.display = 'block';
  const fillEl = $('cm-progress-fill');
  const textEl = $('cm-progress-text');

  const BATCH_SIZE = 20;
  let importados = 0;
  const total = validos.length;

  try {
    for (let i = 0; i < total; i += BATCH_SIZE) {
      const chunk = validos.slice(i, i + BATCH_SIZE);
      const batch = writeBatch(_db);

      for (const it of chunk) {
        const ref = doc(collection(_db, 'inventario'));
        batch.set(ref, {
          rubro:               it.rubro,
          estado:              it.estado,
          descripcion:         it.descripcion,
          fechaCompra:         _toTs(it.fechaCompra),
          precioCompraUSD:     it.precioCompraUSD,
          precioReferenciaUSD: it.precioReferenciaUSD,
          precioVentaGs:       0,
          precioVentaUSD:      0,
          fechaVenta:          null,
          comentario:          it.comentario
        });
      }

      await batch.commit();
      importados += chunk.length;

      const pct = Math.round((importados / total) * 100);
      fillEl.style.width = pct + '%';
      textEl.textContent = `${importados} de ${total} (${pct}%)`;
    }

    _toast(`${importados} ítems importados ✓`);
    cerrarCargaMasiva();

    if (typeof window.cargarInventario === 'function') {
      window.cargarInventario();
    }
  } catch (e) {
    _toast('Error al importar: ' + e.message, 'err');
  }

  btn.disabled = false;
  btn.textContent = 'Importar';
  btnPrev.disabled = false;
  $('cm-texto').disabled = false;
}

function esc(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

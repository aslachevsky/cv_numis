/**
 * vision.js — identificación de coleccionables por foto
 * Usa Google Cloud Vision API (free tier: 1 000 análisis/mes)
 * Requiere habilitar Cloud Vision API en Google Cloud Console.
 */

const VISION_URL = 'https://vision.googleapis.com/v1/images:annotate';
const MAX_IMG_DIM = 1200;

let _apiKey = null;
let _toast  = null;

const $ = id => document.getElementById(id);

const RUBRO_KEYWORDS = {
  monedas:     ['coin', 'coins', 'moneda', 'numismatic', 'penny', 'cent', 'dollar coin', 'peso', 'nickel', 'dime', 'quarter'],
  billetes:    ['banknote', 'bill', 'paper money', 'currency note', 'billete', 'paper currency', 'bank note'],
  medallas:    ['medal', 'medallion', 'medalla', 'award medal'],
  estampillas: ['stamp', 'postage', 'estampilla', 'sello postal', 'postage stamp'],
  token:       ['token', 'chip', 'ficha', 'jeton', 'gaming token']
};

export function initVision({ apiKey, toast }) {
  _apiKey = apiKey;
  _toast  = toast;

  inyectarHTML();

  window.iniciarVisionCamara  = () => $('inv-vision-file-cam').click();
  window.iniciarVisionGaleria = () => $('inv-vision-file-gal').click();
  window.procesarFotoVision   = procesarFoto;
  window.cerrarVisionPreview  = cerrarPreview;
  window.resetVisionSection   = resetSection;
}

function inyectarHTML() {
  const anchor = $('inv-vision-anchor');
  if (!anchor) return;
  anchor.outerHTML = `
    <div id="inv-vision-section" style="margin-bottom:14px">
      <div style="display:flex; gap:8px; align-items:center">
        <button type="button" class="btn-vision" onclick="iniciarVisionCamara()">📷 Cámara</button>
        <button type="button" class="btn-vision" onclick="iniciarVisionGaleria()">🖼️ Galería</button>
        <span style="font-size:10.5px; color:var(--text2)">Identificar con foto</span>
      </div>
      <input type="file" id="inv-vision-file-cam" accept="image/*" capture="environment" style="display:none" onchange="procesarFotoVision(this)">
      <input type="file" id="inv-vision-file-gal" accept="image/*" style="display:none" onchange="procesarFotoVision(this)">
      <div id="inv-vision-preview" class="hidden" style="margin-top:10px">
        <div style="display:flex; gap:10px; align-items:flex-start">
          <img id="inv-vision-img" style="width:72px; height:72px; object-fit:cover; border-radius:8px; border:1px solid var(--border)">
          <div style="flex:1; min-width:0">
            <div id="inv-vision-status" style="font-size:12px; color:var(--text2)"></div>
            <div id="inv-vision-results"></div>
          </div>
          <button type="button" class="modal-close" onclick="cerrarVisionPreview()" style="position:static; font-size:14px; flex-shrink:0">✕</button>
        </div>
      </div>
    </div>`;
}

function resetSection() {
  const preview = $('inv-vision-preview');
  if (preview) preview.classList.add('hidden');
  const img = $('inv-vision-img');
  if (img) img.src = '';
  const st = $('inv-vision-status');
  if (st) st.textContent = '';
  const res = $('inv-vision-results');
  if (res) res.innerHTML = '';
  const cam = $('inv-vision-file-cam');
  if (cam) cam.value = '';
  const gal = $('inv-vision-file-gal');
  if (gal) gal.value = '';
}

function cerrarPreview() { resetSection(); }

// ─── Resize con canvas para no enviar fotos gigantes ────────────
function resizeImage(base64, mimeType) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      let { width: w, height: h } = img;
      if (w <= MAX_IMG_DIM && h <= MAX_IMG_DIM) { resolve(base64); return; }
      const scale = MAX_IMG_DIM / Math.max(w, h);
      w = Math.round(w * scale);
      h = Math.round(h * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      const resized = canvas.toDataURL(mimeType || 'image/jpeg', 0.85).split(',')[1];
      resolve(resized);
    };
    img.src = `data:${mimeType};base64,${base64}`;
  });
}

// ─── Procesar foto seleccionada ─────────────────────────────────
async function procesarFoto(input) {
  const file = input.files?.[0];
  if (!file) return;

  const preview = $('inv-vision-preview');
  const imgEl   = $('inv-vision-img');
  const status  = $('inv-vision-status');
  const results = $('inv-vision-results');

  preview.classList.remove('hidden');
  status.textContent = '⏳ Analizando imagen...';
  status.style.color = 'var(--gold)';
  results.innerHTML  = '';

  const rawBase64 = await fileToBase64(file);
  imgEl.src = `data:${file.type};base64,${rawBase64}`;

  try {
    const base64 = await resizeImage(rawBase64, file.type);
    const response = await callVisionAPI(base64);
    const parsed   = parseResponse(response);
    mostrarResultados(parsed, results, status);
    aplicarAlFormulario(parsed);
  } catch (err) {
    status.textContent = '✕ Error al analizar';
    status.style.color = '#e07070';

    const msg = err.message || '';
    if (msg.includes('403') || msg.includes('has not been used') ||
        msg.includes('PERMISSION_DENIED') || msg.includes('disabled')) {
      results.innerHTML =
        `<div style="color:#e07070;font-size:11px;margin-top:6px">
           Necesitás habilitar la <strong>Cloud Vision API</strong> en
           <a href="https://console.cloud.google.com/apis/library/vision.googleapis.com?project=helio-produce"
              target="_blank" rel="noopener" style="color:var(--gold)">Google Cloud Console</a>.
         </div>`;
    } else {
      results.innerHTML =
        `<div style="color:#e07070;font-size:11px;margin-top:6px">${esc(msg)}</div>`;
    }
  }

  input.value = '';
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ─── Llamada a Cloud Vision API ─────────────────────────────────
async function callVisionAPI(base64Image) {
  const body = {
    requests: [{
      image: { content: base64Image },
      features: [
        { type: 'LABEL_DETECTION',  maxResults: 10 },
        { type: 'TEXT_DETECTION',    maxResults: 5  },
        { type: 'WEB_DETECTION',     maxResults: 5  }
      ]
    }]
  };

  const res = await fetch(`${VISION_URL}?key=${_apiKey}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body)
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `HTTP ${res.status}`);
  }
  return res.json();
}

// ─── Parsear respuesta de Vision ────────────────────────────────
function parseResponse(data) {
  const resp = data.responses?.[0] || {};

  const labels = (resp.labelAnnotations || []).map(l => l.description.toLowerCase());

  const textAnnotations = resp.textAnnotations || [];
  const fullText = textAnnotations[0]?.description || '';

  const web         = resp.webDetection || {};
  const bestGuess   = (web.bestGuessLabels || []).map(l => l.label).join(', ');
  const webEntities = (web.webEntities || [])
    .filter(e => e.description && e.score > 0.5)
    .map(e => e.description);

  let rubro = '';
  for (const [key, keywords] of Object.entries(RUBRO_KEYWORDS)) {
    if (labels.some(l => keywords.some(k => l.includes(k))) ||
        webEntities.some(e => keywords.some(k => e.toLowerCase().includes(k))) ||
        bestGuess.toLowerCase().split(/\W+/).some(w => keywords.includes(w))) {
      rubro = key;
      break;
    }
  }

  let descripcion = bestGuess || webEntities.slice(0, 3).join(' – ');
  if (!descripcion && fullText) {
    descripcion = fullText.split('\n').slice(0, 2).join(' ').trim();
  }

  const comentarioParts = [];
  if (fullText) comentarioParts.push('Texto: ' + fullText.replace(/\n/g, ' | '));
  if (webEntities.length) comentarioParts.push('Ref: ' + webEntities.slice(0, 5).join(', '));
  const comentario = comentarioParts.join('\n');

  return { rubro, descripcion, comentario, labels, bestGuess, fullText, webEntities };
}

// ─── Mostrar resultados en el panel ─────────────────────────────
function mostrarResultados(parsed, resultsEl, statusEl) {
  statusEl.textContent = '✓ Análisis completado';
  statusEl.style.color = '#5dde8a';

  const RUBROS_LABEL = {
    monedas: 'Monedas', billetes: 'Billetes', medallas: 'Medallas',
    estampillas: 'Estampillas', token: 'Token'
  };

  let html = '<div style="margin-top:6px; font-size:11.5px; color:var(--text)">';
  if (parsed.bestGuess)
    html += `<div><strong>Identificación:</strong> ${esc(parsed.bestGuess)}</div>`;
  if (parsed.rubro)
    html += `<div><strong>Rubro:</strong> ${RUBROS_LABEL[parsed.rubro]}</div>`;
  if (parsed.fullText)
    html += `<div style="max-height:36px;overflow:hidden;text-overflow:ellipsis"><strong>Texto:</strong> ${esc(parsed.fullText.replace(/\n/g, ' | '))}</div>`;
  if (!parsed.bestGuess && !parsed.rubro && !parsed.fullText)
    html += `<div style="color:var(--text2)">No se pudo identificar el ítem. Completá los campos manualmente.</div>`;
  html += `<div style="margin-top:6px;color:var(--text2);font-size:10.5px">Los campos se pre-llenaron. Editá lo que necesites.</div>`;
  html += '</div>';

  resultsEl.innerHTML = html;
}

// ─── Aplicar resultados al formulario ───────────────────────────
function aplicarAlFormulario(parsed) {
  if (parsed.rubro) $('inv-rubro').value = parsed.rubro;

  if (parsed.descripcion) {
    const descEl = $('inv-desc');
    if (!descEl.value.trim()) descEl.value = parsed.descripcion;
  }
  if (parsed.comentario) {
    const comEl = $('inv-comentario');
    if (!comEl.value.trim()) comEl.value = parsed.comentario;
  }

  if (_toast) _toast('Foto analizada – revisá los campos ✓');
}

function esc(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

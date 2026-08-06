const https = require('https');
const http = require('http');

const API_KEY = process.env.OPENAI_API_KEY;
const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/api/chat') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);

        const messages = [];
        if (payload.system) {
          messages.push({ role: 'system', content: payload.system });
        }
        (payload.messages || []).forEach(m => {
          messages.push({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: m.content
          });
        });

        const data = JSON.stringify({
          model: 'gpt-4o-mini',
          max_tokens: payload.max_tokens || 400,
          messages: messages
        });

        const options = {
          hostname: 'api.openai.com',
          path: '/v1/chat/completions',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_KEY}`,
            'Content-Length': Buffer.byteLength(data)
          }
        };

        const apiReq = https.request(options, apiRes => {
          let responseData = '';
          apiRes.on('data', chunk => responseData += chunk);
          apiRes.on('end', () => {
            try {
              const openaiResponse = JSON.parse(responseData);
              const text = openaiResponse.choices?.[0]?.message?.content;
              const anthropicFormat = {
                content: [{ type: 'text', text: text || 'Sin respuesta' }]
              };
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(anthropicFormat));
            } catch(e) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Parse error' }));
            }
          });
        });

        apiReq.on('error', err => {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        });

        apiReq.write(data);
        apiReq.end();

      } catch(e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
  } else if (req.url === '/health') {
    res.writeHead(200);
    res.end('OK');
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, () => console.log(`Proxy Simulador Citas — Nuwek corriendo en puerto ${PORT}`));

<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<title>Clasificación — Filtrar / Setter / Cerrar · EVA+ FAW</title>
<style>
  :root{
    --navy:#1B3A6B; --navy-deep:#0B1B33; --blue:#3E6FB0; --blue-light:#8FC1E8;
    --bg:#F7F5EF; --card:#ffffff; --text:#33455E; --green:#2E8B57; --orange:#E8611A;
  }
  * { box-sizing:border-box; }
  body { margin:0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; background:var(--bg); color:var(--text); min-height:100vh; }
  .wrap { max-width:620px; margin:0 auto; padding:1.25rem 1rem 3rem; min-height:100vh; }
  .eyebrow { font-size:11px; font-weight:800; color:var(--blue); text-transform:uppercase; letter-spacing:0.08em; margin-bottom:6px; }
  h1 { font-size:24px; font-weight:900; color:var(--navy); margin:0 0 0.5rem; line-height:1.2; }
  p.sub { font-size:14px; color:rgba(51,69,94,0.75); line-height:1.5; margin:0 0 1.5rem; }
  .hidden { display:none !important; }

  /* Pantalla nombre */
  .name-card { background:var(--card); border-radius:16px; padding:1.5rem; box-shadow:0 10px 30px rgba(27,58,107,0.08); }
  input[type=text] { width:100%; padding:14px 16px; font-size:16px; border:1.5px solid rgba(27,58,107,0.2); border-radius:10px; margin-bottom:1rem; font-family:inherit; }
  input[type=text]:focus { outline:none; border-color:var(--blue); }
  button { font-family:inherit; cursor:pointer; }
  .btn-primary { width:100%; background:var(--navy); color:#fff; border:none; border-radius:10px; padding:14px; font-size:16px; font-weight:700; }
  .btn-primary:disabled { opacity:0.4; }
  .btn-primary:not(:disabled):active { background:var(--navy-deep); }

  /* Pantalla clasificar */
  .progress-bar { height:8px; background:rgba(27,58,107,0.1); border-radius:20px; overflow:hidden; margin-bottom:1.25rem; }
  .progress-fill { height:100%; background:var(--green); width:0%; transition:width 0.25s; }
  .progress-text { font-size:12px; font-weight:700; color:var(--navy); margin-bottom:1.25rem; }

  .pool { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:1.5rem; min-height:40px; }
  .chip { background:#fff; border:1.5px solid rgba(27,58,107,0.18); color:var(--navy); font-size:14px; font-weight:600; padding:9px 14px; border-radius:20px; cursor:pointer; transition:transform 0.12s, box-shadow 0.12s; user-select:none; }
  .chip:active { transform:scale(0.96); }
  .chip.selected { background:var(--navy); color:#fff; border-color:var(--navy); box-shadow:0 6px 16px rgba(27,58,107,0.3); }

  .buckets { display:flex; flex-direction:column; gap:12px; }
  .bucket { background:var(--card); border:2px dashed rgba(27,58,107,0.15); border-radius:14px; padding:12px 14px; min-height:64px; transition:border-color 0.15s, background 0.15s; }
  .bucket.receiving { border-color:var(--blue); background:rgba(62,111,176,0.06); }
  .bucket-label { font-size:13px; font-weight:800; color:var(--navy); text-transform:uppercase; letter-spacing:0.04em; margin-bottom:8px; display:flex; align-items:center; gap:6px; }
  .bucket-count { font-size:11px; font-weight:700; color:#fff; background:var(--blue); border-radius:10px; padding:1px 8px; }
  .bucket-items { display:flex; flex-wrap:wrap; gap:6px; }
  .bucket .chip { background:rgba(62,111,176,0.08); border-color:rgba(62,111,176,0.3); }

  .hint { font-size:12px; color:rgba(51,69,94,0.55); text-align:center; margin:1rem 0 1.25rem; }

  /* Pantalla gracias */
  .done-card { text-align:center; padding:2.5rem 1rem; }
  .done-icon { font-size:48px; margin-bottom:1rem; }
  .done-card h1 { text-align:center; }

  /* Panel resultados (facilitador) */
  .panel-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:1rem; gap:10px; }
  .btn-small { background:var(--navy); color:#fff; border:none; border-radius:8px; padding:8px 14px; font-size:12px; font-weight:700; white-space:nowrap; }
  .concept-row { background:var(--card); border-radius:12px; padding:12px 16px; margin-bottom:10px; box-shadow:0 6px 16px rgba(27,58,107,0.06); }
  .concept-row.agree { border-left:4px solid var(--green); }
  .concept-row.split { border-left:4px solid var(--orange); }
  .concept-name { font-size:14px; font-weight:800; color:var(--navy); margin-bottom:8px; }
  .concept-bars { display:flex; flex-direction:column; gap:4px; }
  .concept-bar-row { display:flex; align-items:center; gap:8px; font-size:11px; }
  .concept-bar-label { width:52px; flex-shrink:0; color:rgba(51,69,94,0.7); font-weight:700; }
  .concept-bar-track { flex:1; height:14px; background:rgba(27,58,107,0.06); border-radius:8px; overflow:hidden; }
  .concept-bar-fill { height:100%; background:var(--blue); border-radius:8px; transition:width 0.3s; }
  .concept-bar-n { width:18px; text-align:right; font-weight:700; color:var(--navy); }
  .participants { font-size:12px; color:rgba(51,69,94,0.6); margin-top:1.5rem; }
</style>
</head>
<body>
<div class="wrap">

  <!-- PANTALLA 1: NOMBRE -->
  <div id="screen-name">
    <div class="eyebrow">EVA+ · FAW</div>
    <h1>¿Cómo te llamas?</h1>
    <p class="sub">Usa el mismo nombre que uses en los próximos ejercicios — así te reconocemos cada vez.</p>
    <div class="name-card">
      <input type="text" id="name-input" placeholder="Tu nombre" autocomplete="off">
      <button class="btn-primary" id="btn-start" onclick="startClassify()">Comenzar</button>
    </div>
  </div>

  <!-- PANTALLA 2: CLASIFICAR -->
  <div id="screen-classify" class="hidden">
    <div class="eyebrow">Actividad en vivo</div>
    <h1>Filtrar · Setter · Cerrar</h1>
    <p class="sub">Toca un concepto y luego toca la caja donde crees que va.</p>
    <div class="progress-bar"><div class="progress-fill" id="progress-fill"></div></div>
    <div class="progress-text" id="progress-text">0/19 clasificados</div>

    <div class="pool" id="pool"></div>

    <div class="buckets">
      <div class="bucket" data-bucket="filtrar" onclick="assignSelected('filtrar')">
        <div class="bucket-label">🔍 Filtrar <span class="bucket-count" id="count-filtrar">0</span></div>
        <div class="bucket-items" id="items-filtrar"></div>
      </div>
      <div class="bucket" data-bucket="setter" onclick="assignSelected('setter')">
        <div class="bucket-label">🔧 Setter <span class="bucket-count" id="count-setter">0</span></div>
        <div class="bucket-items" id="items-setter"></div>
      </div>
      <div class="bucket" data-bucket="cerrar" onclick="assignSelected('cerrar')">
        <div class="bucket-label">🥊 Cerrar / Asesor <span class="bucket-count" id="count-cerrar">0</span></div>
        <div class="bucket-items" id="items-cerrar"></div>
      </div>
    </div>

    <div class="hint">Toca un concepto ya clasificado para regresarlo o moverlo</div>
    <button class="btn-primary" id="btn-submit" onclick="submitClassification()" disabled>Enviar mi clasificación</button>
  </div>

  <!-- PANTALLA 3: GRACIAS -->
  <div id="screen-done" class="hidden">
    <div class="done-card">
      <div class="done-icon">✅</div>
      <h1 id="done-title">¡Gracias!</h1>
      <p class="sub">Tu clasificación quedó guardada. Espera a que Carlos revise los resultados con todo el grupo.</p>
    </div>
  </div>

  <!-- PANTALLA 4: PANEL DE RESULTADOS (facilitador) -->
  <div id="screen-panel" class="hidden">
    <div class="panel-header">
      <div>
        <div class="eyebrow">Panel del facilitador</div>
        <h1 style="font-size:20px;margin:0">Comparativo en vivo</h1>
      </div>
      <button class="btn-small" onclick="loadResults()">↻ Actualizar</button>
    </div>
    <a class="btn-small" style="display:inline-block;text-decoration:none;margin-bottom:1rem" id="export-link" href="#" target="_blank">⬇ Descargar Excel (CSV)</a>
    <div id="results-list"></div>
    <div class="participants" id="participants-list"></div>
  </div>

</div>

<script>
const API_BASE = 'https://simulador-conversaciones-ventas.onrender.com';

const CONCEPTS = [
  'Necesidad','Dolor','Anhelo','Tamaño','Peso','Material que carga','Equipo actual',
  'Cantidad de unidades','Tipo de tránsito','Fecha estimada de compra','Decisor',
  'Ubicación','Frustración','Equipo aliado','Tipo de empresa','Qué transportas',
  'Cómo se enteró de nosotros','Presupuesto','Otras opciones'
];

const BUCKET_LABELS = { filtrar:'Filtrar', setter:'Setter', cerrar:'Cerrar' };

let userName = '';
let assignments = {}; // { concept: 'filtrar' | 'setter' | 'cerrar' }
let selectedConcept = null;

// Si la URL trae ?panel=1, mostramos el panel del facilitador directo
if (new URLSearchParams(location.search).get('panel') === '1') {
  document.addEventListener('DOMContentLoaded', showPanel);
}

document.addEventListener('DOMContentLoaded', () => {
  const saved = localStorage.getItem('eva_username');
  if (saved) document.getElementById('name-input').value = saved;
});

function startClassify() {
  const input = document.getElementById('name-input');
  const name = input.value.trim();
  if (!name) { input.focus(); return; }
  userName = name;
  localStorage.setItem('eva_username', name);
  assignments = {};
  document.getElementById('screen-name').classList.add('hidden');
  document.getElementById('screen-classify').classList.remove('hidden');
  renderPool();
  renderBuckets();
  updateProgress();
}

function renderPool() {
  const pool = document.getElementById('pool');
  pool.innerHTML = '';
  CONCEPTS.filter(c => !assignments[c]).forEach(c => {
    const chip = document.createElement('div');
    chip.className = 'chip' + (selectedConcept === c ? ' selected' : '');
    chip.textContent = c;
    chip.onclick = (e) => { e.stopPropagation(); selectConcept(c); };
    pool.appendChild(chip);
  });
}

function selectConcept(c) {
  selectedConcept = selectedConcept === c ? null : c;
  renderPool();
}

function assignSelected(bucket) {
  if (!selectedConcept) return;
  assignments[selectedConcept] = bucket;
  selectedConcept = null;
  renderPool();
  renderBuckets();
  updateProgress();
}

function unassign(concept, e) {
  e.stopPropagation();
  delete assignments[concept];
  renderPool();
  renderBuckets();
  updateProgress();
}

function renderBuckets() {
  ['filtrar','setter','cerrar'].forEach(bucket => {
    const container = document.getElementById('items-' + bucket);
    container.innerHTML = '';
    const items = CONCEPTS.filter(c => assignments[c] === bucket);
    document.getElementById('count-' + bucket).textContent = items.length;
    items.forEach(c => {
      const chip = document.createElement('div');
      chip.className = 'chip';
      chip.textContent = c;
      chip.onclick = (e) => unassign(c, e);
      container.appendChild(chip);
    });
  });
}

function updateProgress() {
  const done = Object.keys(assignments).length;
  const total = CONCEPTS.length;
  document.getElementById('progress-fill').style.width = Math.round(done/total*100) + '%';
  document.getElementById('progress-text').textContent = `${done}/${total} clasificados`;
  document.getElementById('btn-submit').disabled = done < total;
}

async function submitClassification() {
  const btn = document.getElementById('btn-submit');
  btn.disabled = true;
  btn.textContent = 'Enviando...';
  try {
    await fetch(API_BASE + '/api/classify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: userName, classifications: assignments })
    });
  } catch (e) {
    console.error('No se pudo enviar', e);
  }
  document.getElementById('screen-classify').classList.add('hidden');
  document.getElementById('done-title').textContent = `¡Gracias, ${userName}!`;
  document.getElementById('screen-done').classList.remove('hidden');
}

// ── Panel del facilitador ──
function showPanel() {
  document.getElementById('screen-name').classList.add('hidden');
  document.getElementById('screen-classify').classList.add('hidden');
  document.getElementById('screen-done').classList.add('hidden');
  document.getElementById('screen-panel').classList.remove('hidden');
  document.getElementById('export-link').href = API_BASE + '/api/classify/export.csv';
  loadResults();
}

async function loadResults() {
  const listEl = document.getElementById('results-list');
  const partsEl = document.getElementById('participants-list');
  try {
    const res = await fetch(API_BASE + '/api/classify/results');
    const data = await res.json();
    const submissions = data.submissions || [];

    const counts = {}; // { concept: {filtrar:n, setter:n, cerrar:n} }
    CONCEPTS.forEach(c => counts[c] = { filtrar:0, setter:0, cerrar:0 });
    submissions.forEach(s => {
      Object.entries(s.classifications || {}).forEach(([concept, bucket]) => {
        if (counts[concept] && counts[concept][bucket] !== undefined) counts[concept][bucket]++;
      });
    });

    const total = submissions.length || 1;
    listEl.innerHTML = '';
    CONCEPTS.forEach(concept => {
      const c = counts[concept];
      const max = Math.max(c.filtrar, c.setter, c.cerrar);
      const sum = c.filtrar + c.setter + c.cerrar;
      const agree = sum > 0 && max === sum;
      const row = document.createElement('div');
      row.className = 'concept-row ' + (sum === 0 ? '' : (agree ? 'agree' : 'split'));
      row.innerHTML = `<div class="concept-name">${concept}</div><div class="concept-bars">` +
        ['filtrar','setter','cerrar'].map(b => {
          const n = c[b];
          const pct = sum > 0 ? Math.round(n/sum*100) : 0;
          return `<div class="concept-bar-row"><div class="concept-bar-label">${BUCKET_LABELS[b]}</div><div class="concept-bar-track"><div class="concept-bar-fill" style="width:${pct}%"></div></div><div class="concept-bar-n">${n}</div></div>`;
        }).join('') + `</div>`;
      listEl.appendChild(row);
    });

    partsEl.textContent = `${submissions.length} participante(s): ` + submissions.map(s => s.name).join(', ');
  } catch (e) {
    listEl.innerHTML = '<p class="sub">No se pudieron cargar resultados. Revisa que el backend esté corriendo.</p>';
    console.error(e);
  }
}
</script>
</body>
</html>

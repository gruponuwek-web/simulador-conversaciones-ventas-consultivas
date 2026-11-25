const https = require('https');
const http = require('http');

const API_KEY = process.env.OPENAI_API_KEY;
const PORT = process.env.PORT || 3000;

// ─── Actividad "Filtrar / Setter / Cerrar" — datos en memoria ────────────────
const classifySubmissions = []; // { name, classifications: {concepto: 'filtrar'|'setter'|'cerrar'}, ts }
const classifyFinals = {}; // { concepto: 'filtrar'|'setter'|'cerrar' } — decisión oficial de Carlos

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function sendJSON(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
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
          // temperature: 0 = califica igual cada vez (exámenes); si no la mandan, 0.7 como antes (simulador)
          temperature: typeof payload.temperature === 'number' ? Math.max(0, Math.min(1, payload.temperature)) : 0.7,
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

  // ─── Rutas nuevas: actividad de clasificación ───────────────────────────
  } else if (req.method === 'POST' && req.url === '/api/classify') {
    readBody(req).then(body => {
      try {
        const { name, classifications } = JSON.parse(body || '{}');
        if (!name || !classifications || typeof classifications !== 'object') {
          return sendJSON(res, 400, { error: 'Falta name o classifications' });
        }
        const idx = classifySubmissions.findIndex(s => s.name.toLowerCase() === String(name).trim().toLowerCase());
        const entry = { name: String(name).trim(), classifications, ts: Date.now() };
        if (idx >= 0) classifySubmissions[idx] = entry;
        else classifySubmissions.push(entry);
        sendJSON(res, 200, { ok: true });
      } catch (e) {
        sendJSON(res, 400, { error: 'Invalid JSON' });
      }
    });

  } else if (req.method === 'GET' && req.url === '/api/classify/results') {
    sendJSON(res, 200, { submissions: classifySubmissions, finals: classifyFinals });

  } else if (req.method === 'POST' && req.url === '/api/classify/final') {
    readBody(req).then(body => {
      try {
        const { concept, bucket } = JSON.parse(body || '{}');
        if (!concept || !['filtrar','setter','cerrar'].includes(bucket)) {
          return sendJSON(res, 400, { error: 'Falta concept o bucket inválido' });
        }
        classifyFinals[concept] = bucket;
        sendJSON(res, 200, { ok: true });
      } catch (e) {
        sendJSON(res, 400, { error: 'Invalid JSON' });
      }
    });

  } else if (req.method === 'GET' && req.url === '/api/classify/export.csv') {
    const rows = [['nombre', 'concepto', 'clasificacion', 'fecha']];
    classifySubmissions.forEach(s => {
      const date = new Date(s.ts).toLocaleString('es-MX');
      Object.entries(s.classifications).forEach(([concept, bucket]) => {
        rows.push([s.name, concept, bucket, date]);
      });
    });
    rows.push(['', '', '', '']);
    rows.push(['CLASIFICACIÓN FINAL', '', '', '']);
    Object.entries(classifyFinals).forEach(([concept, bucket]) => {
      rows.push(['Carlos (final)', concept, bucket, '']);
    });
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    res.writeHead(200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="clasificacion-eva.csv"'
    });
    res.end('\uFEFF' + csv);

  } else if (req.method === 'POST' && req.url === '/api/classify/reset') {
    classifySubmissions.length = 0;
    Object.keys(classifyFinals).forEach(k => delete classifyFinals[k]);
    sendJSON(res, 200, { ok: true });

  } else if (req.url === '/health') {
    res.writeHead(200);
    res.end('OK');
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, () => console.log(`Proxy Simulador Citas — Nuwek corriendo en puerto ${PORT}`));

// Your own photos on the TV: sent from a phone to a short-lived page on the local network, kept in D/photos, shown by the Mode
// button's "My photos" slideshow.
//   POST /api/photos/pair, /pair-stop   the phone page on port 8792 at a 6-digit address (http://<tv>:8792/<code>), 15 minutes
//   GET  /api/photos/list               {photos: [{name, url, turn}], bytes, pairing, url, added}; turn: degrees the photo needs (EXIF)
//   GET  /api/photos/file/<name>        one photo
//   POST /api/photos/delete {name}, /clear
// Photos are JPEG, PNG or WebP (a phone's browser sends HEIC pictures as JPEG), at most 20 MB each and 500 photos or 1 GB in all.
const fs = require('fs'),
  path = require('path'),
  http = require('http'),
  crypto = require('crypto');
const P = require('./paths'),
  web = require('./web');
const { imageOk, sniff, imageType } = require('./themeschema');

const DIR = () => process.env.CYTV_PHOTOS || path.join(P.D, 'photos');
const PAIR_PORT = 8792,
  PAIR_MS = 15 * 60 * 1000,
  MAX_FILE = 20 * 1024 * 1024,
  MAX_FILES = 500,
  MAX_BYTES = 1024 * 1024 * 1024,
  NAME = /^[0-9]{13}-[0-9a-f]{6}\.(?:jpg|png|webp)$/;

// the rotation a JPEG's EXIF orientation asks for (older TV browsers do not turn photos themselves)
function turnOf(b) {
  if (!b || b[0] !== 0xff || b[1] !== 0xd8) return 0;
  let i = 2;
  while (i + 4 < b.length && b[i] === 0xff) {
    const mark = b[i + 1],
      len = b.readUInt16BE(i + 2);
    if (mark === 0xe1 && b.toString('latin1', i + 4, i + 10) === 'Exif\0\0') {
      const t = i + 10,
        le = b.toString('latin1', t, t + 2) === 'II',
        u16 = o => (le ? b.readUInt16LE(o) : b.readUInt16BE(o)),
        u32 = o => (le ? b.readUInt32LE(o) : b.readUInt32BE(o));
      if (t + 8 > b.length) return 0;
      const ifd = t + u32(t + 4),
        n = ifd + 2 <= b.length ? u16(ifd) : 0;
      for (let k = 0; k < n; k++) {
        const e = ifd + 2 + k * 12;
        if (e + 10 > b.length) return 0;
        if (u16(e) === 0x0112) {
          const o = u16(e + 8);
          return o === 3 || o === 4 ? 180 : o === 5 || o === 6 ? 90 : o === 7 || o === 8 ? 270 : 0;
        }
      }
      return 0;
    }
    if (mark === 0xda) return 0;
    i += 2 + len;
  }
  return 0;
}

function create() {
  let pair = null,
    added = 0;
  const ensure = () => {
    try {
      fs.mkdirSync(DIR());
    } catch (_) {}
  };
  const names = () => {
    try {
      return fs
        .readdirSync(DIR())
        .filter(n => NAME.test(n))
        .sort();
    } catch (_) {
      return [];
    }
  };
  const size = n => {
    try {
      return fs.statSync(path.join(DIR(), n)).size;
    } catch (_) {
      return 0;
    }
  };
  const turns = {};
  function list() {
    const ns = names();
    let bytes = 0;
    const photos = ns.map(n => {
      bytes += size(n);
      if (turns[n] === undefined) {
        let head = null;
        try {
          const fd = fs.openSync(path.join(DIR(), n), 'r');
          head = Buffer.alloc(65536);
          fs.readSync(fd, head, 0, 65536, 0);
          fs.closeSync(fd);
        } catch (_) {}
        turns[n] = turnOf(head);
      }
      return { name: n, url: '/api/photos/file/' + n, turn: turns[n] };
    });
    return { photos, bytes, pairing: !!pair, url: pair ? pair.url : '', added };
  }
  // a photo from the phone: checked, then kept under a name of its own
  function save(b) {
    const ns = names();
    if (ns.length >= MAX_FILES) return 'the TV holds ' + MAX_FILES + ' photos: delete some first';
    if (ns.reduce((s, n) => s + size(n), 0) + b.length > MAX_BYTES) return 'the photos would take more than 1 GB: delete some first';
    const ext = sniff(b);
    if (!ext || !imageOk(b, 'x.' + ext, MAX_FILE)) return 'not a JPEG, PNG or WebP photo';
    ensure();
    const n = Date.now() + '-' + crypto.randomBytes(3).toString('hex') + '.' + ext;
    fs.writeFileSync(path.join(DIR(), n), b);
    added++;
    return '';
  }

  function page(code) {
    return `<!doctype html><meta name=viewport content="width=device-width,initial-scale=1"><title>Photos to the TV</title>
<style>body{font:18px system-ui,sans-serif;background:#111;color:#eee;max-width:560px;margin:32px auto;padding:0 18px}label{display:block;padding:40px 16px;border:2px dashed #555;border-radius:16px;text-align:center;font-size:20px}input{display:none}#m{margin-top:20px;padding:12px;border-radius:10px;background:#1f2a1f;display:none}small{color:#888}</style>
<h2>Photos to the TV</h2><label for=f>Tap to choose photos</label><input id=f type=file accept="image/jpeg,image/png,image/webp" multiple>
<div id=m></div><p><small>The photos stay on the TV until you delete them there (Mode &gt; My photos). This page closes in 15 minutes.</small></p>
<script>
var m=document.getElementById('m');
document.getElementById('f').onchange=function(){var fs=[].slice.call(this.files),ok=0,bad=0;m.style.display='block';
(function next(){if(!fs.length){m.textContent=ok+' sent to the TV'+(bad?', '+bad+' not taken':'')+'. You can choose more.';return}
var f=fs.shift();m.textContent='Sending '+f.name+'\\u2026 ('+(ok+bad+1)+')';
fetch('/${code}/up',{method:'POST',body:f}).then(function(r){return r.text().then(function(t){if(r.ok)ok++;else{bad++;m.textContent=t}})},function(){bad++}).then(next)})()};
</script>`;
  }
  function startPair() {
    stopPair();
    const code = String(100000 + (crypto.randomBytes(4).readUInt32BE(0) % 900000));
    let wrong = 0;
    const srv = http.createServer((req, res) => {
      const p = req.url.split('?')[0];
      const send = (c, t, type) => {
        res.writeHead(c, { 'content-type': (type || 'text/plain') + '; charset=utf-8', 'cache-control': 'no-store' });
        res.end(t);
      };
      if (p !== '/' + code && p !== '/' + code + '/up') {
        // a guessed address: after 30 the page closes
        if (++wrong > 30) stopPair();
        return send(404, 'Not found');
      }
      if (req.method === 'GET' && p === '/' + code) return send(200, page(code), 'text/html');
      if (req.method !== 'POST' || p !== '/' + code + '/up') return send(404, 'Not found');
      const parts = [];
      let n = 0,
        big = false;
      req.on('data', d => {
        n += d.length;
        if (n > MAX_FILE) big = true;
        else parts.push(d);
      });
      req.on('end', () => {
        if (big) return send(413, 'A photo is larger than 20 MB');
        const err = save(Buffer.concat(parts));
        send(err ? 400 : 200, err || 'ok');
      });
      req.on('aborted', () => {});
    });
    srv.on('error', () => {
      pair = null;
    });
    // closing the page also ends the connections a phone keeps open
    const socks = [];
    srv.on('connection', s => {
      socks.push(s);
      s.on('close', () => socks.splice(socks.indexOf(s), 1));
    });
    srv.listen(PAIR_PORT, '0.0.0.0');
    added = 0;
    pair = { srv, socks, timer: setTimeout(stopPair, PAIR_MS), url: 'http://' + web.lanIp() + ':' + PAIR_PORT + '/' + code };
    return { url: pair.url, seconds: PAIR_MS / 1000 };
  }
  function stopPair() {
    if (!pair) return;
    clearTimeout(pair.timer);
    try {
      pair.srv.close();
    } catch (_) {}
    for (const s of pair.socks.slice()) s.destroy();
    pair = null;
  }

  async function handle(req, res, u, body) {
    if (u === '/api/photos/list') return web.json(res, list());
    const m = /^\/api\/photos\/file\/([^/]+)$/.exec(u);
    if (m) {
      if (!NAME.test(m[1])) return web.notFound(res);
      try {
        const b = fs.readFileSync(path.join(DIR(), m[1]));
        res.writeHead(200, { 'content-type': imageType(m[1]), 'cache-control': 'max-age=86400' });
        return res.end(b);
      } catch (_) {
        return web.notFound(res);
      }
    }
    if (req.method !== 'POST') return web.notFound(res);
    if (u === '/api/photos/pair') return web.json(res, startPair());
    if (u === '/api/photos/pair-stop') {
      stopPair();
      return web.json(res, list());
    }
    if (u === '/api/photos/delete') {
      const b = await body(req);
      if (NAME.test(String(b.name || '')))
        try {
          fs.unlinkSync(path.join(DIR(), b.name));
        } catch (_) {}
      return web.json(res, list());
    }
    if (u === '/api/photos/clear') {
      for (const n of names())
        try {
          fs.unlinkSync(path.join(DIR(), n));
        } catch (_) {}
      return web.json(res, list());
    }
    web.notFound(res);
  }

  return { name: 'photos', prefix: '/api/photos/', handle, list, save, stop: stopPair };
}

module.exports = { create, turnOf };

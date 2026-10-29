// Your photos (photos.js): sent from a phone to the page at a 6-digit address, only real photos are kept, the way the phone held them
// is read from EXIF, the list, serving, deleting and clearing; a guessed address closes the page.
const fs = require('fs'),
  path = require('path'),
  http = require('http');
const { ok, call, tmp, req, run } = require('./lib');

const post = (url, body) =>
  new Promise((res, rej) => {
    const u = new (require('url').URL)(url);
    const r = http.request({ host: u.hostname, port: u.port, path: u.pathname, method: 'POST' }, x => {
      let t = '';
      x.on('data', d => (t += d));
      x.on('end', () => res({ code: x.statusCode, text: t }));
    });
    r.on('error', rej);
    r.end(body);
  });
const get = url =>
  new Promise((res, rej) =>
    http
      .get(url, x => {
        let t = '';
        x.on('data', d => (t += d));
        x.on('end', () => res({ code: x.statusCode, text: t }));
      })
      .on('error', rej)
  );
// a small JPEG with an EXIF orientation (6: the phone was held upright, turn 90 degrees)
function jpeg(orientation) {
  const tiff = Buffer.from([0x4d, 0x4d, 0, 0x2a, 0, 0, 0, 8, 0, 1, 0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, orientation, 0, 0, 0, 0, 0, 0]);
  const app1 = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), tiff]);
  const len = Buffer.alloc(2);
  len.writeUInt16BE(app1.length + 2, 0);
  return Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe1]), len, app1, Buffer.from([0xff, 0xda, 0, 2, 1, 2, 3, 0xff, 0xd9])]);
}

run(async () => {
  process.env.CYTV_PHOTOS = path.join(tmp, 'photos');
  const mod = req('photos');
  ok(
    mod.turnOf(jpeg(6)) === 90 &&
      mod.turnOf(jpeg(8)) === 270 &&
      mod.turnOf(jpeg(3)) === 180 &&
      mod.turnOf(jpeg(1)) === 0 &&
      mod.turnOf(null) === 0,
    'the turn a photo needs is read from its EXIF orientation'
  );
  const ph = mod.create();
  let r = await call(ph, '/api/photos/list');
  ok(r.j.photos.length === 0 && r.j.pairing === false, 'no photos at first');
  r = await call(ph, '/api/photos/pair', 'POST');
  const url = r.j.url.replace(/^http:\/\/[^:/]*:/, 'http://127.0.0.1:');
  ok(/:8792\/\d{6}$/.test(r.j.url), 'the phone page is at a 6-digit address on port 8792');
  const page = await get(url);
  ok(page.code === 200 && /type=file/.test(page.text), 'the address opens the page to choose photos');
  const up = await post(url + '/up', jpeg(6));
  const up2 = await post(url + '/up', Buffer.from('<html>not a photo</html>'));
  ok(up.code === 200 && up2.code === 400 && /not a JPEG/.test(up2.text), 'a photo is taken, anything else is refused');
  r = await call(ph, '/api/photos/list');
  const p = r.j.photos[0];
  ok(
    r.j.photos.length === 1 && p.turn === 90 && r.j.added === 1 && /^\/api\/photos\/file\/\d{13}-[0-9a-f]{6}\.jpg$/.test(p.url),
    'the list has it, with its turn'
  );
  r = await call(ph, p.url);
  ok(r.code === 200, 'the photo is served to the launcher');
  r = await call(ph, '/api/photos/file/..%2fconfig.json');
  ok(r.code === 404, 'only photo names are served');
  for (let i = 0; i < 31; i++) await get(url.replace(/\d{6}$/, '000000')).catch(() => null);
  let closed = false;
  try {
    await post(url + '/up', jpeg(1));
  } catch (_) {
    closed = true;
  }
  ok(closed && !(await call(ph, '/api/photos/list')).j.pairing, 'after 30 guessed addresses the page closes');
  await call(ph, '/api/photos/delete', 'POST', { name: p.name });
  ok((await call(ph, '/api/photos/list')).j.photos.length === 0 && !fs.existsSync(path.join(tmp, 'photos', p.name)), 'a photo is deleted');
  ph.save(jpeg(1));
  ph.save(jpeg(1));
  r = await call(ph, '/api/photos/clear', 'POST');
  ok(r.j.photos.length === 0, 'Delete my photos removes them all');
  ph.stop();
});

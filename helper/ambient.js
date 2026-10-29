// The Mode button on Home: what the TV shows while nobody watches. This part gives the photos for the slideshow and switches the
// screen off with the sound kept (the radio goes on); the launcher draws the modes itself.
//   GET  /api/ambient/photos       {photos: [{url, title, credit}]}: Wikimedia's picture of the day of the last 30 days
//   POST /api/ambient/screen-off   the panel off, the TV still on; any key on the remote switches it on again
// Pictures of the day are chosen by Wikimedia Commons and free to show; each comes with its author and licence, shown on screen.
const fetch = require('./fetch'),
  web = require('./web');

const FEED = () => process.env.CYTV_WIKI || 'https://en.wikipedia.org/api/rest_v1/feed/featured'; // the tests set a stand-in
const DAYS = 30,
  TTL = 12 * 3600 * 1000,
  WIDTH = 1920,
  COMMONS = /^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/([0-9a-f])\/([0-9a-f]{2})\/([^/?#]+)$/;
const strip = s =>
  String(s || '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();

// a picture at the width of the screen: Commons' own scaled copy when the original is wider (an original can be 50 MB)
function sized(img) {
  const src = String((img && img.source) || ''),
    w = Number(img && img.width) || 0,
    m = COMMONS.exec(src);
  if (!m || !/\.(jpe?g|png)$/i.test(m[3])) return '';
  return w > WIDTH
    ? 'https://upload.wikimedia.org/wikipedia/commons/thumb/' + m[1] + '/' + m[2] + '/' + m[3] + '/' + WIDTH + 'px-' + m[3]
    : src;
}

function create(ctx) {
  let cache = null;
  const day = n => {
    const d = new Date(Date.now() - n * 86400000);
    return d.getUTCFullYear() + '/' + ('0' + (d.getUTCMonth() + 1)).slice(-2) + '/' + ('0' + d.getUTCDate()).slice(-2);
  };
  async function one(n) {
    try {
      const r = await fetch.read(FEED() + '/' + day(n), {
        headers: { accept: 'application/json', 'user-agent': 'CleanYourTV (https://github.com/lasharor/cleanyourtv-WebOS)' },
        totalMs: 15000,
        maxBytes: 2 * 1024 * 1024,
      });
      const im = JSON.parse(r.body.toString('utf8')).image || {};
      // landscape only: a tall picture leaves most of a TV black
      if (!im.image || !(Number(im.image.width) > Number(im.image.height))) return null;
      const url = sized(im.image);
      if (!url) return null;
      const who = strip(im.artist && im.artist.text).slice(0, 80),
        lic = strip(im.license && im.license.type).slice(0, 30);
      return {
        url,
        title: strip((im.description && im.description.text) || im.title)
          .replace(/^File:/, '')
          .slice(0, 140),
        credit: [who, lic, 'Wikimedia Commons'].filter(Boolean).join(' · '),
      };
    } catch (_) {
      return null;
    }
  }
  function photos() {
    if (cache && Date.now() - cache.at < cache.ttl) return cache.promise;
    const days = [];
    for (let i = 0; i < DAYS; i++) days.push(i);
    const promise = Promise.all(days.map(one)).then(list => {
      const out = list.filter(Boolean);
      if (!out.length) cache.ttl = 10 * 60 * 1000;
      return out.length ? { photos: out } : { photos: [], error: 'no pictures could be read' };
    });
    cache = { at: Date.now(), ttl: TTL, promise };
    return promise;
  }

  async function handle(req, res, u) {
    if (u === '/api/ambient/photos') return web.json(res, await photos());
    if (u === '/api/ambient/screen-off' && req.method === 'POST')
      return web.json(res, await ctx.luna('luna://com.webos.service.tvpower/power/turnOffScreen', {}));
    web.notFound(res);
  }

  return { name: 'ambient', prefix: '/api/ambient/', handle, photos };
}

module.exports = { create, sized };

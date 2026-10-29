// Radio on Home: the radio stations of the TV's country, from the open Radio Browser directory (radio-browser.info, no key), most
// liked first. Only streams the TV's browser plays (MP3 or AAC, not HLS). The launcher plays them itself, with an <audio> element.
//   GET /api/radio/stations?country=HR   {stations: [{id, name, url, logo, codec, bitrate}]}
// The list is kept for a day per country; a failure is retried after ten minutes.
const { URLSearchParams } = require('url');
const fetch = require('./fetch'),
  web = require('./web');

// the directory's own servers, tried in turn; the tests set CYTV_RADIO to a local stand-in
const HOSTS = () =>
  process.env.CYTV_RADIO ? [process.env.CYTV_RADIO] : ['https://de1.api.radio-browser.info', 'https://fi1.api.radio-browser.info'];
const TTL = 24 * 3600 * 1000,
  FAIL_TTL = 10 * 60 * 1000,
  MAX = 40;
const COUNTRY = /^[A-Z]{2}$/,
  CODECS = /^(mp3|aac|aac\+)$/i,
  URL_OK = /^https?:\/\/[^\s"'<>]+$/;

function create() {
  const cache = {};
  let lastError = '';

  async function ask(country) {
    const q = new URLSearchParams({
      countrycode: country,
      order: 'votes',
      reverse: 'true',
      hidebroken: 'true',
      limit: '150',
    });
    let err = null;
    for (const h of HOSTS()) {
      try {
        const r = await fetch.read(h + '/json/stations/search?' + q.toString(), {
          headers: { accept: 'application/json', 'user-agent': 'CleanYourTV' },
          totalMs: 15000,
          maxBytes: 2 * 1024 * 1024,
        });
        return JSON.parse(r.body.toString('utf8'));
      } catch (e) {
        err = e;
      }
    }
    throw err || new Error('no radio directory');
  }

  // one entry per station name (the directory often lists the same station several times), playable streams only
  function pick(list) {
    const seen = {},
      out = [];
    for (const s of Array.isArray(list) ? list : []) {
      const url = String(s.url_resolved || s.url || '');
      const name = String(s.name || '')
        .trim()
        .slice(0, 60);
      const key = name.toLowerCase().replace(/[^a-z0-9čćšžđ]+/g, '');
      if (!name || !key || seen[key] || !URL_OK.test(url) || !CODECS.test(String(s.codec || '')) || Number(s.hls) === 1) continue;
      seen[key] = 1;
      const logo = String(s.favicon || '');
      out.push({
        id: String(s.stationuuid || key).slice(0, 40),
        name,
        url,
        logo: /^https:\/\/[^\s"'<>]+$/.test(logo) ? logo : '',
        codec: String(s.codec),
        bitrate: Number(s.bitrate) || 0,
      });
      if (out.length >= MAX) break;
    }
    return out;
  }

  function stations(country) {
    const c = COUNTRY.test(country) ? country : 'HR',
      now = Date.now(),
      hit = cache[c];
    if (hit && now - hit.at < hit.ttl) return hit.promise;
    const promise = ask(c).then(
      list => {
        lastError = '';
        return { stations: pick(list) };
      },
      e => {
        lastError = String(e.message || e);
        cache[c].ttl = FAIL_TTL;
        console.log('radio: ' + lastError);
        return { stations: [], error: lastError };
      }
    );
    cache[c] = { at: now, ttl: TTL, promise };
    return promise;
  }

  async function handle(req, res, u) {
    const q = new URLSearchParams(req.url.split('?')[1] || '');
    if (u === '/api/radio/stations') return web.json(res, await stations(String(q.get('country') || '')));
    web.notFound(res);
  }

  return { name: 'radio', prefix: '/api/radio/', handle, stations, error: () => lastError };
}

module.exports = { create };

// Trailers on the home screen (optional, off until a TMDB key is set and it is switched on in the manager app). While the focus rests on
// a streaming app (Netflix, Disney+, Prime Video, Max, SkyShowtime, Apple TV), the launcher plays a trailer of something popular on that
// service in the TV's country, quietly, behind the home screen. What is popular, where it streams and the trailer addresses come from
// TMDB (themoviedb.org) with the user's own free key; the trailers are YouTube videos, played by YouTube's embedded player in a page
// served here, because the embedded player needs a page with an http address and the launcher is a local file.
//   GET  /api/trailers/status          {enabled, hasKey, volume, pairing, pairedAt, error}
//   POST /api/trailers/set             {enabled, key, clearKey, volume}
//   GET  /api/trailers/for?title=&region=&lang=   {items: [{title, year, kind, video, backdrop}]}, the app named by its title
//   GET  /api/trailers/player?v=&vol=  the page that plays one trailer and tells the launcher (postMessage) when it plays
//   POST /api/trailers/pair, /pair-stop   a short-lived page on the local network (port 8791) to type the key on a phone
const http = require('http'),
  crypto = require('crypto');
const { URLSearchParams } = require('url');
const fetch = require('./fetch'),
  web = require('./web');

const API = () => process.env.CYTV_TMDB || 'https://api.themoviedb.org/3'; // overridden only by the tests
const IMG = 'https://image.tmdb.org/t/p/w1280';
const DEFAULTS = { enabled: false, key: '', volume: 15 };
const TTL = 12 * 3600 * 1000,
  FAIL_TTL = 10 * 60 * 1000,
  PER_KIND = 6,
  MAX_ITEMS = 8;
// [the app's title, the service's name at TMDB]; the first provider whose name matches is used
const SERVICES = [
  [/netflix/i, /^netflix$/i],
  [/disney/i, /^disney\s*(plus|\+)$/i],
  [/prime video|amazon/i, /^amazon prime video$/i],
  [/^(hbo\s*)?max\b|hbo/i, /^(hbo\s*)?max$/i],
  [/skyshowtime/i, /^skyshowtime$/i],
  [/apple\s*tv/i, /^apple tv(\+|\s*plus)$/i],
];
// films and series for grown-ups: TMDB's genres Animation and Family (films and series) and Kids (series) are left out
const NO_GENRES = { movie: [16, 10751], tv: [16, 10751, 10762] };
const VIDEO = /^[\w-]{6,20}$/,
  REGION = /^[A-Z]{2}$/,
  LANG = /^[a-z]{2}(-[A-Z]{2})?$/;

function create(ctx) {
  const config = ctx.config;
  const cfg = () => Object.assign({}, DEFAULTS, config.get().trailers || {});
  const cache = {}; // what TMDB answered, by region and service: {at, ttl, items | promise}
  let lastError = '',
    pair = null,
    pairedAt = 0;

  // one TMDB call; a v3 key (32 hex digits) goes in the address, a v4 read token in the Authorization header
  async function tmdb(p, params, key) {
    const k = key || cfg().key;
    if (!k) throw new Error('no TMDB key');
    const q = new URLSearchParams(params || {});
    const v3 = /^[0-9a-f]{32}$/i.test(k);
    if (v3) q.set('api_key', k);
    const r = await fetch.read(API() + p + '?' + q.toString(), {
      headers: v3 ? { accept: 'application/json' } : { accept: 'application/json', authorization: 'Bearer ' + k },
      totalMs: 15000,
      maxBytes: 2 * 1024 * 1024,
      statusText: s => (s === 401 ? 'TMDB refused the key' : 'TMDB answered ' + s),
    });
    return JSON.parse(r.body.toString('utf8'));
  }

  // a description cut at a word, for the two or three lines under the title
  const shorten = (s, n) => (s.length <= n ? s : s.slice(0, s.lastIndexOf(' ', n - 1) > n / 2 ? s.lastIndexOf(' ', n - 1) : n - 1) + '…');

  // the trailer to show for a title: an official YouTube trailer in the TV's language, else in English, else a teaser
  function bestVideo(list, lang) {
    const yt = (list || []).filter(v => v && v.site === 'YouTube' && VIDEO.test(String(v.key)));
    const score = v =>
      (v.type === 'Trailer' ? 4 : v.type === 'Teaser' ? 2 : 0) +
      (v.official ? 1 : 0) +
      (v.iso_639_1 === lang ? 2 : v.iso_639_1 === 'en' ? 1 : 0);
    const best = yt.filter(v => v.type === 'Trailer' || v.type === 'Teaser').sort((a, b) => score(b) - score(a))[0];
    return best ? String(best.key) : '';
  }

  async function lookup(service, region, lang) {
    const provs = await tmdb('/watch/providers/movie', { watch_region: region, language: lang });
    const p = (provs.results || []).filter(x => SERVICES[service][1].test(String(x.provider_name || '')))[0];
    if (!p) return [];
    const disc = kind =>
      tmdb('/discover/' + kind, {
        watch_region: region,
        with_watch_providers: String(p.provider_id),
        with_watch_monetization_types: 'flatrate',
        without_genres: NO_GENRES[kind].join(','),
        sort_by: 'popularity.desc',
        language: lang,
        page: '1',
      }).then(x =>
        (x.results || [])
          .filter(r => !(r.genre_ids || []).some(g => NO_GENRES[kind].indexOf(g) >= 0))
          .slice(0, PER_KIND)
          .map(r => ({ kind, r }))
      );
    const lists = await Promise.all([disc('movie'), disc('tv')]);
    const picks = [];
    for (let i = 0; i < PER_KIND; i++) for (const l of lists) if (l[i]) picks.push(l[i]); // a film, a series, a film, ...
    const short = lang.slice(0, 2);
    const items = await Promise.all(
      picks.map(x =>
        tmdb('/' + x.kind + '/' + x.r.id + '/videos', { include_video_language: short + ',en,null' }).then(
          v => {
            const video = bestVideo(v.results, short);
            const d = String(x.r.release_date || x.r.first_air_date || '');
            return video
              ? {
                  title: String(x.r.title || x.r.name || '').slice(0, 120),
                  year: /^\d{4}/.test(d) ? d.slice(0, 4) : '',
                  overview: shorten(String(x.r.overview || ''), 240),
                  kind: x.kind,
                  video,
                  backdrop: /^\/[\w.-]+$/.test(String(x.r.backdrop_path || '')) ? IMG + x.r.backdrop_path : '',
                }
              : null;
          },
          () => null
        )
      )
    );
    return items.filter(Boolean).slice(0, MAX_ITEMS);
  }

  // the trailers for an app, by its title; kept for twelve hours, a failure for ten minutes
  async function forApp(title, region, lang) {
    const c = cfg();
    if (!c.enabled || !c.key) return { items: [], off: true };
    let service = -1;
    for (let i = 0; i < SERVICES.length; i++) if (service < 0 && SERVICES[i][0].test(title)) service = i;
    if (service < 0) return { items: [] };
    const reg = REGION.test(region) ? region : 'US',
      lng = LANG.test(lang) ? lang : 'en-US';
    const id = reg + ' ' + service + ' ' + lng,
      now = Date.now(),
      hit = cache[id];
    if (hit && now - hit.at < hit.ttl) return hit.promise;
    const promise = lookup(service, reg, lng).then(
      items => {
        lastError = '';
        return { items };
      },
      e => {
        lastError = String(e.message || e);
        cache[id].ttl = FAIL_TTL;
        console.log('trailers: ' + lastError);
        return { items: [], error: lastError };
      }
    );
    cache[id] = { at: now, ttl: TTL, promise };
    return promise;
  }

  const status = () => {
    const c = cfg();
    return { enabled: !!c.enabled, hasKey: !!c.key, volume: c.volume, pairing: !!pair, pairedAt, error: lastError };
  };
  // the settings, from the manager or the phone page; '' or what is wrong
  function applySet(b) {
    const c = cfg();
    if (typeof b.key === 'string' && b.key.trim()) {
      const k = b.key.trim();
      if (!/^[\w.-]{20,400}$/.test(k)) return 'that does not look like a TMDB key';
      c.key = k;
    }
    if (b.clearKey) {
      c.key = '';
      c.enabled = false;
    }
    if (typeof b.volume === 'number' && isFinite(b.volume)) c.volume = Math.round(Math.min(100, Math.max(0, b.volume)));
    if (typeof b.enabled === 'boolean') {
      if (b.enabled && !c.key) return 'set the TMDB key first';
      c.enabled = b.enabled;
    }
    config.update('trailers', x => {
      x.trailers = c;
    });
    for (const k of Object.keys(cache)) delete cache[k];
    return '';
  }

  // the page that plays one trailer: YouTube's embedded player, muted until it starts (autoplay), then at the chosen volume
  function player(v, vol) {
    return `<!doctype html><meta charset=utf-8><title>Trailer</title><style>html,body{margin:0;height:100%;overflow:hidden;background:#000}#p{position:absolute;left:-6%;top:-6%;width:112%;height:112%}</style>
<div id=p></div><script>
var V=${JSON.stringify(v)},VOL=${vol},told=0;
function tell(m){try{parent.postMessage('cytv-trailer:'+m,'*')}catch(e){}}
function onYouTubeIframeAPIReady(){new YT.Player('p',{videoId:V,playerVars:{autoplay:1,mute:1,controls:0,disablekb:1,fs:0,iv_load_policy:3,modestbranding:1,playsinline:1,rel:0,loop:1,playlist:V,origin:location.origin},events:{
onReady:function(e){e.target.playVideo();if(VOL>0){e.target.unMute();e.target.setVolume(VOL)}},
onStateChange:function(e){if(e.data===1&&!told){told=1;tell('playing')}},
onError:function(){tell('error')}}})}
</script><script src="https://www.youtube.com/iframe_api" onerror="tell('error')"></script>`;
  }

  // ---- the key from a phone: a short-lived page on the local network, opened by scanning a QR code in the manager ----
  const PAIR_PORT = 8791,
    PAIR_MS = 10 * 60 * 1000;
  function pairPage(msg, done, token) {
    const c = cfg();
    return `<!doctype html><meta name=viewport content="width=device-width,initial-scale=1"><title>Trailers</title>
<style>body{font:18px system-ui,sans-serif;background:#111;color:#eee;max-width:560px;margin:32px auto;padding:0 18px}label{display:block;color:#aaa;font-size:15px;margin-top:14px}input,button{font:inherit;width:100%;box-sizing:border-box;padding:12px;margin:6px 0;border-radius:10px;border:1px solid #444;background:#1b1b1f;color:#eee}button{background:#f5f6f8;color:#111;font-weight:600;margin-top:20px}.m{padding:12px;border-radius:10px;background:#1f2a1f}small{color:#888}a{color:#9cf}h2{margin:0 0 8px}</style>
<h2>Trailers on the home screen</h2>${msg ? `<p class=m>${web.esc(msg)}</p>` : ''}${
      done
        ? ''
        : `<p><small>Make a free account at <a href="https://www.themoviedb.org/signup">themoviedb.org</a>, then Settings &gt; API. Paste the <b>API key</b> or the <b>API read access token</b>.</small></p>
<form method=post action="/${token}/save"><label>TMDB key ${c.key ? '(one is saved; leave empty to keep it)' : ''}</label><input name=key type=password autocomplete=off>
<button>Save and switch trailers on</button></form>`
    }`;
  }
  function startPair() {
    stopPair();
    const token = crypto.randomBytes(16).toString('hex');
    let hits = 0;
    const srv = http.createServer((req, res) => {
      const send = (code, html) => {
        res.writeHead(code, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
        res.end(html);
      };
      if (++hits > 120) return send(429, 'Too many requests');
      const p = req.url.split('?')[0];
      if (req.method === 'GET' && p === '/' + token) return send(200, pairPage('', false, token));
      if (req.method === 'POST' && p === '/' + token + '/save') {
        let b = '';
        req.on('data', d => {
          b += d;
          if (b.length > 4096) req.destroy();
        });
        req.on('end', () => {
          const key = (new URLSearchParams(b).get('key') || '').trim();
          const k = key || cfg().key;
          if (!k) return send(400, pairPage('Paste the key first.', false, token));
          // the key is checked with TMDB before it is kept
          tmdb('/configuration', {}, k).then(
            () => {
              const err = applySet({ key, enabled: true });
              if (err) return send(400, pairPage(err, false, token));
              pairedAt = Date.now();
              send(200, pairPage('Saved: trailers are on. You can close this page.', true, token));
              setTimeout(stopPair, 2000);
            },
            e => send(400, pairPage('The key did not work: ' + e.message, false, token))
          );
        });
        return;
      }
      send(404, 'Not found');
    });
    srv.on('error', () => {
      pair = null;
    });
    srv.listen(PAIR_PORT, '0.0.0.0');
    pair = { srv, timer: setTimeout(stopPair, PAIR_MS), url: 'http://' + web.lanIp() + ':' + PAIR_PORT + '/' + token };
    return { url: pair.url, seconds: PAIR_MS / 1000 };
  }
  function stopPair() {
    if (!pair) return;
    clearTimeout(pair.timer);
    try {
      pair.srv.close();
    } catch (_) {}
    pair = null;
  }

  async function handle(req, res, u, body) {
    const act = u.replace('/api/trailers/', '');
    const q = new URLSearchParams(req.url.split('?')[1] || '');
    if (act === 'status') return web.json(res, status());
    if (act === 'for') return web.json(res, await forApp(String(q.get('title') || ''), q.get('region') || '', q.get('lang') || ''));
    if (act === 'player') {
      const v = q.get('v') || '',
        vol = Math.round(Math.min(100, Math.max(0, Number(q.get('vol')) || 0)));
      if (!VIDEO.test(v)) return web.notFound(res);
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      return res.end(player(v, vol));
    }
    if (req.method !== 'POST') return web.notFound(res);
    if (act === 'set') {
      const err = applySet(await body(req));
      return err ? web.json(res, { error: err }, 400) : web.json(res, status());
    }
    if (act === 'pair') return web.json(res, startPair());
    if (act === 'pair-stop') {
      stopPair();
      return web.json(res, status());
    }
    web.notFound(res);
  }

  return { name: 'trailers', prefix: '/api/trailers/', handle, status, forApp, stop: stopPair };
}

module.exports = { create, SERVICES };

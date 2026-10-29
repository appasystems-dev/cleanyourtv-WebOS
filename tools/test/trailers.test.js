// Trailers (trailers.js): off without a key, the right TMDB calls for a streaming app in the TV's country, the best trailer of each title,
// nothing for an app that is not a streaming service, a cache, errors reported and retried, the key never reaches the launcher, and
// the player page only for a valid video id.
const { ok, call, serve, req, memoryConfig, run } = require('./lib');
const { URL } = require('url');

run(async () => {
  const hits = [];
  let refuse = false;
  const noCartoons = [];
  const tmdb = await serve((q, r) => {
    const u = new URL(q.url, 'http://x');
    hits.push(u.pathname + ' ' + (u.searchParams.get('api_key') || q.headers.authorization || ''));
    const j = (o, code) => {
      r.writeHead(code || 200, { 'content-type': 'application/json' });
      r.end(JSON.stringify(o));
    };
    if (refuse) return j({ status_message: 'Invalid API key' }, 401);
    if (u.pathname === '/watch/providers/movie')
      return j({
        results: [
          { provider_id: 1796, provider_name: 'Netflix basic with Ads' },
          { provider_id: 8, provider_name: 'Netflix' },
          { provider_id: 337, provider_name: 'Disney Plus' },
        ],
      });
    if (u.pathname === '/discover/movie' || u.pathname === '/discover/tv') {
      const tv = u.pathname === '/discover/tv';
      if (u.searchParams.get('with_watch_providers') !== '8' || u.searchParams.get('watch_region') !== 'HR') return j({ results: [] });
      noCartoons.push(u.searchParams.get('without_genres'));
      return j({
        results: [
          { id: tv ? 29 : 19, [tv ? 'name' : 'title']: 'A cartoon', genre_ids: [35, 16], backdrop_path: '/c.jpg' },
          { id: tv ? 28 : 18, [tv ? 'name' : 'title']: 'A family film', genre_ids: [10751, 12], backdrop_path: '/f.jpg' },
          {
            id: tv ? 20 : 10,
            [tv ? 'name' : 'title']: tv ? 'Series A' : 'Film A',
            backdrop_path: '/a.jpg',
            overview: tv ? 'Short.' : 'A long description of the film. '.repeat(20),
            [tv ? 'first_air_date' : 'release_date']: '2025-03-01',
          },
          { id: tv ? 21 : 11, [tv ? 'name' : 'title']: tv ? 'Series B' : 'Film B', backdrop_path: null },
        ],
      });
    }
    const v = /^\/(movie|tv)\/(\d+)\/videos$/.exec(u.pathname);
    if (v) {
      if (v[2] === '11') return j({ results: [{ site: 'Vimeo', type: 'Trailer', key: '123456' }] }); // no YouTube trailer: left out
      return j({
        results: [
          { site: 'YouTube', type: 'Featurette', key: 'feat_000001', official: true, iso_639_1: 'en' },
          { site: 'YouTube', type: 'Trailer', key: 'trail_en_01', official: true, iso_639_1: 'en' },
          { site: 'YouTube', type: 'Trailer', key: 'trail_hr_' + v[2], official: true, iso_639_1: 'hr' },
          { site: 'YouTube', type: 'Teaser', key: 'teaser_0001', official: true, iso_639_1: 'hr' },
        ],
      });
    }
    j({}, 404);
  });
  process.env.CYTV_TMDB = tmdb.url;
  const config = memoryConfig();
  const tr = req('trailers').create({ config });
  const tc = (act, body, method) => call(tr, '/api/trailers/' + act, method || (body === undefined ? 'GET' : 'POST'), body);
  const KEY = '0123456789abcdef0123456789abcdef';

  let r = await tc('for?title=Netflix&region=HR&lang=hr-HR');
  ok(r.j.off === true && r.j.items.length === 0 && hits.length === 0, 'off by default: no trailers and no call to TMDB');
  r = await tc('set', { enabled: true });
  ok(r.code === 400 && /key first/.test(r.j.error), 'switching trailers on without a key is refused');
  r = await tc('set', { key: 'short' });
  ok(r.code === 400 && !config.get().trailers, 'something that is not a TMDB key is refused');
  r = await tc('set', { key: KEY, enabled: true, volume: 250 });
  ok(
    r.code === 200 && r.j.enabled && r.j.hasKey && r.j.volume === 100 && !('key' in r.j),
    'a key switches them on; the volume is clamped; the status never shows the key'
  );

  r = await tc('for?title=Netflix&region=HR&lang=hr-HR');
  const it = r.j.items;
  ok(
    it.length === 3 &&
      it[0].title === 'Film A' &&
      it[1].title === 'Series A' &&
      it[2].title === 'Series B' &&
      it[0].video === 'trail_hr_10' &&
      it[1].video === 'trail_hr_20' &&
      it[0].year === '2025' &&
      it[0].kind === 'movie' &&
      it[1].overview === 'Short.' &&
      it[0].overview.length <= 240 &&
      /^A long description .* A long…$/.test(it[0].overview) &&
      it[2].overview === '' &&
      it[0].backdrop === 'https://image.tmdb.org/t/p/w1280/a.jpg' &&
      it[2].backdrop === '',
    'Netflix in Croatia: popular films and series in turn, each with its official trailer in Croatian and a short description cut at a word; a title without a YouTube trailer is left out'
  );
  ok(
    noCartoons.sort().join(' ') === '16,10751 16,10751,10762' && !it.some(x => x.title === 'A cartoon' || x.title === 'A family film'),
    'nothing for children: TMDB is asked without animation, family and kids titles, and one it sends anyway is left out'
  );
  ok(
    hits.every(h => / 0123456789abcdef0123456789abcdef$/.test(h)),
    'a v3 key is sent in the address'
  );
  const n = hits.length;
  await tc('for?title=Netflix&region=HR&lang=hr-HR');
  ok(hits.length === n, 'the answer is kept: the same app does not ask TMDB again');
  r = await tc('for?title=Disney%2B&region=HR&lang=hr-HR');
  ok(r.j.items.length === 0 && !r.j.error, 'a service with nothing popular gives no trailers');
  r = await tc('for?title=YouTube&region=HR&lang=hr-HR');
  ok(r.j.items.length === 0 && hits.length === n + 3, 'an app that is not a streaming service asks nothing');

  await tc('set', { key: 'eyJhbGciOiJIUzI1NiJ9.token-for-tests' });
  refuse = true;
  r = await tc('for?title=Netflix&region=HR&lang=hr-HR');
  ok(
    r.j.items.length === 0 && /refused the key/.test(r.j.error) && /Bearer eyJ/.test(hits[hits.length - 1]),
    'a read token goes in the header; a refused key is reported'
  );
  r = await tc('status');
  ok(/refused the key/.test(r.j.error), 'the last error shows in the status for the manager');

  refuse = false;
  await tc('set', { enabled: true });
  const apps = req('apps').create({ config, luna: async () => ({ returnValue: true, apps: [] }), version: '1.6.0', feature: () => null });
  r = await call(apps, '/api/apps');
  ok(
    JSON.stringify(config.get()).indexOf('token-for-tests') > 0 &&
      JSON.stringify(r.j.config.trailers) === JSON.stringify({ enabled: true, volume: 100 }),
    'the key stays in config.json; the launcher gets only whether trailers are on and the volume'
  );
  r = await tc('player?v=abc_DEF-123&vol=15');
  ok(
    r.code === 200 && /videoId:V/.test(r.out) && /"abc_DEF-123"/.test(r.out) && /VOL=15/.test(r.out),
    'the player page plays the asked trailer at the asked volume'
  );
  r = await tc('player?v=%22%3E%3Cscript%3E&vol=15');
  ok(r.code === 404, 'the player page refuses anything that is not a video id');
  r = await tc('set', { clearKey: true });
  ok(r.j.enabled === false && r.j.hasKey === false, 'forgetting the key switches trailers off');
  tmdb.server.close();
});

// Radio (radio.js) and the Mode screens' photos (ambient.js): the stations of a country from the radio directory (playable streams
// only, one per name, kept), the next directory server when one fails; Wikimedia's pictures of the day at screen width, landscape
// only, with their credit.
const { ok, call, serve, req, run } = require('./lib');
const { URL } = require('url');

run(async () => {
  // ---- radio ----
  const asked = [];
  const dir = await serve((q, r) => {
    const u = new URL(q.url, 'http://x');
    asked.push(u.pathname + ' ' + u.searchParams.get('countrycode') + ' ' + u.searchParams.get('order') + ' ' + q.headers['user-agent']);
    r.writeHead(200, { 'content-type': 'application/json' });
    r.end(
      JSON.stringify([
        {
          stationuuid: 'a',
          name: 'HR 1',
          url_resolved: 'https://s/hr1.mp3',
          codec: 'MP3',
          bitrate: 128,
          favicon: 'https://s/hr1.png',
          hls: 0,
        },
        { stationuuid: 'b', name: 'HR1', url_resolved: 'https://s/hr1-copy.mp3', codec: 'MP3', hls: 0 },
        { stationuuid: 'c', name: 'Antena Zagreb', url_resolved: 'http://s/antena.aac', codec: 'AAC+', favicon: 'http://s/x.png', hls: 0 },
        { stationuuid: 'd', name: 'An HLS one', url_resolved: 'https://s/x.m3u8', codec: 'AAC', hls: 1 },
        { stationuuid: 'e', name: 'An OGG one', url_resolved: 'https://s/x.ogg', codec: 'OGG', hls: 0 },
        { stationuuid: 'f', name: 'Bad address', url_resolved: 'javascript:alert(1)', codec: 'MP3', hls: 0 },
      ])
    );
  });
  process.env.CYTV_RADIO = dir.url;
  const radio = req('radio').create();
  let r = await call(radio, '/api/radio/stations?country=HR');
  const st = r.j.stations;
  ok(
    st.length === 2 &&
      st[0].name === 'HR 1' &&
      st[0].url === 'https://s/hr1.mp3' &&
      st[0].logo === 'https://s/hr1.png' &&
      st[1].name === 'Antena Zagreb' &&
      st[1].logo === '' &&
      /^\/json\/stations\/search HR votes CleanYourTV$/.test(asked[0]),
    'the stations of the TV country, most liked first, one per name, MP3 or AAC streams only (no HLS, no other codecs, no odd addresses)'
  );
  await call(radio, '/api/radio/stations?country=HR');
  ok(asked.length === 1, 'the list is kept: the directory is not asked again');
  r = await call(radio, '/api/radio/stations?country=../x');
  ok(asked.length === 1 && r.j.stations.length === 2, 'a country that is not a country code falls back to Croatia (the list kept)');
  dir.server.close();
  process.env.CYTV_RADIO = 'http://127.0.0.1:1';
  r = await call(req('radio').create(), '/api/radio/stations?country=DE');
  ok(r.j.stations.length === 0 && !!r.j.error, 'no directory: an empty list and the reason');

  // ---- photos for the slideshow ----
  const amb = req('ambient');
  ok(
    amb.sized({ source: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Lake_at_dawn.jpg', width: 6000 }) ===
      'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Lake_at_dawn.jpg/1920px-Lake_at_dawn.jpg' &&
      amb.sized({ source: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Small.jpg', width: 1200 }) ===
        'https://upload.wikimedia.org/wikipedia/commons/a/ab/Small.jpg' &&
      amb.sized({ source: 'https://example.com/a/ab/x.jpg', width: 6000 }) === '' &&
      amb.sized({ source: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Clip.webm', width: 6000 }) === '',
    "a picture of the day at the screen's width from Commons' own scaled copies; anything else is left out"
  );
  let n = 0;
  const wiki = await serve((q, res) => {
    n++;
    const tall = n === 1;
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(
      JSON.stringify({
        image: {
          title: 'File:Lake.jpg',
          image: {
            source: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Lake.jpg',
            width: tall ? 2000 : 5000,
            height: tall ? 4000 : 3000,
          },
          artist: { text: '<a href="x">Ana Example</a>' },
          license: { type: 'CC BY-SA 4.0' },
          description: { text: 'A lake <b>at dawn</b>' },
        },
      })
    );
  });
  process.env.CYTV_WIKI = wiki.url;
  const a = amb.create({ luna: async () => ({ returnValue: true }) });
  r = await call(a, '/api/ambient/photos');
  const p = r.j.photos;
  ok(
    n === 30 &&
      p.length >= 28 &&
      p[0].url === 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Lake.jpg/1920px-Lake.jpg' &&
      p[0].title === 'A lake at dawn' &&
      p[0].credit === 'Ana Example · CC BY-SA 4.0 · Wikimedia Commons',
    'the pictures of the last 30 days, landscape only, at screen width, with the title, author and licence as plain text'
  );
  await call(a, '/api/ambient/photos');
  ok(n === 30, 'the pictures are kept for the day');
  r = await call(a, '/api/ambient/screen-off', 'POST');
  ok(r.j.returnValue === true, 'Screen off asks the TV to switch the panel off');
  wiki.server.close();
});

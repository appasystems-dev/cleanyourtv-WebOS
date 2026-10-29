/* ---------- Mode (the button at the top right): what the TV shows while nobody watches. Evening light that lights the room softly, your
   own photos (sent from a phone), photos of the day, a black screen, or the screen off with the sound kept. The radio goes on; any key
   comes back to Home (in the evening light the arrows set it). Only transform and opacity move (the GPU is weak), and a clock moves now
   and then so nothing stays in one place. ---------- */
var modeEl = null,
  modeAt = 0,
  modeT = 0,
  modeIv = 0,
  modePhotos = null,
  modeTurn = 0,
  modeKind = '';
/* the evening light: [name, base, three soft lights]; and how much of it shines, darkest first */
var LIGHTS = [
    ['Warm', '#3a1c0a', ['#ff9a4a', '#ffb067', '#e0703a']],
    ['Candle', '#2e1206', ['#ff7a2a', '#ffc06a', '#c8501e']],
    ['Rose', '#2e1220', ['#ff8a8a', '#ffb3a0', '#d0607a']],
    ['Sea', '#081a26', ['#3aa0c8', '#5ac0b0', '#2a6aa8']],
  ],
  DIMS = [0.8, 0.65, 0.5, 0.35, 0.2],
  light = { c: 0, d: 1 };
try {
  var sv = JSON.parse(localStorage.getItem('cytv.light') || '{}');
  if (sv.c >= 0 && sv.c < LIGHTS.length) light.c = sv.c;
  if (sv.d >= 0 && sv.d < DIMS.length) light.d = sv.d;
} catch (e) {}
function modeOn() {
  return !!modeEl;
}
function modeMenu() {
  api('/api/photos/list').then(
    function (x) {
      modeRows((x && x.photos) || []);
    },
    function () {
      modeRows([]);
    }
  );
}
function modeRows(mine) {
  var items = [
    { label: t('Evening light'), sub: t('lights the room softly'), fn: modeLight },
    {
      label: t('My photos'),
      sub: mine.length ? mine.length + ' ' + t('photos') : t('none yet: send some from your phone'),
      stay: !mine.length,
      fn: function () {
        if (mine.length) modeSlides(mine, true);
        else photosFromPhone();
      },
    },
    { label: t('Add photos...'), stay: true, fn: photosFromPhone },
    { label: t('Photos of the day'), sub: 'Wikimedia Commons', fn: modeWiki },
    { label: t('Black screen'), sub: t('nothing lights up'), fn: modeBlack },
    { label: t('Screen off'), sub: t('the sound goes on, e.g. the radio'), fn: modeScreenOff },
  ];
  if (mine.length)
    items.push({
      label: t('Delete my photos'),
      sub: t('hold OK for 5 seconds'),
      hold: 5000,
      fn: function () {
        closeMenus();
        api('/api/photos/clear', {}).then(function () {
          toast(t('Your photos are deleted'));
        });
      },
    });
  openMenu(t('Mode'), items);
}
function modeBegin(kind) {
  closeMenus();
  trailerStop();
  modeExit(true);
  modeEl = document.createElement('div');
  modeEl.id = 'mode';
  modeEl.className = kind;
  modeKind = kind;
  document.body.appendChild(modeEl);
  modeAt = Date.now();
  return modeEl;
}
/* any key ends it, except the one still held from choosing it */
function modeExit(force) {
  if (!modeEl || (!force && Date.now() - modeAt < 800)) return;
  clearTimeout(modeT);
  clearInterval(modeIv);
  if (modeEl.parentNode) modeEl.parentNode.removeChild(modeEl);
  modeEl = null;
  modeKind = '';
}
/* the keys a Mode screen uses itself: in the evening light, Up and Down set how bright, Left and Right the colour */
function modeKey(k) {
  if (modeKind !== 'light' || k < 37 || k > 40) return false;
  if (k === 38) light.d = Math.min(DIMS.length - 1, light.d + 1);
  else if (k === 40) light.d = Math.max(0, light.d - 1);
  else light.c = (light.c + (k === 39 ? 1 : LIGHTS.length - 1)) % LIGHTS.length;
  try {
    localStorage.setItem('cytv.light', JSON.stringify(light));
  } catch (e) {}
  lightPaint();
  return true;
}
function modeClock(w, small) {
  var c = document.createElement('div');
  c.className = 'mclk' + (small ? ' small' : '');
  c.innerHTML = '<div class="mt"></div><div class="md"></div>';
  w.appendChild(c);
  var n = 0,
    draw = function () {
      var d = new Date();
      try {
        c.firstChild.textContent = d.toLocaleTimeString(LOC, clockOpts());
        c.lastChild.textContent = d.toLocaleDateString(LOC, { weekday: 'long', day: 'numeric', month: 'long' });
      } catch (e) {
        c.firstChild.textContent = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
      }
      /* a new place every few minutes, within the screen */
      if (n++ % 12 === 0)
        c.style.transform = 'translate(' + Math.round(Math.random() * 1100) + 'px,' + Math.round(Math.random() * 640) + 'px)';
    };
  draw();
  modeIv = setInterval(draw, 15000);
}
function modeLight() {
  var w = modeBegin('light');
  w.innerHTML =
    '<div class="lb0"></div><div class="blob b1"></div><div class="blob b2"></div><div class="blob b3"></div><div class="ldim"></div>' +
    '<div class="lhint"></div>';
  w.querySelector('.lhint').textContent = t('Up and Down: brighter or darker · Left and Right: colour · other keys: back');
  modeClock(w, true);
  lightPaint();
  modeT = setTimeout(function () {
    var h = w.querySelector('.lhint');
    if (h) h.classList.add('gone');
  }, 7000);
}
function lightPaint() {
  if (!modeEl || modeKind !== 'light') return;
  var L = LIGHTS[light.c],
    bs = modeEl.querySelectorAll('.blob');
  modeEl.querySelector('.lb0').style.background = L[1];
  for (var i = 0; i < bs.length; i++) bs[i].style.background = 'radial-gradient(closest-side, ' + L[2][i] + ', rgba(0,0,0,0))';
  modeEl.querySelector('.ldim').style.opacity = String(DIMS[light.d]);
}
function modeBlack() {
  modeBegin('black');
}
function modeScreenOff() {
  modeBegin('black');
  api('/api/ambient/screen-off', {}).then(
    function (x) {
      if (x && x.returnValue === false) toast(t('The screen could not be switched off'));
    },
    function () {
      toast(t('The screen could not be switched off'));
    }
  );
}
function modeWiki() {
  if (modePhotos) return modeSlides(modePhotos, false);
  var w = modeBegin('slides');
  api('/api/ambient/photos').then(
    function (x) {
      if (modeEl !== w) return;
      var list = (x && x.photos) || [];
      if (list.length) modePhotos = list;
      modeSlides(list, false);
    },
    function () {
      if (modeEl === w) modeSlides([], false);
    }
  );
}
/* a slideshow: your photos whole (turned the way the phone held them), photos of the day across the screen with their credit */
function modeSlides(list, mine) {
  if (!list.length) {
    toast(t('No photos now: the evening light instead'));
    return modeLight();
  }
  var w = modeBegin('slides' + (mine ? ' mine' : ''));
  w.innerHTML = '<div class="mph"></div><div class="mph"></div><div class="mcap"></div>';
  var layers = w.querySelectorAll('.mph'),
    cap = w.querySelector('.mcap'),
    show = function () {
      var p = list[modeTurn++ % list.length],
        url = mine ? API + p.url : p.url,
        img = new Image();
      img.onload = function () {
        if (modeEl !== w) return;
        var next = layers[modeTurn % 2],
          prev = layers[(modeTurn + 1) % 2],
          turn = mine ? p.turn || 0 : 0;
        next.style.backgroundImage = 'url("' + url + '")';
        next.className = 'mph on' + (turn === 90 || turn === 270 ? ' side' : '');
        next.style.transform = turn ? 'rotate(' + turn + 'deg)' : '';
        prev.classList.remove('on');
        cap.textContent = mine ? '' : (p.title ? p.title + ' · ' : '') + p.credit;
      };
      img.onerror = function () {
        clearTimeout(modeT);
        modeT = setTimeout(show, 2000);
      };
      img.src = url;
      clearTimeout(modeT);
      modeT = setTimeout(show, mine ? 15000 : 30000);
    };
  show();
}
/* sending photos from a phone: the service opens a page on the home network at a short address, shown here */
function photosFromPhone() {
  api('/api/photos/pair', {}).then(
    function (x) {
      if (!x || !x.url) return toast(t('The photo page could not be opened'));
      openMenu(t('Add photos...'), [
        { label: x.url, sub: t('type it in the phone’s browser (same Wi-Fi)'), stay: true, fn: function () {} },
        {
          label: t('Done'),
          fn: function () {
            api('/api/photos/pair-stop', {}).then(function (y) {
              toast(((y && y.added) || 0) + ' ' + t('photos received'));
            });
          },
        },
      ]);
    },
    function () {
      toast(t('The photo page could not be opened'));
    }
  );
}

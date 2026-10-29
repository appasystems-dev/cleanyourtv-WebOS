/* ---------- trailers (manager > Trailers): while the focus rests on a streaming app, a popular film or series on it fills the screen
   behind Home: first its picture, title and a short description, then, TRL_WAIT after the focus arrived, its trailer, quietly. The
   service finds them (TMDB) and serves the player page; this only shows and removes them. The player is removed, not paused, whenever
   the focus moves or anything opens, so the TV's video pipeline is free for the app. ---------- */
var HERO_WAIT = 300 /* ms the focus rests before the picture comes: moving along the row does not flash every title */,
  TRL_WAIT = 2000 /* ms from the focus arriving to the trailer starting */,
  TRL_AGE = 6 * 3600 * 1000,
  trlT = 0,
  trlAt = 0,
  trlFor = '',
  trlFrame = null,
  trlCache = {},
  trlTurn = {};
function trailersOn() {
  return !!(cfg.trailers && cfg.trailers.enabled);
}
function trlRegion() {
  var m = /^[a-z]{2}-([A-Z]{2})/.exec(LOC);
  return m ? m[1] : '';
}
/* called on every focus change: a tile of the dock row (or of a grid that stays in view) shows a title, then its trailer */
function isStreaming(a) {
  return (
    a.id !== '__live' &&
    STREAMING.some(function (re) {
      return re.test(a.title);
    })
  );
}
function trailerFocus(e) {
  var a = e && e._a,
    id = a && !a.sys && (trailersOn() || isStreaming(a)) && (r === 1 || (!TH.push && !TH.overlay)) ? a.id : '';
  if (id && id === trlFor) return;
  trailerStop();
  if (!id) return;
  trlFor = id;
  trlAt = Date.now();
  trlT = setTimeout(function () {
    trailerLoad(a);
  }, HERO_WAIT);
}
function trailerLoad(a) {
  if (!trailersOn()) return trailerLogo(a);
  var c = trlCache[a.id];
  if (c && Date.now() - c.at < TRL_AGE) return trailerShow(a, c.items);
  api('/api/trailers/for?title=' + encodeURIComponent(a.title) + '&region=' + trlRegion() + '&lang=' + encodeURIComponent(LOC)).then(
    function (x) {
      var items = (x && x.items) || [];
      if (!(x && x.error)) trlCache[a.id] = { at: Date.now(), items: items };
      trailerShow(a, items);
    },
    function () {}
  );
}
/* the picture, the title and the description at once; the trailer when TRL_WAIT has passed since the focus arrived */
function trailerShow(a, items) {
  if (trlFor !== a.id) return;
  if (!items.length) return trailerLogo(a);
  var n = trlTurn[a.id] || 0,
    it = items[n % items.length];
  trlTurn[a.id] = n + 1;
  $('trl-bd').style.backgroundImage = it.backdrop ? 'url("' + it.backdrop + '")' : 'none';
  $('trl-t').textContent = it.title + (it.year ? ' (' + it.year + ')' : '');
  $('trl-o').textContent = it.overview || '';
  $('trl').classList.add('on');
  document.body.classList.add('hero');
  trlT = setTimeout(
    function () {
      trailerPlay(a, it);
    },
    Math.max(0, TRL_WAIT - (Date.now() - trlAt))
  );
}
/* an app without films to show (YouTube, or trailers off): its own logo, large, and its name */
function trailerLogo(a) {
  if (trlFor !== a.id || !isStreaming(a)) return;
  $('trl-bd').style.backgroundImage = 'none';
  $('trl-logo').src = API + '/icon/' + encodeURIComponent(a.id);
  $('trl-t').textContent = a.title;
  $('trl-o').textContent = '';
  $('trl').classList.add('on');
  $('trl').classList.add('logo');
  document.body.classList.add('hero');
}
function trailerPlay(a, it) {
  if (trlFor !== a.id || !it.video || radioOn()) return; /* the radio has the sound: the picture stays */
  trlFrame = document.createElement('iframe');
  trlFrame.setAttribute('allow', 'autoplay');
  trlFrame.src = API + '/api/trailers/player?v=' + encodeURIComponent(it.video) + '&vol=' + ((cfg.trailers && cfg.trailers.volume) || 0);
  $('trl').appendChild(trlFrame);
}
function trailerStop() {
  clearTimeout(trlT);
  trlFor = '';
  if (trlFrame) {
    trlFrame.src = 'about:blank';
    if (trlFrame.parentNode) trlFrame.parentNode.removeChild(trlFrame);
    trlFrame = null;
  }
  var w = $('trl');
  if (w) {
    w.classList.remove('on');
    w.classList.remove('logo');
  }
  document.body.classList.remove('hero');
}
window.addEventListener('message', function (ev) {
  if (!trlFrame || ev.source !== trlFrame.contentWindow) return;
  if (ev.data === 'cytv-trailer:playing') trlFrame.classList.add('on');
  else if (ev.data === 'cytv-trailer:error') {
    /* the picture stays, without the video */
    trlFrame.src = 'about:blank';
    trlFrame.parentNode.removeChild(trlFrame);
    trlFrame = null;
  }
});

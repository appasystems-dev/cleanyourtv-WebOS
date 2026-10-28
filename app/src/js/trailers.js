/* ---------- trailers (manager > Trailers): while the focus rests on a streaming app, a trailer of something popular on it plays
   quietly behind the home screen. The service finds them (TMDB) and serves the player page; this only shows and removes it. The player
   is removed, not paused, whenever the focus moves or anything opens, so the TV's video pipeline is free for the app. ---------- */
var TRL_WAIT = 2500,
  TRL_AGE = 6 * 3600 * 1000,
  trlT = 0,
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
/* called on every focus change: a tile of the dock row (or of a grid that stays in view) waits, then plays */
function trailerFocus(e) {
  var a = e && e._a,
    id = a && !a.sys && trailersOn() && (r === 1 || (!TH.push && !TH.overlay)) ? a.id : '';
  if (id && id === trlFor) return;
  trailerStop();
  if (!id) return;
  trlFor = id;
  trlT = setTimeout(function () {
    trailerLoad(a);
  }, TRL_WAIT);
}
function trailerLoad(a) {
  var c = trlCache[a.id];
  if (c && Date.now() - c.at < TRL_AGE) return trailerPlay(a, c.items);
  api('/api/trailers/for?title=' + encodeURIComponent(a.title) + '&region=' + trlRegion() + '&lang=' + encodeURIComponent(LOC)).then(
    function (x) {
      var items = (x && x.items) || [];
      if (!(x && x.error)) trlCache[a.id] = { at: Date.now(), items: items };
      trailerPlay(a, items);
    },
    function () {}
  );
}
function trailerPlay(a, items) {
  if (trlFor !== a.id || !items.length) return;
  var n = trlTurn[a.id] || 0,
    it = items[n % items.length],
    w = $('trl');
  trlTurn[a.id] = n + 1;
  $('trl-bd').style.backgroundImage = it.backdrop ? 'url("' + it.backdrop + '")' : 'none';
  $('trl-cap').textContent = it.title + (it.year ? ' (' + it.year + ')' : '');
  w.classList.add('on');
  trlFrame = document.createElement('iframe');
  trlFrame.setAttribute('allow', 'autoplay');
  trlFrame.src = API + '/api/trailers/player?v=' + encodeURIComponent(it.video) + '&vol=' + ((cfg.trailers && cfg.trailers.volume) || 0);
  w.appendChild(trlFrame);
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
  if (w) w.classList.remove('on');
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

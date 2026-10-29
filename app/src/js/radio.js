/* ---------- radio (the Radio button on the strip): the stations of the TV's country from the service, played here. It goes on in a
   Mode screen and stops when an app or Live TV opens, or Home is left. The TV has no FM tuner: these are the stations' own streams. ---------- */
var radioEl = null,
  radioNow = null,
  radioList = null;
function radioOn() {
  return !!radioNow;
}
function radioStop() {
  if (radioEl) {
    radioEl.pause();
    radioEl.removeAttribute('src');
    try {
      radioEl.load();
    } catch (e) {}
  }
  radioNow = null;
}
function radioPlay(s) {
  trailerStop();
  if (!radioEl) {
    radioEl = document.createElement('audio');
    radioEl.preload = 'none';
    radioEl.addEventListener('error', function () {
      if (radioNow && radioEl.getAttribute('src')) {
        toast(t('This station does not play now') + ': ' + radioNow.name);
        radioStop();
      }
    });
  }
  radioNow = s;
  radioEl.src = s.url;
  var p = radioEl.play();
  if (p && p.catch)
    p.catch(function () {
      if (radioNow === s) {
        toast(t('This station does not play now') + ': ' + s.name);
        radioStop();
      }
    });
}
function radioMenu() {
  if (radioList) return radioRows();
  var m = /^[a-z]{2}-([A-Z]{2})/.exec(LOC);
  api('/api/radio/stations?country=' + (m ? m[1] : '')).then(
    function (x) {
      if (!x.stations || !x.stations.length) return toast(t('No radio stations found'));
      radioList = x.stations;
      radioRows();
    },
    function () {
      toast(t('No radio stations found'));
    }
  );
}
function radioRows() {
  var items = [];
  if (radioNow)
    items.push({
      icon: 'radio',
      label: t('Stop the radio'),
      sub: radioNow.name,
      fn: radioStop,
    });
  radioList.forEach(function (s) {
    items.push({
      label: s.name,
      sub: radioNow && radioNow.id === s.id ? t('playing') : '',
      stay: true,
      fn: function () {
        radioPlay(s);
        var top = stack[stack.length - 1],
          i = top ? top.idx : 0;
        backMenu();
        radioRows();
        stack[stack.length - 1].idx = Math.min(i + (items[0].fn === radioStop ? 0 : 1), stack[stack.length - 1].items.length - 1);
        drawMenu();
      },
    });
  });
  openMenu(t('Radio'), items);
}

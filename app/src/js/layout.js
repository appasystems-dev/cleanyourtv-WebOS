/* ---------- layout ---------- */
function rebuild() {
  var by = {};
  apps.forEach(function (a) {
    by[a.id] = a;
  });
  var di = dockIds(),
    dock = di.map(function (i) {
      return by[i];
    });
  var rest = apps
    .filter(function (a) {
      return !isHidden(a.id) && di.indexOf(a.id) < 0;
    })
    .sort(byOrder);
  var oldE = rows[r] && rows[r][c],
    keep = oldE && oldE._a ? oldE._a.id : null;
  if (oldE) oldE.classList.remove('f');
  var dk = $('dock'),
    gd = $('grid'),
    bar = $('bar'),
    rl = $('rail');
  dk.textContent = '';
  gd.textContent = '';
  bar.textContent = '';
  rl.textContent = '';
  ri = -1;
  var d = dock.map(function (a) {
    var t = tile(a);
    dk.appendChild(t);
    fit(t, true);
    return t;
  });
  var g = rest.map(function (a) {
    var t = tile(a);
    gd.appendChild(t);
    fit(t, false);
    return t;
  });
  /* with the strip on the left (theme rail.show) the top bar has only the Theme button; Live TV is among the apps, so it is left off the strip */
  railEls = TH.rail
    ? [{ label: 'Home', icon: 'home', action: 'home', fixed: true }]
        .concat(
          shownBar().filter(function (o) {
            return o.action !== 'live';
          })
        )
        .map(function (o) {
          var b = document.createElement('div');
          b.className = 'rb';
          b._o = o;
          b.innerHTML = svg(o.action === 'inputs' ? 'hdmi' : o.icon);
          hit(b);
          rl.appendChild(b);
          return b;
        })
    : [];
  var tb = (
    TH.rail
      ? [{ label: 'Theme', icon: 'theme', action: 'theme', fixed: true }]
      : shownBar().concat([{ label: 'Customise', icon: 'edit', action: 'customize', fixed: true }])
  ).map(function (o) {
    var p = document.createElement('div');
    p.className = 'pill';
    p._o = o;
    p.innerHTML = svg(o.icon) + '<span></span>';
    p.lastChild.textContent = barLabel(o);
    hit(p);
    bar.appendChild(p);
    return p;
  });
  rows = [tb, d.length ? d : tb];
  for (var i = 0; i < g.length; i += TH.cols) rows.push(g.slice(i, i + TH.cols));
  var nr = Math.min(r, rows.length - 1),
    nc = c;
  if (keep && tiles[keep]) {
    var p = posOf(tiles[keep]);
    if (p) {
      nr = p[0];
      nc = p[1];
    }
  }
  setFocus(nr, nc, true);
}

function load() {
  api('/api/apps')
    .then(function (x) {
      if (x.version && oldSvc(x.version) && !warned) {
        warned = true;
        toast('The service (' + x.version + ') is older than this launcher needs: update it in the CleanYourTV manager');
      }
      usage = x.usage || {};
      var rank = Object.keys(usage).sort(function (a, b) {
        return usage[b] - usage[a];
      });
      var sig = JSON.stringify([
        x.apps.map(function (a) {
          return a.id;
        }),
        x.config,
        rank,
      ]);
      if (sig === lastSig) return;
      lastSig = sig;
      apps = x.apps.map(function (a) {
        return { id: a.id, title: a.title };
      });
      cfg = x.config || {};
      applyTheme(cfg.theme);
      if (liveOn()) apps.push({ id: '__live', title: t('Live TV') });
      store();
      rebuild();
      if (!perfReady) {
        perfReady = true;
        perfMark('launcher ready ' + Math.round(performance.now()));
      }
    })
    .catch(function () {
      toast(t('Helper not reachable, retrying...'));
      setTimeout(load, 3000);
    });
}

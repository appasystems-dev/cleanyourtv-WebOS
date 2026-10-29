/* ---------- config (edited in the launcher, saved through the helper) ---------- */
function saveCfg() {
  api('/api/config', cfg).catch(function () {
    toast(t('Could not save settings'));
  });
  store();
  rebuild();
}
function isHidden(id) {
  return (cfg.hidden || []).indexOf(id) >= 0;
}
/* the dock until you change it: the streaming apps on this TV, in the order of STREAMING, as many as the theme's dock holds */
function streamingIds() {
  var out = [];
  STREAMING.forEach(function (re) {
    apps.forEach(function (a) {
      if (a.id !== '__live' && re.test(a.title) && out.indexOf(a.id) < 0) out.push(a.id);
    });
  });
  return out;
}
function dockIds() {
  var by = {};
  apps.forEach(function (a) {
    by[a.id] = a;
  });
  var ids = cfg.dock && cfg.dock.length ? cfg.dock : streamingIds();
  if (!ids.length) ids = DEFAULTS.dock;
  return ids
    .filter(function (i) {
      return by[i] && !isHidden(i);
    })
    .slice(0, TH.dockN);
}
function setDock(ids) {
  cfg.dock = ids.slice(0, TH.dockN);
  saveCfg();
}
function hideApp(id) {
  cfg.hidden = (cfg.hidden || []).concat(id);
  cfg.dock = dockIds().filter(function (i) {
    return i !== id;
  });
  saveCfg();
}
function unhideApp(id) {
  cfg.hidden = (cfg.hidden || []).filter(function (i) {
    return i !== id;
  });
  saveCfg();
}
function topbar() {
  return cfg.topbar ? cfg.topbar : DEFAULTS.topbar;
}
/* Live TV is optional (manager > Live TV): off hides every entry, the saved layout is kept for when it is switched on again */
function liveOn() {
  return !(cfg.options && cfg.options.liveTv === false);
}
function shownBar() {
  return liveOn()
    ? topbar()
    : topbar().filter(function (o) {
        return o.action !== 'live';
      });
}
function byOrder(a, b) {
  if (cfg.sort !== 'alpha') {
    var d = (usage[b.id] || 0) - (usage[a.id] || 0);
    if (Math.abs(d) > 1e-9) return d > 0 ? 1 : -1;
  }
  return a.title.localeCompare(b.title);
}
function title(id) {
  for (var i = 0; i < apps.length; i++) if (apps[i].id === id) return apps[i].title;
  return id;
}

/* ---------- actions ---------- */
function act(e) {
  var a = e._a;
  trailerStop();
  if (a) {
    if (!a.sys) {
      e.classList.add('launching');
      setTimeout(function () {
        e.classList.remove('launching');
      }, 4000);
    }
    return launch(a.id);
  }
  var o = e._o || {};
  if (o.action === 'customize') return customizeMenu();
  if (o.action === 'theme') return themeMenu();
  if (o.action === 'radio') return radioMenu();
  if (o.action === 'mode') return modeMenu();
  if (o.action === 'home') return railLeave(1, 0);
  if (o.action === 'live') {
    radioStop();
    return LIVE.enter();
  }
  if (o.action === 'inputs') return inputsMenu();
  if (o.app) launch(o.app, o.params);
}

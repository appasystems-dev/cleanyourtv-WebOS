/* ---------- menus ---------- */
var stack = [],
  ovEl = null;
/* webOS 5's Chromium (68) can leave the old text in the compositor tile when an element's content is replaced, so menu and list text shows
   twice (issue 4). There the element is swapped for a fresh one instead of rewriting its content; newer engines just set innerHTML. */
var OLDGPU = (function () {
  var m = /Chrome\/(\d+)/.exec(navigator.userAgent || '');
  return !!m && +m[1] < 79;
})();
function setHtml(el, h) {
  if (!OLDGPU || !el.parentNode) {
    el.innerHTML = h;
    return el;
  }
  var n = el.cloneNode(false);
  n.innerHTML = h;
  el.parentNode.replaceChild(n, el);
  return n;
}
function openMenu(title, items) {
  trailerStop();
  stack.push({ title: title, items: items, idx: 0 });
  drawMenu();
}
function closeMenus() {
  stack = [];
  if (ovEl) {
    ovEl.remove();
    ovEl = null;
  }
}
function backMenu() {
  stack.pop();
  if (stack.length) drawMenu();
  else closeMenus();
}
function drawMenu() {
  var m = stack[stack.length - 1],
    N = 8,
    start = Math.max(0, Math.min(m.idx - 3, m.items.length - N));
  if (!ovEl) {
    ovEl = document.createElement('div');
    ovEl.id = 'ov';
    document.body.appendChild(ovEl);
  }
  var h = '<div class="panel"><h2></h2><div class="more">' + (start > 0 ? '▲' : '') + '</div>';
  for (var i = start; i < Math.min(m.items.length, start + N); i++) {
    var it = m.items[i];
    h +=
      '<div class="row' +
      (i === m.idx ? ' f' : '') +
      (it.dim ? ' dim' : '') +
      '" data-i="' +
      i +
      '">' +
      (it.icon ? svg(it.icon) : '') +
      '<span class="lb"></span>' +
      (it.sub ? '<span class="st"></span>' : '') +
      '</div>';
  }
  h += '<div class="more">' + (start + N < m.items.length ? '▼' : '') + '</div></div>';
  ovEl = setHtml(ovEl, h);
  ovEl.querySelector('h2').textContent = m.title;
  [].forEach.call(ovEl.querySelectorAll('.row'), function (row) {
    var it = m.items[+row.getAttribute('data-i')];
    row.querySelector('.lb').textContent = it.label;
    if (it.sub) row.querySelector('.st').textContent = it.sub;
    row.addEventListener('click', function () {
      m.idx = +row.getAttribute('data-i');
      if (it.hold) return;
      pickMenu();
    });
    if (it.hold) {
      row.addEventListener('mousedown', function () {
        m.idx = +row.getAttribute('data-i');
        holdStart(it);
      });
      row.addEventListener('mouseup', holdEnd);
      row.addEventListener('mouseleave', holdEnd);
    }
  });
}
/* a row with hold: ms runs only when OK is held that long; the row counts down, letting go early does nothing */
var holdIt = null,
  holdT = 0,
  holdIv = 0;
function holdStart(it) {
  if (holdIt) return;
  holdIt = it;
  var t0 = Date.now(),
    st = ovEl && ovEl.querySelector('.row.f .st');
  holdIv = setInterval(function () {
    if (st) st.textContent = t('keep holding OK') + ' ' + Math.max(1, Math.ceil((it.hold - (Date.now() - t0)) / 1000)) + ' s';
  }, 200);
  holdT = setTimeout(function () {
    clearInterval(holdIv);
    holdIt = null;
    it.fn();
  }, it.hold);
}
function holdEnd() {
  if (!holdIt) return;
  var it = holdIt;
  holdIt = null;
  clearTimeout(holdT);
  clearInterval(holdIv);
  var st = ovEl && ovEl.querySelector('.row.f .st');
  if (st) st.textContent = it.sub || '';
}
function pickMenu() {
  var m = stack[stack.length - 1],
    it = m.items[m.idx];
  if (it && it.fn) {
    var n = stack.length;
    it.fn();
    if (stack.length === n && !it.stay) closeMenus();
  }
}
function menuKey(k) {
  var m = stack[stack.length - 1];
  if (k === 38 && m.idx > 0) {
    m.idx--;
    drawMenu();
  } else if (k === 40 && m.idx < m.items.length - 1) {
    m.idx++;
    drawMenu();
  } else if (k === 13) {
    if (m.items[m.idx] && m.items[m.idx].hold) holdStart(m.items[m.idx]);
    else pickMenu();
  } else if (k === 461 || k === 27 || k === 8) backMenu();
  else return false;
  return true;
}

/* Back on the home screen lists the running apps to close them, as LG's Home does with its Recents on a second Back (issue 16) */
function runningMenu() {
  api('/api/running').then(
    function (x) {
      if (x.error) return toast(t('Could not read the running apps'));
      openMenu(t('Running apps'), runningItems(x.apps || []));
      stack[stack.length - 1].running = true;
    },
    function () {
      toast(t('Could not read the running apps'));
    }
  );
}
/* the list is only true for the moment it was read: it goes when Home is left, so it is never shown out of date */
function closeRunningMenu() {
  if (
    stack.some(function (m) {
      return m.running;
    })
  )
    closeMenus();
}
function runningItems(list) {
  if (!list.length) return [{ label: t('No apps are running'), dim: true }];
  var items = list.map(function (a) {
    return {
      label: a.title,
      sub: t('Close'),
      stay: true,
      fn: function () {
        closeRunning(list, [a.id]);
      },
    };
  });
  if (list.length > 1)
    items.push({
      label: t('Close all'),
      stay: true,
      fn: function () {
        closeRunning(
          list,
          list.map(function (a) {
            return a.id;
          })
        );
      },
    });
  return items;
}
/* the app manager's running list lags by seconds after a close, so the rows go at once instead of after a new reading */
function closeRunning(list, ids) {
  var m = stack[stack.length - 1],
    left = list.filter(function (a) {
      return ids.indexOf(a.id) < 0;
    });
  api('/api/running/close', ids.length > 1 ? { all: true } : { id: ids[0] }).then(
    function (x) {
      if (!x || x.returnValue !== true) toast(t('Could not close'));
    },
    function () {
      toast(t('Could not close'));
    }
  );
  m.items = runningItems(left);
  m.idx = Math.min(m.idx, m.items.length - 1);
  drawMenu();
}

function inputsMenu() {
  api('/api/inputs').then(function (x) {
    var items = (x.devices || [])
      .filter(function (d) {
        return d.appId;
      })
      .map(function (d) {
        var port = 'HDMI ' + d.port,
          named = d.label && d.label !== port && d.label !== 'HDMI ' + d.port,
          parts = [];
        if (named) parts.push(port);
        if (d.hdmiPlugIn) parts.push(t('Connected'));
        if (d.activate) parts.push(t('Active'));
        return {
          icon: 'hdmi',
          label: d.label || port,
          sub: parts.join(' \u00B7 '),
          dim: !d.hdmiPlugIn,
          fn: function () {
            launch(d.appId);
          },
        };
      });
    items.push({
      icon: 'edit',
      label: t('Rename inputs...'),
      stay: true,
      fn: function () {
        renameList(x.devices || []);
      },
    });
    openMenu(t('Inputs'), items);
  });
}
/* names for the inputs, typed on the TV with the remote (the TV's own keyboard comes up); the service shows them in every inputs list */
function renameList(devs) {
  openMenu(
    t('Rename inputs...'),
    devs
      .filter(function (d) {
        return d.appId;
      })
      .map(function (d) {
        return {
          icon: 'hdmi',
          label: d.label || 'HDMI ' + d.port,
          sub: d.lgLabel ? 'LG: ' + d.lgLabel : 'HDMI ' + d.port,
          fn: function () {
            renameInput(d);
          },
        };
      })
  );
}
var renaming = false;
function renameInput(d) {
  closeMenus();
  renaming = true;
  var w = document.createElement('div');
  w.id = 'ren';
  w.innerHTML = '<div class="panel"><h2></h2><input id="ren-in" type="text" maxlength="30" autocomplete="off"><p></p></div>';
  w.querySelector('h2').textContent = t('Name for') + ' ' + (d.lgLabel || d.label || 'HDMI ' + d.port);
  w.querySelector('p').textContent = t('OK saves · Back cancels · empty brings back LG’s name');
  document.body.appendChild(w);
  var inp = w.querySelector('input');
  inp.value = d.lgLabel ? d.label : '';
  var done = function (save) {
    renaming = false;
    if (w.parentNode) w.parentNode.removeChild(w);
    if (!save) return;
    var names = {},
      v = inp.value.replace(/\s+/g, ' ').trim().slice(0, 30),
      k;
    for (k in cfg.inputNames || {}) names[k] = cfg.inputNames[k];
    if (v) names[d.appId] = v;
    else delete names[d.appId];
    cfg.inputNames = names;
    saveCfg();
    toast(v ? t('Saved') + ': ' + v : t('LG’s name is back'));
  };
  inp.addEventListener('keydown', function (e) {
    if (e.keyCode === 13) {
      e.preventDefault();
      done(true);
    } else if (e.keyCode === 461 || e.keyCode === 27) {
      e.preventDefault();
      done(false);
    }
  });
  setTimeout(function () {
    inp.focus();
  }, 50);
}

function appMenu(a) {
  var di = dockIds(),
    pos = di.indexOf(a.id),
    items = [
      {
        label: t('Open'),
        fn: function () {
          launch(a.id);
        },
      },
    ];
  if (pos >= 0) {
    if (pos > 0)
      items.push({
        label: t('Move left in dock'),
        fn: function () {
          var d = di.slice();
          d.splice(pos, 1);
          d.splice(pos - 1, 0, a.id);
          setDock(d);
        },
      });
    if (pos < di.length - 1)
      items.push({
        label: t('Move right in dock'),
        fn: function () {
          var d = di.slice();
          d.splice(pos, 1);
          d.splice(pos + 1, 0, a.id);
          setDock(d);
        },
      });
    items.push({
      label: t('Remove from dock'),
      fn: function () {
        setDock(
          di.filter(function (i) {
            return i !== a.id;
          })
        );
      },
    });
  } else if (di.length < TH.dockN)
    items.push({
      label: t('Add to dock'),
      fn: function () {
        setDock(di.concat(a.id));
      },
    });
  else
    items.push({
      label: t('Add to dock...'),
      stay: true,
      fn: function () {
        openMenu(
          t('Replace which app?'),
          di.map(function (id, i) {
            return {
              label: title(id),
              fn: function () {
                var d = di.slice();
                d[i] = a.id;
                setDock(d);
              },
            };
          })
        );
      },
    });
  items.push({
    label: t('Hide app'),
    fn: function () {
      hideApp(a.id);
    },
  });
  openMenu(a.title, items);
}

function removeButton(o) {
  cfg.topbar = topbar().filter(function (b) {
    return b !== o;
  });
  saveCfg();
}
function barMenu(o) {
  openMenu(barLabel(o), [
    {
      label: t('Remove this button'),
      fn: function () {
        removeButton(o);
      },
    },
  ]);
}

function customizeMenu() {
  openMenu(t('Customise'), [
    {
      label: 'Dock',
      sub: t('hold OK on an app'),
      stay: true,
      fn: function () {
        toast(t('Hold OK on any app to change the dock'));
      },
    },
    { label: t('Top buttons'), stay: true, fn: topButtonsMenu },
    { label: t('Hidden apps'), stay: true, fn: hiddenMenu },
    {
      label: t('App order'),
      sub: cfg.sort === 'alpha' ? t('A to Z') : t('Most used first'),
      fn: function () {
        cfg.sort = cfg.sort === 'alpha' ? 'usage' : 'alpha';
        saveCfg();
      },
    },
    {
      label: t('Clock'),
      sub: cfg.clock === '24' ? t('24-hour') : cfg.clock === '12' ? t('12-hour') : t('Automatic'),
      fn: function () {
        cfg.clock = cfg.clock === '24' ? '12' : cfg.clock === '12' ? 'auto' : '24';
        saveCfg();
        tick();
      },
    },
    {
      label: t('Reset customisation'),
      fn: function () {
        cfg = {};
        saveCfg();
      },
    },
    { label: t('LG’s Home'), sub: t('the TV restarts'), stay: true, fn: lgHomeMenu },
  ]);
}
/* Back to LG's Home without the manager app, kept deep in Customise and behind a confirmation whose first, focused row is Cancel,
   so a stray OK does not switch. The service restarts the TV; CleanYourTV as Home in the manager app switches back. */
function lgHomeMenu() {
  openMenu(t('Use LG’s Home?'), [
    { label: t('No'), fn: closeMenus },
    {
      label: t('Yes, use LG’s Home'),
      sub: t('hold OK for 5 seconds'),
      hold: 5000,
      fn: function () {
        closeMenus();
        api('/api/undo', {}).then(
          function () {
            toast(t('Switching to LG’s Home… the TV restarts in a moment.'));
          },
          function () {
            toast(t('Could not switch to LG’s Home'));
          }
        );
      },
    },
  ]);
}
/* the Theme button (themes with the strip on the left): this TV's own themes (MENU_THEMES), LG's own Home behind a confirmation, and
   Customise, which has no button of its own then */
function themeMenu() {
  api('/api/theme/list').then(
    function (x) {
      var cur = (x.current && x.current.id) || '',
        items = (x.themes || [])
          .filter(function (th) {
            return MENU_THEMES.indexOf(th.id) >= 0;
          })
          .map(function (th) {
            return {
              label: th.name,
              sub: th.id === cur ? t('selected') : '',
              sel: th.id === cur,
              fn: function () {
                if (th.id === cur) return;
                toast(t('Getting the theme…'));
                api('/api/theme/set', { id: th.id }).then(
                  function (y) {
                    if (y.error) toast(t('Could not change the theme'));
                    else load();
                  },
                  function () {
                    toast(t('Could not change the theme'));
                  }
                );
              },
            };
          });
      items.push({ label: 'LG', sub: t('LG’s own Home'), stay: true, fn: lgHomeMenu });
      items.push({ icon: 'edit', label: t('Customise'), stay: true, fn: customizeMenu });
      openMenu(t('Theme'), items);
      for (var i = 0; i < items.length; i++) if (items[i].sel) stack[stack.length - 1].idx = i;
      drawMenu();
    },
    function () {
      toast(t('Could not read the themes'));
    }
  );
}
function topButtonsMenu() {
  var items = shownBar().map(function (o) {
    return {
      label: barLabel(o),
      sub: t('OK to remove'),
      fn: function () {
        removeButton(o);
      },
    };
  });
  items.push({ label: t('Add a button...'), stay: true, fn: addButtonMenu });
  openMenu(t('Top buttons'), items);
}
function addButtonMenu() {
  var items = PRESETS.filter(function (p) {
    return liveOn() || p.action !== 'live';
  }).map(function (p) {
    return {
      icon: p.icon,
      label: barLabel(p),
      fn: function () {
        cfg.topbar = topbar().concat([p]);
        saveCfg();
      },
    };
  });
  items.push({
    label: t('An app...'),
    stay: true,
    fn: function () {
      openMenu(
        t('Pick an app'),
        apps
          .slice()
          .sort(function (a, b) {
            return a.title.localeCompare(b.title);
          })
          .map(function (a) {
            return {
              label: a.title,
              fn: function () {
                cfg.topbar = topbar().concat([{ label: a.title, icon: 'grid', app: a.id }]);
                saveCfg();
              },
            };
          })
      );
    },
  });
  openMenu(t('Add a button'), items);
}
function hiddenMenu() {
  var h = (cfg.hidden || []).filter(function (id) {
    return apps.some(function (a) {
      return a.id === id;
    });
  });
  if (!h.length) return toast(t('No hidden apps'));
  openMenu(
    t('Hidden apps (OK to show again)'),
    h.map(function (id) {
      return {
        label: title(id),
        fn: function () {
          unhideApp(id);
        },
      };
    })
  );
}

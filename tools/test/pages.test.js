// The pages that run on the TV (launcher, manager, picker, notification card): nothing newer than Chromium 68 (webOS 5), and fixes that
// must not come back.
const fs = require('fs'),
  path = require('path'),
  vm = require('vm');
const { root, ok, run } = require('./lib');

run(async () => {
  const pages = ['app', 'manager/app', 'picker/app', 'notify/app'].map(d => path.join(root, d, 'index.html'));
  const rules = [
    [/\?\?|\?\.[A-Za-z_\[(]/, 'optional chaining or ??'],
    [/\|\|=|&&=/, 'logical assignment'],
    [
      /\.(flat|flatMap|matchAll|replaceAll|findLast)\(|\.at\(-?\d|\bObject\.fromEntries\b|\bPromise\.(allSettled|any)\b|\bglobalThis\b|\bstructuredClone\b|\bAbortSignal\.timeout\b/,
      'a function newer than Chromium 68',
    ],
    [
      /\baspect-ratio\s*:|:is\(|:where\(|:has\(|\binset\s*:|:focus-visible|\bcontainer-type|color-mix\(|\b\d+d?v?[sd]vh\b|@layer\b/,
      'CSS newer than Chromium 68',
    ],
  ];
  const bad = [];
  for (const f of pages)
    fs.readFileSync(f, 'utf8')
      .split('\n')
      .forEach((line, i) => {
        for (const r of rules) if (r[0].test(line)) bad.push(path.relative(root, f) + ':' + (i + 1) + ' ' + r[1]);
      });
  ok(!bad.length, 'the pages use nothing newer than Chromium 68' + (bad.length ? ':\n  ' + bad.join('\n  ') : ''));
  // the scripts must be ES5: Chromium 68 knows most of ES2015, but a slip there is a page that stays blank on webOS 5 only
  const acorn = require(path.join(root, 'tools', 'vendor', 'acorn.js'));
  for (const f of pages) {
    const html = fs.readFileSync(f, 'utf8'),
      re = /<script>([\s\S]*?)<\/script>/g;
    let m,
      err = '';
    while ((m = re.exec(html))) {
      try {
        acorn.parse(m[1], { ecmaVersion: 5 });
      } catch (e) {
        err = e.message;
      }
    }
    ok(!err, 'the script of ' + path.relative(root, f) + ' is ES5' + (err ? ': ' + err : ''));
  }
  // flex "gap" is ignored before Chromium 84, and the script that once added the spacing after each redraw made lists jump and left old
  // text behind on webOS 5 (issues 4, 8, 13): flex children are spaced with sibling margins
  const gapBad = [];
  for (const f of pages) {
    const t = fs.readFileSync(f, 'utf8'),
      re = /([^{}]+)\{([^{}]*)\}/g;
    let m;
    while ((m = re.exec(t))) {
      if (/display:\s*(inline-)?flex/.test(m[2]) && /(^|[;\s])(row-|column-)?gap\s*:/.test(m[2]))
        gapBad.push(path.relative(root, f) + ': ' + m[1].trim().split('\n').pop());
    }
  }
  ok(!gapBad.length, 'no flex container uses gap (a sibling margin instead)' + (gapBad.length ? ':\n  ' + gapBad.join('\n  ') : ''));
  ok(
    !fs.existsSync(path.join(root, 'shared', 'flexgap.js')) && !/flexgap/.test(fs.readFileSync(path.join(root, 'ipk', 'build.py'), 'utf8')),
    'no script adds the spacing after a redraw'
  );
  ok(
    !/\.tile\.f\s*\{[^}]*outline/.test(fs.readFileSync(path.join(root, 'app', 'index.html'), 'utf8')) &&
      /\.tile\.f::before\s*\{[^}]*border-radius:/.test(fs.readFileSync(path.join(root, 'app', 'index.html'), 'utf8')) &&
      /\.tile\.fill\.f\s*\{\s*box-shadow:\s*0 0 0 var\(--ring-w\)/.test(fs.readFileSync(path.join(root, 'app', 'index.html'), 'utf8')),
    'the focus ring has its own rounded corners (an outline is a rectangle before Chromium 94), also on tiles that crop their picture'
  );
  const built = require(path.join(root, 'tools', 'build-pages.js'));
  for (const p of built.PAGES)
    ok(
      built.build(p[0]) === fs.readFileSync(path.join(root, p[1]), 'utf8'),
      p[1] + ' is built from ' + p[0] + ' (run: node tools/build-pages.js)'
    );
  // a long device name (HDMI-CEC) is the second line of a chip in the Inputs picker: the line could not shrink, so it was painted outside the
  // card, over the next ones (issue 19). It wraps onto a second line now, ends in an ellipsis there when that is not enough, and the card
  // reserves the two lines so every card's icon and port sit at the same height.
  const pickerPage = fs.readFileSync(path.join(root, 'picker', 'app', 'index.html'), 'utf8'),
    cssRule = (css, sel) => (css.match(new RegExp(sel.replace(/\./g, '\\.') + '\\s*\\{([^}]*)\\}')) || [])[1] || '',
    chipSt = cssRule(pickerPage, '.chip .st'),
    chipTx = cssRule(pickerPage, '.chip .tx');
  ok(
    /-webkit-line-clamp:\s*2/.test(chipSt) &&
      /overflow:\s*hidden/.test(chipSt) &&
      /min-height:\s*2\.4em/.test(chipSt) &&
      !/white-space:\s*nowrap/.test(chipSt) &&
      /text-align:\s*center/.test(chipSt) &&
      /width:\s*100%/.test(chipTx) &&
      /overflow:\s*hidden/.test(cssRule(pickerPage, '.chip')),
    'a long input name stays inside its card in the Inputs picker, on two lines'
  );
  // the favourite star and the menus' right-hand text both had the class st: the star's width squeezed the menu text into a column
  const launcher = fs.readFileSync(path.join(root, 'app', 'index.html'), 'utf8');
  ok(
    !/(^|\n)\s*\.st\s*\{/.test(launcher) && /svg\.st\s*\{\s*width:\s*26px/.test(launcher),
    "the favourite star is styled as svg.st, so the menu's .st text keeps its natural width"
  );

  // LG's Home from the launcher: the last row of Customise, behind a confirmation whose first (focused) row is Cancel
  const calls = [],
    opened = [];
  const sb = vm.createContext({
    navigator: { userAgent: '' },
    cfg: {},
    t: k => k,
    toast() {},
    api: (p, b) => (calls.push([p, b]), Promise.resolve({ returnValue: true })),
  });
  vm.runInContext(fs.readFileSync(path.join(root, 'app', 'src', 'js', 'menus.js'), 'utf8'), sb);
  sb.openMenu = (title, items) => opened.push({ title, items });
  sb.customizeMenu();
  const lg = opened[0].items[opened[0].items.length - 1];
  lg.fn();
  const confirm = opened[1];
  const cancelled = confirm.items[0].label === 'Cancel' && confirm.items[0].fn === sb.backMenu && calls.length === 0;
  confirm.items[1].fn();
  ok(
    lg.label === 'LG’s Home' && lg.stay && cancelled && calls.length === 1 && calls[0][0] === '/api/undo' && !!calls[0][1],
    "Customise ends with LG's Home; its confirmation starts with Cancel and only Yes posts /api/undo"
  );

  // the Theme button (themes with the strip on the left): the themes with the current one marked, Customise last; a pick sets it
  calls.length = 0;
  opened.length = 0;
  let loads = 0;
  sb.stack = [];
  sb.drawMenu = () => {};
  sb.load = () => loads++;
  sb.api = (p, b) => (
    calls.push([p, b]),
    Promise.resolve(
      p === '/api/theme/list'
        ? {
            current: { id: 'sidebar' },
            themes: [
              { id: 'classic', name: 'Classic' },
              { id: 'sidebar', name: 'Sidebar' },
            ],
          }
        : {}
    )
  );
  sb.openMenu = (title, items) => (opened.push({ title, items }), sb.stack.push({ items, idx: 0 }));
  sb.themeMenu();
  await new Promise(res => setTimeout(res, 0));
  const tm = opened[0],
    tlast = tm.items[tm.items.length - 1];
  tm.items[1].fn();
  tm.items[0].fn();
  await new Promise(res => setTimeout(res, 0));
  ok(
    tm.title === 'Theme' &&
      tm.items[1].sub === 'selected' &&
      sb.stack[0].idx === 1 &&
      tlast.label === 'Customise' &&
      tlast.stay &&
      tlast.fn === sb.customizeMenu &&
      calls.length === 2 &&
      calls[1][0] === '/api/theme/set' &&
      calls[1][1].id === 'classic' &&
      loads === 1,
    'the Theme menu marks the current theme, ends with Customise, and a pick sets the theme and reloads the page'
  );

  // the strip on the left: Left from the first app goes to it, Up and Down move along it, Right goes back to the same app
  const el = () => {
    const s = new Set();
    return {
      style: {},
      textContent: '',
      classList: {
        add: k => s.add(k),
        remove: k => s.delete(k),
        toggle: (k, on) => (on ? s.add(k) : s.delete(k)),
        contains: k => s.has(k),
      },
    };
  };
  const els = {},
    keys = {};
  const ps = vm.createContext({
    document: { addEventListener: (n, f) => (keys[n] = f), body: el() },
    performance: { now: () => Date.now() },
    setInterval() {},
    setTimeout,
    clearTimeout,
    Date,
    Math,
    LOC: 'en-GB',
    clockOpts: () => ({}),
    $: id => els[id] || (els[id] = el()),
    LIVE: { on: false },
    stack: [],
    t: k => k,
    glowNow() {},
    glowSoon() {},
    trailerFocus() {},
    trailerStop() {},
    TH: { push: null, overlay: false, rail: true, tileH: 150, gapY: 60, gt: 350, viewH: 780 },
    r: 1,
    c: 0,
    ri: -1,
  });
  vm.runInContext(fs.readFileSync(path.join(root, 'app', 'src', 'js', 'theme.js'), 'utf8'), ps);
  vm.runInContext(fs.readFileSync(path.join(root, 'app', 'src', 'js', 'input.js'), 'utf8'), ps);
  ps.barLabel = o => o.label;
  ps.TH = { push: null, overlay: false, rail: true, tileH: 150, gapY: 60, gt: 350, viewH: 780 };
  const bt = l => Object.assign(el(), { _o: { label: l } }),
    tile = l => Object.assign(el(), { _a: { id: l, title: l } });
  ps.railEls = [bt('Home'), bt('Inputs'), bt('Settings')];
  ps.rows = [[bt('Theme')], [tile('a'), tile('b')], [tile('c'), tile('d')]];
  ps.setFocus(2, 0, true);
  const press = k => keys.keydown({ keyCode: k, preventDefault() {} });
  press(37);
  const inRail = ps.ri === 0 && ps.railEls[0].classList.contains('f') && !ps.rows[2][0].classList.contains('f');
  press(40);
  press(40);
  press(40);
  const atEnd = ps.ri === 2 && ps.focused() === ps.railEls[2] && !ps.railEls[0].classList.contains('f');
  press(39);
  ok(
    inRail &&
      atEnd &&
      ps.ri === -1 &&
      ps.r === 2 &&
      ps.c === 0 &&
      ps.rows[2][0].classList.contains('f') &&
      !ps.railEls[2].classList.contains('f'),
    'Left from the first app goes to the strip, Down stops at its end, Right goes back to the same app'
  );
  press(37);
  press(461);
  ok(ps.ri === -1 && ps.focused() === ps.rows[2][0], 'Back on the strip goes back to the apps');

  // the dock until it is changed: the streaming apps on this TV in a fixed order, as many as the theme holds; the rest go to the grid
  const dsb = vm.createContext({ cfg: {}, TH: { dockN: 7 }, apps: [] });
  vm.runInContext(fs.readFileSync(path.join(root, 'app', 'src', 'js', 'core.js'), 'utf8'), dsb);
  vm.runInContext(fs.readFileSync(path.join(root, 'app', 'src', 'js', 'config.js'), 'utf8'), dsb);
  dsb.apps = [
    ['com.webos.app.browser', 'Web Browser'],
    ['amazon', 'Prime Video'],
    ['youtube.leanback.kids.v4', 'YouTube Kids'],
    ['com.hbo.hbomax', 'HBO Max'],
    ['youtube.leanback.v4', 'YouTube'],
    ['spotify-beehive', 'Spotify - Music and Podcasts'],
    ['netflix', 'Netflix'],
    ['com.disney.disneyplus-prod', 'Disney+'],
    ['__live', 'Live TV'],
  ].map(x => ({ id: x[0], title: x[1] }));
  const auto = JSON.stringify(dsb.dockIds());
  dsb.cfg = { dock: ['spotify-beehive', 'netflix'] };
  const mine = JSON.stringify(dsb.dockIds());
  dsb.cfg = { hidden: ['netflix'] };
  const hid = JSON.stringify(dsb.dockIds());
  ok(
    auto === '["netflix","youtube.leanback.v4","com.disney.disneyplus-prod","com.hbo.hbomax","amazon"]' &&
      mine === '["spotify-beehive","netflix"]' &&
      hid === '["youtube.leanback.v4","com.disney.disneyplus-prod","com.hbo.hbomax","amazon"]',
    'the dock starts with the streaming apps on the TV (Netflix, YouTube, Disney+, Max, Prime Video, ...; not YouTube Kids or Live TV); a dock you set wins, a hidden app is left out'
  );

  // trailers: the focus resting on a dock app asks the service and plays one; moving on or opening anything removes the player
  const tcalls = [],
    tels = {},
    box = () => {
      const e = el();
      e.children = [];
      e.appendChild = c => (e.children.push(c), (c.parentNode = e));
      e.removeChild = c => e.children.splice(e.children.indexOf(c), 1);
      return e;
    };
  const tsb = vm.createContext({
    window: { addEventListener() {} },
    document: { createElement: () => Object.assign(el(), { setAttribute() {}, contentWindow: {} }) },
    setTimeout,
    clearTimeout,
    Date,
    API: 'http://127.0.0.1:8765',
    LOC: 'hr-HR',
    cfg: { trailers: { enabled: true, volume: 15 } },
    TH: { push: { up: 400 }, overlay: false },
    r: 1,
    $: id => tels[id] || (tels[id] = box()),
    api: p => (tcalls.push(p), Promise.resolve({ items: [{ title: 'Film A', year: '2025', video: 'trail_hr_10', backdrop: '' }] })),
  });
  vm.runInContext(fs.readFileSync(path.join(root, 'app', 'src', 'js', 'trailers.js'), 'utf8'), tsb);
  vm.runInContext('TRL_WAIT = 20', tsb);
  const nfx = { _a: { id: 'netflix', title: 'Netflix' } };
  tsb.trailerFocus(nfx);
  await new Promise(res => setTimeout(res, 60));
  const frame = tels.trl.children[0];
  ok(
    tcalls.length === 1 &&
      tcalls[0] === '/api/trailers/for?title=Netflix&region=HR&lang=hr-HR' &&
      !!frame &&
      frame.src === 'http://127.0.0.1:8765/api/trailers/player?v=trail_hr_10&vol=15' &&
      tels.trl.classList.contains('on') &&
      tels['trl-cap'].textContent === 'Film A (2025)',
    'resting on Netflix asks for its trailers with the TV country and language and plays one quietly behind Home'
  );
  tsb.trailerStop();
  ok(tels.trl.children.length === 0 && frame.src === 'about:blank' && !tels.trl.classList.contains('on'), 'stopping removes the player');
  tsb.r = 2;
  tsb.trailerFocus({ _a: { id: 'other', title: 'Disney+' } });
  tsb.r = 1;
  tsb.trailerFocus({ _a: { id: 'netflix', title: 'Netflix' } });
  tsb.trailerFocus({ _o: { label: 'Theme' } });
  tsb.cfg.trailers.enabled = false;
  tsb.trailerFocus(nfx);
  await new Promise(res => setTimeout(res, 60));
  ok(
    tcalls.length === 1 && tels.trl.children.length === 0,
    'nothing plays from an opened grid, when the focus moves on before the wait, or when trailers are off'
  );
});

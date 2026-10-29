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

  // LG's Home from the launcher: the last row of Customise, behind a confirmation whose first (focused) row is No; Yes needs OK held 5 s
  const calls = [],
    opened = [];
  const sb = vm.createContext({
    navigator: { userAgent: '' },
    cfg: {},
    t: k => k,
    toast() {},
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    Date,
    Math,
    trailerStop() {},
    api: (p, b) => (calls.push([p, b]), Promise.resolve({ returnValue: true })),
  });
  vm.runInContext(fs.readFileSync(path.join(root, 'app', 'src', 'js', 'menus.js'), 'utf8'), sb);
  sb.openMenu = (title, items) => opened.push({ title, items });
  sb.customizeMenu();
  const lg = opened[0].items[opened[0].items.length - 1];
  lg.fn();
  const confirm = opened[1];
  const no = confirm.items[0].label === 'No' && confirm.items[0].fn === sb.closeMenus && calls.length === 0;
  const yes = confirm.items[1];
  sb.drawMenu = () => {};
  sb.stack = [{ items: confirm.items, idx: 1 }];
  const fiveS = yes.hold === 5000;
  yes.hold = 60;
  sb.menuKey(13);
  await new Promise(res => setTimeout(res, 20));
  sb.holdEnd();
  await new Promise(res => setTimeout(res, 80));
  const early = calls.length === 0;
  sb.stack = [{ items: confirm.items, idx: 1 }];
  sb.menuKey(13);
  await new Promise(res => setTimeout(res, 100));
  ok(
    lg.label === 'LG’s Home' && lg.stay && no && fiveS && early && calls.length === 1 && calls[0][0] === '/api/undo' && !!calls[0][1],
    "Customise ends with LG's Home; its confirmation starts with No, which closes it, and Yes posts /api/undo only after OK is held 5 s"
  );

  // naming an input on the TV: OK in the field saves the name for that input; an empty name brings LG's back
  const field = { value: '', listeners: {}, addEventListener: (n, f) => (field.listeners[n] = f), focus() {} };
  const dlg = { innerHTML: '', parentNode: null, querySelector: s => (s === 'input' ? field : { textContent: '' }) };
  let saved = 0,
    toastMsg = '';
  sb.document = { createElement: () => dlg, body: { appendChild: w => (w.parentNode = { removeChild() {} }) } };
  sb.saveCfg = () => saved++;
  sb.toast = m => (toastMsg = m);
  sb.cfg = { inputNames: { 'com.webos.app.hdmi1': 'TV box' } };
  sb.renameInput({ appId: 'com.webos.app.hdmi3', label: 'HDMI 3', port: 3 });
  const renamingOn = sb.renaming === true;
  field.value = '  PS5 ';
  field.listeners.keydown({ keyCode: 13, preventDefault() {} });
  const named = JSON.stringify(sb.cfg.inputNames) === '{"com.webos.app.hdmi1":"TV box","com.webos.app.hdmi3":"PS5"}' && saved === 1;
  sb.renameInput({ appId: 'com.webos.app.hdmi3', label: 'PS5', lgLabel: 'HDMI 3', port: 3 });
  const prefilled = field.value === 'PS5';
  field.value = '';
  field.listeners.keydown({ keyCode: 13, preventDefault() {} });
  ok(
    renamingOn &&
      named &&
      prefilled &&
      JSON.stringify(sb.cfg.inputNames) === '{"com.webos.app.hdmi1":"TV box"}' &&
      saved === 2 &&
      !sb.renaming,
    'an input is named on the TV: OK saves the name typed for it (others kept); an empty name brings back LG’s'
  );
  sb.toast = () => {};

  // the evening light: Up and Down set how bright (within its steps), Left and Right the colour; it is remembered; other screens keep no keys
  const store = {};
  const msb = vm.createContext({ localStorage: { getItem: k => store[k] || null, setItem: (k, v) => (store[k] = v) }, Math, JSON, String });
  vm.runInContext(fs.readFileSync(path.join(root, 'app', 'src', 'js', 'modes.js'), 'utf8'), msb);
  vm.runInContext("modeKind = 'light'", msb);
  for (let i = 0; i < 9; i++) msb.modeKey(38);
  const top = msb.light.d === 4;
  for (let i = 0; i < 9; i++) msb.modeKey(40);
  msb.modeKey(37);
  const kept = JSON.parse(store['cytv.light']);
  vm.runInContext("modeKind = 'slides'", msb);
  ok(
    top && msb.light.d === 0 && msb.light.c === 3 && kept.c === 3 && kept.d === 0 && msb.modeKey(38) === false && msb.modeKey(13) === false,
    'the evening light: Up and Down set how bright within its steps, Left and Right the colour, remembered; other Mode screens end on any key'
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
              { id: 'warm', name: 'Warm' },
            ],
          }
        : {}
    )
  );
  sb.openMenu = (title, items) => (opened.push({ title, items }), sb.stack.push({ items, idx: 0 }));
  sb.MENU_THEMES = ['sidebar', 'warm'];
  sb.themeMenu();
  await new Promise(res => setTimeout(res, 0));
  const tm = opened[0],
    tlast = tm.items[tm.items.length - 1];
  tm.items[0].fn();
  tm.items[1].fn();
  await new Promise(res => setTimeout(res, 0));
  ok(
    tm.title === 'Theme' &&
      tm.items.map(x => x.label).join(',') === 'Sidebar,Warm,LG,Customise' &&
      tm.items[0].sub === 'selected' &&
      sb.stack[0].idx === 0 &&
      tm.items[2].fn === sb.lgHomeMenu &&
      tlast.label === 'Customise' &&
      tlast.stay &&
      tlast.fn === sb.customizeMenu &&
      calls.length === 2 &&
      calls[1][0] === '/api/theme/set' &&
      calls[1][1].id === 'warm' &&
      loads === 1,
    'the Theme menu offers only this TV’s themes and LG (behind its confirmation), marks the current one, ends with Customise; a pick sets it'
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
    radioStop() {},
    holdEnd() {},
    renaming: false,
    modeOn: () => false,
    modeExit() {},
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
    document: { body: el(), createElement: () => Object.assign(el(), { setAttribute() {}, contentWindow: {} }) },
    setTimeout,
    clearTimeout,
    Date,
    API: 'http://127.0.0.1:8765',
    LOC: 'hr-HR',
    radioOn: () => false,
    STREAMING: [/^netflix/i, /^youtube/i],
    cfg: { trailers: { enabled: true, volume: 15 } },
    TH: { push: { up: 400 }, overlay: false },
    r: 1,
    $: id => tels[id] || (tels[id] = box()),
    api: p => (
      tcalls.push(p),
      Promise.resolve({
        items: [{ title: 'Film A', year: '2025', overview: 'About A.', video: 'trail_hr_10', backdrop: 'https://x/a.jpg' }],
      })
    ),
  });
  vm.runInContext(fs.readFileSync(path.join(root, 'app', 'src', 'js', 'trailers.js'), 'utf8'), tsb);
  vm.runInContext('HERO_WAIT = 10; TRL_WAIT = 120', tsb);
  const nfx = { _a: { id: 'netflix', title: 'Netflix' } };
  tsb.trailerFocus(nfx);
  await new Promise(res => setTimeout(res, 50));
  const picture =
    tcalls.length === 1 &&
    tcalls[0] === '/api/trailers/for?title=Netflix&region=HR&lang=hr-HR' &&
    tels.trl.classList.contains('on') &&
    tsb.document.body.classList.contains('hero') &&
    tels['trl-t'].textContent === 'Film A (2025)' &&
    tels['trl-o'].textContent === 'About A.' &&
    tels['trl-bd'].style.backgroundImage === 'url("https://x/a.jpg")' &&
    tels.trl.children.length === 0;
  await new Promise(res => setTimeout(res, 120));
  const frame = tels.trl.children[0];
  ok(
    picture && !!frame && frame.src === 'http://127.0.0.1:8765/api/trailers/player?v=trail_hr_10&vol=15',
    'resting on Netflix shows a popular title at once (picture, title, description; asked with the TV country and language), and its trailer, quietly, only when the wait has passed'
  );
  tsb.trailerStop();
  ok(
    tels.trl.children.length === 0 &&
      frame.src === 'about:blank' &&
      !tels.trl.classList.contains('on') &&
      !tsb.document.body.classList.contains('hero'),
    'stopping removes the player and the picture'
  );
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
  ok(
    tels.trl.classList.contains('on') && tels.trl.classList.contains('logo') && /\/icon\/netflix$/.test(tels['trl-logo'].src),
    'with trailers off a streaming app shows its own logo, large'
  );
  tsb.trailerStop();
  tsb.cfg.trailers.enabled = true;
  tsb.api = p => (tcalls.push(p), Promise.resolve({ items: [] }));
  tsb.trailerFocus({ _a: { id: 'youtube.leanback.v4', title: 'YouTube' } });
  await new Promise(res => setTimeout(res, 160));
  ok(
    tels.trl.classList.contains('logo') && tels.trl.children.length === 0 && /youtube\.leanback\.v4$/.test(tels['trl-logo'].src),
    'YouTube (no films from TMDB) shows its logo and plays nothing'
  );
  tsb.trailerStop();
  tsb.trailerFocus({ _a: { id: 'com.lg.smartdoctor', title: 'Smart Doctor' } });
  await new Promise(res => setTimeout(res, 40));
  ok(!tels.trl.classList.contains('on'), 'an app that is not a streaming service shows nothing behind Home');
});

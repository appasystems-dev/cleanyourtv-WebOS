// Switching the debloat on and off while the TV runs (the boot script 15-cleanyourtv-debloat applies it at every start). What it
// stops and blocks is in scripts/debloat-stop.sh; scripts/debloat-undo.sh reverses it.
// What LG's preloader starts (scripts/preload.sh, preload.conf) is set until the next restart only, and switching the TV off and on with
// the remote (a suspend, not a restart) turns LG's own choice back on: the browser, the voice app, HDMI 2 were preloaded again. So while
// the debloat is applied, the service compares the preloader's policy with the lists every two minutes and sets it again where it differs.
const fs = require('fs');
const P = require('./paths'),
  exec = require('./exec');

const PM = 'luna://com.webos.service.preloadmanager/';

function apply(on) {
  const link = P.INITD + '/15-cleanyourtv-debloat';
  if (on) return exec.sh('ln -sf ' + P.D + '/15-cleanyourtv-debloat ' + link + '; sh ' + P.D + '/debloat-stop.sh', 60000);
  return exec.sh('rm -f ' + link + '; sh ' + P.D + '/debloat-undo.sh', 60000);
}

// "add a b\noff c d" from preload.sh lists
function parseLists(out) {
  const l = { add: [], off: [] };
  String(out || '')
    .split('\n')
    .forEach(line => {
      const w = line.trim().split(/\s+/);
      if (w[0] === 'add' || w[0] === 'off') l[w[0]] = w.slice(1).filter(id => /^[\w.-]+$/.test(id));
    });
  return l;
}

// whether the debloat is applied now: switched on for the boot, not paused, and our Home in place (as the boot script asks)
function applied() {
  try {
    if (!fs.existsSync(P.INITD + '/15-cleanyourtv-debloat')) return false;
    if (fs.existsSync(P.D + '/DISABLE-DEBLOAT') || fs.existsSync(P.D + '/DISABLE')) return false;
    return fs.readFileSync(P.PROC + '/mounts', 'utf8').indexOf(' /usr/palm/applications/com.webos.app.home ') >= 0;
  } catch (_) {
    return false;
  }
}

function create(ctx, deps) {
  const d = Object.assign(
    {
      applied,
      lists: () => exec.sh('sh ' + P.D + '/preload.sh lists', 20000).then(r => parseLists(r.out)),
    },
    deps || {}
  );
  // the apps whose preload was set again, as "off <id>" or "on <id>"
  async function checkPreload() {
    if (!d.applied()) return [];
    const l = await d.lists();
    if (!l.add.length && !l.off.length) return [];
    const r = await ctx.luna(PM + 'getPreloadPolicy', {});
    if (!Array.isArray(r.applications)) return [];
    const set = [];
    for (const a of r.applications) {
      if (!a || !a.id) continue;
      const want = l.off.indexOf(a.id) >= 0 ? false : l.add.indexOf(a.id) >= 0 ? true : null;
      if (want === null || a.isEnabled === want) continue;
      const s = await ctx.luna(PM + 'setPreloadPolicy', { application: { id: a.id, isEnabled: want }, permanent: false });
      if (s.returnValue === true) set.push((want ? 'on ' : 'off ') + a.id);
    }
    if (set.length) console.log('preload set again: ' + set.join(', '));
    return set;
  }
  return {
    name: 'debloat',
    checkPreload,
    start: () => setInterval(() => checkPreload().catch(() => {}), 120000),
  };
}

module.exports = { apply, create, parseLists };

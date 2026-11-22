// The debloat's part in the service (debloat.js): after the TV was switched off and on, LG's preloader starts its own choice again;
// the service sets the lists of preload.conf again where the policy differs, and only while the debloat is applied.
const { ok, req, run } = require('./lib');
const debloat = req('debloat');

run(async () => {
  const l = debloat.parseLists('add netflix\noff com.webos.app.browser com.webos.app.hdmi2 x;y\n');
  ok(
    l.add.join() === 'netflix' && l.off.join() === 'com.webos.app.browser,com.webos.app.hdmi2',
    'the lists of preload.sh lists, only app ids'
  );

  let policy = [
      { id: 'netflix', isEnabled: false },
      { id: 'youtube.leanback.v4', isEnabled: true },
      { id: 'com.webos.app.browser', isEnabled: true },
      { id: 'com.webos.app.hdmi2', isEnabled: false },
    ],
    on = true;
  const sets = [];
  const luna = async (uri, p) => {
    if (/getPreloadPolicy$/.test(uri)) return { returnValue: true, applications: policy };
    if (/setPreloadPolicy$/.test(uri)) {
      sets.push(p.application.id + '=' + p.application.isEnabled + (p.permanent === false ? '' : ' permanent'));
      return { returnValue: true };
    }
    return {};
  };
  const d = debloat.create({ luna }, { applied: () => on, lists: async () => l });
  const set = await d.checkPreload();
  ok(
    set.join() === 'on netflix,off com.webos.app.browser' && sets.join() === 'netflix=true,com.webos.app.browser=false',
    'switched back on by LG: set again as the lists say, until the next restart only; the rest is left alone: ' + sets.join()
  );
  policy = policy.map(a => Object.assign({}, a, { isEnabled: a.id === 'com.webos.app.browser' ? false : a.isEnabled }));
  policy[0].isEnabled = true;
  sets.length = 0;
  ok((await d.checkPreload()).length === 0 && sets.length === 0, 'as the lists say: nothing is set');
  policy[2].isEnabled = true;
  on = false;
  ok((await d.checkPreload()).length === 0 && sets.length === 0, 'debloat not applied (off, paused or LG Home): nothing is set');
});

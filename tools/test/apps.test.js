// The launcher's app list (apps.js): the first answer is waited for, later ones come from memory while the list is asked again.
const { ok, call, req, memoryConfig, run } = require('./lib');

run(async () => {
  let asked = 0,
    title = 'One';
  const luna = async uri => {
    if (/listApps/.test(uri)) {
      asked++;
      await new Promise(r => setTimeout(r, 50));
      return {
        returnValue: true,
        apps: [
          { id: 'a.one', title, folderPath: '/x', icon: 'i.png' },
          { id: 'com.webos.app.home', title: 'Home' },
        ],
      };
    }
    if (/getAllInputStatus/.test(uri))
      return {
        returnValue: true,
        devices: [
          { appId: 'com.webos.app.hdmi3', label: 'HDMI 3', port: 3 },
          { appId: 'com.webos.app.hdmi1', label: 'HDMI 1', port: 1 },
        ],
      };
    return { returnValue: true };
  };
  const apps = req('apps').create({ config: memoryConfig({ dock: ['a.one'] }), luna, version: '1.6.0', feature: () => null });
  let r = await call(apps, '/api/apps');
  ok(
    asked === 1 && r.j.apps.length === 1 && r.j.apps[0].title === 'One' && r.j.config.dock[0] === 'a.one',
    'the first list is asked from the app manager, without LG Home'
  );
  title = 'Two';
  const t0 = Date.now();
  r = await call(apps, '/api/apps');
  ok(asked === 1 && r.j.apps[0].title === 'One' && Date.now() - t0 < 40, 'opened again soon: the list comes from memory at once');
  r = await call(apps, '/api/launch', 'POST', { id: 'bad id' });
  ok(r.code === 400, 'a bad app id is refused');

  // names for the inputs, given on the TV: kept with the launcher settings, shown in every inputs list, LG's name beside it
  await call(apps, '/api/config', 'POST', {
    dock: ['a.one'],
    inputNames: { 'com.webos.app.hdmi3': '  PS5   console ', 'bad id': 'x', 'com.webos.app.hdmi2': '' },
  });
  r = await call(apps, '/api/inputs');
  const d3 = r.j.devices[0],
    d1 = r.j.devices[1];
  ok(
    d3.label === 'PS5 console' && d3.lgLabel === 'HDMI 3' && d1.label === 'HDMI 1' && !('lgLabel' in d1),
    'a name given to HDMI 3 replaces LG’s in the inputs list (LG’s name kept beside it); others stay as LG names them'
  );
  r = await call(apps, '/api/apps');
  ok(
    JSON.stringify(r.j.config.inputNames) === JSON.stringify({ 'com.webos.app.hdmi3': 'PS5 console' }) && r.j.config.dock[0] === 'a.one',
    'the names are saved tidied (spaces, bad ids and empty names dropped) and come back to the launcher'
  );
});

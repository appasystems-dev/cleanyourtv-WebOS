#!/bin/sh
# LG's preloader (webos-preload-manager) starts some apps hidden while Home is up, so they open at once. Two optional files on the TV
# change what it starts, in RAM until the next restart (run by debloat-stop.sh; "preload.sh undo" by debloat-undo.sh):
#   preload-add   app ids it should preload too (its list is a read-only configd file: a copy with them is mounted over it; one
#                 already there but switched off is switched on)
#   preload-off   app ids it should not preload
export PATH=/usr/bin:/usr/sbin:/bin:/sbin:$PATH
L=/media/developer/cleanyourtv
F=/etc/configd/layers/base/com.webos.service.preloadmanager.json
T=/tmp/cleanyourtv-preloadmanager.json
ids() { [ -r "$L/$1" ] && for w in $(cat "$L/$1"); do case "$w" in *[!A-Za-z0-9._-]*) ;; *) echo "$w" ;; esac; done; }
policy() {
  luna-send -n 1 -w 8000 luna://com.webos.service.preloadmanager/setPreloadPolicy \
    "{\"application\":{\"id\":\"$1\",\"isEnabled\":$2},\"permanent\":false}" </dev/null >/dev/null 2>&1
}
# the preloader reads its list at start: configd reads the files again, then the preloader is restarted
reload() {
  luna-send -n 1 -w 10000 luna://com.webos.service.config/reconfigure '{}' </dev/null >/dev/null 2>&1
  systemctl restart preload-manager.service && sleep 3
}
if [ "$1" = undo ]; then
  if grep -q " $F " /proc/mounts; then umount $F && rm -f $T && reload; fi
  for id in $(ids preload-off); do policy $id true; done
  exit 0
fi
ADD=$(ids preload-add)
if [ -n "$ADD" ] && [ -e $F ] && ! grep -q " $F " /proc/mounts; then
  node $L/jtool.js preloadadd $F $T $ADD && mount --bind $T $F && reload
fi
# an app already on LG's list but switched off there (Netflix on some TVs, which the restart above also closes) is switched on
for id in $ADD; do policy $id true; done
for id in $(ids preload-off); do policy $id false; done

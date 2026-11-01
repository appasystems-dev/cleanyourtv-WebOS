#!/bin/sh
# LG's preloader (webos-preload-manager) starts some apps hidden while Home is up, so they open at once. What it starts is changed in RAM
# until the next restart (run by debloat-stop.sh; "preload.sh undo" by debloat-undo.sh), from two lists in preload.conf (the place to
# edit them), each replaced on one TV by a file of the same name in /media/developer/cleanyourtv:
#   preload-add (PRELOAD_ADD)   app ids it should preload too (its list is a read-only configd file: a copy with them is mounted over
#                               it; one already there but switched off is switched on)
#   preload-off (PRELOAD_OFF)   app ids it should not preload
export PATH=/usr/bin:/usr/sbin:/bin:/sbin:$PATH
L=/media/developer/cleanyourtv
F=/etc/configd/layers/base/com.webos.service.preloadmanager.json
T=/tmp/cleanyourtv-preloadmanager.json
PRELOAD_ADD=''
PRELOAD_OFF=''
[ -r $L/preload.conf ] && . $L/preload.conf
# ids <file> <list>: the file on the TV if there is one, else the list of preload.conf; only app ids pass
ids() {
  if [ -r "$L/$1" ]; then cat "$L/$1"; else echo "$2"; fi | tr ' ' '
' | while read -r w; do
    case "$w" in '' | *[!A-Za-z0-9._-]*) ;; *) echo "$w" ;; esac
  done
}
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
  for id in $(ids preload-off "$PRELOAD_OFF"); do policy $id true; done
  exit 0
fi
ADD=$(ids preload-add "$PRELOAD_ADD")
if [ -n "$ADD" ] && [ -e $F ] && ! grep -q " $F " /proc/mounts; then
  node $L/jtool.js preloadadd $F $T $ADD && mount --bind $T $F && reload
fi
# an app already on LG's list but switched off there (Netflix on some TVs, which the restart above also closes) is switched on
for id in $ADD; do policy $id true; done
for id in $(ids preload-off "$PRELOAD_OFF"); do policy $id false; done

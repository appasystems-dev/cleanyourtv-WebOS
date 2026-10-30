# The launcher

The launcher replaces LG's Home. It is a web page of the project that the TV's browser runs, so it starts fast and works the
same on every supported webOS version.

![Home screen](screenshots/home.jpg)

## The screen

- **Dock.** The first row, large. Until you change it, it holds the streaming apps on your TV (Netflix, YouTube, Disney+, Max,
  Prime Video, SkyShowtime, Apple TV, Pickbox, HRTi, RTL Play, MAXtv, Voyo, Plex, in that order), as many as the theme's dock holds
  (four in Classic, five in Sidebar).
- **Top shelf.** The name of the focused app and an ambient glow taken from its icon.
- **Grid.** All other apps, sorted by how often you use each one (or A to Z).
- **Top buttons.** Inputs, Live TV, Settings and Customise, and a clock. The buttons you see are yours to change.

## Keys

| Action | How |
|---|---|
| Open an app | OK |
| App options (dock, hide) | Hold OK on an app |
| Remove a top button | Hold OK on it |
| Customise | The **Customise** button |
| Live TV | The **Live TV** button or tile |
| Switch input | The **Inputs** button |
| Close running apps | Back on the home screen |
| The strip on the left (themes such as Sidebar) | Left from the first app; Up and Down along it, Right or Back to the apps |

The Magic Remote pointer works too: pointing and clicking, and holding the button on an app for its options.

![App options](screenshots/options.jpg)

## Running apps

Back on the home screen lists the apps that are open, as LG's Home does with its Recents on a second Back. OK closes an app,
**Close all** closes every app in the list, and Back leaves it. Closing an app also removes it from LG's recent apps.

It lists the apps the launcher knows, including the ones you hid from the grid; Home itself, CleanYourTV's own apps and the TV's
system apps are never in it. The list is read when it opens and closes when you leave Home. Suggested and first built by
[Steefzar](https://github.com/lasharor/cleanyourtv-WebOS/issues/16).

![Running apps](screenshots/running.jpg)

## Customise

![Customise menu](screenshots/customise.jpg)

**Customise** holds:

- the **top buttons** (add Inputs, Settings, Live TV or any app, or remove one),
- **hidden apps** (show them again),
- the **app order** (most used first, or A to Z),
- the **clock** format (automatic, 12 or 24 hour),
- **Reset customisation**,
- **LG’s Home**: switches back to LG’s Home after a confirmation whose first, focused row is **No** (a stray OK closes it); **Yes**
  only works when OK is held for five seconds. The TV restarts.
  Kept here rather than on the home screen so it is not chosen by accident; **CleanYourTV as Home** in the manager app switches back.

A theme can put the buttons in a **strip along the left edge** instead (`rail.show`, the Sidebar theme): **Home** (back to the
first app, the grid closed), **Antenna TV** (LG's own TV programme from the aerial or cable, `com.webos.app.livetv`), **Radio**, your
top buttons as round icons (without Live TV, which is a tile among the apps) and **Theme**. Theme lists this TV's own themes
(`MENU_THEMES` in `app/src/js/core.js`; the manager app has all of them), then **LG** (LG's own Home, behind the same confirmation as
Customise > LG's Home) and **Customise**. The top bar then has only the **Mode** button.

## Radio

**Radio** on the strip lists the radio stations of your country (from the TV's language), most liked first, from the open
[Radio Browser](https://www.radio-browser.info/) directory. OK plays one; the list stays open, and its first row stops the radio. It goes
on behind Home and in a Mode screen, and stops when an app or Live TV opens or you leave Home. The TV has no FM tuner: these are the
stations' own internet streams (MP3 or AAC). While the radio plays, trailers show their picture without the video.

## Mode

**Mode** (top right with the strip) is for when nobody watches. Any key comes back to Home.

- **Evening light** lights the room softly, so the TV can be the only light: a warm base with three soft lights drifting slowly, and a
  small clock. Up and Down make it brighter or darker (five steps; it starts dim), Left and Right change the colour (warm, candle,
  rose, sea). The choice is remembered.
- **My photos**: your own photos, whole, each for 15 seconds, turned the way the phone held them. **Add photos...** opens
  a page on the home network for 15 minutes at a short address shown on the TV (`http://<tv>:8792/<6 digits>`); type it in the
  phone's browser on the same Wi-Fi, choose photos, and they are sent. JPEG, PNG or WebP (an iPhone sends its photos as JPEG), at
  most 20 MB each, 500 photos or 1 GB in all, kept in `/media/developer/cleanyourtv/photos`. **Delete my photos** needs OK held for
  five seconds.
- **Photos of the day**: Wikimedia Commons' pictures of the day of the last month, each with its author and licence.
- **Black screen**, and **Screen off**, which switches the panel off and keeps the sound (the radio). On an LCD TV the black screen
  still has its backlight on; Screen off is darker.

The clock moves now and then, so nothing stays in one place on the screen.

The dock holds four apps, or as many as the theme sets (`dock.count`). Hold OK on an app and choose **Add to dock**, **Move left**, **Move right** or **Remove from dock**.

An input can be a dock tile too, beside the apps: put its app id (`com.webos.app.hdmi3` for HDMI 3) in `dock`. It opens that input, under
the name given to it on the TV when there is one. Inputs are not in the grid, so an input removed from the dock goes back to the Inputs list only.

## Trailers

Optional, off until you set it up in the manager app (**Trailers**). When the focus comes to Netflix, Disney+, Prime Video, Max,
SkyShowtime or Apple TV, something popular on that service in your country fills the screen behind Home: its picture, its title with
the year and a short description, on the left where the app name would be (`grid.x`, `shelf.y` of the theme). Two seconds after the
focus arrived its trailer starts over the picture, quietly (the volume is set in the manager: muted, 15, 30 or 50 %). Once it plays, the
title and the description go, the shade over the video lightens and the apps move down a little, out of its way. Moving the focus,
opening an app or a menu, or leaving Home stops it at once, and the player is removed, so the app you open has the TV's video to itself.

YouTube, and every streaming app TMDB has no films for (Pickbox, HRTi, RTL Play, ...), shows its own logo, large, and plays nothing;
with trailers off, every streaming app does. Moving along the row changes the picture or the logo with the focus.

The trailers are of films and series for grown-ups: animation, family titles and (for series) kids' programmes are left out. "Popular" is TMDB's
popularity of the titles that stream on that service in your country, in turn a film and a series; TMDB has no ranking per country.

What is popular, where it streams and which trailer belongs to it come from [TMDB](https://www.themoviedb.org/) with your own free key,
typed on your phone (manager app > Trailers > TMDB key). The trailers are the official YouTube trailers, played by YouTube's embedded
player; the language of the trailer follows the TV when one exists, otherwise English. The service asks TMDB at most once every twelve
hours per service. This product uses the TMDB API but is not endorsed or certified by TMDB.

On an older TV the video can make moving around Home less smooth; switch trailers off or set the volume to muted if it bothers you.

## Inputs

The **Inputs** button lists HDMI inputs by the names LG shows, with what is connected and a marker on the active one. OK
switches to the input.

**Rename inputs...**, the last row, names an input on the TV itself: choose it, type the name with the remote (the TV's keyboard comes
up), OK saves. An empty name brings back LG's. The names are kept with the launcher's settings (`inputNames`) and show in every inputs
list, also the one on the Input key, with LG's name beside it.

![Inputs menu](screenshots/inputs.jpg)

## Icons

Each tile uses the app's own icon. The tile colour is taken from the icon's edge colour, so an icon that reaches its edges blends
into the tile, and the ambient glow comes from the icon's most vivid colour. Colours are worked out once per app and remembered.

!!! note "Icons with a transparent margin"
    An icon that is an opaque square with a transparent margin around it (many LG icons) can look boxed in on its tile. A fix
    that fills the tile is available as a test build; see [Test builds](managing.md#test-builds).

## Language

Menus follow the TV's language: English, Dutch, German, French, Spanish and Croatian.

## Themes

The look of the home screen (colours, tile and text size, columns, clock, glow, animation speed, wallpaper) is a [theme](themes.md),
chosen in the manager app.

## Settings file

Settings are stored on the TV in `/media/developer/cleanyourtv/config.json`:

| Key | Meaning |
|---|---|
| `dock` | App ids in the dock (up to the theme's `dock.count`), inputs too (`com.webos.app.hdmi3`). Missing: the streaming apps on the TV. |
| `topbar` | The buttons at the top. |
| `hidden` | App ids you hid. |
| `sort` | `usage` or `alpha`. |
| `clock` | `auto`, `12` or `24`. |

See [`config.example.json`](https://github.com/lasharor/cleanyourtv-WebOS/blob/main/config.example.json). Change settings in
the launcher; the file is read and written by the service.

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
- **LG’s Home**: switches back to LG’s Home after a confirmation whose first row is **Cancel**, and restarts the TV.
  Kept here rather than on the home screen so it is not chosen by accident; **CleanYourTV as Home** in the manager app switches back.

A theme can put the buttons in a **strip along the left edge** instead (`rail.show`, the Sidebar theme): **Home** (back to the
first app, the grid closed), then your top buttons as round icons, without Live TV, which is a tile among the apps. The top bar then
has only a **Theme** button: it lists the themes, as manager app > Theme does, and **Customise** is its last row.

The dock holds four apps, or as many as the theme sets (`dock.count`). Hold OK on an app and choose **Add to dock**, **Move left**, **Move right** or **Remove from dock**.

## Trailers

Optional, off until you set it up in the manager app (**Trailers**). While the focus rests on Netflix, Disney+, Prime Video, Max,
SkyShowtime or Apple TV for two and a half seconds, a trailer of something popular on that service in your country plays behind the
home screen, quietly (the volume is set in the manager: muted, 15, 30 or 50 %). The title shows at the top right. Moving the focus,
opening an app or a menu, or leaving Home stops it at once, and the player is removed, so the app you open has the TV's video to itself.

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
| `dock` | App ids in the dock (up to the theme's `dock.count`). Missing: the streaming apps on the TV. |
| `topbar` | The buttons at the top. |
| `hidden` | App ids you hid. |
| `sort` | `usage` or `alpha`. |
| `clock` | `auto`, `12` or `24`. |

See [`config.example.json`](https://github.com/lasharor/cleanyourtv-WebOS/blob/main/config.example.json). Change settings in
the launcher; the file is read and written by the service.

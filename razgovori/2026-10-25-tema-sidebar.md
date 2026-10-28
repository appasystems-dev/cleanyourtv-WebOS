# Razgovor: tema Sidebar (25. do 28. 10. 2026)

Zapis cijelog razgovora s AI asistentom (Claude Code), da se u sljedećem razgovoru može uzeti kao kontekst. Postoji samo na forku
(`appasystems-dev/cleanyourtv-WebOS`, grana `launcher-lg-home`), kao i `KONTEKST.md`. Privatni podaci su izostavljeni ili maskirani
(korisničko ime na računalu je `<korisnik>`).

Rezultat je u commitu `946b0a8` ("Theme Sidebar: ..."); ovaj zapis je u commitu nakon njega.

## 1. Zahtjev

> Napravi novu temu za CleanYourTV launcher (grana `launcher-lg-home` na mom forku): traka uz lijevi rub s tri ikone (kućica, HDMI
> ulazi, postavke); gore lijevo ništa, gore desno samo gumb za temu; jedan red aplikacija dolje, strelica dolje otvara još dva reda s
> ostalim aplikacijama. Pokaži mi sliku pregleda prije commita.

## 2. Što je asistent otkrio prije rada

- Tema je samo podaci (`themes/<id>/theme.json` i slike). Što tema smije postaviti određuje `helper/themeschema.js`.
- U shemi nije bilo **okomite trake**. Gumbe na traci nije bilo moguće birati po temi, a nije postojao ni gumb **Kućica**.
- U launcheru nije postojao **gumb za temu**: tema se birala samo u manager aplikaciji (Theme). API za to već postoji i launcher ga smije
  zvati: `/api/theme/list` i `/api/theme/set` (`helper/theme.js`).
- Raspored "red dolje, strelica dolje pomakne red gore i pokaže mrežu" već postoji kao `grid.mode: "push"` (koristi ga Horizon).
- Gornji gumbi su `cfg.topbar` (zadano: Inputs, Live TV, Settings) plus fiksni Customise (`app/src/js/layout.js`). Live TV je i pločica
  među aplikacijama (`__live`).
- U Customise je sigurni prelazak na LG-ov Home (napravljen ranije na ovoj grani), pa Customise mora ostati dostupan.
- Teme TV čita s GitHuba. Instalacija s naše grane zapisuje izvor (`D/source`), pa TV vidi i teme s forka.

Zaključak: tema sama nije dovoljna, launcher treba malu izmjenu. Asistent je to napravio na općenit način, kao novu postavku teme koju
može koristiti i bilo koja druga tema.

## 3. Odluke (asistent ih je donio sam i rekao ih)

1. **Nova postavka teme `rail.*`:** `rail.show` (zadano isključeno), `rail.width`, `rail.size`, `rail.gap`, `rail.panel`.
2. Kad je traka uključena, **gornji red ima samo gumb Tema**. On nabraja teme (odabrana je označena i fokusirana), a zadnji red je
   **Prilagodi** (Customise), jer drugog gumba gore nema.
3. **Na traci su Kućica i korisnikovi gornji gumbi, bez Live TV-a**, jer je Live TV već pločica među aplikacijama. Tako su zadano točno
   tri ikone. Za Ulaze se na traci prikazuje HDMI ikona.
4. **Kućica** vraća fokus na prvu aplikaciju u redu i zatvara mrežu.
5. **Kretanje:** strelica lijevo s prve aplikacije (ili s gumba Tema) vodi na traku. Gore i dolje se kreće po traci, a desno ili Natrag
   vraća na istu aplikaciju. Držanje OK na gumbu trake nudi uklanjanje, kao kod gornjih gumba (Kućica i Tema se ne uklanjaju).
6. **Red dolje su aplikacije iz docka.** Zadano su to 4 aplikacije, ostale se dodaju s *Držite OK → Dodaj u traku* (tema dopušta 7).
7. **Razmaci su odabrani tako da se vide točno dva reda više**, bez komada trećeg: okomiti razmak 60 px, `grid.dockUp` 450,
   `grid.clipTop` 0. Zato se zatamni cijeli zaslon, ne samo dio ispod vrha.
8. **Ime teme:** Sidebar (`themes/sidebar/`). Pozadina `sidebar.jpg` je generirana skriptom (tamnoplavo-tirkizni gradijent s mekim
   mrljama), pa je naše vlasništvo.
9. Slike u repozitoriju (`preview.jpg`, `docs/screenshots/themes-5.jpg`) su na engleskom, kao kod ostalih tema. Korisniku su pokazane
   i hrvatske.

## 4. Što je promijenjeno (commit `946b0a8`)

| Datoteka | Izmjena |
|---|---|
| `helper/themeschema.js` | Postavke `rail.*`; CSS varijable `--rail-*`; atribut `data-rail`; `rail` u rezultatu; gornja traka se prikazuje i kad je `bar.show` isključen, a traka uključena (zbog gumba Tema) |
| `app/src/index.html` | `<div id="rail">` unutar `#top` |
| `app/src/css/home.css` | Izgled trake (`#rail`, `.rb`), zadane vrijednosti varijabli; razmak samo s margin (bez flex `gap`, zbog Chromiuma 68) |
| `app/src/js/core.js` | Ikone `home` i `theme` |
| `app/src/js/clock.js` | Varijable `railEls`, `ri`; prijevodi (nl, de, fr, es, hr): Home, Theme, selected, učitavanje i greške teme; `barLabel` za Home i Theme |
| `app/src/js/theme.js` | `TH.rail`; `focused()`, `railFocus()`, `railLeave()`; `setFocus` skida fokus s trake |
| `app/src/js/layout.js` | Gradnja trake i gornjeg reda (samo Tema kad je traka uključena) |
| `app/src/js/config.js` | Akcije `theme` i `home` |
| `app/src/js/input.js` | Tipke na traci; lijevo s prvog stupca na traku; OK i držanje OK rade s `focused()`; pokazivač Magic Remotea na traci |
| `app/src/js/menus.js` | `themeMenu()` |
| `app/index.html`, `manager/app/index.html` | Ponovno izgrađeni (`node tools/build-pages.js`) |
| `themes/sidebar/` | `theme.json`, `sidebar.jpg`, `preview.jpg` |
| `themes/index.json` | Ponovno generiran (`node tools/theme-index.js`) |
| `tools/test/pages.test.js` | Testovi: izbornik Tema (oznaka odabrane, Prilagodi na kraju, odabir postavlja temu i osvježava); kretanje po traci (lijevo, dolje do kraja, desno natrag, Natrag) |
| `tools/test/theme.test.js` | Test: traka je zadano isključena; kad je uključena, širina se ograničava, a gornji red ostaje za gumb Tema |
| `tools/test/golden/api.json` | Snimljeni odgovori dobili su `rail: false`, `attrs.rail: "off"` i `--rail-*` za temu Classic. Razlog: nova postavka teme |
| `tools/theme-preview.mjs` | Radi i na Windowsu: putanja preko `fileURLToPath`, Chrome i Edge u popisu putanja |
| `docs/themes.md`, `docs/launcher.md`, `themes/README.md` | Opis teme i trake; tablica postavki ponovno generirana (`node tools/theme-docs.js`) |
| `KONTEKST.md` | Sidebar u tablici tema i bilješke o njoj |

`theme.json` teme Sidebar ukratko: sat isključen, ime aplikacije isključeno; gumb gore desno (`bar.x` 72, `bar.y` 54); traka širine 136,
gumbi 76, razmak 34, prozirnost 0.55; dock dolje 7 × (196 × 150), razmak 40, `dock.x` 200, `dock.y` 72; mreža `push`, 7 stupaca,
širina 1614, `gapX` 40, `gapY` 60, `dockUp` 450, `clipTop` 0; pozadina `sidebar.jpg`, zatamnjenje 0.1.

## 5. Pregled

Napravljen s `tools/theme-preview.mjs` u headless Chromeu s izmišljenim aplikacijama. Asistent je koristio i kopiju alata izvan
repozitorija koja snima još dvije slike: fokus na traci i izbornik Tema. Prvi pregled je otkrio dvije greške, koje su ispravljene
prije commita:

- ispod dva reda virio je komad trećeg reda,
- kad se otvori mreža, gornjih 160 px nije bilo zatamnjeno.

Korisnik je vidio četiri slike: početni zaslon, dva reda više, fokus na traci i izbornik Tema.

## 6. Provjere

- Na računalu (Node 20.18, Windows) prolaze `node tools/test.js pages` i `node tools/test.js theme`.
- Snimljeni odgovori za temu provjereni su usporedbom s `resolve()` teme Classic.
- Padaju `api`, `diag`, `manager`, `package` i `scripts`, ali samo zbog Windowsa: nema `/bin/sh`, nema `python3`, a Unix dozvole ne
  postoje. Isti padovi postoje i bez ove izmjene. To provjerava GitHub Actions.
- Nije pokrenuto: `sh tools/check.sh`, testovi pod Node 8.12, Chromium 68/79 (`--chromium`).
- **Ništa nije isprobano na pravom TV-u.**

## 7. Problemi na ovom računalu (Windows) i kako su riješeni

- **Node nije instaliran.** Prijenosni Node 20.18 je u
  `C:\Users\<korisnik>\.t3\scratch\2026-10-25-https-github-com-lasharor-cleanyourtv-41a9229e\_tools\node-v20.18.0-win-x64\node.exe`
  (mapa `_tools` iz `KONTEKST.md` više nije u repozitoriju).
- **Alat za pregled** traži Node 22 (WebSocket). Na Nodeu 20 radi sa zastavicom:
  `node --experimental-websocket tools/theme-preview.mjs sidebar --out <mapa>`. Chrome je u
  `C:\Program Files\Google\Chrome\Application\chrome.exe`. Hrvatski jezik dolazi iz jezika sustava; za engleske slike treba Chrome
  pokrenuti s `--lang=en-GB`. ffmpeg nije instaliran, pa je `preview.jpg` napravljen s Python PIL-om (800 × 450).
- **Završeci redaka.** `core.autocrlf=true` pretvara datoteke u CRLF kod svakog checkouta, stasha i slično, a CRLF kvari
  `tools/build-pages.js` (`@include` se ne zamijeni) i provjeru `themes/index.json`. Rješenje: datoteke pretvoriti u LF
  (`sed -i 's/\r$//' ...`), zatim ponovno izgraditi stranice i indeks. **Ne koristiti `git stash`.** Commit sam normalizira na LF, pa
  upozorenja "LF will be replaced by CRLF" nisu greška.
- Python na Windowsu ne vidi `/tmp` iz Git Basha; pomoćne skripte su bile u `C:\Users\<korisnik>\.cytv-scratch\`.

## 8. Tijek razgovora

1. Korisnik je zatražio temu (gore) i sliku prije commita.
2. Asistent je proučio shemu, launcher i API. Dodao je postavku `rail.*`, traku, gumb Tema, kretanje i prijevode. Napravio je temu,
   pozadinu, testove i dokumentaciju, i pokazao slike. Pitao je smije li commitati i pushati.
3. Korisnik: "pushaj cijeli ovaj razgovor na git". Asistent je commitao i pushao sav posao (`946b0a8`). GitHub Actions je pokrenuo
   *Test build* (paket `test-launcher-lg-home`) i *Documentation*.
4. Korisnik: ne samo posao, nego i datoteka iz koje se cijeli razgovor može uzeti kao kontekst. Nastala je ova datoteka.

## 9. Sljedeći koraci

- Provjeriti da je GitHub Actions za `946b0a8` prošao (testovi pod Linuxom, Node 8.12, Chromium 68/79).
- Na TV-u (kad bude rootan): **CleanYourTV → Update channel → test-launcher-lg-home**, zatim **CleanYourTV → Theme → Sidebar**.
  Isprobati traku, gumb Tema, Prilagodi → LG-ov Home (samo pogledati, ne potvrditi) i dva reda više.
- Dodati u dock aplikacije koje roditelji koriste (do 7): *Držite OK → Dodaj u traku*.
- Otvoreno: treba li Live TV ipak biti na traci; treba li tekst ispod ikona na traci.
- Za pull request prema autoru projekta: postavka `rail.*`, gumb Tema i ispravak alata za pregled mogu ići gore. `KONTEKST.md` i mapa
  `razgovori/` ne idu.

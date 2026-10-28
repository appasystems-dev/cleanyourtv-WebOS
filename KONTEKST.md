# Kontekst: CleanYourTV na našem LG TV-u

Bilješke o tome gdje smo stali, za mene i za AI asistenta u sljedećem razgovoru. Ova datoteka postoji samo na forku
(`appasystems-dev/cleanyourtv-WebOS`, grana `launcher-lg-home`) i ne ide u pull request prema autoru projekta.
Ovdje ne pišemo privatne podatke: IP adrese, ključeve, lozinke ni adrese playlisti.

## Cilj

Jednostavan početni zaslon za roditelje na LG TV-u, bez LG-ovih reklama, uz sigurno vraćanje na LG-ov Home.

## TV

- Model **75UN71003LC**, OTA ID `HE_DTV_W20P_AFADABAA`, firmware **04.64.00** (webOS 5, Node.js 8.12, Chromium 68).
- Još **nije rootan**.
- **Automatsko ažuriranje softvera mora ostati isključeno.** Novi firmware bi vjerojatno zatvorio exploit.

## Root (prema podacima s cani.rootmy.tv)

- **SlopBro** radi do verzije 04.64.00, točno naše, a zakrpa nije navedena. To je metoda koju koristimo.
- Stariji exploiti za ovaj model su zakrpani, npr. faultmanager od 04.60.49.
- Upute: GitHub stranica SlopBro-a. Prije rootanja ih još jednom pročitati.

### Tko što radi

**Na TV-u (ja, daljinskim):**
1. Isključiti automatsko ažuriranje.
2. Pokrenuti SlopBro prema uputama.
3. Provjeriti Homebrew Channel i uključiti **Settings → SSH Server**.
4. U routeru rezervirati fiksnu IP adresu za TV.

**S računala preko SSH-a (asistent, uz moje odobrenje za svaki korak):**
- SSH ključ i spajanje: `ssh root@<ip-televizora>`.
- Prvo samo čitanje: `sh tools/diagnose.sh <ip-televizora> > cytv-diagnose.txt`.
- Instalacija s naše grane:

  ```sh
  ssh root@<ip-televizora> 'curl -fsSL https://raw.githubusercontent.com/appasystems-dev/cleanyourtv-WebOS/launcher-lg-home/install.sh | CYTV_REPO=appasystems-dev/cleanyourtv-WebOS CYTV_BRANCH=launcher-lg-home sh'
  ```

- Postavljanje: na TV-u **CleanYourTV → Set up now**, ili preko SSH-a
  `sh /media/developer/apps/usr/palm/services/com.cleanyourtv.manager.service/bootstrap.sh install`.
- Provjera logova: `/media/developer/cytv-setup.log`, `/tmp/cleanyourtv-helper.log`.

Pravilo: prije svake izmjene na TV-u asistent kaže naredbu i kako se poništava. Bez mog "da" nema restarta, brisanja ni izmjene boot skripti.
Povratak na LG Home: CleanYourTV → *CleanYourTV as Home* off, ili `sh /media/developer/cleanyourtv/undo-home.sh`.

## Što je napravljeno na grani `launcher-lg-home`

1. **"Safe button" za LG Home:** Customise → zadnja stavka *LG's Home* → pitanje *Use LG's Home?*. Prvi red je **Cancel** i on je
   već označen, pa slučajni OK samo zatvori pitanje. Tek *Yes, use LG's Home* poziva `/api/undo`, što vraća LG Home i restarta TV.
   Ništa se ne briše. Natrag na CleanYourTV: aplikacija CleanYourTV → *CleanYourTV as Home*.
2. **Hrvatski prijevod** cijelog launchera (izbornici, Live TV, filtri, greške streama). Datum i sat su na hrvatskom.
   Jezik se bira prema jeziku TV-a, pa TV mora biti na hrvatskom. Otvoreno: koristiti hrvatski i za srpski i bosanski?
3. Test u `tools/test/pages.test.js`, dokumentacija u `docs/launcher.md` i `docs/managing.md`.
4. GitHub Actions uključene na forku. Svaki push na granu gradi testni paket `test-launcher-lg-home`.

Ništa od ovoga još nije isprobano na pravom TV-u.

### Napomene za rad na Windowsu

- Prijenosni Node.js je u mapi `_tools` (nije instaliran u sustav).
- Repozitorij koristi LF završetke redaka, jer CRLF kvari izgradnju stranica.
- `sh tools/check.sh` pod Node 8.12 i neki testovi servisa ne rade na Windowsu. To provjerava GitHub Actions.

## Kako dolazi izmjena na TV

Izmjena na računalu → testovi → push na fork → GitHub izgradi paket → na TV-u **CleanYourTV → Update channel** → naša grana → instalacija.
Kasnije se izmjena može predložiti autoru (pull request na `lasharor/cleanyourtv-WebOS`).

## Dizajn početnog zaslona

Radi se na računalu, a TV služi za konačnu provjeru.

- **Teme** (bez programiranja): `themes/<ime>/theme.json` i slike. Sve mogućnosti su u `docs/themes.md`, a shemu određuje
  `helper/themeschema.js`. Pregled na računalu: `node tools/theme-preview.mjs <id> --out <mapa>`. TV čita teme s GitHuba,
  pa nova tema ne traži novu instalaciju.
- **Izmjene launchera** (programiranje): `app/src/`, zatim `node tools/build-pages.js`.

### Postojeće teme (sve od autora projekta)

| Tema | Opis |
|---|---|
| Classic | Originalni izgled, skoro crna, 10 stupaca |
| Compact | 12 stupaca manjih pločica |
| **Large print** | 8 stupaca velikih pločica i krupnija slova: **kandidat za roditelje** |
| Midnight | Tamnoplava s mekom pozadinom |
| OLED black | Potpuno crna, bez sjaja |
| Still | Bez animacija |
| Warm | Smeđa i jantarna |
| Bloom | Cvjetna pozadina, traka u staklenom panelu dolje |
| Horizon | Krajolik u sumrak, 7 aplikacija dolje, sat gore lijevo |
| **Sidebar** (naša) | Traka lijevo (kućica, HDMI ulazi, postavke), gore desno samo gumb *Tema*, jedan red od 7 aplikacija dolje; strelica dolje pokaže još dva reda |

Slike: `docs/screenshots/themes-1.jpg` do `themes-5.jpg`.

Cijeli razgovor o temi Sidebar (odluke, izmjene, problemi na Windowsu): `razgovori/2026-10-25-tema-sidebar.md`.
Svaki budući razgovor zapisati u `razgovori/` na isti način (samo fork, bez privatnih podataka).

Za Sidebar je launcher dobio novu postavku teme `rail.*` (traka uz lijevi rub) i gumb **Tema**, koji nabraja teme kao manager
(Tema) i na kraju ima *Prilagodi*, jer u toj temi gore nema drugog gumba. Live TV nije na traci jer je već pločica među aplikacijama.
Red dolje pokazuje aplikacije iz docka: zadano su samo 4, ostale se dodaju s *Držite OK → Dodaj u traku*.
Pregled na Windowsu: `node --experimental-websocket tools/theme-preview.mjs sidebar --out <mapa>` (Node 20; Node 22 ne treba zastavicu). Teme koje su napravili drugi korisnici zasad ne postoje.

## Sljedeći koraci

1. Isključiti automatsko ažuriranje na TV-u.
2. Rootati TV preko SlopBro-a, uključiti SSH i rezervirati IP.
3. Asistent instalira CleanYourTV s grane `launcher-lg-home` i provjeri logove.
4. Isprobati *LG's Home* potvrdu i hrvatski jezik na pravom TV-u.
5. Isprobati teme **Large print** i **Horizon**, zatim napraviti vlastitu temu za roditelje.
6. Odlučiti o hrvatskom za srpski i bosanski jezik TV-a.

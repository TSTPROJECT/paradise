# PARADISE — An Interactive Character Portfolio

An interactive portfolio for **Lust (ลัสท์)** — เพลินพริ้ม ดาฤดี เทวอนันต์ — owner of Paradise, a windowless tower of clubs, casinos, hotels and secrets.

**Created by TST Project.** Unofficial fan-made OC × Marvel project. Not affiliated with or endorsed by Marvel.

The interface is in English; all character lore is in Thai.

---

## What's inside

| Area | What it does |
| --- | --- |
| **The Invitation** | Opening screen. Click the blood-red apple: it tears free, falls under gravity and leaves the scene, the frame reacts, and the entrance appears. Remembered for the browser session, so it never replays. |
| **Lobby + The Corridor** | Hero artwork, Thai introduction and ten doors. Doors lean toward the pointer, swing open on click, and darkness spreads from the door into the room. |
| **CHARACTER FILE** | Classified dossier with the transparent full-body art; toggle the skull-mask version. |
| **BIOGRAPHY** | 11 fragments in six chapters, a serpent that follows your reading position down the timeline. |
| **RELATIONSHIPS** | Relationship map (tabs, arrow-key navigation) for Tony Stark, Mephisto, the Seven Sins and the Paradise staff. |
| **ABILITIES** | Rebirth / Resurrection rules on a gravestone panel, an interactive life/death cycle model, and a sealed contract addendum. |
| **PARADISE CLUB** | Elevator floor selector with an animated indicator, a generated perspective corridor and an atmospheric maze map per floor. |
| **RUBICON — SEED** | Sealed fictional file: break the seal, redactions, 72-hour slider. Fiction only — no formulas, ingredients or dosages. |
| **THE SEVEN SINS** | Seven seats around an ouroboros. Only Lust is identified; the other six are undisclosed. |
| **GALLERY** | All eight works in justified rows that keep each image's natural aspect ratio; accessible lightbox with keyboard and swipe. |
| **CREDITS** | Artist records, website credit and the Thai attribution notice. |

### Secrets (4)
1. Hover or tap the gilded skull ornament under the lobby artwork — a hidden inscription.
2. ABILITIES → break the wax seal — the contract addendum (a clue about what the contract returns and what it does not).
3. PARADISE CLUB → press the unlabeled elevator button — a concealed file and a brass key.
4. The key unlocks door **000** in the corridor — a secret room.

The footer counts secrets found in the current session.

---

## Project structure

```
index.html                 All content and markup (semantic, works without JS as a long page)
css/style.css              Visual system, layout, responsive rules, reduced motion
js/main.js                 Apple, router/doors, serpents, cursor, sound, room features, lightbox
assets/favicon.svg
assets/images/lust/        Artwork (WebP, full size + 960w)
.nojekyll                  Serve files as-is on GitHub Pages
```

No build step, no dependencies, no backend, no API keys. Fonts load from Google Fonts with system fallbacks.

### Artwork used

| File | Size (px) | Type | Where |
| --- | --- | --- | --- |
| `theater-of-serpents` | 2000 × 2000 | square | Lobby hero, gallery |
| `red-room-telephone` | 2000 × 1514 | landscape | Biography (cinematic panel), gallery |
| `lust-cutout` | 2000 × 1390 | transparent cutout | Character File, gallery |
| `lust-cutout-skull-mask` | 2000 × 1390 | transparent cutout | Character File (mask toggle), gallery |
| `grave-embrace` | 1200 × 1801 | portrait | Relationships (Tony Stark file), gallery |
| `office-at-dusk` | 1414 × 2000 | portrait | Secret room 000, gallery |
| `office-at-dusk-skull-mask` | 1414 × 2000 | portrait | Secret room 000 (toggle), gallery |
| `bride-of-thorns` | 1441 × 2000 | portrait | Abilities, gallery |

Each has a `-960.webp` version for in-page display; the full file is used in the lightbox. To replace an image, keep the same file name (or update the paths and the `width`/`height` attributes in `index.html` and the `ART` list in `js/main.js`).

---

## Preview locally

Any static server works. From the project folder:

```bash
python -m http.server 8080
```

Then open <http://localhost:8080>. (Opening `index.html` directly from disk also works in most browsers.)

To replay the apple, close the tab or clear the site's session storage — the state lasts for one browser session.

## Deploy to GitHub Pages

The repository includes a workflow, [`.github/workflows/pages.yml`](.github/workflows/pages.yml), that checks the JavaScript and publishes the site on every push to `main`.

1. Push this repository to GitHub on the `main` branch, keeping `index.html` at the root.
2. On GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions** (one-time setting).
3. Open the **Actions** tab and wait for **Deploy to GitHub Pages** to finish (re-run it from there if it ran before step 2).
4. The site is live at `https://<username>.github.io/<repository>/`.

Prefer no workflow? Choose **Source: Deploy from a branch**, branch `main`, folder `/ (root)` instead; the site needs no build either way.

All paths are relative (`assets/...`, `css/...`, `js/...`), so the site works under a repository subpath as well as on a custom domain. `.nojekyll` makes Pages serve the files as-is.

---

## Interaction details

- **Custom cursor** — a burgundy diamond sigil with a trailing gold ring. States: default, interactive (links/buttons), door/hidden panel (arched ring), drag (lightbox), unavailable (dashed ring with a slash). Only on fine pointers; the native cursor is hidden only after the custom one is running. `pointer-events: none` throughout.
- **Sound** — starts **OFF**; nothing plays until the visitor presses **SOUND ON** (bottom-right). The preference lasts for the session. All sounds are synthesized in the browser with the Web Audio API — there are no audio files and no third-party audio. Distinct cues: UI click, menu tap, door latch, door creak, paper/file, close, secret, unavailable, apple pluck/fall/impact, elevator ding, wax seal, rebirth toll. Each sound is debounced and the system caps simultaneous voices, so rapid clicking stays quiet. Every action also has a visual result, so audio is never the only feedback.
- **Serpents** — locally authored SVG, tapered with layered strokes and a masked scale texture. Three appear: across the lobby (passing behind the artwork frame), along the corridor divider, and down the biography timeline. They only update while on screen (IntersectionObserver), use one passive scroll listener and an easing loop that stops when settled, turn their heads toward a nearby mouse pointer, and never take pointer events. With reduced motion they render as static illustrations.
- **Keyboard** — every room, door, tab and control is a real link or button. Escape closes the lightbox, the menu, then the open room. Focus is kept inside open rooms and the lightbox, and returns to the door you came from. The browser Back button closes rooms.
- **Reduced motion** — the apple drops instantly, doors open without the veil, serpents are static, reveals are immediate.

---

## Credits and Attribution

- **Website design and implementation:** TST Project.
- **Artwork:** belongs to its respective creators. The artists credited on this site:
  1. https://www.facebook.com/intira.silapoch?locale=th_TH
  2. https://www.facebook.com/aums.thirapaws?locale=th_TH
  3. https://www.facebook.com/profile.php?id=61593459614936&locale=th_TH
  4. https://www.facebook.com/narisara.kanjananapanich?locale=th_TH

  On the site they are listed as Artist 01–04 with a "Visit Facebook Profile" link, because their public display names have not been verified. Which artist drew which image has not been confirmed yet, so no image-to-artist mapping is shown. **Add image-specific attribution only once it is confirmed** (for example, in the figure captions and the `ART` list captions in `js/main.js`), and replace the neutral labels with names only when they are confirmed.
- **Sound:** original, synthesized in the browser by this site's code. No third-party audio.
- **Fonts:** Cinzel, Cormorant Garamond and Noto Serif Thai via Google Fonts (SIL Open Font License).
- This is an **unofficial fan-made OC × Marvel portfolio**. Marvel characters and names (such as Tony Stark and Mephisto) belong to their owners. TST Project claims no ownership of the artists' illustrations or of Marvel's intellectual property.

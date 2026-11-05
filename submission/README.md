# Hush Hues — CrazyGames submission

## Title

**Hush Hues**

## Description — English (~150 words)

Hush Hues is a calm colour-sorting puzzle. Tap a tube to lift its top ball, tap another tube to drop it: a ball can
land in an empty tube or on a ball of the same colour. Fill every tube with a single colour and the level is sorted.

There is no timer and no way to lose. Undo a move, restart whenever you like, or take one extra tube when a board feels
tight. Over 300 hand-tuned levels ease you in with three colours and slowly grow to twelve, adding fresh ideas
along the way: hidden balls that reveal their colour at the top, taller tubes, locked tubes that open when a colour is
complete, small helper tubes and frozen balls that thaw when you play next to them. Every fifth level is a breather,
every tenth a hard level worth double stars.

Soft sounds, smooth motion, colour-blind symbols and gentle vibration make every move pleasant. Take your time.

## Description — Français (~150 mots)

Hush Hues est un puzzle de tri de couleurs tout en douceur. Touchez un tube pour soulever la bille du dessus, puis
un autre tube pour la déposer : une bille peut aller dans un tube vide ou sur une bille de la même couleur. Quand chaque
tube ne contient plus qu’une seule couleur, le niveau est trié.

Pas de chronomètre, impossible de perdre. Annulez un coup, recommencez quand vous voulez, ou prenez un tube de plus
quand le plateau devient serré. Plus de 300 niveaux soigneusement dosés commencent avec trois couleurs et montent
lentement jusqu’à douze, avec de nouvelles idées en chemin : billes cachées qui se révèlent en haut du tube, tubes plus
hauts, tubes verrouillés qui s’ouvrent quand une couleur est complète, petits tubes d’appoint et billes gelées qui
fondent quand on joue à côté. Un niveau sur cinq est une pause douce, un sur dix un niveau difficile aux étoiles doublées.

Sons doux, animations fluides, symboles pour daltoniens et légères vibrations rendent chaque coup agréable.
Prenez votre temps.

## Controls

| Input | Action |
|---|---|
| Tap / click a tube | Lift its top ball; tap another tube to drop it there |
| Tap the same tube again | Put the ball back |
| Undo button · `U` · `Ctrl+Z` | Undo the last move (3 free per level, more with an optional rewarded ad) |
| Restart button · `R` | Restart the level |
| Extra tube button | One more empty tube (once per level, optional rewarded ad) |
| `1`–`9`, `0` · `Tab` + `Enter` | Pick tubes with the keyboard |

## Category and tags

- **Category:** Puzzle
- **Tags:** sorting, color, relaxing, casual, brain, logic, ball sort, mobile, one-hand, offline-friendly
- **Orientation:** portrait on mobile (also plays on desktop in a centered column)
- **Audience / rating:** suitable for everyone; no violence, no text chat, no user-generated content,
  no purchases (fits PEGI 3, well within the PEGI 12 limit)
- **Languages:** English, French (browser language, switch in Settings)

## Files

| What | Where |
|---|---|
| Game zip to upload | GitHub Actions → workflow **CI & GitHub Pages** → latest run on `main` → artifact **`hush-hues-crazygames`** (download, then upload the zip as is: `index.html` at its root). Locally: `npm run zip:crazygames` → `hush-hues-crazygames.zip` |
| Covers | `submission/covers/landscape-1920x1080.png`, `portrait-800x1200.png`, `square-800x800.png` |
| Preview videos | `submission/videos/landscape-1920x1080.mp4`, `portrait-1080x1620.mp4` (H.264, no audio) |

Regenerate covers and videos from the real game (needs the web build served on port 4173):

```bash
npm run build && npm run preview &   # serves dist/ on http://localhost:4173
node scripts/covers.mjs              # -> submission/covers/*.png
node scripts/videos.mjs              # -> submission/videos/*.mp4 (records real-time play, ~1 min)
```

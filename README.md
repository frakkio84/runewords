# D2 Runewords

A native Expo / React Native app that lists every Diablo 2 Resurrected runeword from [diablo2.io/runewords](https://diablo2.io/runewords/), including Reign of the Warlock recipes.

The project uses **Expo SDK 54**, which matches Expo Go on the Apple App Store and Google Play Store.

## Filters

- **Runes needed** — 2 through 6 sockets
- **Weapon / item class** — swords, axes, missile weapons, body armor, helms, shields, and the other base types used on diablo2.io
- **Ladder** — Ladder, Non-Ladder, or both
- **Search** — name, rune recipe, or stats

Broad classes such as **Weapons** and **Melee Weapons** also match specific weapon bases (so Breath of the Dying appears under Swords).

## Run the app

```sh
npm install
npx expo start
```

Scan the QR code with **Expo Go** from the App Store or Play Store, or press `a` / `i` / `w` for Android, iOS, or web.

```sh
npm test
```

runs the filter checks against the bundled runeword data.

## Data

`src/data/runewords.json` was parsed from the public diablo2.io runewords listing (Resurrected v3.3 / RotW). Recipes, allowed bases, required level, ladder flags, and stats are stored locally so the app works offline.

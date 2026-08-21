# D2 Runewords

A native Expo / React Native app that lists every Diablo 2 Resurrected runeword from [diablo2.io/runewords](https://diablo2.io/runewords/), including Reign of the Warlock recipes.

This project uses **Expo SDK 54**, which is the Expo Go version on the Apple App Store and Google Play Store. `expo.dev/go` defaults to SDK 57 — do not use that build with this app.

## Expo Go on a phone

1. Install **Expo Go from the Play Store or App Store** (SDK 54). If you already installed Expo Go from [expo.dev/go](https://expo.dev/go), uninstall it and reinstall the store app, or download SDK 54 explicitly:

   ```sh
   npx expo-go download android 54
   ```

2. In this repo:

   ```sh
   npm install
   npx expo start --go --clear
   ```

3. Scan the QR code with Expo Go. Force-close Expo Go first if you previously opened this project on SDK 57.

## Filters

- **Runes needed** — 2 through 6 sockets
- **Weapon / item class** — swords, axes, missile weapons, body armor, helms, shields, and the other base types used on diablo2.io
- **Ladder** — Ladder, Non-Ladder, or All
- **Search** — name, rune recipe, or stats

## Data

`src/data/runewords.json` was parsed from the public diablo2.io runewords listing (Resurrected v3.3 / RotW). Recipes, allowed bases, required level, ladder flags, and stats are stored locally so the app works offline.

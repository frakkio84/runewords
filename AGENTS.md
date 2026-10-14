# Esecuzione agenti — Orari

Esegui i task in ordine, dal Task 0 all’ultimo. Un task per volta. Non saltare un task. Non inventare file oltre a quelli scritti qui. Non cambiare la visibilità di repository esistenti.

Dopo ogni task lancia il comando di verifica. Se il comando termina con un errore, correggi solo quel task e rilancialo. Non passare al task successivo finché la verifica non stampa `OK`.

Lingua dell’interfaccia e dei messaggi: italiano. Codice, nomi di file e tipi: inglese, come già nel repo.

## Contesto fisso

- App: orari commerciali, città pilota Bologna, fuso `Europe/Rome`.
- Stack già presente: Expo SDK 54, Expo Router, TypeScript, React Native Web. Non aggiungere un altro framework.
- Il dominio puro sta in `src/domain/`. Non metterci import di React.
- Repository Git pubblico attuale, da non modificare: `https://github.com/frakkio84/runewords` (visibilità PUBLIC). Non lanciare `gh repo edit`, non renderlo privato, non cancellarlo, non fare force-push su `master`.
- Repository Git privato da creare in questo piano: `frakkio84/orari-commerciali`.
- Non committare token, file `.env` o URL di remote che contengono `x-access-token`.

## Regole di design da applicare, senza discuterle

Da [Best practices for REST API design](https://stackoverflow.blog/2020/03/02/best-practices-for-rest-api-design/):

- I path usano nomi plurali, non verbi. Esempio giusto: `GET /businesses`. Esempio vietato: `GET /getBusinesses`.
- `GET` legge. `POST` crea. `PATCH` aggiorna una parte. Non usare `GET` per scrivere.
- Le liste accettano `limit` e `offset`. La risposta contiene `items` e `total`.
- Gli errori non usano HTTP 200. Formato unico: `{ "error": { "code": "snake_case", "message": "testo italiano" } }`.
- Codici: 200 lettura, 201 creazione, 400 input invalido, 403 non autorizzato, 404 assente, 409 conflitto, 429 troppe richieste.

Da [Refactoring.Guru](https://refactoring.guru/):

- **Strategy:** il calcolo dell’attendibilità e le policy restano dati passati alle funzioni, non `if` sparsi nella UI.
- **Adapter:** `PlacesProvider` è l’unico contatto con un catalogo esterno. `FixturePlacesProvider` è un adapter. Non chiamare un provider vero.
- **Facade:** la UI chiama solo `src/application/api/handleRequest.ts`. Non chiama `submitContribution` direttamente.
- **Repository:** l’interfaccia pubblica è `CatalogRepository`. La classe che usa `localStorage` non va riesportata dai barrel `src/types` o `src/domain`.
- **Factory Method:** `buildPilotCatalog` resta l’unico punto che costruisce il catalogo iniziale.
- **Command:** ogni contributo è un comando con `type` e `payload`. Un comando `pending` non modifica gli orari pubblicati.
- SOLID: un file, una responsabilità. Il dominio non importa infrastruttura. L’infrastruttura importa il dominio. La UI importa l’applicazione, non l’infrastruttura concreta.

## Task 0 — Repository Git privato

Obiettivo: esiste un repository GitHub privato `frakkio84/orari-commerciali`. Il repository `runewords` resta pubblico.

1. Controlla se esiste già:

```sh
gh repo view frakkio84/orari-commerciali --json name,visibility,url
```

2. Se il comando risponde `not found` oppure `Could not resolve`, crealo vuoto e privato. Non usare `--push` in questo passo.

```sh
gh repo create frakkio84/orari-commerciali --private --description "Pilot orari commerciali, Bologna"
```

3. Se `gh repo create` risponde che non hai permesso di scrittura, fermati. Scrivi all’utente il comando del punto 2 e non tentare API alternative. Non continuare gli altri task.
4. Se il repository esiste ed è `PRIVATE`, non ricrearlo.
5. Se esiste ed è `PUBLIC`, fermati e scrivilo all’utente. Non cambiare la visibilità da solo.
6. Aggiungi il remote solo se manca. Il nome del remote è `private`.

```sh
git remote get-url private || git remote add private https://github.com/frakkio84/orari-commerciali.git
```

7. Non fare push in questo task. Il push è l’ultimo task.

Verifica:

```sh
gh repo view frakkio84/orari-commerciali --json visibility --jq .visibility
```

`OK` solo se la stampa è `PRIVATE`.

## Task 1 — Far passare il typecheck

Obiettivo: `npm run typecheck` termina con exit code 0. Non rifattorizzare altro in questo task.

1. In `src/app/(tabs)/_layout.tsx` elimina l’import di `@expo/vector-icons` e tutte le proprietà `tabBarIcon`. Lascia `title` su ogni `Tabs.Screen`.
2. In `src/domain/claims/claims.ts` sostituisci la riga del tipo `Result` con:

```ts
export type Result<T extends object = object> = ({ ok: true; catalog: Catalog } & T) | Failure;
```

3. Nella stessa file, sulla funzione `publishOwnerHours`, cambia il tipo di ritorno da `Result<Record<string, never>>` a `Result`.
4. In `src/data/buildPilotCatalog.ts` sostituisci la funzione `must` con questa. Il cast finale è voluto.

```ts
function must<T extends { ok: boolean; message?: string }>(
  result: T,
  label: string,
): Extract<T, { ok: true }> {
  if (!result.ok) throw new Error(`${label}: ${result.message ?? label}`);
  return result as Extract<T, { ok: true }>;
}
```

5. In `src/app/business/[id].tsx` importa il tipo `Contribution` da `../../domain/catalog`. Calcola l’ultima conferma così, e usa `latestConfirmation.payload.observed` solo dopo questo filtro:

```ts
const latestConfirmation = catalog.contributions
  .filter(
    (item): item is Extract<Contribution, { type: 'status_confirmation' }> =>
      item.businessId === business.id && item.type === 'status_confirmation',
  )
  .slice()
  .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
```

6. In `src/features/contributions/ContributeForm.tsx`, prima riga di `onSubmit` e di `confirm`, aggiungi `if (!business) return;`.

Verifica:

```sh
npm run typecheck && echo OK
```

## Task 2 — Repository (pattern), implementazione privata

Obiettivo: il salvataggio del catalogo passa da un’interfaccia. `localStorage` sta in un solo file, non esportato verso il dominio.

Crea `src/application/repository/CatalogRepository.ts`:

```ts
import type { Catalog } from '../../domain/catalog';

export type SessionState = {
  catalog: Catalog;
  userId: string | null;
};

export interface CatalogRepository {
  load(now: Date): SessionState;
  save(state: SessionState): void;
}
```

Crea `src/infrastructure/repository/LocalSessionRepository.ts`. Questa classe è l’unica che legge `localStorage`. Chiave: `orari-commerciali.v1`.

Comportamento obbligatorio:

- Se `localStorage` non esiste, `load` chiama `buildPilotCatalog(now)` e restituisce `{ catalog, userId: null }`.
- Se il JSON è rotto, o non contiene la città `bologna`, o `businesses` è vuoto, stesso fallback.
- Ogni profilo con `id` diverso da `mod-pilot` viene salvato e riletto con `role: 'user'`. Non permettere a un JSON modificato di diventare moderatore.
- `save` scrive `JSON.stringify(state)`.
- Esporta la classe. Non esportarla da `src/types/index.ts`.
- Il costruttore riceve un oggetto `{ get(key: string): string | null; set(key: string, value: string): void }`. Nel costruttore di default, se non viene passato, usa `localStorage` quando esiste e un oggetto no-op altrimenti.

Crea `src/application/repository/MemoryKeyValue.ts` con una mappa in memoria che rispetta `get` e `set`. Serve solo ai test.

In `src/state/Store.tsx`:

- Istanzia `new LocalSessionRepository()` una volta, fuori dal componente.
- `useState` iniziale chiama `repository.load(new Date())`.
- `useEffect` chiama `repository.save(persisted)` quando `persisted` cambia.
- Cancella da questo file le funzioni locali `loadState`, `freshState` e `sanitize`. Il loro comportamento ora sta nel repository.
- Non importare `localStorage` in `Store.tsx`.

Crea `src/application/repository/CatalogRepository.test.ts`. Casi, con `node:test`:

- load su store vuoto restituisce almeno un business di Bologna e `userId === null`.
- save e load successivo conservano un `userId`.
- un JSON con `role: 'moderator'` su un profilo che non è `mod-pilot` viene riletto come `user`.
- un JSON `businesses: []` viene sostituito dal catalogo pilota.

Verifica:

```sh
npx tsx --test src/application/repository/CatalogRepository.test.ts && echo OK
```

## Task 3 — API interna a risorse, stile REST

Obiettivo: una funzione sola smista le richieste. I test controllano i codici HTTP. Non avviare un server.

Crea `src/application/api/types.ts`:

```ts
export type ApiRequest = {
  method: 'GET' | 'POST' | 'PATCH';
  path: string;
  query?: Record<string, string>;
  body?: unknown;
  actorId?: string;
};

export type ApiResponse = {
  status: number;
  body: unknown;
};

export function apiError(status: number, code: string, message: string): ApiResponse {
  return { status, body: { error: { code, message } } };
}
```

Crea `src/application/api/handleRequest.ts`. Esporta `handleRequest(state, request, deps) -> { state, response }`. `deps` ha `now: Date` e `id: () => string`.

Route esatte, e nessun’altra:

| Metodo | Path | Effetto |
|---|---|---|
| `GET` | `/businesses` | Chiama `searchBusinesses`. Query opzionali: `text`, `category`, `lat`, `lng`, `radius`, `openNow`, `limit`, `offset`. Default `limit=20`. `openNow=true` solo se il valore è la stringa `true`. Risposta 200: `{ items, total }`. Ogni item ha `id`, `name`, `category`, `address`, `statusLabel`, `trust`. |
| `GET` | `/businesses/:id` | 200 con la scheda, oppure 404 `not_found`. |
| `GET` | `/businesses/:id/hours` | 200 con `{ scheduleKnown, intervals }`. 404 se l’attività non esiste. |
| `POST` | `/businesses/:id/check-ins` | Body `{ observed: "open" \| "closed", displayName: string }`. Crea la conferma. 201. Non cambia `hoursVersion`. 400 se manca il nome o `observed`. 429 se il rate limit del dominio risponde con errore. |
| `POST` | `/businesses/:id/contributions` | Body del contributo già usato da `submitContribution`, più `displayName`. 201 se `pending`. 400 se il dominio rifiuta il payload. 429 sul rate limit. |
| `GET` | `/me/contributions` | 200 e lista dei contributi di `actorId`. 403 `unauthenticated` se `actorId` manca. |
| `POST` | `/businesses/:id/claims` | Body `{ displayName, verificationMethod, note? }`. 201. Lo stato del claim creato è `pending`. |
| `PATCH` | `/contributions/:id` | Body `{ status: "withdrawn" }`. Solo l’autore, cioè `actorId`. 200. Altri status: 400 `unsupported_status`. |
| `POST` | `/catalog/sync` | Chiama `resyncPilotCatalog`. 200 con il report. |

Dettagli obbligatori:

- Path sconosciuto: 404 `not_found`.
- Metodo sbagliato su un path noto: 405 con body errore `method_not_allowed`. Aggiungi il campo `status` anche in questo caso, non un’eccezione.
- `POST /businesses/:id/check-ins` e `POST /businesses/:id/contributions` usano le funzioni di dominio già presenti. Non duplicare la validazione degli orari.
- Una proposta weekly resta `pending` se `autoPublishCommunityEdits` è false. Non passare una policy diversa.
- La risposta 201 include `id` e `status` del record creato.
- Non importare React in questa cartella.

Crea `src/application/api/handleRequest.test.ts`. Ogni test usa `buildPilotCatalog(new Date('2026-10-14T10:00:00.000Z'))` e un contatore `id`.

Casi minimi:

- `GET /businesses?text=zanarini` → 200 e `total === 1`.
- `GET /businesses?openNow=true` non include la libreria senza orari.
- `GET /businesses/inesistente` → 404 e `body.error.code === 'not_found'`.
- `POST /getBusiness` non esiste: 404. Non aggiungere quella route.
- check-in 201 e `hoursVersion` identico a prima.
- proposta orari 201 con `status === 'pending'` e orari pubblicati identici. Usa `publishedHoursUnchanged`.
- check-in senza `displayName` → 400.
- `GET /me/contributions` senza `actorId` → 403.
- claim → 201 e il claim nel catalogo è `pending`.
- sei check-in nello stesso minuto con la policy di default non sono tutti 201: l’ultimo oltre il limite orario è 429. Se il limite di default è 5, il sesto è 429.
- `PATCH` di un contributo pending dell’autore → 200 e status `withdrawn`.
- `POST /catalog/sync` due volte di seguito: la seconda risposta ha `created === 0`.

Verifica:

```sh
npx tsx --test src/application/api/handleRequest.test.ts && echo OK
```

Poi collega la UI. In `src/state/Store.tsx` i metodi `submitAs`, `claimAs`, `withdraw` e `resync` costruiscono una `ApiRequest` e chiamano `handleRequest`. Aggiornano lo stato solo se `status` è 200 o 201. Il messaggio mostrato all’utente resta quello già presente nel file. Non cambiare i testi italiani già visibili.

Verifica di nuovo:

```sh
npm run typecheck && echo OK
```

## Task 4 — Test di dominio mancanti

Aggiungi `src/domain/opening-hours/parse.test.ts`.

Casi:

- `09:00-13:00, 15:00-19:00` produce due fasce.
- stringa vuota, `-` e `chiuso` producono zero fasce.
- `25:00-26:00` è `{ ok: false }`.
- `9:00–13:00` con il trattino lungo produce `09:00` e `13:00`.

Aggiungi `src/domain/text.test.ts`.

Casi:

- `normalizeName('Caffè Zanarini')` è uguale a `normalizeName('Caffe Zanarini')`.
- due punti a circa 50 metri hanno distanza minore di 80.
- due punti a circa 3 km hanno distanza maggiore di 2000.

Aggiungi questi file allo script `test:unit` nel Task 6. Non lanciare ancora l’intera suite se il Task 6 non è finito. Verifica solo i file nuovi:

```sh
npx tsx --test src/domain/opening-hours/parse.test.ts src/domain/text.test.ts && echo OK
```

## Task 5 — Test end-to-end web

Obiettivo: Playwright apre l’export web e percorre il primo traguardo. Non usare Detox. Non usare un emulatore.

1. Installa una sola dipendenza di sviluppo:

```sh
npm install -D @playwright/test serve
npx playwright install chromium
```

2. In `package.json` aggiungi lo script:

```json
"export:web": "expo export --platform web"
```

3. Crea `playwright.config.ts` con `testDir: 'e2e'`, `baseURL: 'http://127.0.0.1:4173'`, un solo progetto `chromium`, e `webServer.command` uguale a `npx serve dist -l 4173`. `reuseExistingServer` è false.
4. Aggiungi `data-testid` senza togliere `accessibilityLabel`:
   - campo di ricerca in `src/app/(tabs)/index.tsx`: `search-input`
   - card in `src/features/businesses/BusinessCard.tsx`: `business-card` e `accessibilityLabel` già presente
   - schermata scheda: `business-status`, `business-trust`, `published-hours`
   - `src/features/contributions/ContributeForm.tsx`: `display-name`, `confirm-open`, `contribution-success`
   - tab profilo: `my-contributions`
5. `testID` di React Native diventa `data-testid` sul web. Usalo, non un attributo inventato.
6. Crea `e2e/milestone.spec.ts`. Flusso, in un solo test seriale:
   - apri `/`
   - cerca `zanarini`
   - clicca la card `Caffè Zanarini`
   - leggi uno stato che contiene `Aperto` oppure `Chiuso`, mai solo un colore
   - apri il contributo, scrivi il nome `Ada`, premi `È aperto adesso`
   - il testo di successo contiene `non sono stati modificati`
   - torna alla scheda: le fasce `07:30–12:30` sono ancora visibili
   - invia una proposta orari diversa solo se il form è già compilato; se per farlo servono più di venti righe di test, salta la proposta e copri il caso nel test di API del Task 3
   - apri Profilo e controlla che esista la conferma
7. Secondo test: cerca `nanni`. La card contiene `Orari non disponibili` e non contiene la parola `Chiuso` come stato principale. Il badge può essere letto con il testo intero `Orari non disponibili`.
8. Terzo test: attiva `Aperto adesso`. La libreria Nanni non compare.

Verifica:

```sh
npm run export:web && npx playwright test && echo OK
```

Se l’export fallisce per tipi, torna al Task 1. Non disattivare `strict`.

## Task 6 — Script di test e distribuzione iOS, Android, web

In `package.json` gli script devono essere esattamente questi, più quelli già utili (`start`, `android`, `ios`, `web`, `export:web`):

```json
"test:unit": "tsx --test src/domain/opening-hours/schedule.test.ts src/domain/opening-hours/parse.test.ts src/domain/text.test.ts src/domain/contributions/contributions.test.ts src/domain/claims/claims.test.ts src/domain/import/importPlaces.test.ts src/domain/search/search.test.ts src/data/buildPilotCatalog.test.ts src/application/repository/CatalogRepository.test.ts src/application/api/handleRequest.test.ts",
"test:e2e": "npm run export:web && playwright test",
"test": "npm run test:unit && npm run typecheck",
"typecheck": "tsc --noEmit"
```

`npm test` non lancia l’e2e, perché l’export è lento. `npm run test:e2e` lo lancia.

Crea `eas.json`:

```json
{
  "cli": { "version": ">= 16.0.0", "appVersionSource": "local" },
  "build": {
    "development": { "developmentClient": true, "distribution": "internal" },
    "preview": {
      "distribution": "internal",
      "android": { "buildType": "apk" },
      "ios": { "simulator": true }
    },
    "production": { "autoIncrement": false }
  },
  "submit": { "production": {} }
}
```

In `app.json`, dentro `expo.ios`, aggiungi `"bundleIdentifier": "it.orari.commerciali"`. Dentro `expo.android`, aggiungi `"package": "it.orari.commerciali"`. Non rimuovere i permessi di localizzazione già presenti.

Crea `docs/distribuzione.md` con questi comandi e nient’altro di inventato sui negozi:

- Web: `npm run export:web` produce `dist/`. Pubblicare il contenuto di `dist/` su un hosting statico.
- Android e iOS, build cloud: `npx eas-cli build -p android --profile preview` e `npx eas-cli build -p ios --profile preview`.
- Expo Go, stesso SDK 54: `npx expo start`.
- Non inserire una chiave di servizio nel repository. Non creare un account Expo da questo task.

Verifica:

```sh
npm test && echo OK
```

Poi, solo se `npm test` è OK:

```sh
npm run test:e2e && echo OK
```

## Task 7 — Documentazione

Aggiorna `README.md` senza cancellare le decisioni di pilot già scritte. Aggiungi in fondo, in italiano, sezioni brevi:

- Test: `npm test` per unità e tipi, `npm run test:e2e` per il web.
- API: link a `docs/api.md`.
- Architettura: link a `docs/architettura.md`.
- Distribuzione: link a `docs/distribuzione.md`.
- Repository: il codice pubblico di partenza è `frakkio84/runewords`. Il codice di questa app va sul repository privato `frakkio84/orari-commerciali`.

Crea `docs/api.md` copiando la tabella del Task 3, più il formato errore e un esempio JSON di `GET /businesses?text=zanarini`.

Crea `docs/architettura.md` con cinque righe, una per pattern, usando i nomi dei file creati nei task precedenti. Non descrivere microservizi. Il deploy è un’app Expo più, in futuro, Postgres descritto da `supabase/migrations/0001_init.sql`.

Verifica: i tre file esistono.

```sh
test -f docs/api.md && test -f docs/architettura.md && test -f docs/distribuzione.md && echo OK
```

## Task 8 — Push sul repository privato

1. Controlla di essere sul branch `cursor/orari-commerciali-mvp-8c32`. Se non lo sei, fermati.
2. `npm test` deve essere già OK.
3. Non fare `git add` di `.env`, `dist/` o `node_modules/`. `dist/` e `node_modules/` sono già ignorati.
4. Committa con un messaggio che descrive l’app orari, i test e il repository privato. Non usare un messaggio vuoto.
5. Push del branch sul repository privato, senza force:

```sh
git push -u private HEAD:cursor/orari-commerciali-mvp-8c32
```

6. Non fare push su `origin` `master`. Il push su `origin` del branch `cursor/...` è ammesso solo se il task di pull request del progetto lo richiede già. Non aprire una pull request verso `runewords` che mescoli questo prodotto se l’utente non l’ha chiesto in questo file. Questo file non lo chiede.
7. Verifica:

```sh
git ls-remote private HEAD && gh repo view frakkio84/orari-commerciali --json visibility --jq .visibility
```

`OK` se il remote risponde e la visibilità è `PRIVATE`.

## Stop

Fermati quando il Task 8 è OK. Non aggiungere chat, pagamenti, badge, machine learning, una mappa a tasselli o un provider Google, OSM o Foursquare.

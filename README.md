# Orari

App per cercare esercizi a Bologna e consultare gli orari di apertura. Gli orari distinguono provenienza e attendibilità. Un contributo resta in attesa e non sostituisce i dati pubblicati.

Il primo traguardo copre ricerca, stato calcolato, provenienza e contributi. Mappa a tasselli, notifiche, gamification e pagamenti restano fuori.

## Decisioni del pilot

1. **Città:** Bologna, fuso `Europe/Rome`.
2. **Provider:** adapter locale `FixturePlacesProvider`. OpenStreetMap, Google Places e Foursquare non sono collegati: licenza, conservazione e costi vanno verificati prima di un provider vero.
3. **Verifica titolari:** revisione manuale. I metodi proposti sono documento, contatto aziendale o revisione manuale. Una richiesta `pending` non dà permessi.
4. **Soglie:** 3 conferme indipendenti per «Confermato dalla community», 2 disaccordi per «Da riconfermare», finestra di 14 giorni. La pubblicazione automatica delle modifiche è disattivata. Sono valori da validare, non una verità di prodotto.
5. **Ricerca:** tutta la città, oppure 500 m, 1 km, 2 km e 5 km da un punto. Categorie del catalogo pilota.
6. **Moderazione:** le decisioni stanno nel dominio e nell’audit log. L’app non offre una coda: un utente non può approvare, nemmeno la propria proposta.
7. **Dati personali:** in questo pilot il nome visualizzato resta sul dispositivo. Non c’è una chiave di servizio nel bundle.
8. **Mappa:** schema locale delle coordinate, senza fornitore di tasselli a pagamento.
9. **Costo esterno:** nessuna chiamata a API a pagamento.
10. **Distribuzione:** Expo web ed Expo Go.

Il piano per completare test, API e distribuzione è in `AGENTS.md`. Il codice di questa app va pubblicato sul repository privato `frakkio84/orari-commerciali`. `frakkio84/runewords` resta pubblico.

## Avvio

```sh
npm install
npx expo start
```

Poi `w` per il web, oppure Expo Go con lo stesso SDK 54.

```sh
npm test
npm run typecheck
```

## Cosa si può fare

- Cercare per nome, categoria, distanza e «aperto adesso».
- Vedere un esercizio senza orari come «Orari non disponibili», non come chiuso.
- Leggere orari, eccezioni, stato calcolato, provenienza e attendibilità.
- Confermare aperto/chiuso adesso senza modificare la settimana.
- Proporre orari, chiusure, aperture o dati errati. La proposta resta `pending`.
- Chiedere la titolarità di una scheda, senza ottenere permessi.
- Ripetere l’importazione: niente duplicati e niente sovrascrittura degli orari protetti.

Il catalogo iniziale è dimostrativo e passa dalla stessa pipeline di importazione usata per un provider esterno.

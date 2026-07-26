# Blackout al Faro

Gioco di deduzione sociale ambientato a Port Leon durante un blackout. Un solo
dispositivo distribuisce i ruoli, guida la notte, raccoglie le scelte private,
risolve i poteri, rivela gli eliminati e controlla la vittoria.

[Gioca online con GitHub Pages](https://aalborghetti.github.io/port_leon-blackout_al_faro/)

L'app implementa la **modalità digitale completa**. Per ora non è presente una
modalità di supporto alle sole carte fisiche.

## Avvio

Il client del gioco usa HTML, CSS e JavaScript vanilla e può essere avviato
senza compilazione.

Si può aprire direttamente `index.html`, oppure servire la cartella con un
server statico:

```bash
python -m http.server 8000
```

Poi aprire `http://localhost:8000`.

Il server locale è consigliato su mobile per un comportamento più uniforme
della sintesi vocale. L'app non carica font, audio, analytics o altre risorse da
servizi esterni.

La versione online viene distribuita automaticamente tramite GitHub Pages.
Ogni push sul ramo `main` esegue i test, prepara un artefatto contenente soltanto
il client statico e lo pubblica:

```bash
npm test
npm run prepare:pages
```

I comandi locali richiedono Node.js 22 o successivo e non installano dipendenze.

## Cosa gestisce l'app

- configurazione pubblica da 5 a 15 giocatori;
- scelta libera dei personaggi speciali entro i limiti di composizione;
- assegnazione casuale con generatore crittograficamente sicuro del browser;
- rivelazione privata dei ruoli con pressione prolungata;
- inizio della partita dalla Notte 1;
- registrazione obbligatoria di un eliminato ogni giorno;
- sequenza notturna guidata con transizioni automatiche quando tutti hanno gli occhi chiusi;
- utilizzi dei poteri, interferenza del Guastatore e protezione del Tecnico;
- rivelazione pubblica dei ruoli eliminati;
- voto doppio assegnato dal Portavoce;
- condizioni di vittoria e co-vittoria del Naufrago;
- voce narrante italiana e atmosfera marina procedurale opzionali;
- salvataggio locale per riprendere una partita interrotta;
- copertura automatica delle schermate segrete quando si cambia app o scheda.

I voti diurni non vengono inseriti uno per uno: il gruppo discute e vota fuori
dall'app, poi comunica al dispositivo soltanto il nome dell'eliminato.

## Flusso di una partita

1. Si scelgono numero di giocatori, nomi, speciali e modalità audio.
2. Il dispositivo viene passato a turno; ogni giocatore tiene premuto per
   vedere il proprio ruolo, poi lo nasconde.
3. Il dispositivo viene posato al centro e inizia la Notte 1. Tutti chiudono
   gli occhi e, dopo cinque secondi, la voce chiama automaticamente il primo
   ruolo.
4. Solo il ruolo chiamato apre gli occhi e interagisce con lo schermo. Al
   termine della sequenza l'alba viene risolta automaticamente dopo cinque
   secondi.
5. All'alba l'app comunica soltanto l'eliminato, oppure che nessuno è stato
   eliminato. L'eventuale interferenza viene annunciata pubblicamente.
6. Il Giorno 1 si apre direttamente sulla lista dei vivi: il gruppo discute,
   vota fuori dall'app e seleziona un unico eliminato.
7. L'app rivela il ruolo, applica l'eventuale Portavoce e controlla la vittoria.
8. Notte e giorno si alternano fino alla vittoria di una fazione.

## Composizione

### Sabotatori

| Giocatori | Posti della fazione Sabotatori |
|---:|---:|
| 5–7 | 1 |
| 8–11 | 2 |
| 12–15 | 3 |

Il Guastatore occupa uno di questi posti e sostituisce quindi un Sabotatore
normale.

### Categorie degli speciali

| Codice | Categoria | Ruoli | Fazione |
|---|---|---|---|
| **I** | Indagine | Sentinella, Vedetta, Cartografa della Baia | Custodi |
| **P** | Protezione | Tecnico | Custodi |
| **V** | Influenza | Portavoce | Custodi |
| **N** | Neutrale | Naufrago | Nessuna |
| **G** | Guasto | Guastatore | Sabotatori |

| Giocatori | Speciali esatti | I | P | V | N | G |
|---:|---:|---:|---:|---:|---:|---:|
| 5–6 | 1 | max 1 | max 1 | max 1 | max 1 | 0 |
| 7 | 2 | max 1 | max 1 | max 1 | max 1 | 0 |
| 8 | 2 | max 1 | max 1 | max 1 | max 1 | max 1 |
| 9–11 | 3 | max 1 | max 1 | max 1 | max 1 | max 1 |
| 12–15 | 4 | max 2 | max 1 | max 1 | max 1 | max 1 |

Vincoli aggiuntivi applicati automaticamente:

- ogni speciale è unico;
- il Guastatore è disponibile solo con almeno due posti Sabotatore;
- tra 8 e 11 giocatori Naufrago e Guastatore non possono convivere;
- due ruoli di Indagine richiedono almeno 12 giocatori e il Guastatore;
- da 12 giocatori servono almeno due speciali schierati con i Custodi;
- da 12 giocatori deve essere presente almeno uno tra Naufrago e Guastatore.

## Ruoli

| Ruolo | Fazione | Potere |
|---|---|---|
| **Custode** | Custodi | Nessun potere notturno. Discute e vota. |
| **Sabotatore** | Sabotatori | Ogni notte sceglie insieme agli altri Sabotatori un unico bersaglio. |
| **Sentinella** | Custodi | Una volta per partita scopre l'allineamento di un altro giocatore vivo: Custodi, Sabotatori o Neutrale. |
| **Tecnico** | Custodi | Una volta per partita, dopo la scelta definitiva dei Sabotatori e senza conoscerla, può annullare il sabotaggio. |
| **Portavoce** | Custodi | Quando viene eliminato pronuncia un ultimo messaggio di massimo dieci parole e assegna un voto doppio per la votazione successiva. |
| **Naufrago** | Neutrale | Nessun potere. Vince con la fazione vincitrice soltanto se è ancora vivo. |
| **Vedetta** | Custodi | Due volte per partita scopre se un altro giocatore vivo ha compiuto un'azione notturna, ma non quale. |
| **Cartografa della Baia** | Custodi | Due volte per partita confronta due altri giocatori vivi e scopre se appartengono alla stessa fazione. |
| **Guastatore** | Sabotatori | Una volta per partita blocca per quella notte i poteri attivi dei Custodi. |

Sentinella, Vedetta e Cartografa possono controllare nuovamente un bersaglio già
scelto in una notte precedente, ma non possono scegliere se stesse. La
Cartografa deve indicare due persone vive e differenti.

## Giorno, eliminazione e Portavoce

- La partita inizia dal **Giorno 1**.
- Durante il giorno i vivi discutono liberamente.
- Gli eliminati non parlano, non votano e non comunicano tramite gesti.
- La votazione si svolge fuori dall'app.
- Ogni giornata deve terminare con **un solo eliminato**.
- In caso di parità il gruppo continua a confrontarsi e a votare finché non
  emerge un unico nome; non esiste l'esito “nessun eliminato”.
- Il ruolo dell'eliminato viene rivelato pubblicamente.

Quando viene eliminato, di giorno o di notte, il Portavoce:

1. rivela il proprio ruolo;
2. pronuncia un ultimo messaggio di massimo dieci parole;
3. designa pubblicamente un giocatore ancora vivo;
4. fa valere doppio il voto di quel giocatore nella votazione successiva.

Il bonus non si applica alla votazione che ha eliminato il Portavoce. Se il
giocatore designato muore prima della votazione successiva, il bonus è perso.
Il bonus si consuma con quella votazione anche se il designato è proprio il
giocatore eliminato dal voto.

## Sequenza della notte

1. Tutti chiudono gli occhi.
2. I Sabotatori aprono gli occhi e concordano **insieme un solo bersaglio**.
3. Se è presente il Guastatore, una schermata neutra e la voce danno agli altri
   Sabotatori il tempo di chiudere gli occhi; solo dopo compare la sua scelta
   segreta sull'interferenza.
4. Il Guastatore chiude gli occhi; se non era presente, li chiude l'intera
   squadra. Il bersaglio non può più cambiare.
5. Il Tecnico decide se intervenire senza conoscere il bersaglio.
6. Sentinella, Cartografa e Vedetta vengono chiamate separatamente, se presenti
   e vive.
7. Dopo ogni ruolo, un breve intervallo automatico gli permette di richiudere
   gli occhi prima della chiamata successiva.
8. L'app risolve gli effetti e annuncia l'esito all'alba.

I Sabotatori non possono bersagliare un membro della propria fazione e devono
sempre raggiungere un accordo: non esistono voti notturni individuali.

Se il Guastatore usa l'interferenza:

- il sabotaggio procede;
- Tecnico, Sentinella, Cartografa e Vedetta non ottengono effetti;
- gli utilizzi bloccati non vengono consumati;
- viene consumato l'utilizzo del Guastatore;
- l'interferenza viene annunciata all'alba senza rivelarne l'autore.

Il Tecnico sceglie dopo i Sabotatori. Se usa il potere e non viene bloccato,
nessuno viene eliminato durante quella notte.

Per la Vedetta hanno agito:

- tutti i Sabotatori vivi che hanno partecipato alla scelta condivisa;
- il Tecnico se ha deciso di intervenire;
- uno speciale che ha scelto di usare il proprio potere.

Essere soltanto chiamati dalla voce non conta come azione. Durante
l'interferenza la Vedetta non riceve alcun risultato.

## Vittoria

- I Custodi vincono quando non rimane alcun Sabotatore vivo.
- I Sabotatori vincono quando il loro numero è uguale o superiore al numero di
  membri vivi della fazione dei Custodi.
- Gli speciali di fazione vengono conteggiati con la rispettiva fazione.
- Il Naufrago non conta nel confronto numerico.
- Il Naufrago ancora vivo co-vince con qualsiasi fazione vincitrice; se è stato
  eliminato, perde.

Il potere del Portavoce viene risolto prima del controllo della vittoria.

## Privacy e audio

Le informazioni segrete non vengono pronunciate dalla voce narrante. I
risultati delle indagini compaiono solo sullo schermo e devono essere
memorizzati prima di chiudere gli occhi.

Quando una schermata segreta perde il focus o la pagina viene nascosta, compare
una copertura di sicurezza. Durante l'assegnazione un ruolo già rivelato viene
anche richiuso automaticamente.

Le tre modalità audio sono:

- **Muto** durante setup e giorno;
- **Voce** tramite Web Speech API del browser;
- **Voce e atmosfera**, con mare e vento generati localmente dalla Web Audio
  API e abbassati mentre parla il narratore.

La voce viene attivata automaticamente quando inizia la notte, anche se era
stato scelto Muto: con tutti gli occhi chiusi, la regia autonoma non potrebbe
altrimenti chiamare il ruolo corretto. Al ritorno del giorno viene ripristinata
la preferenza Muto.

Prima della prima notte l'app verifica che il browser completi davvero una frase
di prova. Se la sintesi vocale manca o non risponde, la notte non parte. Se si
interrompe in seguito, la regia blocca l'avanzamento, copre le informazioni
private e segnala con tre toni di aprire gli occhi e ripetere la chiamata. Anche
durante il nuovo annuncio lo schermo resta coperto: la voce ordina prima a tutti
di richiudere gli occhi, poi richiama il solo ruolo attivo. Lo schermo si scopre
soltanto quando la chiamata è terminata.

Con un lettore di schermo sono consigliate le cuffie, perché il software
assistivo può leggere il testo privato. Su telefono è consigliato attivare
“Non disturbare”.

## Salvataggio

La partita in corso viene conservata nel `localStorage` del browser, sul solo
dispositivo usato. Alla riapertura si può scegliere **Continua la partita**.

Il pulsante **Chiudi e cancella i ruoli** rimuove il salvataggio. Non vengono
inviati dati a server esterni e i segreti non vengono inseriti in URL, log o
analytics.

## Verifica

Il motore è separato dall'interfaccia in `game-engine.js`: la stessa sorgente
UMD viene caricata dal browser e dalla suite Node.js.

Con Node.js:

```bash
node --test tests/game-engine.test.js
```

La suite copre 30 casi relativi a composizione, fazioni, vittoria,
eliminazioni, Portavoce e risoluzione notturna.

Senza Node.js, gli stessi test si possono eseguire aprendo
`tests/game-engine-browser.html`.

`tests/browser-smoke.html` percorre inoltre nel browser un'intera sequenza:
setup, otto assegnazioni, Notte 1 con transizioni automatiche, alba, selezione
diretta del Giorno 1, eliminazione e avvio della Notte 2. Usa una chiave di
salvataggio isolata e non tocca eventuali partite reali.

## Struttura

```text
.
├── index.html                 # shell accessibile dell'app
├── styles.css                 # interfaccia mobile-first
├── game-engine.js             # regole pure e macchina di risoluzione
├── app.js                     # stato, schermate, privacy, voce e atmosfera
├── package.json               # test e preparazione dell'artefatto statico
├── .github/workflows/pages.yml # pubblicazione automatica GitHub Pages
├── scripts/prepare-public.mjs # prepara solo i file necessari alla demo
├── tests/
│   ├── game-engine.test.js    # test del motore
│   ├── package.json           # isola il runner Node in CommonJS
│   ├── game-engine-browser.html # runner senza Node.js
│   └── browser-smoke.html     # percorso integrato nel browser
├── art/
│   ├── cards/minimal/         # set illustrato coordinato
│   └── concepts/              # esplorazioni grafiche precedenti
└── img/                       # vecchi SVG, mantenuti come archivio
```

## Illustrazioni

L'app usa le nove carte con nome in
[`art/cards/minimal/labelled`](art/cards/minimal/README.md) e il dorso con il
faro in `art/cards/minimal/card-back-lighthouse.png`.

La direzione è la variante **F — illustrazione editoriale a linea**, con fondo
avorio, blu notte, petrolio e un accento ambra. Gli asset restano concept
digitali: per la stampa serviranno ancora abbondanze, zone sicure, profilo
colore e prove nelle dimensioni reali.

## Aspetti da validare con i playtest

Il sistema è implementato, ma il bilanciamento richiede partite reali. In
particolare vanno osservati:

- il passaggio da uno a due Sabotatori tra 7 e 8 giocatori;
- la forza combinata di Guastatore e ruoli di Indagine;
- la frequenza con cui il Tecnico annulla una notte;
- l'impatto del voto doppio del Portavoce;
- durata media della partita e chiarezza delle istruzioni vocali.

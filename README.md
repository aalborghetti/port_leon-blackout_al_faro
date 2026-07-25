# Blackout al Faro

App web e progetto di gioco di deduzione sociale in stile *Lupus in Fabula*, ambientato in un faro isolato durante un blackout.

L'app attuale gestisce l'**assegnazione dei ruoli** e la **narrazione delle fasi**, ma non implementa eliminazioni, controllo delle vittorie, voti o risoluzione dei poteri. La partita vera e propria si gioca **a voce** tra i partecipanti.

> ⚠️ Il regolamento è in revisione. La sezione **Regolamento di progetto** descrive la versione verso cui evolverà il gioco; il codice dell'app usa ancora la configurazione precedente.

## Come si usa

L'app è composta da soli file statici, senza build né dipendenze. Per avviarla basta aprire `index.html` in un browser, oppure servire la cartella con un server statico:

```bash
# opzione 1: aprire direttamente il file
# basta fare doppio clic su index.html

# opzione 2: server statico locale (consigliato per l'audio su mobile)
python -m http.server 8000
# poi apri http://localhost:8000
```

L'idea è di **passare un unico dispositivo** tra i giocatori: ognuno vede solo il proprio ruolo, poi lo passa al successivo.

## Flusso dell'app

L'app è organizzata in 4 schermate:

1. **Setup** — Si sceglie il numero di giocatori (5–15) e, opzionalmente, la *Modalità Caos*. Il pulsante *Regole ruoli (preview)* mostra l'anteprima della composizione (quanti Sabotatori, Custodi, Speciali) in base ai giocatori selezionati.
2. **Assegnazione** — Per ogni giocatore: si tocca lo schermo per scoprire il proprio ruolo (mostrato con la relativa carta-personaggio illustrata), lo si memorizza e si passa il dispositivo. Tra un giocatore e l'altro lo schermo lampeggia di nero per evitare che il ruolo resti visibile.
3. **Fine** — I ruoli sono assegnati. È disponibile un **riepilogo riservato all'host** (da non mostrare in pubblico). Da qui si può avviare il narratore, fare una nuova assegnazione o tornare al setup.
4. **Narratore** — Scandisce le fasi della partita (Notte → Giorno → Votazione) con voce sintetica (TTS) ed effetti sonori opzionali.

## Regolamento di progetto

Queste regole rappresentano la versione di progetto più recente. Le parti indicate come **da confermare** non devono ancora essere considerate definitive.

### Fazioni e condizioni di vittoria

- I **Custodi** vincono quando tutti i Sabotatori sono stati eliminati.
- I **Sabotatori** vincono quando il loro numero è uguale o superiore al numero dei Custodi ancora vivi.
- I personaggi speciali schierati con i Custodi o con i Sabotatori vengono conteggiati nella rispettiva fazione.
- Il **Naufrago** è neutrale e non viene conteggiato per nessuna fazione.
- Il Naufrago vince, insieme alla fazione vincitrice, se è ancora vivo quando la partita termina. Se viene eliminato, perde.
- Finché è vivo, il Naufrago discute e vota come gli altri giocatori.
- Le condizioni di vittoria vengono controllate subito dopo ogni eliminazione.

Esempio: se rimangono un Sabotatore, un Custode e il Naufrago, il Sabotatore raggiunge la parità con i Custodi e vince. Anche il Naufrago vince se è ancora vivo.

### Eliminazione e rivelazione

Quando un giocatore viene eliminato, di giorno o di notte:

1. rivela immediatamente il proprio ruolo;
2. colloca la carta scoperta davanti a sé;
3. rimane visibile a tutti per il resto della partita.

La possibilità per il giocatore eliminato di parlare, gesticolare o partecipare ancora alla partita è **da confermare**. L'unica eccezione già prevista è l'effetto di eliminazione del Portavoce.

### Composizione dei ruoli

I ruoli base sono **Custode** e **Sabotatore**. Tutti gli altri ruoli sono personaggi speciali.

Prima dell'assegnazione:

1. il gruppo sceglie pubblicamente quali personaggi speciali inserire;
2. tutti conoscono i ruoli presenti nella partita, ma non chi li riceverà;
3. i ruoli selezionati vengono aggiunti a Custodi e Sabotatori e poi mescolati;
4. i posti rimanenti vengono occupati dai Custodi.

I singoli personaggi speciali non hanno soglie legate direttamente al numero di partecipanti. La composizione stabilisce invece quanti ruoli di ogni categoria possono essere scelti. L'unica eccezione è il **Guastatore**, disponibile soltanto se la configurazione iniziale comprende almeno due Sabotatori.

Il Guastatore sostituisce uno dei Sabotatori previsti: non aggiunge un ulteriore membro alla loro fazione.

In termini di composizione, se viene scelto il Guastatore, il numero di Sabotatori normali da inserire è pari al totale previsto meno uno.

#### Numero di Sabotatori

Il principio scelto è avere circa **un Sabotatore ogni cinque giocatori**, ma la regola di arrotondamento non è ancora definita. Questa è l'ipotesi di test raccomandata:

| Giocatori | Sabotatori |
|---:|---:|
| 5–7 | 1 |
| 8–11 | 2 |
| 12–15 | 3 |

La soglia tra 7 e 8 giocatori dovrà essere verificata con particolare attenzione durante i playtest.

#### Categorie dei personaggi speciali

| Codice | Categoria | Ruoli attuali | Fazione |
|---|---|---|---|
| **I** | Indagine | Sentinella, Vedetta, Cartografa della Baia | Custodi |
| **P** | Protezione | Tecnico | Custodi |
| **V** | Influenza | Portavoce | Custodi |
| **N** | Neutrale | Naufrago | Nessuna |
| **G** | Guasto | Guastatore | Sabotatori |

Il numero dei giocatori non rende obbligatorio o vietato un ruolo specifico: stabilisce soltanto il numero totale di speciali e i limiti delle categorie. Dopo avere scelto le categorie, il gruppo seleziona liberamente un personaggio disponibile per ciascun posto.

Ogni personaggio speciale è unico e non può essere inserito due volte. Un limite di categoria superiore al numero dei ruoli oggi disponibili diventerà utile quando verranno aggiunti nuovi personaggi.

I ruoli di Indagine, Protezione e Influenza sostituiscono altrettanti Custodi. Il Naufrago occupa un posto non appartenente ai Sabotatori, ma non entra nella fazione dei Custodi.

#### Composizione standard degli speciali

| Giocatori | Speciali totali | Indagine | Protezione | Influenza | Neutrali | Guasto |
|---:|---:|---:|---:|---:|---:|---:|
| 5–6 | 1 | max 1 | max 1 | max 1 | max 1 | 0 |
| 7 | 2 | max 1 | max 1 | max 1 | max 1 | 0 |
| 8 | 2 | max 1 | max 1 | max 1 | max 1 | max 1 |
| 9–11 | 3 | max 1 | max 1 | max 1 | max 1 | max 1 |
| 12–15 | 4 | max 2 | max 1 | max 1 | max 1 | max 1 |

Si applicano inoltre questi vincoli:

- il totale indicato deve essere raggiunto esattamente, mentre i valori delle categorie sono soltanto limiti massimi;
- tra 8 e 11 giocatori, Naufrago e Guastatore non possono essere presenti insieme;
- da 12 giocatori, Naufrago e Guastatore possono convivere;
- due ruoli di Indagine sono ammessi soltanto da 12 giocatori e soltanto se è presente il Guastatore;
- da 12 giocatori, almeno due degli speciali scelti devono appartenere ai Custodi;
- con l'attuale insieme di categorie, da 12 giocatori deve essere presente almeno uno tra Naufrago e Guastatore;
- il Naufrago e il Guastatore occupano ciascuno uno dei posti disponibili.

La colonna Guasto si applica soltanto se il numero di Sabotatori previsto dalla configurazione è almeno due. Questo vincolo prevale anche se in futuro cambieranno le soglie associate al numero di giocatori.

Il limite base rimane di quattro speciali. Un eventuale quinto personaggio nelle partite più numerose verrà valutato soltanto dopo i playtest.

Esempi:

- con 8 giocatori, `G + I` è valido, mentre `G + N` non lo è;
- con 10 giocatori, `I + P + N` e `G + I + V` sono validi, mentre `G + N + V` non lo è;
- con 12 giocatori, `G + I + I + N` è valido, mentre `I + I + P + V` non lo è perché manca il Guastatore.

### Ruoli

| Ruolo | Fazione | Effetto di progetto | Stato |
|---|---|---|---|
| **Sabotatore** | Sabotatori | Ogni notte sceglie insieme agli altri Sabotatori un bersaglio da eliminare. | Confermato |
| **Custode** | Custodi | Non possiede poteri. Discute e vota per individuare i Sabotatori. | Confermato |
| **Sentinella** | Custodi | Una volta per partita controlla l'allineamento di un altro giocatore vivo. | Confermata |
| **Tecnico** | Custodi | Una volta per partita, dopo che i Sabotatori hanno scelto definitivamente il bersaglio, può annullare il sabotaggio. Non conosce il bersaglio e gli altri poteri notturni funzionano normalmente. | Confermato |
| **Portavoce** | Custodi | Quando viene eliminato, pronuncia un ultimo messaggio di massimo dieci parole e designa pubblicamente un giocatore vivo. Nella votazione successiva il voto di quel giocatore vale doppio. | Confermato |
| **Naufrago** | Neutrale | Non ha poteri. Vince se è vivo alla fine, indipendentemente dalla fazione vincitrice. Non conta per nessuna fazione. | Confermato |
| **Vedetta** | Custodi | Fino a due volte per partita osserva un giocatore vivo e scopre se ha compiuto un'azione notturna, ma non quale. | Confermata, da testare |
| **Cartografa della Baia** | Custodi | Fino a due volte per partita confronta due giocatori vivi, differenti e diversi da sé, e scopre se appartengono alla stessa fazione. Il Naufrago risulta differente da qualsiasi altro giocatore. | Confermata, da testare |
| **Guastatore** | Sabotatori | In una partita con almeno due Sabotatori, ne sostituisce uno. Una volta per partita disattiva i poteri notturni attivi dei Custodi per quella notte; i poteri bloccati non vengono consumati. | Confermato, da testare |

#### Portavoce

Il potere si attiva con qualsiasi eliminazione, di giorno o di notte:

1. il Portavoce rivela la propria carta;
2. pronuncia un ultimo messaggio di massimo dieci parole;
3. designa pubblicamente un giocatore ancora vivo;
4. nella votazione successiva, il voto del giocatore designato vale due.

Il voto doppio si applica alla votazione seguente, mai a quella che ha causato l'eliminazione del Portavoce. Se la partita termina prima, il potere non produce effetti.

La carta viene rivelata, il Portavoce parla e designa il giocatore prima di verificare le condizioni di vittoria.

La gestione del caso in cui il giocatore designato venga eliminato prima della votazione è ancora **da confermare**.

#### Limiti di utilizzo

- Sentinella: una volta per partita.
- Vedetta: due volte per partita.
- Cartografa della Baia: due volte per partita.
- Tecnico: una volta per partita.
- Guastatore: una volta per partita.

Sentinella, Vedetta e Cartografa vengono interpellate ogni notte e possono decidere di non usare il proprio potere. Un utilizzo viene consumato soltanto quando il personaggio riceve il risultato. Un potere bloccato dall'interferenza del Guastatore non consuma utilizzi.

### Sequenza della notte

La sequenza di progetto è:

1. tutti i giocatori chiudono gli occhi;
2. i Sabotatori si svegliano e scelgono definitivamente il bersaglio;
3. se presente, il Guastatore decide se provocare l'interferenza;
4. i Sabotatori chiudono gli occhi;
5. il Tecnico viene svegliato e, senza conoscere il bersaglio, può annullare il sabotaggio;
6. gli altri personaggi notturni agiscono separatamente;
7. il narratore risolve gli effetti e annuncia l'esito all'alba.

Se il Guastatore ha attivato l'interferenza:

- il Tecnico e gli altri poteri notturni attivi dei Custodi non hanno effetto;
- un potere utilizzabile una sola volta non viene consumato;
- i poteri passivi o attivati dall'eliminazione non vengono bloccati;
- all'alba viene annunciata l'interferenza, senza rivelare chi sia il Guastatore.

Il bersaglio scelto dai Sabotatori non può essere cambiato dopo la loro fase.

Il Guastatore partecipa alla normale scelta del bersaglio e può usare l'interferenza anche se è l'ultimo Sabotatore ancora vivo.

Per la Vedetta, “compiere un'azione notturna” significa:

- per ogni Sabotatore vivo, partecipare alla scelta del bersaglio;
- per un personaggio speciale, utilizzare o risolvere il proprio potere;
- per il Tecnico, decidere effettivamente di annullare il sabotaggio.

Essere semplicemente svegliati dal narratore non conta come azione. Durante una notte di interferenza la Vedetta non riceve alcun risultato.

### Giorno e votazione

- Durante il giorno i giocatori vivi discutono liberamente.
- Durante la votazione indicano contemporaneamente il giocatore che vogliono eliminare.
- Il giocatore eliminato rivela subito la propria carta e la colloca scoperta davanti a sé.
- La gestione dei pareggi non è ancora stata definita.

### Decisioni ancora aperte

Prima di aggiornare la logica dell'app devono essere definite:

1. la soglia esatta con cui aumenta il numero dei Sabotatori;
2. cosa accade in caso di parità nella votazione;
3. se la partita inizia con il Giorno o con una prima Notte senza eliminazione;
4. quali comunicazioni sono consentite ai giocatori eliminati;
5. come i Sabotatori risolvono un disaccordo sul bersaglio;
6. quale risultato riceve la Sentinella quando controlla il Naufrago;
7. cosa accade al potere del Portavoce se il giocatore designato muore prima della votazione successiva;
8. come ricordare il voto doppio del Portavoce nella versione fisica senza rivelare informazioni aggiuntive;
9. se il voto del Portavoce resta doppio durante un eventuale ballottaggio della stessa fase.

### Stato dell'app rispetto al regolamento

Il codice non implementa ancora questa revisione. In particolare usa ancora:

- due Sabotatori fino a 10 giocatori e tre da 11 in su;
- inserimento automatico degli speciali in base al numero di partecipanti;
- il vecchio Disturbatore al posto del Naufrago;
- il precedente effetto del Tecnico e del Portavoce;
- nessuna Vedetta, Cartografa della Baia o Guastatore;
- nessun tracciamento di eliminazioni, carte rivelate o condizioni di vittoria.

Il README costituisce quindi la specifica di progetto; l'app rimane temporaneamente un prototipo della versione precedente.

### Illustrazioni attuali

La versione precedente dell'app contiene sei **carte-personaggio in formato SVG** nella cartella `img/`:

```
img/sabotatore.svg   img/sentinella.svg   img/portavoce.svg
img/custode.svg      img/tecnico.svg      img/disturbatore.svg
```

Il file del Disturbatore è un elemento della versione precedente. Se
un'immagine manca, l'app nasconde l'elemento grafico e mostra comunque nome e
descrizione del ruolo.

Le esplorazioni del dorso e delle varianti stilistiche del Custode sono
disponibili in [`art/concepts`](art/concepts/README.md). È stata scelta la
variante **F — Linea editoriale**.

Il nuovo dorso minimale e le illustrazioni coordinate di tutti i nove ruoli
sono disponibili nel [`set illustrato minimale`](art/cards/minimal/README.md).
Restano separati dall'app finché non verranno progettate la gabbia grafica
della carta e le esportazioni digitali definitive.

## Narratore attuale

La schermata narratore guida le fasi della partita con audio:

- **Notte** — Sabotatori, Sentinella e Tecnico agiscono.
- **Giorno** — discussione libera (consigliati 3–6 minuti).
- **Votazione** — al "tre" tutti indicano chi eliminare.

Le fasi si ripetono in ciclo (Notte → Giorno → Votazione → Notte …).

Controlli disponibili:

- **Voce (TTS)** — sintesi vocale via Web Speech API, con preferenza per una voce italiana.
- **Effetti (SFX)** — suoni opzionali per le fasi (file forniti dall'utente, vedi sotto).
- **🌩️ Temporale** — sottofondo di tempesta generato dal vivo (vedi sotto). Attivo di default.
- **Ripeti audio** — riascolta la fase corrente.

### Sottofondo di temporale (procedurale)

Un letto sonoro continuo di pioggia, vento/mare e tuoni, **sintetizzato in tempo reale** con la Web Audio API (nessun file audio richiesto): si genera dal vivo, quindi va in loop all'infinito senza ripetizioni udibili. Cambia atmosfera in base alla fase, con una dissolvenza incrociata:

- **Notte** — più intenso: pioggia battente, vento, tuoni frequenti e vicini.
- **Giorno** — più calmo: pioggia leggera, tuoni radi e lontani.
- **Votazione** — aggiunge un tuono secco come "stoccata".

Mentre il narratore parla, il temporale viene abbassato automaticamente (*ducking*) per non coprire la voce. Si attiva/disattiva con il toggle **🌩️ Temporale** e parte dopo *Abilita audio*.

> 🔊 **Audio su mobile:** premere prima *Abilita audio*. I browser mobili bloccano l'audio finché non c'è un'interazione esplicita dell'utente.

### Effetti sonori (opzionali)

Gli SFX non sono inclusi nel repository e vanno forniti dall'utente. Per abilitarli, inserire i file audio nella cartella `sfx/`:

```
sfx/night.mp3
sfx/day.mp3
sfx/vote.mp3
```

Se i file mancano, l'app funziona comunque: l'effetto viene semplicemente saltato. La narrazione parlata non richiede file audio, perché è generata a runtime dal TTS del browser.

## Struttura del progetto

```
.
├── index.html   # markup delle 4 schermate (setup, assegnazione, fine, narratore)
├── styles.css   # tema scuro, layout mobile-friendly
├── app.js       # logica: composizione ruoli, assegnazione, narratore TTS/SFX
├── img/         # carte-personaggio SVG dei 6 ruoli
├── art/         # concept e nuovo set illustrato minimale
└── sfx/         # (opzionale) effetti sonori delle fasi (.mp3 forniti dall'utente)
```

## Tecnologie

- HTML, CSS e JavaScript vanilla — nessuna dipendenza, nessun build step.
- [Web Speech API](https://developer.mozilla.org/docs/Web/API/SpeechSynthesis) per la sintesi vocale.
- Supporto da tastiera durante l'assegnazione: **Spazio/Invio** per scoprire il ruolo, **Invio** per passare al giocatore successivo.

## Stato e prossimi passi

Prima di aggiornare l'app è necessario chiudere le decisioni elencate nel regolamento. Successivamente:

1. raccogliere ruoli, fazioni, poteri e testi delle carte in un'unica fonte dati;
2. aggiornare la selezione dei personaggi speciali e la composizione delle partite;
3. gestire giocatori vivi, eliminazioni, rivelazione delle carte e voti;
4. implementare la sequenza notturna e la risoluzione privata dei poteri;
5. verificare automaticamente le condizioni di vittoria;
6. progettare carte e illustrazioni utilizzabili sia nella versione fisica sia in quella digitale.

La versione fisica richiede comunque un narratore non giocante oppure un'app capace di fornire privatamente i risultati di Sentinella, Vedetta e Cartografa della Baia.

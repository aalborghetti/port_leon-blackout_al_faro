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

La possibilità per il giocatore eliminato di parlare, gesticolare o partecipare ancora alla partita è **da confermare**. L'unica eccezione già prevista è l'eventuale effetto di eliminazione del Portavoce.

### Composizione dei ruoli

I ruoli base sono **Custode** e **Sabotatore**. Tutti gli altri ruoli sono personaggi speciali.

Prima dell'assegnazione:

1. il gruppo sceglie pubblicamente quali personaggi speciali inserire;
2. tutti conoscono i ruoli presenti nella partita, ma non chi li riceverà;
3. i ruoli selezionati vengono aggiunti a Custodi e Sabotatori e poi mescolati;
4. i posti rimanenti vengono occupati dai Custodi.

I singoli personaggi speciali non hanno un numero minimo di partecipanti. Il **Guastatore** sostituisce uno dei Sabotatori previsti: non aggiunge un ulteriore membro alla loro fazione.

#### Numero di Sabotatori

Il principio scelto è avere circa **un Sabotatore ogni cinque giocatori**, ma la regola di arrotondamento non è ancora definita. Questa è l'ipotesi di test raccomandata:

| Giocatori | Sabotatori |
|---:|---:|
| 5–7 | 1 |
| 8–11 | 2 |
| 12–15 | 3 |

La soglia tra 7 e 8 giocatori dovrà essere verificata con particolare attenzione durante i playtest.

#### Numero di personaggi speciali

Anche il numero massimo di personaggi speciali è ancora **da confermare**. Una prima ipotesi di test è:

| Giocatori | Personaggi speciali |
|---:|---:|
| 5–6 | 1 |
| 7–8 | 2 |
| 9–11 | 3 |
| 12–15 | 4 |

Il Naufrago e il Guastatore occupano ciascuno uno di questi posti. Per ora non è stato deciso se limitare il numero di ruoli investigativi presenti contemporaneamente.

### Ruoli

| Ruolo | Fazione | Effetto di progetto | Stato |
|---|---|---|---|
| **Sabotatore** | Sabotatori | Ogni notte sceglie insieme agli altri Sabotatori un bersaglio da eliminare. | Confermato |
| **Custode** | Custodi | Non possiede poteri. Discute e vota per individuare i Sabotatori. | Confermato |
| **Sentinella** | Custodi | Ogni notte controlla l'allineamento di un giocatore. | Da ribilanciare |
| **Tecnico** | Custodi | Una volta per partita, dopo che i Sabotatori hanno scelto definitivamente il bersaglio, può annullare il sabotaggio. Non conosce il bersaglio e gli altri poteri notturni funzionano normalmente. | Confermato |
| **Portavoce** | Custodi | Quando viene eliminato, pronuncia un ultimo messaggio di massimo dieci parole e designa un giocatore vivo. Nella votazione successiva il voto di quel giocatore vale doppio. | Da confermare o eliminare |
| **Naufrago** | Neutrale | Non ha poteri. Vince se è vivo alla fine, indipendentemente dalla fazione vincitrice. Non conta per nessuna fazione. | Confermato |
| **Vedetta** | Custodi | Ogni notte osserva un giocatore e scopre se ha compiuto un'azione notturna, ma non quale. | Introdotta, da testare |
| **Cartografa della Baia** | Custodi | Ogni notte confronta due giocatori vivi, differenti e diversi da sé, e scopre se appartengono alla stessa fazione. Il Naufrago risulta differente da qualsiasi altro giocatore. | Introdotta, da testare |
| **Guastatore** | Sabotatori | Sostituisce un Sabotatore. Una volta per partita disattiva i poteri notturni attivi dei Custodi per quella notte; i poteri bloccati non vengono consumati. | Introdotto, da testare |

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
2. il numero massimo di personaggi speciali per ciascun numero di giocatori;
3. se limitare a uno Sentinella, Vedetta e Cartografa nella stessa partita;
4. se mantenere il Portavoce con il nuovo potere oppure eliminarlo;
5. cosa accade in caso di parità nella votazione;
6. se la partita inizia con il Giorno o con una prima Notte senza eliminazione;
7. quali comunicazioni sono consentite ai giocatori eliminati;
8. come i Sabotatori risolvono un disaccordo sul bersaglio;
9. quale risultato riceve la Sentinella quando controlla il Naufrago;
10. cosa accade al potere del Portavoce se il giocatore designato muore prima della votazione successiva.

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

Il file del Disturbatore è un elemento della versione precedente. Non sono ancora state create le carte del Naufrago, della Vedetta, della Cartografa della Baia e del Guastatore. Se un'immagine manca, l'app nasconde l'elemento grafico e mostra comunque nome e descrizione del ruolo.

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

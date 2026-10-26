/* CourtIQ - contenuti di base (generici e prudenti, non sono consigli medici) */
"use strict";

const ZONES = {
  spalla_sx:   { group: "spalla",   label: "Spalla sinistra" },
  spalla_dx:   { group: "spalla",   label: "Spalla destra" },
  gomito_sx:   { group: "gomito",   label: "Gomito sinistro" },
  gomito_dx:   { group: "gomito",   label: "Gomito destro" },
  polso_sx:    { group: "polso",    label: "Polso sinistro" },
  polso_dx:    { group: "polso",    label: "Polso destro" },
  lombare:     { group: "lombare",  label: "Zona lombare" },
  anca_sx:     { group: "anca",     label: "Anca e gluteo sinistro" },
  anca_dx:     { group: "anca",     label: "Anca e gluteo destro" },
  ginocchio_sx:{ group: "ginocchio",label: "Ginocchio sinistro" },
  ginocchio_dx:{ group: "ginocchio",label: "Ginocchio destro" },
  tibia_sx:    { group: "tibia",    label: "Tibia sinistra" },
  tibia_dx:    { group: "tibia",    label: "Tibia destra" },
  achille_sx:  { group: "achille",  label: "Tendine d'Achille sinistro" },
  achille_dx:  { group: "achille",  label: "Tendine d'Achille destro" },
  caviglia_sx: { group: "caviglia", label: "Caviglia sinistra" },
  caviglia_dx: { group: "caviglia", label: "Caviglia destra" }
};

const GROUP_LABELS = {
  spalla: "Spalle", gomito: "Gomiti", polso: "Polsi", lombare: "Zona lombare",
  anca: "Anche e glutei", ginocchio: "Ginocchia", tibia: "Tibie", achille: "Tendini d'Achille", caviglia: "Caviglie"
};

const PAIN_TYPES = ["Indolenzimento", "Fitta", "Dolore sordo"];

/* ordine di visualizzazione: tennis, pickleball, padel, running, preparazione atletica */
const SPORTS = { tennis: "Tennis", pickleball: "Pickleball", padel: "Padel", running: "Running", atletica: "Preparazione atletica" };
/* sport con campo (lavagna e mini-campo nei drill) */
const COURT_SPORTS = ["tennis", "pickleball", "padel"];

/* board: coordinate normalizzate sul rettangolo del campo (x 0-1 da sinistra, y 0-1 dall'alto).
   p = giocatore, o = avversario, b = palla. a = frecce [x1,y1,x2,y2,tipo] tipo: "ball" | "move" */
const DRILLS = [
  /* ---------------- TENNIS ---------------- */
  {
    id: "t1", sport: "tennis", title: "Diagonale di dritto profonda", cat: "Fondo campo", level: "Base",
    time: "10-15 min", zones: ["spalla", "gomito", "lombare"],
    tactic: {
      goal: "Tenere lo scambio in diagonale con palle profonde, per spingere l'avversario dietro la linea di fondo e aspettare la palla corta da attaccare.",
      target: "Zona tra la linea del servizio e la linea di fondo, nel quarto di campo in diagonale.",
      steps: [
        "Due giocatori in diagonale sul lato del dritto.",
        "Palleggio continuo solo in diagonale, con margine sopra la rete.",
        "Conta i colpi che rimbalzano oltre la linea del servizio: obiettivo 10 di fila.",
        "Dopo ogni colpo, piccolo recupero verso il centro."
      ]
    },
    tech: {
      chain: [
        "La spinta parte dalle gambe: carica sulla gamba esterna e trasferisci il peso in avanti.",
        "Ruota anche e busto insieme: il braccio segue la rotazione, non la sostituisce.",
        "Impatto davanti al corpo, polso stabile.",
        "Finale del gesto completo e rilassato sopra la spalla opposta."
      ],
      faults: [
        "Colpire con il solo braccio, senza rotazione del busto.",
        "Impatto in ritardo, con la palla dietro il corpo.",
        "Impugnatura troppo stretta per tutto lo scambio."
      ]
    },
    board: { p: [[0.78, 0.97]], o: [[0.22, 0.03]], b: [[0.74, 0.9]],
      a: [[0.74, 0.9, 0.25, 0.18, "ball"], [0.25, 0.1, 0.72, 0.82, "ball"]] }
  },
  {
    id: "t2", sport: "tennis", title: "Split-step e recupero al centro", cat: "Footwork", level: "Base",
    time: "8-10 min", zones: ["ginocchio", "caviglia", "achille"],
    tactic: {
      goal: "Essere pronti a partire in entrambe le direzioni nel momento in cui l'avversario colpisce.",
      target: "Rientro dopo ogni colpo verso il centro della linea di fondo, leggermente spostato verso la probabile risposta.",
      steps: [
        "Il compagno alimenta a destra e a sinistra alternando.",
        "Piccolo saltello (split-step) quando il compagno colpisce la palla.",
        "Spostamento laterale, colpo, recupero con passi incrociati o accostati.",
        "Serie da 6-8 palle, poi pausa."
      ]
    },
    tech: {
      chain: [
        "Atterraggio morbido sull'avampiede, ginocchia leggermente flesse.",
        "Busto dritto e peso distribuito su entrambi i piedi.",
        "Primo passo esplosivo verso la palla, poi passi più corti per sistemarsi.",
        "Ginocchia allineate con le punte dei piedi nei cambi di direzione."
      ],
      faults: [
        "Saltare troppo in alto o troppo tardi.",
        "Atterrare sui talloni a gambe tese.",
        "Ginocchia che cedono verso l'interno nel cambio di direzione."
      ]
    },
    board: { p: [[0.5, 0.97]], o: [[0.5, 0.03]], b: [[0.5, 0.1]],
      a: [[0.5, 0.97, 0.2, 0.9, "move"], [0.2, 0.9, 0.5, 0.97, "move"], [0.5, 0.97, 0.8, 0.9, "move"]] }
  },
  {
    id: "t3", sport: "tennis", title: "Servizio in kick sul rovescio", cat: "Servizio", level: "Intermedio",
    time: "10-15 min", zones: ["spalla", "lombare", "gomito"],
    tactic: {
      goal: "Servire una seconda palla sicura, con rimbalzo alto che porta l'avversario a rispondere di rovescio sopra la spalla.",
      target: "Angolo interno o esterno del rettangolo del servizio, verso il rovescio di chi risponde.",
      steps: [
        "Metti un bersaglio (cono o asciugamano) nell'angolo scelto.",
        "Serie da 10 servizi dal lato destro, poi 10 dal lato sinistro.",
        "Conta quanti entrano e quanti rimbalzano vicino al bersaglio.",
        "Priorità alla sicurezza, non alla velocità."
      ]
    },
    tech: {
      chain: [
        "Lancio leggermente sopra la testa, non troppo dietro.",
        "Piegamento delle gambe e spinta verso l'alto e in avanti.",
        "Rotazione del busto che porta il braccio, spalla rilassata.",
        "Accompagna il gesto fino in fondo, senza fermare il braccio di colpo."
      ],
      faults: [
        "Inarcare molto la schiena per cercare l'effetto.",
        "Lancio troppo dietro la testa.",
        "Forzare l'effetto solo con il polso."
      ]
    },
    board: { p: [[0.55, 1.0]], o: [[0.25, 0.0]], b: [[0.55, 0.98]],
      a: [[0.55, 0.98, 0.32, 0.3, "ball"], [0.32, 0.3, 0.22, 0.08, "ball"]] }
  },
  {
    id: "t4", sport: "tennis", title: "Approccio e volée", cat: "Transizione fondo-rete", level: "Intermedio",
    time: "10-15 min", zones: ["ginocchio", "spalla", "polso"],
    tactic: {
      goal: "Sfruttare una palla corta per attaccare lungo linea e chiudere il punto a rete.",
      target: "Approccio profondo lungo linea, poi volée verso lo spazio libero.",
      steps: [
        "Il compagno alimenta una palla corta a metà campo.",
        "Colpo d'approccio lungo linea e avanzamento verso la rete.",
        "Split-step quando il compagno colpisce il passante.",
        "Volée profonda o angolata nello spazio aperto."
      ]
    },
    tech: {
      chain: [
        "Abbassati con le gambe, non con la schiena, sulle palle basse.",
        "Volée corta: piatto corde davanti al corpo, quasi senza apertura.",
        "Il passo in avanti accompagna la volée.",
        "Polso fermo e impugnatura morbida."
      ],
      faults: [
        "Fermarsi a metà campo nella cosiddetta terra di nessuno.",
        "Aprire troppo la racchetta sulla volée.",
        "Piegare la schiena invece delle ginocchia."
      ]
    },
    board: { p: [[0.8, 0.75]], o: [[0.5, 0.03]], b: [[0.78, 0.7]],
      a: [[0.8, 0.75, 0.75, 0.56, "move"], [0.78, 0.7, 0.82, 0.08, "ball"]] }
  },
  {
    id: "t5", sport: "tennis", title: "Risposta compatta al servizio", cat: "Risposta", level: "Base",
    time: "10 min", zones: ["polso", "gomito"],
    tactic: {
      goal: "Rimettere in gioco il servizio con un colpo corto e controllato, profondo al centro.",
      target: "Zona centrale profonda, verso i piedi di chi ha servito.",
      steps: [
        "Il compagno serve a velocità media.",
        "Risposta con apertura ridotta, cercando il centro del campo.",
        "Serie da 10, poi cambio di lato.",
        "Variante: risposta in diagonale corta."
      ]
    },
    tech: {
      chain: [
        "Split-step quando il battitore colpisce.",
        "Rotazione rapida delle spalle, apertura corta.",
        "Usa la velocità della palla in arrivo, senza strappare.",
        "Polso stabile all'impatto, finale corto."
      ],
      faults: [
        "Apertura ampia contro un servizio veloce.",
        "Colpire con il polso rigido e il braccio teso.",
        "Rispondere fermi sui talloni."
      ]
    },
    board: { p: [[0.82, 1.0]], o: [[0.55, 0.0]], b: [[0.6, 0.72]],
      a: [[0.55, 0.0, 0.7, 0.72, "ball"], [0.8, 0.95, 0.5, 0.06, "ball"]] }
  },
  {
    id: "t6", sport: "tennis", title: "Doppio: incrocio a rete", cat: "Doppio", level: "Intermedio",
    time: "10-15 min", zones: ["caviglia", "ginocchio", "spalla"],
    tactic: {
      goal: "Il giocatore a rete intercetta la risposta in diagonale e chiude al centro o sui piedi dell'avversario a rete.",
      target: "Volée tra i due avversari o sui piedi di chi è a rete.",
      steps: [
        "Il compagno serve, il giocatore a rete parte quando la risposta è già partita.",
        "Spostamento in diagonale verso la rete per intercettare.",
        "Il battitore copre il lato lasciato libero.",
        "Concordate prima un segnale per sapere chi incrocia."
      ]
    },
    tech: {
      chain: [
        "Partenza dopo l'impatto della risposta, non prima.",
        "Passi rapidi e corti, ultimo passo in avanti verso la rete.",
        "Volée davanti al corpo, spalle rivolte verso il bersaglio.",
        "Atterraggio stabile, ginocchia flesse."
      ],
      faults: [
        "Partire troppo presto, scoprendo il corridoio.",
        "Colpire in corsa con il braccio troppo lontano dal corpo.",
        "Cambiare direzione bruscamente sul tallone."
      ]
    },
    board: { p: [[0.7, 0.62], [0.6, 1.0]], o: [[0.3, 0.0], [0.7, 0.35]], b: [[0.5, 0.56]],
      a: [[0.3, 0.02, 0.5, 0.55, "ball"], [0.7, 0.62, 0.52, 0.58, "move"], [0.5, 0.55, 0.5, 0.25, "ball"]] }
  },

  /* ---------------- PICKLEBALL ---------------- */
  {
    id: "p1", sport: "pickleball", title: "Dink in diagonale", cat: "Kitchen (NVZ)", level: "Base",
    time: "10 min", zones: ["lombare", "ginocchio", "polso"],
    tactic: {
      goal: "Mantenere lo scambio basso e lento dalla linea della Kitchen, finché l'avversario alza una palla da attaccare.",
      target: "Dentro la Kitchen avversaria, in diagonale, con la palla che scende dopo la rete.",
      steps: [
        "Due giocatori in diagonale, piedi dietro la linea della Kitchen.",
        "Dink morbidi solo in diagonale, la palla rimbalza nella Kitchen.",
        "Obiettivo: 20 dink di fila senza errori.",
        "Variante: alternate diagonale e centro."
      ]
    },
    tech: {
      chain: [
        "Posizione bassa con le gambe piegate, schiena dritta.",
        "Il movimento parte dalla spalla, gesto corto, polso fermo.",
        "Paletta davanti al corpo, faccia leggermente aperta.",
        "Peso sugli avampiedi, pronto ad aggiustare la posizione."
      ],
      faults: [
        "Piegarsi in avanti con la schiena invece che con le gambe.",
        "Muovere il polso per dare direzione.",
        "Entrare con i piedi nella Kitchen per colpire al volo."
      ]
    },
    board: { p: [[0.75, 0.66]], o: [[0.25, 0.34]], b: [[0.7, 0.6]],
      a: [[0.7, 0.62, 0.3, 0.4, "ball"], [0.3, 0.38, 0.7, 0.58, "ball"]] }
  },
  {
    id: "p2", sport: "pickleball", title: "Terzo colpo smorzato (third shot drop)", cat: "Transizione", level: "Intermedio",
    time: "10-15 min", zones: ["spalla", "polso", "lombare"],
    tactic: {
      goal: "Dal fondo campo, far cadere la palla nella Kitchen avversaria per avere il tempo di avanzare verso la rete.",
      target: "Kitchen avversaria, con un arco che scende dopo la rete.",
      steps: [
        "Un compagno a rete alimenta palle profonde.",
        "Dal fondo, colpo morbido con traiettoria ad arco nella Kitchen.",
        "Dopo il colpo, avanza di qualche passo e fermati (split-step).",
        "Conta quanti drop finiscono nella Kitchen su 10."
      ]
    },
    tech: {
      chain: [
        "Gesto dal basso verso l'alto guidato da gambe e spalla.",
        "Paletta aperta, accompagnamento lento verso il bersaglio.",
        "Corpo fermo all'impatto, poi avanzamento.",
        "Impugnatura morbida per controllare la palla."
      ],
      faults: [
        "Colpire troppo forte, con la palla che resta alta.",
        "Correre in avanti mentre si colpisce.",
        "Usare il polso per sollevare la palla."
      ]
    },
    board: { p: [[0.3, 0.97], [0.75, 0.97]], o: [[0.3, 0.34], [0.7, 0.34]], b: [[0.3, 0.92]],
      a: [[0.3, 0.92, 0.45, 0.4, "ball"], [0.3, 0.97, 0.3, 0.8, "move"], [0.75, 0.97, 0.75, 0.8, "move"]] }
  },
  {
    id: "p3", sport: "pickleball", title: "Reset dalla zona di transizione", cat: "Difesa", level: "Intermedio",
    time: "10 min", zones: ["ginocchio", "lombare", "polso"],
    tactic: {
      goal: "Neutralizzare una palla veloce ai piedi rimettendola morbida nella Kitchen avversaria.",
      target: "Kitchen avversaria, palla bassa sopra la rete.",
      steps: [
        "Un compagno a rete spinge palle sui piedi di chi sta a metà campo.",
        "Chi difende si abbassa e blocca la palla, senza spingerla.",
        "Dopo il reset avanza di un passo, quando possibile.",
        "Serie da 10, poi cambio ruolo."
      ]
    },
    tech: {
      chain: [
        "Gambe larghe e piegate: ti abbassi con le gambe, non con la schiena.",
        "Paletta davanti al corpo, gesto quasi assente (blocco).",
        "Assorbi la velocità della palla con la presa morbida.",
        "Busto stabile e testa ferma all'impatto."
      ],
      faults: [
        "Rispondere con un colpo ampio e veloce.",
        "Restare dritti con le gambe tese.",
        "Presa troppo stretta."
      ]
    },
    board: { p: [[0.5, 0.82]], o: [[0.5, 0.34]], b: [[0.5, 0.78]],
      a: [[0.5, 0.36, 0.5, 0.78, "ball"], [0.5, 0.78, 0.35, 0.4, "ball"]] }
  },
  {
    id: "p4", sport: "pickleball", title: "Risposta profonda e avanzamento", cat: "Servizio e risposta", level: "Base",
    time: "10 min", zones: ["spalla", "caviglia"],
    tactic: {
      goal: "Rispondere profondo al servizio per tenere indietro gli avversari e guadagnare tempo per arrivare alla Kitchen.",
      target: "Ultimi metri del campo avversario, verso il centro.",
      steps: [
        "Il compagno serve dal basso in diagonale.",
        "Dopo il rimbalzo, risposta alta e profonda.",
        "Subito avanzamento verso la linea della Kitchen.",
        "Ricorda: anche la risposta al servizio deve rimbalzare prima di essere colpita."
      ]
    },
    tech: {
      chain: [
        "Aspetta il rimbalzo con il peso in avanti.",
        "Gesto lungo, guidato dalla rotazione del busto.",
        "Primo passo in avanti subito dopo l'impatto.",
        "Fermati in posizione stabile prima del colpo successivo."
      ],
      faults: [
        "Risposta corta che lascia avanzare gli avversari.",
        "Rimanere sulla linea di fondo dopo la risposta.",
        "Arrivare in corsa sotto la rete senza fermarsi."
      ]
    },
    board: { p: [[0.72, 1.0]], o: [[0.28, 0.0]], b: [[0.72, 0.92]],
      a: [[0.28, 0.02, 0.72, 0.85, "ball"], [0.72, 0.92, 0.45, 0.08, "ball"], [0.72, 1.0, 0.7, 0.68, "move"]] }
  },
  {
    id: "p5", sport: "pickleball", title: "Scambi veloci a rete", cat: "Kitchen (NVZ)", level: "Intermedio",
    time: "8-10 min", zones: ["gomito", "polso", "spalla"],
    tactic: {
      goal: "Gestire gli scambi rapidi al volo a rete, mirando alla spalla della mano dominante dell'avversario o ai piedi.",
      target: "Spalla del braccio che tiene la paletta o piedi dell'avversario.",
      steps: [
        "Entrambi alla linea della Kitchen.",
        "Volée rapide e controllate, prima lente poi più veloci.",
        "Chi riceve una palla alta può accelerare, chi riceve una palla bassa la tiene bassa.",
        "Serie da 30 secondi, poi pausa."
      ]
    },
    tech: {
      chain: [
        "Paletta alta davanti al petto, pronta.",
        "Gesto corto: blocca o spingi in avanti, non caricare indietro.",
        "Gomito davanti al corpo, spalla rilassata.",
        "Piedi fermi dietro la linea della Kitchen."
      ],
      faults: [
        "Caricare il colpo dietro la spalla.",
        "Paletta bassa tra un colpo e l'altro.",
        "Cadere in avanti nella Kitchen dopo la volée."
      ]
    },
    board: { p: [[0.4, 0.66], [0.75, 0.66]], o: [[0.3, 0.34], [0.65, 0.34]], b: [[0.5, 0.5]],
      a: [[0.4, 0.64, 0.62, 0.36, "ball"], [0.62, 0.36, 0.45, 0.64, "ball"]] }
  },
  {
    id: "p6", sport: "pickleball", title: "Movimento di coppia a rete", cat: "Doppio", level: "Base",
    time: "10 min", zones: ["caviglia", "ginocchio", "achille"],
    tactic: {
      goal: "Muoversi insieme al compagno come se foste legati da una corda, senza lasciare spazio al centro.",
      target: "Coprire il centro: la palla nel mezzo la prende chi ha il dritto o chi è in diagonale.",
      steps: [
        "Coppia alla linea della Kitchen, palle alimentate a destra e a sinistra.",
        "Quando uno si sposta verso il lato, l'altro scivola verso il centro.",
        "Spostamenti laterali con passi accostati, senza incrociare.",
        "Concordate prima chi prende le palle centrali."
      ]
    },
    tech: {
      chain: [
        "Passi brevi e laterali, peso sugli avampiedi.",
        "Ginocchia flesse e allineate con le punte.",
        "Busto rivolto alla rete durante lo spostamento.",
        "Fermati in equilibrio prima di colpire."
      ],
      faults: [
        "Muoversi da soli, aprendo un buco al centro.",
        "Spostarsi con passi incrociati e lunghi.",
        "Frenare bruscamente sul tallone."
      ]
    },
    board: { p: [[0.3, 0.68], [0.7, 0.68]], o: [[0.3, 0.32], [0.7, 0.32]], b: [[0.12, 0.62]],
      a: [[0.3, 0.68, 0.16, 0.68, "move"], [0.7, 0.68, 0.5, 0.68, "move"]] }
  },
  /* ---------------- PADEL ---------------- */
  {
    id: "pd1", sport: "padel", title: "Bandeja per tenere la rete", cat: "Gioco a rete", level: "Intermedio",
    time: "10-15 min", zones: ["spalla", "gomito", "lombare"],
    tactic: {
      goal: "Rispondere a un pallonetto non troppo profondo senza perdere la posizione a rete, rimettendo la palla lenta e profonda.",
      target: "Angolo di fondo avversario, con la palla che muore vicino alla parete laterale o alla rete metallica.",
      steps: [
        "Coppia a rete, il compagno dal fondo alza pallonetti di media altezza.",
        "Passo indietro laterale, bandeja controllata verso l'angolo.",
        "Subito dopo, recupera la posizione verso la rete.",
        "Serie da 8, poi cambio lato."
      ]
    },
    tech: {
      chain: [
        "Mettiti di profilo presto, con il braccio libero che indica la palla.",
        "Impatto davanti e all'altezza della testa o poco sopra, non dietro.",
        "Il gesto è guidato dalla rotazione del busto, non dal solo braccio.",
        "Accompagnamento morbido in avanti con il peso che si trasferisce sulla gamba anteriore."
      ],
      faults: [
        "Colpire la palla dietro la testa, inarcando la schiena.",
        "Spezzare il polso all'impatto per dare effetto.",
        "Restare fermi frontali invece di girarsi di profilo."
      ]
    },
    board: { p: [[0.3, 0.62], [0.72, 0.64]], o: [[0.3, 0.9], [0.7, 0.9]], b: [[0.72, 0.6]],
      a: [[0.3, 0.12, 0.72, 0.58, "ball"], [0.72, 0.64, 0.74, 0.7, "move"], [0.72, 0.6, 0.12, 0.06, "ball"]] }
  },
  {
    id: "pd2", sport: "padel", title: "Uscita dalla parete di fondo", cat: "Difesa", level: "Base",
    time: "10-15 min", zones: ["ginocchio", "lombare", "caviglia"],
    tactic: {
      goal: "Lasciare che la palla rimbalzi sulla parete di fondo e colpirla quando torna verso di te, rimettendola in gioco con calma.",
      target: "Colpo basso al centro o pallonetto profondo, a seconda della posizione degli avversari.",
      steps: [
        "Il compagno lancia o colpisce palle che arrivano alla parete di fondo.",
        "Accompagna la palla con passi laterali, senza correre contro il vetro.",
        "Colpisci dopo il rimbalzo sul vetro, davanti al corpo.",
        "Alterna dritto e rovescio, serie da 8."
      ]
    },
    tech: {
      chain: [
        "Gambe piegate e baricentro basso mentre aspetti la palla.",
        "Mantieni una distanza di sicurezza dal vetro, circa un passo e mezzo.",
        "Colpo corto e controllato, spinto dalle gambe.",
        "Recupera subito la posizione centrale."
      ],
      faults: [
        "Stare troppo vicini al vetro e restare schiacciati.",
        "Abbassarsi con la schiena invece che con le ginocchia.",
        "Colpire con fretta prima che la palla torni dalla parete."
      ]
    },
    board: { p: [[0.3, 0.92], [0.7, 0.88]], o: [[0.3, 0.38], [0.7, 0.38]], b: [[0.62, 0.98]],
      a: [[0.6, 0.4, 0.62, 0.98, "ball"], [0.62, 0.98, 0.64, 0.88, "ball"], [0.64, 0.88, 0.45, 0.3, "ball"]] }
  },
  {
    id: "pd3", sport: "padel", title: "Pallonetto per riconquistare la rete", cat: "Transizione", level: "Base",
    time: "10 min", zones: ["spalla", "polso"],
    tactic: {
      goal: "Mandare gli avversari indietro con un pallonetto alto e profondo e avanzare insieme verso la rete.",
      target: "Sopra la testa degli avversari, verso gli angoli di fondo campo.",
      steps: [
        "Coppia a fondo campo, avversari a rete che giocano volée.",
        "Pallonetto alto, preferibilmente sopra il rovescio avversario.",
        "Mentre la palla scavalca gli avversari, avanzate insieme verso la rete.",
        "Conta quanti pallonetti costringono gli avversari a girarsi."
      ]
    },
    tech: {
      chain: [
        "Racchetta aperta e gesto dal basso verso l'alto.",
        "Le gambe danno la spinta, il braccio accompagna.",
        "Finale alto e completo verso il bersaglio.",
        "Polso stabile per tutto il gesto."
      ],
      faults: [
        "Pallonetto corto che finisce sullo smash avversario.",
        "Restare fermi a guardare la palla invece di avanzare.",
        "Usare solo il polso per alzare la palla."
      ]
    },
    board: { p: [[0.3, 0.9], [0.7, 0.9]], o: [[0.3, 0.38], [0.7, 0.38]], b: [[0.3, 0.86]],
      a: [[0.3, 0.86, 0.6, 0.06, "ball"], [0.3, 0.9, 0.3, 0.66, "move"], [0.7, 0.9, 0.7, 0.66, "move"]] }
  },
  {
    id: "pd4", sport: "padel", title: "Volée profonda al centro", cat: "Gioco a rete", level: "Base",
    time: "10 min", zones: ["gomito", "polso", "spalla"],
    tactic: {
      goal: "Tenere gli avversari lontani dalla rete con volée profonde e senza rischi, aspettando la palla facile.",
      target: "Centro del campo avversario o sui piedi di chi è più lontano dalla rete.",
      steps: [
        "Coppia a rete, il compagno dal fondo colpisce palle medie.",
        "Volée profonda al centro, tra i due avversari.",
        "Dopo ogni volée, split-step e posizione pronta.",
        "Serie da 10, poi alterna volée di dritto e di rovescio."
      ]
    },
    tech: {
      chain: [
        "Racchetta alta davanti al corpo, gesto corto.",
        "Impatto davanti, il passo in avanti accompagna il colpo.",
        "Spalla e gomito rilassati, polso fermo.",
        "Ginocchia flesse per le palle basse."
      ],
      faults: [
        "Aprire troppo indietro la racchetta.",
        "Colpire con il braccio teso e lontano dal corpo.",
        "Cercare l'angolo stretto con troppo rischio."
      ]
    },
    board: { p: [[0.3, 0.62], [0.7, 0.62]], o: [[0.3, 0.1], [0.7, 0.1]], b: [[0.32, 0.58]],
      a: [[0.7, 0.12, 0.32, 0.58, "ball"], [0.32, 0.58, 0.5, 0.1, "ball"]] }
  },
  {
    id: "pd5", sport: "padel", title: "Vibora sull'angolo", cat: "Gioco a rete", level: "Intermedio",
    time: "10-15 min", zones: ["spalla", "gomito", "polso", "lombare"],
    tactic: {
      goal: "Colpire un pallonetto con effetto laterale, più aggressivo della bandeja, per mettere in difficoltà l'avversario vicino alla parete laterale.",
      target: "Angolo tra parete di fondo e parete laterale avversaria.",
      steps: [
        "Il compagno alza pallonetti sul lato del dritto.",
        "Vibora verso l'angolo opposto, cercando il rimbalzo sulla parete laterale.",
        "Recupera subito la posizione a rete.",
        "Serie da 6-8, poi pausa: è un colpo impegnativo per la spalla."
      ]
    },
    tech: {
      chain: [
        "Di profilo, preparazione alta con il gomito all'altezza della spalla.",
        "Impatto di lato e davanti al corpo, mai dietro la testa.",
        "L'effetto nasce dalla rotazione del busto e dalla traiettoria della racchetta.",
        "Accompagnamento verso il basso e di lato, senza fermare il braccio di colpo."
      ],
      faults: [
        "Forzare l'effetto con un colpo secco del polso.",
        "Colpire con il gomito sotto la spalla.",
        "Ripetere troppi colpi senza pause."
      ]
    },
    board: { p: [[0.72, 0.62], [0.3, 0.64]], o: [[0.3, 0.9], [0.7, 0.9]], b: [[0.74, 0.58]],
      a: [[0.3, 0.88, 0.74, 0.58, "ball"], [0.74, 0.58, 0.04, 0.06, "ball"]] }
  },
  {
    id: "pd6", sport: "padel", title: "Coppia: avanti e indietro insieme", cat: "Coppia", level: "Base",
    time: "10 min", zones: ["caviglia", "ginocchio", "achille"],
    tactic: {
      goal: "Muoversi in coppia alla stessa altezza: si sale insieme verso la rete e si arretra insieme sul pallonetto.",
      target: "Mantenere la coppia allineata, senza buchi al centro né in diagonale.",
      steps: [
        "Il compagno alterna palle corte e pallonetti.",
        "Sulla palla corta la coppia sale verso la rete.",
        "Sul pallonetto chi è sul lato della palla arretra, l'altro lo segue.",
        "Usate parole brevi per comunicare: \"mia\", \"tua\", \"giù\"."
      ]
    },
    tech: {
      chain: [
        "Passi laterali e indietro brevi, mai di spalle alla palla.",
        "Peso sugli avampiedi, ginocchia morbide.",
        "Fermati in equilibrio prima di colpire.",
        "Split-step quando l'avversario colpisce."
      ],
      faults: [
        "Un giocatore a rete e uno a fondo, con la diagonale scoperta.",
        "Arretrare correndo all'indietro di schiena.",
        "Frenate brusche sul tallone sull'erba sintetica."
      ]
    },
    board: { p: [[0.3, 0.66], [0.7, 0.66]], o: [[0.3, 0.38], [0.7, 0.38]], b: [[0.5, 0.2]],
      a: [[0.3, 0.66, 0.3, 0.86, "move"], [0.7, 0.66, 0.7, 0.86, "move"], [0.5, 0.38, 0.5, 0.9, "ball"]] }
  }
  ,
  /* ---------------- RUNNING (niente campo: board assente) ---------------- */
  {
    id: "ru1", sport: "running", title: "Cadenza con metronomo", cat: "Tecnica di corsa", level: "Base",
    time: "15-20 min", zones: ["ginocchio", "tibia", "anca"],
    tactic: {
      goal: "Abituarsi a passi un po' più corti e frequenti a parità di velocità, per alleggerire ogni appoggio.",
      target: "La tua cadenza abituale più un piccolo aumento (circa 5%), sempre a ritmo facile.",
      steps: [
        "Corri 3 minuti a ritmo facile e conta i passi in 30 secondi: moltiplica per 2 e hai i passi al minuto (SPM).",
        "Imposta il metronomo del calcolatore qui sopra a circa il 5% in più.",
        "4-6 blocchi da 2 minuti seguendo il bip, con 2 minuti di corsa libera tra un blocco e l'altro.",
        "La velocità resta la stessa: cambiano solo lunghezza e frequenza del passo."
      ]
    },
    tech: {
      chain: [
        "Il piede appoggia sotto il corpo, non molto davanti.",
        "Busto alto, leggera inclinazione in avanti che parte dalle caviglie.",
        "Braccia piegate a circa 90° che oscillano avanti e indietro.",
        "Contatto con il terreno breve ed elastico."
      ],
      faults: [
        "Allungare il passo atterrando con il tallone molto avanti (overstriding).",
        "Aumentare la cadenza tutta in una volta invece che a piccoli passi.",
        "Spalle contratte e braccia che incrociano davanti al petto."
      ]
    }
  },
  {
    id: "ru2", sport: "running", title: "Frazionati brevi (ripetute)", cat: "Frazionati", level: "Intermedio",
    time: "30-40 min", zones: ["achille", "tibia", "ginocchio"],
    tactic: {
      goal: "Alternare tratti veloci e recuperi per migliorare la velocità senza accumulare troppa fatica.",
      target: "Ritmo costante su tutte le ripetute: l'ultima deve essere simile alla prima.",
      steps: [
        "15 minuti di riscaldamento a ritmo facile, più qualche andatura tecnica.",
        "6-8 ripetute da 400 m (o 90 secondi) a ritmo sostenuto ma controllato.",
        "Recupero di 90 secondi-2 minuti camminando o corricchiando.",
        "10 minuti di defaticamento facile."
      ]
    },
    tech: {
      chain: [
        "Aumenta la velocità con la frequenza del passo, non allungando la falcata.",
        "Spinta dall'anca, ginocchio che avanza, piede che ricade sotto il corpo.",
        "Braccia più attive ma spalle rilassate.",
        "Sguardo avanti, testa ferma."
      ],
      faults: [
        "Partire troppo forte nella prima ripetuta.",
        "Accorciare i recuperi quando si è già stanchi.",
        "Fare sempre le ripetute su superfici dure senza alternare."
      ]
    }
  },
  {
    id: "ru3", sport: "running", title: "Corsa a soglia", cat: "Soglia", level: "Intermedio",
    time: "30-45 min", zones: ["anca", "ginocchio", "achille"],
    tactic: {
      goal: "Allenare il ritmo che si riesce a tenere a lungo con uno sforzo «comodamente impegnativo».",
      target: "Sforzo intorno a RPE 7: riesci a dire poche parole, non a chiacchierare.",
      steps: [
        "15 minuti di riscaldamento facile.",
        "2 blocchi da 10 minuti a soglia con 3 minuti facili in mezzo.",
        "Quando ti senti pronto, passa a 20 minuti continui.",
        "10 minuti di defaticamento facile."
      ]
    },
    tech: {
      chain: [
        "Respirazione regolare e ritmica.",
        "Passo costante: usa il calcolatore per fissare il passo al km.",
        "Bacino stabile, senza ondeggiare di lato.",
        "Appoggi silenziosi e leggeri."
      ],
      faults: [
        "Trasformare la soglia in una gara.",
        "Correre a soglia tutti i giorni senza giorni facili.",
        "Ignorare un fastidio che aumenta durante il blocco."
      ]
    }
  },
  {
    id: "ru4", sport: "running", title: "Salite brevi e discese controllate", cat: "Cambi di pendenza", level: "Intermedio",
    time: "25-35 min", zones: ["achille", "tibia", "anca"],
    tactic: {
      goal: "Rinforzare gambe e spinta con la salita e imparare a scendere senza frenare di colpo.",
      target: "Salita moderata di 60-100 m, sforzo sostenuto ma tecnica pulita.",
      steps: [
        "Riscaldamento di 15 minuti in piano.",
        "6-10 salite con passi corti, busto leggermente in avanti, braccia attive.",
        "Rientro in discesa camminando o corricchiando con passi corti e morbidi.",
        "Aumenta il numero di salite solo di settimana in settimana."
      ]
    },
    tech: {
      chain: [
        "In salita l'inclinazione parte dalle caviglie, non dalla vita.",
        "Spinta completa della gamba d'appoggio.",
        "In discesa passi corti e frequenti, piede sotto il corpo.",
        "Ginocchia morbide in atterraggio."
      ],
      faults: [
        "Piegarsi in avanti dalla vita.",
        "Discese veloci a passi lunghi che caricano ginocchia e tibie.",
        "Aggiungere troppe salite tutte insieme."
      ]
    }
  },
  {
    id: "ru5", sport: "running", title: "Progressivo con pacing strutturato", cat: "Pacing", level: "Base",
    time: "30-40 min", zones: ["ginocchio", "anca"],
    tactic: {
      goal: "Imparare a gestire il ritmo e chiudere più veloci di come si è partiti.",
      target: "Tre parti uguali: facile, media, un po' più veloce (negative split).",
      steps: [
        "Dividi la corsa in tre parti uguali.",
        "Primo terzo facile, secondo terzo a ritmo medio, ultimo terzo un po' più veloce.",
        "Fissa con il calcolatore il passo al km di ciascuna parte.",
        "Annota a fine corsa durata e RPE nel check-in."
      ]
    },
    tech: {
      chain: [
        "Accelera aumentando prima la cadenza.",
        "Mantieni la stessa postura in tutte e tre le parti.",
        "Respirazione che sale gradualmente.",
        "Rilassa viso e spalle quando aumenti il ritmo."
      ],
      faults: [
        "Partire troppo veloci e rallentare nel finale.",
        "Guardare solo l'orologio e non le sensazioni.",
        "Saltare il defaticamento."
      ]
    }
  },
  {
    id: "ru6", sport: "running", title: "Andature tecniche e allunghi", cat: "Tecnica di corsa", level: "Base",
    time: "10-15 min", zones: ["achille", "caviglia", "anca"],
    tactic: {
      goal: "Migliorare coordinazione, appoggio e reattività del piede.",
      target: "Gesti puliti e leggeri, non veloci.",
      steps: [
        "Skip basso e skip alto, 2 x 20 m ciascuno.",
        "Calciata dietro, 2 x 20 m.",
        "Corsa balzata leggera, 2 x 20 m.",
        "4 allunghi da 60-80 m in progressione, con recupero completo camminando."
      ]
    },
    tech: {
      chain: [
        "Appoggio sull'avampiede, tallone che sfiora il terreno.",
        "Busto alto, bacino stabile.",
        "Braccia coordinate con le gambe.",
        "Ritmo prima della forza."
      ],
      faults: [
        "Fare le andature da freddo.",
        "Inclinarsi indietro con il busto.",
        "Appoggi rumorosi e pesanti."
      ]
    }
  },
  /* ---------------- PREPARAZIONE ATLETICA GENERALE ---------------- */
  {
    id: "at1", sport: "atletica", title: "Schemi motori di base", cat: "Schemi motori", level: "Base",
    time: "15-20 min", zones: ["ginocchio", "lombare", "spalla"],
    tactic: {
      goal: "Costruire i movimenti fondamentali su cui si appoggiano tutti gli sport: piegarsi, spingere, tirare, affondare, trasportare.",
      target: "Gesto controllato su tutta l'ampiezza, prima della quantità e del carico.",
      steps: [
        "Squat a corpo libero, 2 x 10.",
        "Piegamento in avanti a schiena neutra con un bastone lungo la schiena, 2 x 10.",
        "Affondo indietro alternato, 2 x 8 per gamba.",
        "Piegamenti (anche sulle ginocchia) e rematore con elastico, 2 x 10 ciascuno."
      ]
    },
    tech: {
      chain: [
        "Schiena neutra in tutti gli esercizi.",
        "Ginocchia allineate con le punte dei piedi.",
        "Movimento lento in discesa e deciso in salita.",
        "Respirazione regolare, senza trattenere il fiato."
      ],
      faults: [
        "Ginocchia che cadono verso l'interno nello squat.",
        "Schiena arrotondata nel piegamento in avanti.",
        "Aumentare i carichi prima di aver consolidato il gesto."
      ]
    }
  },
  {
    id: "at2", sport: "atletica", title: "Scaletta di agilità", cat: "Footwork", level: "Base",
    time: "10 min", zones: ["caviglia", "achille", "ginocchio"],
    tactic: {
      goal: "Migliorare rapidità e precisione dei piedi.",
      target: "Appoggi precisi dentro i quadrati, senza guardare troppo in basso.",
      steps: [
        "Un piede per quadrato, poi due piedi per quadrato.",
        "Laterale dentro-dentro-fuori.",
        "Salti a piedi pari, poi su un piede solo se ben controllati.",
        "3-4 passaggi per esercizio, recupero completo."
      ]
    },
    tech: {
      chain: [
        "Sugli avampiedi, ginocchia leggermente flesse.",
        "Braccia che accompagnano il ritmo.",
        "Busto stabile sopra i piedi.",
        "Precisione prima della velocità."
      ],
      faults: [
        "Correre sui talloni.",
        "Accelerare perdendo la precisione degli appoggi.",
        "Busto che oscilla molto."
      ]
    }
  },
  {
    id: "at3", sport: "atletica", title: "Coni: cambi di direzione e decelerazione controllata", cat: "Decelerazione", level: "Intermedio",
    time: "10-15 min", zones: ["ginocchio", "caviglia", "achille"],
    tactic: {
      goal: "Imparare a frenare e ripartire in sicurezza, il momento in cui ginocchia e caviglie sono più sollecitate.",
      target: "Frenata in più passi corti, poi ripartenza nella nuova direzione.",
      steps: [
        "Due coni a 5 m: corsa, frenata controllata in 3 passi, ritorno.",
        "Quattro coni a quadrato: spostamento avanti, laterale, indietro.",
        "Cambio di direzione a 45° e poi a 90°.",
        "4-6 ripetizioni per esercizio, recupero completo."
      ]
    },
    tech: {
      chain: [
        "Abbassa il baricentro piegando anche e ginocchia mentre freni.",
        "Ginocchio allineato al piede nella frenata.",
        "Busto sopra il piede d'appoggio.",
        "Spinta di ripartenza dal piede esterno."
      ],
      faults: [
        "Frenare con un solo appoggio a gamba tesa.",
        "Ginocchio che cede verso l'interno.",
        "Busto che si inclina troppo all'indietro."
      ]
    }
  },
  {
    id: "at4", sport: "atletica", title: "Reattività su segnale", cat: "Reattività", level: "Base",
    time: "10 min", zones: ["caviglia", "ginocchio"],
    tactic: {
      goal: "Ridurre il tempo di reazione e il primo passo.",
      target: "Partenza immediata al segnale nella direzione indicata.",
      steps: [
        "Un compagno indica una direzione (voce, mano o colore del cono).",
        "Partenza e sprint di 3-5 m, poi frenata controllata.",
        "Partenze da posizioni diverse: in piedi, seduto, di spalle.",
        "Serie brevi, recupero completo tra le partenze."
      ]
    },
    tech: {
      chain: [
        "Posizione pronta: piedi larghi, ginocchia flesse, peso sugli avampiedi.",
        "Primo passo corto ed esplosivo.",
        "Braccia che spingono avanti e indietro.",
        "Frenata in più appoggi."
      ],
      faults: [
        "Partire con un passo lungo e lento.",
        "Anticipare il segnale.",
        "Fare troppe ripetizioni senza recupero."
      ]
    }
  },
  {
    id: "at5", sport: "atletica", title: "Catena cinetica: lancio rotazionale", cat: "Catene cinetiche", level: "Intermedio",
    time: "10 min", zones: ["lombare", "spalla"],
    tactic: {
      goal: "Sentire come la forza passa dai piedi alle anche, al busto e alle braccia, come nei colpi da racchetta.",
      target: "Lancio di una palla medica leggera contro un muro, di lato.",
      steps: [
        "Di fianco al muro, palla all'altezza del petto.",
        "Carica ruotando anche e busto lontano dal muro.",
        "Lancia ruotando prima le anche, poi il busto, infine le braccia.",
        "2-3 serie da 6-8 lanci per lato."
      ]
    },
    tech: {
      chain: [
        "La spinta parte dal piede dietro.",
        "Le anche ruotano prima delle spalle.",
        "Braccia che finiscono il movimento, non lo iniziano.",
        "Schiena neutra durante tutta la rotazione."
      ],
      faults: [
        "Lanciare solo con le braccia.",
        "Usare una palla troppo pesante.",
        "Ruotare piegando la schiena."
      ]
    }
  },
  {
    id: "at6", sport: "atletica", title: "Stabilità di caviglia ed equilibrio", cat: "Prevenzione", level: "Base",
    time: "8-10 min", zones: ["caviglia", "ginocchio"],
    tactic: {
      goal: "Migliorare il controllo della caviglia e del ginocchio su un piede solo.",
      target: "Equilibrio stabile senza che il ginocchio ceda verso l'interno.",
      steps: [
        "Equilibrio su un piede, 3 x 30 secondi per lato.",
        "Su un piede, tocca con l'altro piede avanti, di lato e dietro.",
        "Piccoli saltelli da un piede all'altro con atterraggio fermo.",
        "Progressione: occhi chiusi o superficie morbida, solo se sicuri."
      ]
    },
    tech: {
      chain: [
        "Piede ben appoggiato: tallone, base dell'alluce e del mignolo.",
        "Ginocchio morbido e allineato al piede.",
        "Bacino orizzontale.",
        "Sguardo avanti."
      ],
      faults: [
        "Ginocchio rigido e bloccato.",
        "Bacino che cade da un lato.",
        "Progredire troppo in fretta."
      ]
    }
  }

];

/* Routine di mobilità e riscaldamento generali. zones = gruppi a cui la routine è collegata */
const ROUTINES = [
  {
    id: "r1", title: "Riscaldamento dinamico pre-partita", zones: [], kind: "Riscaldamento",
    steps: [
      { n: "Corsa leggera sul posto", s: 60, d: "Ritmo tranquillo, braccia sciolte." },
      { n: "Saltelli leggeri", s: 40, d: "Sugli avampiedi, ginocchia morbide." },
      { n: "Circonduzioni delle braccia", s: 40, d: "Avanti e indietro, cerchi ampi e lenti." },
      { n: "Rotazioni del busto", s: 40, d: "Piedi alla larghezza delle spalle, ruota lentamente a destra e a sinistra." },
      { n: "Affondi in camminata", s: 45, d: "Passi ampi e controllati, busto dritto." },
      { n: "Passi laterali e split-step", s: 45, d: "Spostati di lato e fai un piccolo saltello a ogni cambio." },
      { n: "Colpi a vuoto lenti", s: 60, d: "Dritto, rovescio e servizio senza palla, a velocità crescente." }
    ]
  },
  {
    id: "r2", title: "Mobilità spalle e dorso", zones: ["spalla"], kind: "Mobilità",
    steps: [
      { n: "Circonduzioni lente delle spalle", s: 40, d: "Spalle verso le orecchie e poi indietro, senza forzare." },
      { n: "Apertura del libro, lato sinistro", s: 45, d: "Sdraiato sul fianco, ginocchia piegate: apri il braccio sopra e ruota il busto." },
      { n: "Apertura del libro, lato destro", s: 45, d: "Stesso movimento sull'altro fianco." },
      { n: "Scivolamenti al muro", s: 45, d: "Schiena al muro, braccia a W: sali lentamente verso una Y." },
      { n: "Allungamento braccio incrociato, sinistro", s: 30, d: "Porta il braccio davanti al petto e accompagnalo con l'altra mano." },
      { n: "Allungamento braccio incrociato, destro", s: 30, d: "Stesso allungamento con l'altro braccio." },
      { n: "Respirazione profonda", s: 40, d: "In piedi, inspira dal naso ed espira lentamente." }
    ]
  },
  {
    id: "r3", title: "Avambraccio, gomito e polso", zones: ["gomito", "polso"], kind: "Mobilità",
    steps: [
      { n: "Circonduzioni dei polsi", s: 30, d: "Cerchi lenti in entrambi i sensi." },
      { n: "Apri e chiudi le mani", s: 30, d: "Apri bene le dita e chiudi il pugno senza stringere." },
      { n: "Allungamento flessori, braccio sinistro", s: 30, d: "Braccio teso, palmo in avanti, tira dolcemente le dita indietro." },
      { n: "Allungamento flessori, braccio destro", s: 30, d: "Stesso allungamento sull'altro braccio." },
      { n: "Allungamento estensori, braccio sinistro", s: 30, d: "Braccio teso, palmo verso di te, piega dolcemente il polso." },
      { n: "Allungamento estensori, braccio destro", s: 30, d: "Stesso allungamento sull'altro braccio." },
      { n: "Rotazioni dell'avambraccio", s: 40, d: "Gomito piegato vicino al fianco, ruota il palmo su e giù lentamente." }
    ]
  },
  {
    id: "r4", title: "Schiena e anche", zones: ["lombare"], kind: "Mobilità",
    steps: [
      { n: "Gatto e mucca", s: 45, d: "A quattro zampe, alterna schiena tonda e schiena incavata, lentamente." },
      { n: "Ginocchia al petto", s: 40, d: "Sdraiato sulla schiena, porta le ginocchia verso il petto e dondola piano." },
      { n: "Rotazioni con ginocchia piegate", s: 45, d: "Sdraiato, ginocchia unite: lasciale cadere piano a destra e a sinistra." },
      { n: "Ponte per i glutei", s: 45, d: "Solleva il bacino stringendo i glutei, scendi lentamente." },
      { n: "Allungamento flessori anca, sinistro", s: 30, d: "In affondo con il ginocchio a terra, spingi dolcemente il bacino in avanti." },
      { n: "Allungamento flessori anca, destro", s: 30, d: "Stesso allungamento sull'altra gamba." },
      { n: "Posizione del bambino", s: 40, d: "Seduto sui talloni, braccia avanti, respira lentamente." }
    ]
  },
  {
    id: "r5", title: "Ginocchia e gambe", zones: ["ginocchio"], kind: "Mobilità",
    steps: [
      { n: "Pedalata da sdraiato", s: 40, d: "Sdraiato sulla schiena, pedala lentamente in aria." },
      { n: "Allungamento quadricipite, sinistro", s: 30, d: "In piedi con appoggio, porta il tallone verso il gluteo." },
      { n: "Allungamento quadricipite, destro", s: 30, d: "Stesso allungamento sull'altra gamba." },
      { n: "Allungamento femorali", s: 40, d: "Gamba tesa su un rialzo basso, busto dritto, inclinati leggermente." },
      { n: "Mini piegamenti lenti", s: 45, d: "Piegamenti parziali, ginocchia allineate con le punte, solo se senza dolore." },
      { n: "Ponte per i glutei", s: 40, d: "Solleva e abbassa lentamente il bacino." }
    ]
  },
  {
    id: "r6", title: "Polpacci, tendini d'Achille e caviglie", zones: ["achille", "caviglia"], kind: "Mobilità",
    steps: [
      { n: "Circonduzioni delle caviglie", s: 40, d: "Seduto o in piedi con appoggio, cerchi lenti in entrambi i sensi." },
      { n: "Polpaccio al muro, gamba tesa sinistra", s: 30, d: "Mani al muro, gamba dietro tesa, tallone a terra." },
      { n: "Polpaccio al muro, gamba tesa destra", s: 30, d: "Stesso allungamento sull'altra gamba." },
      { n: "Polpaccio al muro, ginocchio piegato", s: 40, d: "Come prima ma con il ginocchio dietro leggermente piegato, alterna le gambe." },
      { n: "Sollevamenti sui talloni lenti", s: 40, d: "Sali e scendi lentamente sugli avampiedi, con appoggio." },
      { n: "Equilibrio su un piede", s: 40, d: "20 secondi per piede, vicino a un appoggio." }
    ]
  },
  {
    id: "r7", title: "Defaticamento post-partita", zones: [], kind: "Defaticamento",
    steps: [
      { n: "Camminata tranquilla", s: 60, d: "Lascia scendere il ritmo del respiro." },
      { n: "Allungamento polpacci", s: 40, d: "Al muro o alla rete, alterna le gambe." },
      { n: "Allungamento quadricipiti", s: 40, d: "Tallone verso il gluteo, alterna le gambe." },
      { n: "Allungamento spalle", s: 40, d: "Braccio incrociato davanti al petto, alterna." },
      { n: "Allungamento avambracci", s: 40, d: "Flessori ed estensori del polso, senza forzare." },
      { n: "Respirazione profonda", s: 40, d: "Inspira in 4 tempi, espira in 6 tempi." }
    ]
  }
  ,
  {
    id: "r8", title: "Anche, glutei e bandelletta (runner)", zones: ["anca"], kind: "Mobilità e rinforzo",
    steps: [
      { n: "Ponte per i glutei", s: 45, d: "Solleva il bacino stringendo i glutei, scendi lentamente." },
      { n: "Conchiglia, lato sinistro", s: 40, d: "Sdraiato sul fianco, ginocchia piegate: apri il ginocchio sopra senza ruotare il bacino." },
      { n: "Conchiglia, lato destro", s: 40, d: "Stesso esercizio sull'altro fianco." },
      { n: "Allungamento flessori anca (psoas), sinistro", s: 30, d: "In affondo con il ginocchio a terra, spingi dolcemente il bacino in avanti." },
      { n: "Allungamento flessori anca (psoas), destro", s: 30, d: "Stesso allungamento sull'altra gamba." },
      { n: "Allungamento laterale dell'anca", s: 40, d: "In piedi, incrocia una gamba dietro l'altra e inclina il busto dal lato opposto; alterna." },
      { n: "Camminata laterale lenta", s: 45, d: "Ginocchia leggermente piegate, piccoli passi laterali, bacino fermo." }
    ]
  },
  {
    id: "r9", title: "Tibie, polpacci e piede (runner)", zones: ["tibia"], kind: "Mobilità e rinforzo",
    steps: [
      { n: "Circonduzioni delle caviglie", s: 40, d: "Cerchi lenti in entrambi i sensi." },
      { n: "Camminata sui talloni", s: 30, d: "Punte sollevate, piccoli passi, senza forzare." },
      { n: "Sollevamenti sui talloni lenti", s: 45, d: "Sali e scendi lentamente sugli avampiedi, con appoggio." },
      { n: "Polpaccio al muro, gamba tesa", s: 40, d: "Mani al muro, gamba dietro tesa, tallone a terra; alterna." },
      { n: "Raccogli l'asciugamano con le dita", s: 40, d: "Seduto, avvicina un asciugamano con le dita dei piedi; alterna." },
      { n: "Equilibrio su un piede", s: 40, d: "20 secondi per piede, vicino a un appoggio." }
    ]
  },
  {
    id: "r10", title: "Settimana di scarico (periodizzazione)", zones: [], kind: "Scarico programmato",
    steps: [
      { n: "Riduci il volume", s: 30, d: "Questa settimana allenati circa un terzo in meno del solito, mantenendo la tecnica." },
      { n: "Mobilità generale", s: 60, d: "Gatto e mucca, apertura del libro, rotazioni con ginocchia piegate." },
      { n: "Ponte per i glutei", s: 45, d: "Lento e controllato." },
      { n: "Equilibrio su un piede", s: 40, d: "20 secondi per piede." },
      { n: "Respirazione profonda", s: 40, d: "Inspira in 4 tempi, espira in 6 tempi." }
    ]
  }

];

/* ================= VIDEO DEL COLPO =================
   Colpi selezionabili per sport, con la checklist del gesto (spunte fatte dall'utente).
   Sono indicazioni tecniche generiche e diffuse, non valori misurati.
   kind = famiglia di regole usata dall'analisi automatica (vedi VIDEO_RULES)
   view = inquadratura richiesta per l'analisi: "side" laterale, "front" frontale */
const VIDEO_SHOTS = {
  tennis: [
    { id: "serve", label: "Servizio", kind: "overhead", view: "side", rules: { elbowImpactMin: 140 }, checklist: [
      "Lancio di palla davanti e leggermente sopra la testa",
      "Piegamento delle gambe prima della spinta",
      "Busto che ruota e porta il braccio",
      "Impatto in alto con il braccio quasi disteso",
      "Accompagnamento completo, senza fermare il braccio" ] },
    { id: "forehand", label: "Dritto", kind: "ground", view: "side", checklist: [
      "Split-step quando l'avversario colpisce",
      "Preparazione anticipata con rotazione delle spalle",
      "Gambe piegate e peso che va in avanti",
      "Impatto davanti al corpo, polso stabile",
      "Finale sopra la spalla opposta" ] },
    { id: "backhand", label: "Rovescio", kind: "ground", view: "side", checklist: [
      "Rotazione delle spalle in preparazione",
      "Appoggio stabile, ginocchia piegate",
      "Impatto davanti al corpo",
      "Polso fermo, nessuna «frustata» di polso",
      "Finale completo e rilassato" ] }
  ],
  pickleball: [
    { id: "third", label: "Terzo colpo smorzato", kind: "soft", view: "side", checklist: [
      "Paletta pronta davanti al corpo",
      "Si scende con le gambe, non con la schiena",
      "Movimento corto dalla spalla, polso fermo",
      "Traiettoria morbida che scende nella Kitchen",
      "Avanzamento verso la rete dopo il colpo" ] },
    { id: "dink", label: "Dink", kind: "soft", view: "side", checklist: [
      "Ginocchia piegate, baricentro basso",
      "Paletta davanti, testa della paletta alta",
      "Gesto corto guidato dalla spalla",
      "Busto stabile, senza piegarsi in avanti",
      "Recupero della posizione pronta" ] },
    { id: "serve", label: "Servizio dal basso", kind: "underhand", view: "side", checklist: [
      "Impatto sotto l'altezza della vita",
      "Movimento del braccio dal basso verso l'alto",
      "Peso che passa dal piede dietro a quello avanti",
      "Busto stabile",
      "Accompagnamento verso il bersaglio" ] }
  ],
  padel: [
    { id: "bandeja", label: "Bandeja", kind: "overhead", view: "side", rules: { elbowImpactMin: 110 }, checklist: [
      "Posizione di profilo, passi di aggiustamento",
      "Braccio libero che accompagna e indica la palla",
      "Impatto davanti al corpo, sopra la spalla",
      "Gesto controllato, senza forzare la potenza",
      "Rientro verso la rete dopo il colpo" ] },
    { id: "vibora", label: "Víbora", kind: "overhead", view: "side", rules: { elbowImpactMin: 110 }, checklist: [
      "Preparazione di profilo, come per la bandeja",
      "Impatto più laterale, davanti al corpo",
      "Rotazione del busto che porta il braccio",
      "Polso che non forza l'effetto da solo",
      "Recupero dell'equilibrio dopo il colpo" ] },
    { id: "volley", label: "Volée", kind: "volley", view: "side", checklist: [
      "Racchetta alta davanti al corpo",
      "Gesto corto, senza caricare all'indietro",
      "Impatto davanti, polso fermo",
      "Passo in avanti con il piede opposto",
      "Ritorno subito in posizione pronta" ] }
  ],
  running: [
    { id: "side", label: "Corsa, vista laterale", kind: "run_side", view: "side", checklist: [
      "Piede che appoggia sotto il corpo, non molto davanti",
      "Busto alto, leggera inclinazione dalle caviglie",
      "Braccia piegate che oscillano avanti e indietro",
      "Appoggi leggeri e silenziosi",
      "Testa ferma, sguardo avanti" ] },
    { id: "front", label: "Corsa, vista frontale", kind: "run_front", view: "front", checklist: [
      "Ginocchia allineate con i piedi, senza cadere verso l'interno",
      "Bacino stabile, senza abbassarsi da un lato",
      "Braccia che non incrociano davanti al petto",
      "Piedi che non si incrociano sulla linea centrale",
      "Spalle rilassate e allo stesso livello" ] }
  ],
  atletica: [
    { id: "squat", label: "Squat", kind: "squat", view: "side", checklist: [
      "Piedi alla larghezza delle spalle, talloni a terra",
      "Schiena neutra per tutta la discesa",
      "Ginocchia nella direzione delle punte",
      "Discesa controllata, salita decisa",
      "Respirazione regolare" ] },
    { id: "landing", label: "Atterraggio da salto (frontale)", kind: "landing", view: "front", checklist: [
      "Atterraggio sugli avampiedi, poi tallone",
      "Ginocchia piegate per ammortizzare",
      "Ginocchia allineate ai piedi, non verso l'interno",
      "Busto stabile sopra i piedi",
      "Atterraggio silenzioso" ] },
    { id: "decel", label: "Frenata e cambio di direzione", kind: "decel", view: "side", checklist: [
      "Frenata in più passi corti",
      "Baricentro che si abbassa mentre freni",
      "Ginocchio allineato al piede",
      "Busto sopra il piede d'appoggio",
      "Ripartenza con spinta del piede esterno" ] }
  ]
};

/* Soglie dell'analisi automatica (indicative e modificabili).
   Gli angoli sono in gradi, misurati sul piano dell'immagine (video 2D), quindi approssimativi.
   - quality: quando l'analisi NON è affidabile e va rifatto il video
   - kinds: regole per famiglia di gesto; il campo "rules" di un colpo in VIDEO_SHOTS sovrascrive i valori.
   Nessuna soglia esprime un rischio di infortunio: servono solo a scegliere quale suggerimento mostrare. */
const VIDEO_RULES = {
  quality: {
    minFrames: 8,               // fotogrammi analizzati minimi
    minDetectedRatio: 0.7,      // quota di fotogrammi in cui la persona è stata trovata
    minVisibility: 0.55,        // confidenza media dei punti chiave (0-1)
    minInFrameRatio: 0.7,       // quota di fotogrammi con corpo intero dentro l'inquadratura
    sideMaxShoulderRatio: 0.45, // vista laterale: larghezza spalle / lunghezza busto sotto questo valore (almeno in parte del video)
    frontMinShoulderRatio: 0.5  // vista frontale: larghezza spalle / lunghezza busto sopra questo valore
  },
  sampleFps: { default: 15, run_side: 20, run_front: 20 }, // fotogrammi al secondo analizzati
  maxSeconds: 12,                                          // durata massima analizzata
  kinds: {
    ground:    { elbowImpactMin: 90,  kneeFlexPrepMin: 15, trunkRotRangeMin: 20 },
    overhead:  { elbowImpactMin: 130, kneeFlexPrepMin: 10, trunkLeanMax: 35, wristAboveShoulder: true },
    volley:    { elbowImpactMin: 80,  trunkLeanMax: 40 },
    soft:      { kneeFlexPrepMin: 20, trunkLeanMax: 40 },
    underhand: { kneeFlexPrepMin: 10, trunkLeanMax: 40 },
    run_side:  { cadenceLow: 160, overstrideMax: 0.2, trunkLeanMax: 20 }, // overstride: piede davanti all'anca / lunghezza gamba
    run_front: { valgusMax: 0.08, trunkLeanMax: 15 },                    // valgus: spostamento interno del ginocchio / lunghezza gamba
    squat:     { kneeFlexMin: 70, trunkLeanMax: 50 },
    landing:   { valgusMax: 0.08 },                                     // ripresa frontale: si valuta solo l'allineamento delle ginocchia
    decel:     { kneeFlexMin: 30, trunkLeanMax: 40 }
  }
};

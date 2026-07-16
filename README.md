# YouPlanner

Applicazione operativa per pianificazione persone, ferie/permessi, reperibilità, turni, festività italiane e chiusure aziendali.

Repository: https://github.com/andreafunicelli/YouPlanner

Questa versione mantiene il frontend React/Vite generato con ClaudeCode e usa un backend locale Express con persistenza JSON per rendere reali login, scope per ruolo, richieste, decisioni manageriali, assegnazioni calendario, reperibilità, turni, notifiche, FAQ e profilo utente.

## Setup

```bash
cd /Users/andreafunicelli/Projects/peopleplannertwo
npm install
```

## Avvio sviluppo

### Solo backend/app servita da Express

Il backend serve anche la build statica `dist/`:

```bash
npm run build
npm run api
```

URL locale:

```text
http://127.0.0.1:4174
http://127.0.0.1:4174/api/health
```

### Frontend Vite separato

```bash
npm run api
npm run dev
```

URL:

- Frontend dev: `http://127.0.0.1:5173`
- API: `http://127.0.0.1:4174/api/health`

## Build, lint e test

```bash
npm run lint
npm test
npm run build
```

## Database demo

Il backend usa un file JSON locale generato dal seed. In esecuzione locale il default è:

```text
server/peopleplanner-db.json
```

In Docker viene usato invece un volume persistente:

```text
/data/peopleplanner-db.json
```

È possibile sovrascrivere il percorso con:

```bash
PEOPLEPLANNER_DB_PATH=/percorso/peopleplanner-db.json npm run api
```

Reset seed demo:

```bash
curl -X POST http://127.0.0.1:4174/api/dev/reset \
  -H 'content-type: application/json' \
  -d '{}'
```

## Login LDAP e Google Workspace demo

La pagina di accesso simula due provider aziendali completi senza contattare servizi esterni:

- LDAP / Active Directory con username e password;
- Google Workspace con account chooser e controllo del dominio fittizio;
- sessioni opache casuali con scadenza e revoca al logout;
- mapping delle identità demo sui ruoli Super Admin, BU Manager e Dipendente.

Account LDAP disponibili:

```text
anna.vitali       Super Admin
elena.conti       BU Manager
giulia.romano     Dipendente
manager.senzabu   Manager senza BU
password          Demo!2026
```

Gli account Google sono mostrati direttamente nell'account chooser e appartengono al dominio
fittizio `youco.demo`. Le variabili `LDAP_ENABLED`, `GOOGLE_WORKSPACE_ENABLED`,
`DEMO_LDAP_*`, `DEMO_GOOGLE_DOMAIN` e `AUTH_SESSION_TTL_MS` consentono di personalizzare
la simulazione. Questa implementazione non deve essere considerata un collegamento LDAP/OAuth
reale: per la produzione servono certificati, segreti e callback dei provider effettivi.

## Reperibilità e turni operativi

Le operazioni sono riservate ai BU Manager e possono essere create o eliminate sia dalle
rispettive sezioni sia dal pulsante `Assegna` del calendario.

La reperibilità prevede esclusivamente le linee `Base` e `Garofalo`. Per ciascuna Business Unit
e settimana ogni linea può avere un solo assegnatario. La stessa persona può invece coprire
entrambe le linee nella medesima settimana. Un tentativo di assegnare una linea già occupata
restituisce il conflitto `ONCALL_LINE_OCCUPIED` e non modifica la pianificazione.

## Deploy con Docker

Il file `docker-compose.yml` include build multi-stage, healthcheck, riavvio automatico,
volume persistente, log rotation e un runtime read-only senza capability Linux.

Build e avvio su un server con Docker Compose:

```bash
git clone https://github.com/andreafunicelli/YouPlanner.git
cd YouPlanner
cp .env.example .env
docker compose config
docker compose up -d --build --remove-orphans
```

Per sicurezza la porta è pubblicata solo su `127.0.0.1` per l'uso dietro reverse
proxy o tunnel. Per esporla direttamente sulla rete, impostare con cautela in `.env`:

```dotenv
YOUPLANNER_BIND_ADDRESS=0.0.0.0
```

Verifica:

```bash
curl -fsS http://127.0.0.1:4174/api/health
docker compose ps
docker compose logs -f youplanner
```

URL applicazione:

```text
http://<server-ip>:4174
```

Persistenza dati:

```text
volume Docker: youplanner-data (configurabile con YOUPLANNER_DATA_VOLUME)
file interno: /data/peopleplanner-db.json
```

Aggiornamento:

```bash
git pull --ff-only
docker compose up -d --build --remove-orphans
docker image prune -f
```

Rollback operativo:

```bash
docker compose down
docker compose up -d --build
```

Backup rapido del volume dati:

```bash
docker run --rm -v youplanner-data:/data -v "$PWD":/backup alpine \
  sh -c 'cp /data/peopleplanner-db.json /backup/peopleplanner-db.$(date +%F_%H%M).json'
```

Ripristino del backup (a container fermo):

```bash
docker compose down
docker run --rm -v youplanner-data:/data -v "$PWD":/backup alpine \
  sh -c 'cp /backup/peopleplanner-db.BACKUP.json /data/peopleplanner-db.json'
docker compose up -d
```

In produzione `/api/dev/reset` è disabilitato e CORS cross-origin non viene
attivato; frontend e API restano serviti dallo stesso container.

## Credenziali demo

Le credenziali demo sono presenti nel seed/app locale per consentire la verifica dei workflow. Non pubblicare password reali in documentazione condivisa.

Account demo disponibili:

- Super Admin: `superadmin@peopleplanner.local` — password locale: `[REDACTED]`
- Manager BU Sviluppo Software: `manager@peopleplanner.local` — password locale: `[REDACTED]`
- Dipendente: `employee@peopleplanner.local` — password locale: `[REDACTED]`
- Manager senza BU: `manager-empty@peopleplanner.local` — password locale: `[REDACTED]`

Nota: la schermata di login locale contiene scorciatoie di verifica per questi profili; evitare di riusarle in ambienti esposti o produttivi.

## Ruoli e scope

- `SUPER_ADMIN`
  - vede persone e Business Unit;
  - può aggiungere persone dalla configurazione;
  - può consultare dashboard/calendario/chiusure in modalità amministrativa;
  - non riceve notifiche operative di team/turni;
  - non può approvare richieste, modificare calendario, creare reperibilità o turni: queste azioni restano manageriali.
- `ADMIN`
  - ruolo manager operativo;
  - vede solo persone, richieste, notifiche, turni e reperibilità delle Business Unit assegnate;
  - se non gestisce alcuna BU, vede zero persone, zero richieste e zero BU operative;
  - può approvare/rifiutare richieste, assegnare calendario, creare reperibilità e turni nel proprio scope.
- `EMPLOYEE`
  - vede solo sé stesso e le proprie richieste;
  - può inserire nuove richieste personali;
  - riceve notifiche relative alle proprie richieste/decisioni.

## Workflow principali

- Login role-based dalla schermata iniziale.
- Manager:
  - dashboard con metriche da backend scoped;
  - calendario scoped alla BU gestita;
  - approvazione/rifiuto richieste con persistenza backend;
  - assegnazione manuale calendario con blocco su festività/chiusure;
  - reperibilità bloccata se sovrapposta ad assenze;
  - turni operativi con blocco duplicati e gestione turni scoperti;
  - manager senza BU visualizza esplicitamente stati vuoti, senza fallback ai dati seed statici.
- Employee:
  - inserimento richiesta ferie/permessi;
  - validazione sovrapposizioni;
  - festività e chiusure escluse dal conteggio ferie.
- Super Admin:
  - vista configurazione persone/BU;
  - aggiunta persona demo;
  - separazione dalle notifiche operative.
- Header:
  - notifiche reali da `/api/notifications`;
  - FAQ role-aware da `/api/faq`;
  - profilo utente da `/api/profile` e cambio password da `/api/profile/password`.
- Tweaks:
  - configurazione globale persistente modificabile solo dal Super Admin;
  - preferenze personali persistenti per ogni account, con override dei valori globali;
  - soglie assenti e smart working modificabili esclusivamente dai BU Manager con BU assegnata;
  - ripristino personale ai valori globali.

## Regole dominio implementate

- Festività italiane dinamiche con Pasqua e Lunedì dell'Angelo calcolati via algoritmo gregoriano.
- Festività nazionali e chiusure aziendali sono derivate nel calendario: non generano finte richieste ferie.
- Chiusura aziendale distinta da festività nazionale.
- Presidio su chiusura: chi è in presidio visualizza `Presidio`; gli altri visualizzano `Chiusura`/assenza derivata.
- Richieste ferie/smart working su soli giorni non lavorativi vengono bloccate.
- Richieste sovrapposte pending/approved vengono bloccate.
- Reperibilità sovrapposta ad assenze viene bloccata con HTTP `409`.
- Notifiche operative rispettano lo scope BU/team; manager senza BU e Super Admin non ricevono notifiche operative.
- Confronti date normalizzati su chiavi `yyyy-MM-dd`.

## Endpoint principali

- `GET /api/health`
- `POST /api/dev/reset`
- `POST /api/login`
- `GET /api/bootstrap`
- `GET /api/dashboard`
- `POST /api/requests`
- `POST /api/requests/:id/decision`
- `POST /api/assignments`
- `POST /api/oncall`
- `POST /api/shifts`
- `POST /api/admin/people`
- `GET /api/notifications`
- `GET /api/faq`
- `GET /api/profile`
- `PATCH /api/profile`
- `POST /api/profile/password`
- `PATCH /api/tweaks/global` (solo Super Admin)
- `PATCH /api/tweaks/me`
- `DELETE /api/tweaks/me`

## Pubblicazione locale Cloudflare

La build statica è in:

```text
dist/
```

Topologia prevista:

```text
Browser -> Cloudflare Tunnel -> nginx:80 -> 127.0.0.1:4174
```

FQDN richiesto:

```text
https://youplanner.funilab.org
```

## Limitazioni note

- Persistenza locale JSON, adatta a demo/verifica locale; per produzione serve DB relazionale e migrazioni.
- Autenticazione demo con token semplice uguale allo user id; per produzione servono password hashing/sessioni/JWT reali.
- Le password demo sono intenzionalmente solo per ambiente locale/demo e vanno ruotate/rimosse prima di un uso reale.
- Alcune viste amministrative sono leggere per preservare il design ClaudeCode e completare i workflow principali senza riscrittura totale.
- `npm install` può segnalare vulnerabilità moderate; valutare `npm audit` e fix mirato prima di uso produttivo.

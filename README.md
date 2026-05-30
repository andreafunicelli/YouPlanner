# PeoplePlanner / YouPlanner

Applicazione operativa per pianificazione persone, ferie/permessi, reperibilità, turni, festività italiane e chiusure aziendali.

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

Il backend usa un file JSON locale generato dal seed:

```text
server/peopleplanner-db.json
```

Reset seed demo:

```bash
curl -X POST http://127.0.0.1:4174/api/dev/reset \
  -H 'content-type: application/json' \
  -d '{}'
```

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

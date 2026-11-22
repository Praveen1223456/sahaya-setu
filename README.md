# Sahaya Setu (సహాయ సేతు)

Report civic problems and disasters by photo, voice (Telugu, Hindi, English), SMS or QR code, and track each one
from complaint to verified repair.

One platform for everyday complaints (a broken streetlight, a leaking pipe, uncollected garbage) and for disasters
(fallen poles, flooding, people trapped). Every report reaches the right department, and a named worker fixes it.
The repair is checked with a photo taken on site, and it is verified before the ticket closes. In disaster mode,
life-safety work goes first.

Built with **MongoDB, Express, React and Node.js** for the IDEA//FORGE Online Hackathon.

## Features

**Report from anywhere, even without network**
- **Live photo report:** the photo is stamped with time, GPS, address and a report ID. Camera only: gallery photos can't be used.
- **Voice in Telugu, Hindi or English:** the citizen speaks, edits the text, and gets a suggested category, department, priority and safety warning. See [VOICE.md](VOICE.md).
- **No signal:** reports are saved on the phone and sent later. The citizen can also send them now as a short coded SMS, or show a QR code that a neighbour's phone scans and uploads.
- **SOS:** hold for 3 seconds, cancel within 5. The location is sent again every 3 minutes, and the app can flash the screen, sound a siren, and alert family by SMS.

**From complaint to verified repair**
- **Asset-level location:** citizens pick the exact pole, streetlight, pipe or road section from a list of nearby assets, or type the number painted on it.
- **Duplicates and fakes:** duplicates merge automatically by asset, by location and by photo fingerprint. Forwarded photos, fake GPS and edited photos are flagged.
- **Seven departments share one ticket system:** electricity, water, roads, municipal, health, transport and rescue. Each desk sees only its own tickets, and can transfer a ticket or ask another department to help.
- **Named workers:** a worker accepts or declines the job, navigates to the site, and submits the repair with a photo. The server checks how far from the problem the photo was taken, and whether it's just the citizen's "before" photo.
- **Independent verification:** the citizen confirms by app or SMS. Suspicious repairs go to a supervisor, who can never be the person who did the repair. Rejected repairs reopen the ticket and stay on record.

**Everyday mode and disaster mode**
- **One switch:** life-safety work gets shorter deadlines and jumps the queue, while streetlights and garbage wait.
- **Warnings:** the control room types a warning, or imports an official CAP alert (the format NDMA's SACHET system uses). Citizens in the area see it with their nearest cyclone shelters.
- **Evacuation list:** households register elderly, pregnant or bedridden members in advance, and officials see who needs help to evacuate.
- **Situation report** for the District Collector, written by Claude if an API key is set.

**Transparency**
- **Public board:** what was reported, what was repaired, who verified it, and how long each department took.
- **Timeline:** every ticket keeps a full record, and citizens get an SMS at every step.

## Apps

| App | Address | For |
|---|---|---|
| Citizen app | `/citizen/` | Report, SOS, voice, track and rate repairs, QR relay. Telugu and English (voice also in Hindi). Installable, works offline. |
| Control room and department desks | `/dashboard/` | Live queue and map, SOS alarm, assign workers, verify repairs, mode switch, warnings, situation report. |
| Field worker | `/field/` | My jobs, the department queue, navigation, repair proof. |
| Public board | `/board/` | Verified repairs and department performance. |

## Quick start

You need **Node.js 18+** and **MongoDB**. Either install MongoDB Community Server, or create a free
[MongoDB Atlas](https://www.mongodb.com/atlas) cluster.

```bash
git clone https://github.com/<your-username>/sahaya-setu.git
cd sahaya-setu
cp server/.env.example server/.env     # set MONGODB_URI and JWT_SECRET
npm run setup                          # install server and client packages
npm run build                          # build the React apps
npm start                              # http://localhost:4000
npm run seed                           # second terminal: demo data
```

Open http://localhost:4000 and sign in to the dashboard with a demo token:

| Role | Tokens |
|---|---|
| Control room | `control-demo` |
| Department desks | `elec-demo`, `water-demo`, `roads-demo`, `municipal-demo`, `health-demo`, `transport-demo`, `rescue-demo` |
| Field workers | `ravi-lineman`, `suresh-lineman`, `sita-fitter`, `kumar-roads`, `anil-municipal`, `sdrf-team1`, `ambulance-1` |

**While developing the React apps:** run `npm run dev:server` and `npm run dev:client` in two terminals, then
open http://localhost:5173/citizen/.

**On phones:** the camera, GPS and microphone need HTTPS. Run a tunnel such as
`cloudflared tunnel --url http://localhost:4000` and open the HTTPS address it prints.

**Citizen sign-in codes** (for voice and status) are sent by SMS. Without an SMS gateway, they appear in the
dashboard's SMS log. For a quick demo, start the server with `DEV_SHOW_OTP=1` to show the code on screen. Never
use that in production.

## Five-minute demo

1. Run `npm run seed`. Open the dashboard as **Control room** and turn on the SOS alarm.
2. **Citizen app:** report a problem with a live photo, and pick the pole from the "Which pole?" list.
3. **Dashboard as Electricity:** open the ticket and assign **Ravi**.
4. **Field app as Ravi:** accept, tap "I am on the way", then submit the repair with a photo. The app shows how far you are from the pole.
5. **Citizen app:** the ticket shows before and after photos. Rate it. It closes as verified.
6. **Dashboard as Municipal:** the streetlight "repair" photo was taken 2.7 km away. Reject it, and the ticket reopens.
7. **Citizen app:** report by voice in Telugu or Hindi, then ask "What is the status of my complaint?"
8. **Control room:** switch to disaster mode and watch the queue reorder. Open a warning's evacuation list.
9. Finish on the public board.

## How it works

```
Citizen app ─┐  photo + GPS + signature             ┌─ Electricity ─┐
Voice ───────┤                                      ├─ Water        │
SMS ─────────┼─► intake ─► duplicates ─► ticket ────├─ Roads        ├─ worker accepts → on site
QR relay ────┘   validate   fakes        priority   ├─ Municipal    │   → repair photo + GPS
                 store      asset match  routing    └─ … ───────────┘          │
                                                                               ▼
                 citizen ◄── SMS at every step ── verification (citizen / supervisor) → closed
```

**One tiny message format for every channel.** A report fits in one SMS or one QR code:
`SS|ELEC|SEV4|PPL2|16.578700,82.006100|ACC12|1430|ID7F3A9K2Q|PH9876543210|ASAMP-POLE-0101`.
The same ID is used for the photo upload, so a report that arrives by SMS first and online later is counted once.

## Configuration

Set these in `server/.env`. See `server/.env.example` and `server/src/config.js` for all options.

| Variable | Purpose |
|---|---|
| `MONGODB_URI` | MongoDB connection string (local or Atlas) |
| `JWT_SECRET` | **Required for real use:** signs citizen sign-in tokens |
| `PORT` | Default 4000 |
| `SMS_SENDER=http`, `SMS_GATEWAY_URL`, `SMS_INBOUND_NUMBER` | Real SMS through a gateway, such as an SMS gateway app on an Android phone |
| `ANTHROPIC_API_KEY` | Optional AI: photo and voice classification, situation report. Rule-based without it. |
| `STT_PROVIDER`, `STT_BASE_URL`, `STT_API_KEY` | Optional server speech-to-text (Whisper-compatible) |
| `STAFF_TOKENS_JSON` | Replace the demo staff tokens |
| `CATEGORY_DEPARTMENTS_JSON` | Change which department handles a category |

## Project structure

```
server/                 Express API + MongoDB (Mongoose)
  src/services.js         intake, assignment, repair proof, verification, transfer, escalation
  src/lib/                duplicates, assets, SMS format, photo fingerprints, modes, warnings, AI, voice
  src/routes/             citizen, voice, staff and public endpoints
  data/                   sample assets, villages, shelters and CAP alert (made-up demo data)
  test/                   Jest + Supertest against a real MongoDB
client/                 React (Vite): citizen, dashboard, field and board apps
e2e/                    Playwright browser tests of all apps, including voice
VOICE.md                Voice complaints: setup, API, privacy, tests
```

## Tests

```bash
npm test                                            # 23 server tests (needs MongoDB)
pip install playwright && playwright install chromium
python e2e/e2e_test.py  --base http://localhost:4000   # full repair workflow across all apps (after npm run seed)
python e2e/e2e_voice.py --base http://localhost:4000   # voice flow (start the server with DEV_SHOW_OTP=1)
```

## Limitations

- **Sample data:** the assets, villages, shelters and CAP alert in `server/data/` are made up. Replace them with your district's real data.
- **Bluetooth mesh** needs a native Android app. The QR relay does the same job in a web app.
- **Browser speech recognition** works in Chrome and Edge and needs internet. Telugu text-to-speech voices are missing on many phones, so instructions are also always shown as text.
- **Photo signing:** the key lives in the web app, where it can be extracted. Production should use Android Play Integrity.
- **Staff logins:** demo tokens are not real accounts.
- **112:** connecting to the real 112 system needs government approval.
- **Map tiles** come from OpenStreetMap and need internet.

## License

Choose a license (for example MIT) before making the repository public. Third-party code and fonts keep their own
licenses: Leaflet, react-leaflet, jsQR, qrcode-generator, Hind and Hind Guntur (SIL Open Font License).

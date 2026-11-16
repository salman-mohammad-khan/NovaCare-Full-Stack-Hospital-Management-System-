# NovaCare Healthcare Solutions

A full-stack hospital care-coordination app built with the MERN stack (MongoDB, Express, React, Node.js). Patients find a specialist and request a visit, admins run the request queue, and doctors close each visit with notes, a prescription and a follow-up date. It has three role-based portals, a doctor directory, light and dark themes, and a health assistant that suggests the right specialist (rules first, a small local AI model second).

**Live demo:** https://www.nova-care.xyz (runs on a free Oracle Cloud Always Free ARM VM behind Caddy HTTPS)

> This is a demo project. Use the seeded demo accounts below and do not enter real personal or medical data.

---

## What you can do

**Patient**
- Browse 13 specialists, filter by specialty, search by name or focus area, and hide doctors who are unavailable.
- Request a visit by choosing a date, a time slot and the consultation mode. Bookings start from tomorrow; same-day and past dates are rejected.
- Follow the visit through its status and read the doctor's notes, prescription and follow-up date.
- Register as a new patient and book straight away.

**Admin**
- Work the request queue: confirm, reschedule or cancel appointments before they happen.
- Create and edit doctor profiles. A new doctor gets a one-time temporary password that is shown once to the admin.
- Mark a doctor as unavailable so no new bookings are accepted.
- Read contact messages and reset the demo data.

**Doctor**
- See only the appointments assigned to them, add a consultation summary, prescription and follow-up date, and mark the visit completed.

Appointment status flow:

```
Requested -> Confirmed -> Completed
                |
                +-> Cancelled   (admin only, from Requested or Confirmed)
```

Completed appointments are locked from further changes.

---

## Security and reliability

- **Signed login tokens (JWT, 24 hours).** Booking, admin and doctor routes check the token and the role on the server. A patient cannot confirm an appointment or change a doctor.
- **Role-scoped data.** `GET /api/app-state` returns only the public doctor directory and summary counts to visitors. Patients and doctors receive only their own records. Admins receive everything.
- **Hashed passwords** (bcrypt), including the seeded demo accounts.
- **Production guard.** With `NODE_ENV=production` the server refuses to start unless `JWT_SECRET` is a random string of at least 32 characters.
- **Rate limits** on login, registration and the AI assistant, plus security headers. Cross-origin access is off unless `CORS_ORIGIN` is set.
- **Admin-only demo reset.** `POST /api/reset` needs an admin token.
- **Sessions.** An expired or invalid token signs the user out instead of leaving a broken signed-in screen.

---

## Health assistant

The chat widget helps a patient choose a doctor. It runs entirely on the same machine, with no external AI service.

1. **Emergency rules answer first and instantly.** Chest pain with sweating, stroke signs, trouble breathing, heavy bleeding, fainting, seizures, severe allergic reactions, poisoning, newborn fever and thoughts of suicide get a fixed message: call 108 (or 112), plus the Tele-MANAS helpline for self-harm. They never wait for a model.
2. **Keyword rules pick the specialty and priority** when they are confident (English and Hinglish, children go to pediatrics, negations such as "no fever" are handled).
3. **A small local model decides only the unsure cases.** `qwen3.5:2b` (through Ollama) is asked for a specialty and urgency as strict JSON. If the model is slow, busy or switched off, the rules' best guess is used, so the assistant always answers.
4. **Replies are fixed templates** that name the doctor and what that doctor covers. A 2B model wrote friendlier replies in testing but promised things ("we have scheduled your appointment") and repeated symptoms the patient never mentioned, so model-written replies are off unless `LLM_REPLY=true`.
5. The result is a recommendation card that pre-fills the booking form. The assistant never diagnoses and always says so.

It was chosen by testing five local models (1.7B to 4B parameters) on the VM's two CPU cores with 46 labelled messages written for this project, including Hinglish and ten emergencies. Letting a small model decide everything from a long prompt was the worst option (30 to 70% fully correct, 20 to 80 seconds per answer). Rules first with `qwen3.5:2b` as the fallback reached about 91% fully correct, and cases the rules are confident about answer instantly. A 4B model as the classifier reached 96% but took about 35 seconds. Those cases are my own labels, so treat the figures as a guide, not a clinical result.

Chat messages are logged without any account details (session id, route, chosen specialty, the patient's last message trimmed to 300 characters) and deleted automatically after 30 days.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, React Router 7, Vite 8, Tailwind CSS 4 |
| Backend | Node.js, Express 5 |
| Database | MongoDB (official driver) |
| Auth | JSON Web Tokens, bcryptjs |
| Assistant | Rule engine plus a small local LLM through Ollama (`qwen3.5:2b`) |
| Hosting | Oracle Cloud Always Free (Arm), Caddy, systemd |

---

## Run it locally

Requirements: Node.js 20.19 or later (22 recommended) and [MongoDB Community Server](https://www.mongodb.com/try/download/community).

```bash
npm install
cp .env.example .env        # then edit the values you need
npm run mongo:start         # terminal 1: local MongoDB
npm run server              # terminal 2: API on http://127.0.0.1:4000
npm run dev                 # terminal 3: Vite on http://localhost:5173
```

The database is seeded on first start. Seeded appointment dates are shifted to the current date, so the demo always looks current.

### Environment variables

```env
MONGO_URI=mongodb://127.0.0.1:27017
MONGO_DB_NAME=NovaCare
PORT=4000

# Required when NODE_ENV=production (random, 32+ characters)
JWT_SECRET=
JWT_EXPIRES_IN=24h

# Optional: only if the API and the web app are on different origins
CORS_ORIGIN=

# Health assistant (works with rules alone if the model is unreachable)
LLM_ENABLED=true
LLM_BASE_URL=http://127.0.0.1:11434
LOCAL_LLM_MODEL=qwen3.5:2b
LLM_TIMEOUT_MS=30000
LLM_REPLY=false
```

---

## Demo accounts

| Role | Email | Password |
|---|---|---|
| Admin | `admin@novacare.demo` | `Admin@123` |
| Doctor | `aisha@novacare.demo` | `Doctor@123` |
| Patient | `patient@novacare.demo` | `Patient@123` |

The sign-in page also lists these with one-click auto-fill. More doctor and patient accounts are in the seed data.

---

## API overview

| Route | Access |
|---|---|
| `GET /api/health` | Public |
| `GET /api/app-state` | Public (limited), signed-in users get their own records, admins get all |
| `POST /api/auth/login`, `POST /api/patients/register` | Public, rate limited |
| `POST /api/appointments` | Patient |
| `PATCH /api/appointments/:id/admin` | Admin |
| `PATCH /api/appointments/:id/doctor` | Doctor |
| `POST /api/doctors/upsert`, `PATCH /api/doctors/:id/availability` | Admin |
| `POST /api/contact-messages` | Public or signed in |
| `POST /api/ai-assistant` | Public, rate limited (rules plus the local model) |
| `POST /api/reset` | Admin |

---

## Project structure

```
server/
  index.js          Express app and API routes
  triageRules.js    Emergency, specialty and priority rules (English and Hinglish)
  triage.js         Health assistant: rules first, local model for unsure cases, templates as fallback
  triage.test.js    Tests for the rules and the assistant flow (npm test)
  db.js             MongoDB connection
  seedData.js       Seed doctors, users and appointments
src/
  pages/            Home, doctors, doctor detail, sign in, portal, contact
  components/       Header, sidebar, footer, AI widget, and ui/ (Button, Card, Badge, Input, Skeleton)
  context/          App state and toast notifications
  hooks/            Form handling and theme
  lib/              API client and appointment helpers
scripts/mongo-start.mjs   Start a local mongod
```

---

## Deploy on a small VM

The live site runs on one Arm VM:

1. Build the frontend on your machine with `npm run build`.
2. Copy `dist/`, `server/`, `package.json` and `package-lock.json` to the VM and run `npm ci --omit=dev`.
3. Run MongoDB on the VM, bound to `127.0.0.1`.
4. Create a systemd service that runs `node server/index.js` with `NODE_ENV=production`, `PORT`, `MONGO_URI`, `MONGO_DB_NAME` and a random `JWT_SECRET` in a private environment file.
5. Put Caddy in front as a reverse proxy to `127.0.0.1:4000` for automatic HTTPS.

The Express server serves the built frontend and the API from one origin, so no CORS setup is needed.

---

## Known limitations

- Automated tests cover the rules and the assistant flow (`npm test`); there is no CI workflow or browser test suite in the repo yet.
- Demo data is shared by everyone who uses the site. An admin can reset it from the footer.
- There is no email: no email verification and no password reset. The demo uses seeded accounts, and a real deployment would add a transactional email service first.
- The assistant's model runs on two CPU cores, so an unsure case takes several seconds and a busy server answers from templates.
- This is a demo, not a medical product: it has no audit trail, no consent flow and no real-world compliance work.

# NovaCare Healthcare Solutions

A full-stack hospital care-coordination app built with the MERN stack (MongoDB, Express, React, Node.js). Patients find a specialist and request a visit, admins run the request queue, and doctors close each visit with notes, a prescription and a follow-up date. It has three role-based portals, a doctor directory, light and dark themes, and a health assistant that suggests the right specialist (rules first, then a hosted model on Amazon Bedrock).

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

The chat widget helps a patient choose a doctor. With an Amazon Bedrock key it uses a hosted model (gpt-oss 20B) for the specialty, urgency and a short piece of advice; without one it uses the rules and a small local model on the same machine.

1. **Emergencies get a fixed message.** Chest pain with sweating, stroke signs, trouble breathing, heavy bleeding, fainting, seizures, severe allergic reactions, poisoning, newborn fever and thoughts of suicide: call 108 (or 112), plus the Tele-MANAS helpline for self-harm. The word rules fire first and are never skipped. With Bedrock on, a separate model check and the triage call can raise an emergency the rules missed (for example "mere bete ko daura pad raha hai"). Optionally (`BEDROCK_MAY_DOWNGRADE=true`) two clear "not an emergency" answers can cancel a rule's false alarm, never a self-harm one.
2. **Keyword rules pick the specialty and priority** when they are confident (English and Hinglish, children go to pediatrics, negations such as "no fever" are handled).
3. **With a Bedrock key, one hosted-model call per message** (gpt-oss 20B, low reasoning effort, about 1.5 s) returns the specialty, urgency, a short reason and symptom summary for the booking form, and two sentences of general advice. The doctor is always chosen here, in code, from the real catalogue, so the model cannot invent one, and advice that promises a booking or contains a dose is thrown away. Without a key the rules decide, and a small local model (`qwen3.5:2b` through Ollama) is asked only when they are unsure. If Bedrock is down, the rules and templates answer (the local model only if `BEDROCK_LOCAL_FALLBACK=true`).
4. **It asks before it commits when the message is vague.** The reply says what the symptoms could be related to (a plain-language area, never a diagnosis) and which specialist is a good starting point. If the message is too general to be sure ("I have pain", "I have fever") it also asks one or two short questions, and the card says "Likely specialist (may change as you answer)". It asks at most once, never when the message already says how long it has lasted, never in an emergency, and `BEDROCK_ASK_FOLLOWUP=false` switches it off.
5. **Replies** are the model's advice followed by the doctor and the next step, or a fixed template when there is no model. A 2B local model promised things ("we have scheduled your appointment"), so its replies stay off unless `LLM_REPLY=true`.
6. The result is a recommendation card that pre-fills the booking form. The assistant never diagnoses and always says so.

**How well it works.** `npm run bench` measures the assistant on 96 labelled messages in `server/benchmark/cases.json` (English, Hindi and Hinglish; 11 emergencies). 66 came from a code audit and shaped the prompts; 30 were written afterwards and measured once before tuning. The labels were written during development and some are arguable, so treat the figures as a guide, not a clinical result. Fully right means both specialty and priority match:

| | Audit set (66) | Fresh set (30) |
|---|---|---|
| Rules only | 32 | 18 |
| Rules + hosted model (default) | 50 | 25 |
| Rules + hosted model, `BEDROCK_MAY_DOWNGRADE=true` | 53 | 26 |

Asking questions was measured separately, with a second model playing the patient (it is told the true story, so it is a rough stand-in for real patients). On 32 deliberately vague first messages (`server/benchmark/vague.json`, `vague-fresh.json`; `node server/benchmark/vague.mjs [--fresh]`) answering at once was fully right 19 times and asking first 26 times; the second file (12 messages) was written after tuning and measured once: 7 against 9. On the 96 mostly-clear messages above it asks in about 20% of them and the score is unchanged (78 of 96 both ways).

Emergencies were called Emergency in 11 of 11 cases with the hosted model (2 of 6 and 3 of 5 with rules only). Where the rules were wrong most often: false emergencies on questions ("how to avoid food poisoning"), no Hinglish seizure wording, and ignoring negation for the specialty. An earlier 46-message test, not kept in this repository, reported about 91% for rules plus the local 2B model; on this set the same rules score about 52%. Bedrock allows about 100 requests a minute per model on this account, and each message makes two calls.

Chat messages are logged without any account details (session id, route, chosen specialty, the patient's last message trimmed to 300 characters) and deleted automatically after 30 days.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, React Router 7, Vite 8, Tailwind CSS 4 |
| Backend | Node.js, Express 5 |
| Database | MongoDB (official driver) |
| Auth | JSON Web Tokens, bcryptjs |
| Assistant | Rule engine plus gpt-oss 20B on Amazon Bedrock (or a small local LLM through Ollama without a key) |
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
# Amazon Bedrock (optional, create a Bedrock API key in the AWS console and keep it out of git)
# AWS_BEARER_TOKEN_BEDROCK=
# BEDROCK_REGION=ap-south-1
# BEDROCK_MODEL_ID=openai.gpt-oss-20b-1:0
# BEDROCK_MAY_DOWNGRADE=false
# BEDROCK_LOCAL_FALLBACK=false
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
| `POST /api/ai-assistant` | Public, rate limited (rules plus Bedrock or the local model) |
| `POST /api/reset` | Admin |

---

## Project structure

```
server/
  index.js          Express app and API routes
  triageRules.js    Emergency, specialty and priority rules (English and Hinglish)
  triage.js         Health assistant: rules, Bedrock path, local model and templates as fallbacks
  triageAi.js       Prompts and parsing for the hosted model (the doctor is still chosen in code)
  bedrock.js        Minimal Amazon Bedrock client over fetch
  triage.test.js    Tests for the rules and the local flow (npm test)
  triageAi.test.js  Tests for the Bedrock client and path with a fake model
  benchmark/        96 labelled messages and the runner (npm run bench), plus the vague-message sets (vague.mjs)
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
- Without a Bedrock key the assistant's model runs on two CPU cores, so an unsure case takes several seconds and a busy server answers from templates. Bedrock is limited to about 100 requests a minute per model.
- This is a demo, not a medical product: it has no audit trail, no consent flow and no real-world compliance work.

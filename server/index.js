import dotenv from "dotenv";
dotenv.config({ override: true });
import { compare as comparePasswordHash, hash as hashPassword } from "bcryptjs";
import cors from "cors";
import express from "express";
import jwt from "jsonwebtoken";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { closeDb, getDb, getMongoConfig } from "./db.js";
import { createSeedState } from "./seedData.js";
import { getTriageResponse, warmUpModel } from "./triage.js";

const app = express();
const port = Number(process.env.PORT ?? 4000);
const __dirname = dirname(fileURLToPath(import.meta.url));
const distPath = resolve(__dirname, "../dist");
const indexPath = resolve(distPath, "index.html");
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const JWT_SECRET = process.env.JWT_SECRET ?? (IS_PRODUCTION ? "" : "novacare-dev-secret-change-in-production");
if (IS_PRODUCTION && JWT_SECRET.length < 32) {
  console.error("JWT_SECRET must be a random string of at least 32 characters when NODE_ENV=production.");
  process.exit(1);
}
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? "24h";
const PHONE_MIN_DIGITS = 10;
const DEFAULT_DOCTOR_SLOTS = [
  ["10:00 AM", "01:00 PM", "04:00 PM"],
  ["09:30 AM", "12:30 PM", "03:30 PM"],
  ["11:00 AM", "02:00 PM", "05:00 PM"],
];
const APPOINTMENT_STATUS = {
  CANCELLED: "Cancelled",
  COMPLETED: "Completed",
  CONFIRMED: "Confirmed",
  REQUESTED: "Requested",
};

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use((_request, response, next) => {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "SAMEORIGIN");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});
// The app and API share one origin, so cross-origin access is off unless CORS_ORIGIN is set.
if (process.env.CORS_ORIGIN) {
  app.use(cors({ origin: process.env.CORS_ORIGIN.split(",").map((item) => item.trim()) }));
}
app.use(express.json({ limit: "1mb" }));

function createRateLimiter({ windowMs, max, message }) {
  const hits = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) {
      if (entry.resetAt <= now) {
        hits.delete(key);
      }
    }
  }, windowMs).unref();

  return (request, response, next) => {
    const key = request.ip ?? "unknown";
    const now = Date.now();
    let entry = hits.get(key);

    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }

    entry.count += 1;
    if (entry.count > max) {
      response.setHeader("Retry-After", String(Math.ceil((entry.resetAt - now) / 1000)));
      response.status(429).json({ error: message });
      return;
    }

    next();
  };
}

const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: "Too many attempts. Please wait a few minutes and try again.",
});
const aiLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 15,
  message: "You are sending messages too quickly. Please wait a moment and try again.",
});

function generateTempPassword() {
  return `${randomBytes(9).toString("base64url")}#7`;
}

async function hashSeedPasswords(seedUsers) {
  return Promise.all(
    seedUsers.map(async (user) => {
      if (typeof user.password !== "string" || !user.password) {
        return user;
      }

      const { password, ...rest } = user;
      return { ...rest, passwordHash: await hashPassword(password, 10) };
    }),
  );
}

if (existsSync(indexPath)) {
  app.use(express.static(distPath));
}

function createId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeEmail(email) {
  return String(email ?? "").trim().toLowerCase();
}

function normalizeNameKey(name) {
  return String(name ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizePhone(phone) {
  return String(phone ?? "").replace(/\D/g, "");
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function createNameMatchRegex(name) {
  const parts = normalizeNameKey(name).split(" ").filter(Boolean).map(escapeRegex);
  return `^${parts.join("\\s+")}$`;
}

function hasValidPhone(phone) {
  return normalizePhone(phone).length >= PHONE_MIN_DIGITS;
}

function requiredFieldError(label) {
  return `${label}: This field is required.`;
}

function validatePatientRegistration({ email, name, password, phone }) {
  const passwordError =
    "Password must be at least 6 characters long and include at least one number and one special character.";

  if (!name) {
    return requiredFieldError("Full name");
  }

  if (!email) {
    return requiredFieldError("Email");
  }

  if (!phone.trim()) {
    return requiredFieldError("Phone");
  }

  if (!password) {
    return requiredFieldError("Password");
  }

  if (/^\d/.test(name)) {
    return "Full name cannot start with a number.";
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return "Please enter a valid email address with @ and a domain such as .com.";
  }

  if (password.length < 6 || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    return passwordError;
  }

  return "";
}

function buildAvatarLabel(name) {
  return String(name ?? "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function slugify(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatScheduleLabel(date) {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(date);
}

function createDoctorSchedule(startDate) {
  const baseDate = startDate ? new Date(`${startDate}T00:00:00`) : new Date();

  return Array.from({ length: 3 }, (_, index) => {
    const date = addDays(baseDate, index + 1);

    return {
      date: date.toISOString().slice(0, 10),
      label: formatScheduleLabel(date),
      slots: DEFAULT_DOCTOR_SLOTS[index % DEFAULT_DOCTOR_SLOTS.length],
    };
  });
}

function refreshDoctorSchedule(doctor) {
  if (!doctor) {
    return doctor;
  }

  const today = new Date();
  const schedule = Array.from({ length: 3 }, (_, index) => {
    const date = addDays(today, index + 1);
    const existingEntry = doctor.schedule?.[index];

    return {
      date: date.toISOString().slice(0, 10),
      label: formatScheduleLabel(date),
      slots:
        Array.isArray(existingEntry?.slots) && existingEntry.slots.length
          ? existingEntry.slots
          : DEFAULT_DOCTOR_SLOTS[index % DEFAULT_DOCTOR_SLOTS.length],
    };
  });

  return {
    ...doctor,
    isAvailable: doctor.isAvailable !== false,
    schedule,
    nextAvailable: `${schedule[0].label} at ${schedule[0].slots[0]}`,
  };
}

function buildDoctorRecord({ existingDoctor, form }) {
  const schedule = createDoctorSchedule(form.availabilityDate || existingDoctor?.schedule?.[0]?.date);
  const focusAreas = String(form.focusAreas ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const languages = String(form.languages ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return {
    id: existingDoctor?.id ?? `dr-${slugify(form.name) || createId("doctor")}`,
    userId: existingDoctor?.userId ?? createId("usr-doc"),
    name: String(form.name).trim(),
    specialty: String(form.specialty).trim(),
    clinic: String(form.clinic).trim(),
    experience: String(form.experience).trim(),
    fee: Number(form.fee),
    location: String(form.location).trim(),
    languages,
    nextAvailable: `${schedule[0].label} at ${schedule[0].slots[0]}`,
    intro: String(form.intro).trim(),
    about: String(form.about).trim(),
    focusAreas,
    credentials: String(form.credentials).trim(),
    tone: form.tone,
    avatarLabel: buildAvatarLabel(form.name),
    isAvailable: existingDoctor?.isAvailable !== false,
    schedule,
  };
}

function stripMongoFields(document) {
  const sanitized = { ...document };
  delete sanitized._id;
  delete sanitized._seedIndex;
  delete sanitized.password;
  delete sanitized.passwordHash;
  delete sanitized.nameKey;
  delete sanitized.__v;
  return sanitized;
}

function buildAppointmentSeedKey(appointment) {
  return [
    normalizeEmail(appointment.patientEmail),
    String(appointment.doctorName ?? "").trim().toLowerCase(),
    String(appointment.appointmentDate ?? "").trim(),
    String(appointment.appointmentSlot ?? "").trim(),
  ].join("|");
}

function createLegacyUserId(user) {
  const rolePrefix =
    user.role === "admin" ? "usr-admin" : user.role === "doctor" ? "usr-doc" : "usr-patient";

  return `${rolePrefix}-${String(user._id).slice(-8)}`;
}

async function verifyUserPassword(user, password) {
  if (!password) {
    return false;
  }

  if (typeof user.password === "string" && user.password === password) {
    return true;
  }

  if (typeof user.passwordHash === "string" && user.passwordHash) {
    try {
      return await comparePasswordHash(password, user.passwordHash);
    } catch {
      return false;
    }
  }

  return false;
}

function validateAdminTransition(currentStatus, nextStatus) {
  if (currentStatus === APPOINTMENT_STATUS.COMPLETED) {
    return "Completed appointments cannot be changed by admin controls.";
  }

  if (nextStatus === currentStatus) {
    if ([APPOINTMENT_STATUS.REQUESTED, APPOINTMENT_STATUS.CONFIRMED].includes(currentStatus)) {
      return "";
    }

    return "Only requested or confirmed appointments can be edited from admin triage.";
  }

  if (nextStatus === APPOINTMENT_STATUS.CONFIRMED && currentStatus !== APPOINTMENT_STATUS.REQUESTED) {
    return "Admin can only confirm appointments that are still requested.";
  }

  if (
    nextStatus === APPOINTMENT_STATUS.CANCELLED &&
    ![APPOINTMENT_STATUS.REQUESTED, APPOINTMENT_STATUS.CONFIRMED].includes(currentStatus)
  ) {
    return "Only requested or confirmed appointments can be cancelled by admin.";
  }

  if (![APPOINTMENT_STATUS.CONFIRMED, APPOINTMENT_STATUS.CANCELLED].includes(nextStatus)) {
    return "Admin can only mark appointments as confirmed or cancelled.";
  }

  return "";
}

function validateDoctorTransition(currentStatus, nextStatus) {
  if (currentStatus === APPOINTMENT_STATUS.COMPLETED) {
    return "Completed appointments cannot be changed by doctor controls.";
  }

  if (nextStatus === APPOINTMENT_STATUS.CONFIRMED && currentStatus !== APPOINTMENT_STATUS.REQUESTED) {
    return "Doctor can only confirm appointments that are still requested.";
  }

  if (nextStatus === APPOINTMENT_STATUS.COMPLETED && currentStatus !== APPOINTMENT_STATUS.CONFIRMED) {
    return "Only confirmed appointments can be completed by the doctor.";
  }

  if (![APPOINTMENT_STATUS.CONFIRMED, APPOINTMENT_STATUS.COMPLETED].includes(nextStatus)) {
    return "Doctor can only confirm or complete appointments.";
  }

  return "";
}

async function getCollections() {
  const db = await getDb();
  return {
    appointments: db.collection("appointments"),
    assistantLogs: db.collection("assistantLogs"),
    contactMessages: db.collection("contactMessages"),
    doctors: db.collection("doctors"),
    users: db.collection("users"),
  };
}

async function ensureSeedData() {
  const collections = await getCollections();
  const seed = createSeedState();

  await collections.users.createIndex({ email: 1 }, { unique: true });
  await collections.assistantLogs.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

  const specs = [
    ["users", await hashSeedPasswords(seed.users)],
    ["doctors", seed.doctors],
    ["appointments", seed.appointments],
    ["contactMessages", seed.contactMessages],
  ];

  await Promise.all(
    specs.map(async ([name, items]) => {
      const collection = collections[name];
      const count = await collection.estimatedDocumentCount();

      if (count === 0 && items.length) {
        await collection.insertMany(items.map((item, index) => ({ ...item, _seedIndex: index })));
      }
    }),
  );
}

async function repairLegacyData() {
  const collections = await getCollections();
  const seed = createSeedState();
  const seedUsersByEmail = new Map(seed.users.map((user, index) => [normalizeEmail(user.email), { ...user, index }]));
  const seedAppointmentsByKey = new Map(
    seed.appointments.map((appointment, index) => [buildAppointmentSeedKey(appointment), { appointment, index }]),
  );

  const doctors = await collections.doctors.find({}, { projection: { _id: 0, id: 1, name: 1 } }).toArray();
  const doctorIdByName = new Map(doctors.map((doctor) => [doctor.name, doctor.id]));
  const users = await collections.users.find({}).toArray();

  await Promise.all(
    users.map(async (user) => {
      const seedUser = seedUsersByEmail.get(normalizeEmail(user.email));
      const updates = {};

      if (!user.id) {
        updates.id = seedUser?.id ?? createLegacyUserId(user);
      }

      if (user.role === "doctor" && !user.linkedDoctorId) {
        updates.linkedDoctorId = seedUser?.linkedDoctorId ?? doctorIdByName.get(user.name) ?? "";
      }

      if (seedUser && user._seedIndex == null) {
        updates._seedIndex = seedUser.index;
      }

      if (seedUser && !user.phone) {
        updates.phone = seedUser.phone;
      }

      if (seedUser && !user.name) {
        updates.name = seedUser.name;
      }

      const nextNameKey = normalizeNameKey(updates.name ?? user.name);
      if (nextNameKey && user.nameKey !== nextNameKey) {
        updates.nameKey = nextNameKey;
      }

      if (seedUser && !user.password && !user.passwordHash) {
        updates.passwordHash = await hashPassword(seedUser.password, 10);
      }

      if (Object.keys(updates).length) {
        await collections.users.updateOne({ _id: user._id }, { $set: updates });
      }
    }),
  );

  const normalizedUsers = await collections.users
    .find({}, { projection: { _id: 0, id: 1, email: 1 } })
    .toArray();
  const userIdByEmail = new Map(normalizedUsers.map((user) => [normalizeEmail(user.email), user.id]).filter(([, id]) => id));
  const appointments = await collections.appointments.find({}).toArray();

  await Promise.all(
    appointments.map(async (appointment) => {
      const seedMatch = seedAppointmentsByKey.get(buildAppointmentSeedKey(appointment));
      const updates = {};

      if (!appointment.id) {
        updates.id = seedMatch?.appointment.id ?? createId("apt");
      }

      if (!appointment.patientId) {
        updates.patientId = userIdByEmail.get(normalizeEmail(appointment.patientEmail)) ?? "";
      }

      if (!appointment.doctorId) {
        updates.doctorId = doctorIdByName.get(appointment.doctorName) ?? "";
      }

      if (seedMatch && appointment._seedIndex == null) {
        updates._seedIndex = seedMatch.index;
      }

      if (!appointment.bookedAt && appointment.createdAt) {
        updates.bookedAt = appointment.createdAt;
      }

      if (!appointment.updatedAt && appointment.createdAt) {
        updates.updatedAt = appointment.createdAt;
      }

      if (Object.keys(updates).length) {
        await collections.appointments.updateOne({ _id: appointment._id }, { $set: updates });
      }
    }),
  );
}

function compareSeedOrder(left, right) {
  const leftCreatedAt = Date.parse(left.createdAt ?? "") || 0;
  const rightCreatedAt = Date.parse(right.createdAt ?? "") || 0;

  if (leftCreatedAt !== rightCreatedAt) {
    return rightCreatedAt - leftCreatedAt;
  }

  return (left._seedIndex ?? Number.MAX_SAFE_INTEGER) - (right._seedIndex ?? Number.MAX_SAFE_INTEGER);
}

async function readAppState(actor) {
  const collections = await getCollections();
  const [users, doctors, appointments, contactMessages] = await Promise.all([
    collections.users.find({}, { projection: { _id: 0, __v: 0, password: 0, passwordHash: 0 } }).toArray(),
    collections.doctors.find({}, { projection: { _id: 0, __v: 0 } }).toArray(),
    collections.appointments.find({}, { projection: { _id: 0, __v: 0 } }).toArray(),
    collections.contactMessages.find({}, { projection: { _id: 0, __v: 0 } }).toArray(),
  ]);

  const todayKey = new Date().toISOString().slice(0, 10);
  const stats = {
    patientCount: users.filter((user) => user.role === "patient").length,
    requestedCount: appointments.filter((item) => item.status === "Requested").length,
    upcomingCount: appointments.filter(
      (item) => ["Requested", "Confirmed"].includes(item.status) && item.appointmentDate >= todayKey,
    ).length,
  };

  // Admins see everything, patients and doctors only their own records, and anonymous
  // visitors only the public doctor directory plus summary counts.
  let visibleUsers = [];
  let visibleAppointments = [];
  let visibleMessages = [];

  if (actor?.role === "admin") {
    visibleUsers = users;
    visibleAppointments = appointments;
    visibleMessages = contactMessages;
  } else if (actor?.role === "patient") {
    visibleUsers = users.filter((user) => user.id === actor.id);
    visibleAppointments = appointments.filter((item) => item.patientId === actor.id);
  } else if (actor?.role === "doctor") {
    const ownDoctorIds = new Set(doctors.filter((doc) => doc.userId === actor.id).map((doc) => doc.id));
    visibleUsers = users.filter((user) => user.id === actor.id);
    visibleAppointments = appointments.filter((item) => ownDoctorIds.has(item.doctorId));
  }

  return {
    appointments: visibleAppointments,
    contactMessages: visibleMessages.sort(compareSeedOrder),
    doctors: doctors.map(refreshDoctorSchedule).sort(compareSeedOrder),
    stats,
    users: visibleUsers.sort(compareSeedOrder),
  };
}

async function findActor(actorUserId) {
  if (!actorUserId) {
    return null;
  }

  const { users } = await getCollections();
  return users.findOne({ id: actorUserId });
}

function signToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, name: user.name, email: user.email },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN },
  );
}

async function authenticate(request, response, next) {
  const header = request.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";

  if (!token) {
    response.status(401).json({ error: "Authentication required. Please sign in." });
    return;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const actor = await findActor(payload.sub);

    if (!actor) {
      response.status(401).json({ error: "Account not found. Please sign in again." });
      return;
    }

    request.actor = actor;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      response.status(401).json({ error: "Session expired. Please sign in again." });
    } else {
      response.status(401).json({ error: "Invalid session. Please sign in again." });
    }
  }
}

async function optionalAuthenticate(request, _response, next) {
  const header = request.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";

  if (token) {
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      request.actor = (await findActor(payload.sub)) ?? undefined;
    } catch {
      request.actor = undefined;
    }
  }

  next();
}

async function resetDatabase() {
  const collections = await getCollections();
  const seed = createSeedState();
  const hashedSeedUsers = await hashSeedPasswords(seed.users);

  await Promise.all([
    collections.users.deleteMany({}),
    collections.doctors.deleteMany({}),
    collections.appointments.deleteMany({}),
    collections.contactMessages.deleteMany({}),
  ]);

  await Promise.all([
    seed.users.length
      ? collections.users.insertMany(hashedSeedUsers.map((item, index) => ({ ...item, _seedIndex: index })))
      : null,
    seed.doctors.length
      ? collections.doctors.insertMany(seed.doctors.map((item, index) => ({ ...item, _seedIndex: index })))
      : null,
    seed.appointments.length
      ? collections.appointments.insertMany(
          seed.appointments.map((item, index) => ({ ...item, _seedIndex: index })),
        )
      : null,
  ]);
}

app.get("/api/health", async (_request, response) => {
  const { dbName, mongoUri } = getMongoConfig();

  response.json({
    dbName,
    mongoUri,
    ok: true,
  });
});

app.get("/api/app-state", optionalAuthenticate, async (request, response) => {
  response.json(await readAppState(request.actor));
});

app.post("/api/auth/login", authLimiter, async (request, response) => {
  const { users } = await getCollections();
  const email = normalizeEmail(request.body.email);
  const password = String(request.body.password ?? "");

  const matchedUser = await users.findOne({ email });
  const isValidPassword = matchedUser ? await verifyUserPassword(matchedUser, password) : false;

  if (!matchedUser || !isValidPassword) {
    response.status(401).json({
      error: "We could not match that email and password in the system.",
    });
    return;
  }

  response.json({
    ok: true,
    token: signToken(matchedUser),
    user: stripMongoFields(matchedUser),
  });
});

app.post("/api/patients/register", authLimiter, async (request, response) => {
  const { users } = await getCollections();
  const email = normalizeEmail(request.body.email);
  const name = String(request.body.name ?? "").trim();
  const nameKey = normalizeNameKey(name);
  const password = String(request.body.password ?? "").trim();
  const phone = String(request.body.phone ?? "");
  const cleanedPhone = normalizePhone(phone);

  const registrationError = validatePatientRegistration({ email, name, password, phone });
  if (registrationError) {
    response.status(400).json({ error: registrationError });
    return;
  }

  if (!hasValidPhone(phone)) {
    response.status(400).json({
      error: "Please enter a valid mobile number with at least 10 digits.",
    });
    return;
  }

  const existingUser = await users.findOne({ email });
  if (existingUser) {
    response.status(409).json({
      error: "Email already exists. Please sign in instead.",
    });
    return;
  }

  const existingName = await users.findOne({
    $or: [
      { nameKey },
      { name: { $regex: createNameMatchRegex(name), $options: "i" } },
    ],
  });
  if (existingName) {
    response.status(409).json({
      error: "Full name already exists. Please use a different name.",
    });
    return;
  }

  const newPatient = {
    id: createId("usr-patient"),
    role: "patient",
    name,
    nameKey,
    email,
    password,
    phone: cleanedPhone,
    createdAt: new Date().toISOString(),
  };

  await users.insertOne(newPatient);

  response.status(201).json({ ok: true, token: signToken(newPatient), user: stripMongoFields(newPatient) });
});

app.post("/api/appointments", authenticate, async (request, response) => {
  const actor = request.actor;
  if (actor.role !== "patient") {
    response.status(403).json({
      error: "Please sign in with a patient account before booking.",
    });
    return;
  }

  const { doctors, appointments } = await getCollections();
  const doctorId = String(request.body.doctorId ?? "");
  const doctor = await doctors.findOne({ id: doctorId });

  if (!doctor) {
    response.status(404).json({ error: "Selected doctor was not found." });
    return;
  }

  if (doctor.isAvailable === false) {
    response.status(409).json({
      error: "This doctor is temporarily unavailable for new bookings. Please try again later.",
    });
    return;
  }

  const selectedDate = String(request.body.selectedDate ?? "");
  const selectedSlot = String(request.body.selectedSlot ?? "");
  const reason = String(request.body.reason ?? "");
  const symptoms = String(request.body.symptoms ?? "");
  const patientPhone = normalizePhone(request.body.phone || actor.phone || "");

  if (!selectedDate || !selectedSlot || !reason.trim() || !symptoms.trim()) {
    response.status(400).json({
      error: "Please complete the visit details before sending the request.",
    });
    return;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const selectedDateTime = new Date(`${selectedDate}T00:00:00`);
  if (Number.isNaN(selectedDateTime.getTime()) || selectedDateTime <= today) {
    response.status(400).json({
      error: "Please choose a slot from tomorrow onwards. Same-day and past dates are not bookable.",
    });
    return;
  }

  if (!hasValidPhone(patientPhone)) {
    response.status(400).json({
      error: "Please enter a valid mobile number with at least 10 digits.",
    });
    return;
  }

  const appointment = {
    id: createId("apt"),
    patientId: actor.id,
    patientName: actor.name,
    patientEmail: actor.email,
    phone: patientPhone,
    doctorId: doctor.id,
    doctorName: doctor.name,
    specialty: doctor.specialty,
    appointmentDate: selectedDate,
    appointmentSlot: selectedSlot,
    consultationMode: String(request.body.consultationMode ?? "In-clinic"),
    priority: String(request.body.priority ?? "Routine"),
    reason: reason.trim(),
    symptoms: symptoms.trim(),
    status: "Requested",
    adminSummary: "",
    doctorSummary: "",
    prescription: [],
    followUpDate: "",
    bookedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  await appointments.insertOne(appointment);
  response.status(201).json({ ok: true, appointment });
});

app.patch("/api/appointments/:appointmentId/admin", authenticate, async (request, response) => {
  const actor = request.actor;
  if (actor.role !== "admin") {
    response.status(403).json({
      error: "Only admin accounts can update the triage board.",
    });
    return;
  }

  const { appointments } = await getCollections();
  const appointment = await appointments.findOne({ id: request.params.appointmentId });
  if (!appointment) {
    response.status(404).json({ error: "Appointment not found." });
    return;
  }

  const nextStatus = String(request.body.status ?? APPOINTMENT_STATUS.REQUESTED);
  const transitionError = validateAdminTransition(appointment.status, nextStatus);
  if (transitionError) {
    response.status(400).json({ error: transitionError });
    return;
  }

  const result = await appointments.updateOne(
    { id: request.params.appointmentId },
    {
      $set: {
        status: nextStatus,
        consultationMode: String(request.body.consultationMode ?? "In-clinic"),
        appointmentDate: String(request.body.appointmentDate ?? ""),
        appointmentSlot: String(request.body.appointmentSlot ?? ""),
        adminSummary: String(request.body.adminSummary ?? "").trim(),
        updatedAt: new Date().toISOString(),
      },
    },
  );

  if (!result.matchedCount) {
    response.status(404).json({ error: "Appointment not found." });
    return;
  }

  response.json({ ok: true });
});

app.patch("/api/appointments/:appointmentId/doctor", authenticate, async (request, response) => {
  const actor = request.actor;
  if (actor.role !== "doctor") {
    response.status(403).json({
      error: "Only doctor accounts can update doctor-handled appointments.",
    });
    return;
  }

  const { appointments } = await getCollections();
  const appointment = await appointments.findOne({
    id: request.params.appointmentId,
    doctorId: actor.linkedDoctorId,
  });
  if (!appointment) {
    response.status(404).json({ error: "Appointment not found for this doctor." });
    return;
  }

  const nextStatus = String(request.body.status ?? APPOINTMENT_STATUS.COMPLETED);
  const transitionError = validateDoctorTransition(appointment.status, nextStatus);
  if (transitionError) {
    response.status(400).json({ error: transitionError });
    return;
  }

  const update = {
    status: nextStatus,
    updatedAt: new Date().toISOString(),
  };

  if (nextStatus === APPOINTMENT_STATUS.COMPLETED) {
    const doctorSummary = String(request.body.doctorSummary ?? "").trim();
    if (!doctorSummary) {
      response.status(400).json({
        error: "Please add a consultation summary before completing the visit.",
      });
      return;
    }

    update.doctorSummary = doctorSummary;
    update.prescription = String(request.body.prescriptionItems ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    update.followUpDate = String(request.body.followUpDate ?? "");
  }

  const result = await appointments.updateOne(
    { id: request.params.appointmentId, doctorId: actor.linkedDoctorId },
    {
      $set: update,
    },
  );

  if (!result.matchedCount) {
    response.status(404).json({ error: "Appointment not found for this doctor." });
    return;
  }

  response.json({ ok: true });
});

app.post("/api/contact-messages", optionalAuthenticate, async (request, response) => {
  const actor = request.actor;
  const email = normalizeEmail(request.body.email || actor?.email || "");
  const phone = normalizePhone(request.body.phone || actor?.phone || "");
  const name = String(request.body.name ?? "").trim() || actor?.name || "Visitor";
  const subject = String(request.body.subject ?? "").trim();
  const message = String(request.body.message ?? "").trim();

  if (!name || !email || !subject || !message) {
    response.status(400).json({
      error: "Please complete the contact form before sending it.",
    });
    return;
  }

  if (phone && !hasValidPhone(phone)) {
    response.status(400).json({
      error: "Please enter a valid mobile number with at least 10 digits.",
    });
    return;
  }

  const { contactMessages } = await getCollections();
  const contactMessage = {
    id: createId("msg"),
    name,
    email,
    phone,
    category: String(request.body.category ?? "General question"),
    subject,
    message,
    submittedByRole: actor?.role ?? "guest",
    createdAt: new Date().toISOString(),
  };

  await contactMessages.insertOne(contactMessage);
  response.status(201).json({ ok: true, contactMessage });
});

app.post("/api/doctors/upsert", authenticate, async (request, response) => {
  const actor = request.actor;
  if (actor.role !== "admin") {
    response.status(403).json({
      error: "Only admin accounts can manage doctor profiles.",
    });
    return;
  }

  const form = request.body.form ?? {};
  const requiredFields = [
    form.name,
    form.specialty,
    form.clinic,
    form.experience,
    form.fee,
    form.location,
    form.languages,
    form.focusAreas,
    form.credentials,
    form.intro,
    form.about,
    form.email,
    form.phone,
    form.availabilityDate,
  ];

  if (requiredFields.some((value) => !String(value ?? "").trim())) {
    response.status(400).json({ error: "Please complete all doctor profile fields." });
    return;
  }

  if (!hasValidPhone(form.phone)) {
    response.status(400).json({
      error: "Doctor contact number must contain at least 10 digits.",
    });
    return;
  }

  if (!Number.isFinite(Number(form.fee)) || Number(form.fee) <= 0) {
    response.status(400).json({
      error: "Consultation fee must be a valid amount.",
    });
    return;
  }

  const { doctors, users } = await getCollections();
  const doctorId = String(form.doctorId ?? "");
  const existingDoctor = doctorId ? await doctors.findOne({ id: doctorId }) : null;
  const existingUser = doctorId ? await users.findOne({ linkedDoctorId: doctorId }) : null;
  const normalizedEmail = normalizeEmail(form.email);
  const conflictingUser = await users.findOne({
    email: normalizedEmail,
    ...(existingUser ? { id: { $ne: existingUser.id } } : {}),
  });

  if (conflictingUser) {
    response.status(409).json({
      error: "That doctor email is already assigned to another account.",
    });
    return;
  }

  const doctorRecord = buildDoctorRecord({ existingDoctor, form });
  const tempPassword = generateTempPassword();
  const doctorUser = {
    id: existingUser?.id ?? doctorRecord.userId,
    role: "doctor",
    name: doctorRecord.name,
    nameKey: normalizeNameKey(doctorRecord.name),
    email: normalizedEmail,
    phone: normalizePhone(form.phone),
    linkedDoctorId: doctorRecord.id,
    createdAt: existingUser?.createdAt ?? new Date().toISOString(),
    ...(existingUser?.passwordHash
      ? { passwordHash: existingUser.passwordHash }
      : existingUser?.password
        ? { password: existingUser.password }
        : { passwordHash: await hashPassword(tempPassword, 10) }),
  };

  if (existingDoctor) {
    await doctors.updateOne(
      { id: existingDoctor.id },
      {
        $set: {
          ...doctorRecord,
          createdAt: existingDoctor.createdAt ?? new Date().toISOString(),
        },
      },
    );
  } else {
    await doctors.insertOne({
      ...doctorRecord,
      createdAt: new Date().toISOString(),
    });
  }

  if (existingUser) {
    await users.updateOne({ id: existingUser.id }, { $set: doctorUser });
  } else {
    await users.insertOne(doctorUser);
  }

  response.json({
    ok: true,
    message: existingDoctor
      ? "Doctor profile updated successfully."
      : `Doctor profile created. One-time temporary password: ${tempPassword} (shown once, share it securely).`,
  });
});

app.patch("/api/doctors/:doctorId/availability", authenticate, async (request, response) => {
  const actor = request.actor;
  if (actor.role !== "admin") {
    response.status(403).json({
      error: "Only admin accounts can change doctor availability.",
    });
    return;
  }

  const { doctors } = await getCollections();
  const doctorId = String(request.params.doctorId ?? "");
  const doctor = await doctors.findOne({ id: doctorId });

  if (!doctor) {
    response.status(404).json({ error: "Selected doctor was not found." });
    return;
  }

  const isAvailable = request.body.isAvailable === true;
  await doctors.updateOne({ id: doctorId }, { $set: { isAvailable } });

  response.json({
    ok: true,
    doctor: refreshDoctorSchedule({ ...doctor, isAvailable }),
    message: isAvailable
      ? `${doctor.name} is now marked as available for new bookings.`
      : `${doctor.name} is now marked as unavailable for new bookings.`,
  });
});

app.post("/api/reset", authenticate, async (request, response) => {
  if (request.actor.role !== "admin") {
    response.status(403).json({ error: "Only admin accounts can reset the demo data." });
    return;
  }

  await resetDatabase();
  response.json({ ok: true });
});

app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(500).json({
    error: "The care workspace could not complete that request right now.",
  });
});

if (existsSync(indexPath)) {
  app.get("/{*path}", (_request, response, next) => {
    if (_request.path.startsWith("/api")) {
      next();
      return;
    }

    response.sendFile(indexPath);
  });
}

async function start() {
  await ensureSeedData();
  await repairLegacyData();

  // POST /api/ai-assistant
  app.post("/api/ai-assistant", aiLimiter, async (req, res) => {
    const { messages, sessionId } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "messages array is required" });
    }

    if (messages.some((item) => typeof item?.content !== "string" || item.content.length > 2000)) {
      return res.status(400).json({ error: "Each message must be text of at most 2000 characters." });
    }

    if (messages.length > 40) {
      return res.status(400).json({ error: "Conversation too long — please start a new session" });
    }

    try {
      const { doctors } = await getCollections();
      const catalogue = await doctors
        .find({}, { projection: { _id: 0, id: 1, name: 1, specialty: 1, focusAreas: 1, isAvailable: 1 } })
        .toArray();
      const result = await getTriageResponse({ messages, doctors: catalogue });

      if (sessionId) {
        // Keep a small, auto-expiring (30 days) log so answers can be reviewed and the rules improved.
        const latest = [...messages].reverse().find((item) => item.role === "user")?.content ?? "";
        const { assistantLogs } = await getCollections();
        await assistantLogs
          .insertOne({
            sessionId: String(sessionId).slice(0, 80),
            route: result.meta.route,
            llmCalls: result.meta.llmCalls,
            ms: result.meta.ms,
            model: result.meta.model,
            specialty: result.recommendation?.specialty ?? null,
            priority: result.recommendation?.priority ?? null,
            message: String(latest).slice(0, 300),
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          })
          .catch(() => {});
      }

      return res.json({ message: result.message, recommendation: result.recommendation });
    } catch (err) {
      console.error("AI assistant error:", err.message);
      return res.status(503).json({
        error: "The health assistant is offline right now. You can still browse specialists and book an appointment.",
      });
    }
  });

  app.listen(port, () => {
    console.log(`NovaCare API listening on http://127.0.0.1:${port}`);
    // Load the assistant's model now so the first patient does not wait for a cold start.
    warmUpModel()
      .then((ok) => console.log(ok ? "Assistant model ready" : "Assistant model not loaded (rules-only mode)"))
      .catch(() => {});
  });
}

start().catch(async (error) => {
  console.error("Failed to start NovaCare API", error);
  await closeDb();
  process.exit(1);
});

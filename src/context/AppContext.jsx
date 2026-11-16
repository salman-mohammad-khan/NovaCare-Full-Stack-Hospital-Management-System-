import { useCallback, useEffect, useMemo, useState } from "react";
import { api, getToken, setToken } from "../lib/api";
import { attachDoctorPhotos } from "../lib/doctorMedia";
import { createSeedState, readStoredSession, writeStoredSession } from "../lib/demoStore";
import { AppContext } from "./useAppContext";

const EMPTY_STATE = {
  appointments: [],
  contactMessages: [],
  doctors: [],
  users: [],
};

function decodeJwtSubject(token) {
  try {
    const payload = token.split(".")[1];
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return json.sub ?? "";
  } catch {
    return "";
  }
}

function resolveInitialSession() {
  const token = getToken();
  if (token) {
    return decodeJwtSubject(token) || readStoredSession();
  }
  return readStoredSession();
}

function asString(value, fallback = "") {
  return typeof value === "string" ? value : value == null ? fallback : String(value);
}

function asStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => asString(item).trim()).filter(Boolean);
}

function normalizeSchedule(schedule) {
  if (!Array.isArray(schedule)) {
    return [];
  }

  return schedule
    .map((entry) => ({
      date: asString(entry?.date),
      label: asString(entry?.label),
      slots: asStringArray(entry?.slots),
    }))
    .filter((entry) => entry.date && entry.label && entry.slots.length);
}

function normalizeDoctor(doctor) {
  return {
    ...doctor,
    id: asString(doctor?.id),
    userId: asString(doctor?.userId),
    name: asString(doctor?.name, "Doctor"),
    specialty: asString(doctor?.specialty, "General Medicine"),
    clinic: asString(doctor?.clinic),
    experience: asString(doctor?.experience),
    fee: Number(doctor?.fee) || 0,
    location: asString(doctor?.location),
    languages: asStringArray(doctor?.languages),
    nextAvailable: asString(doctor?.nextAvailable),
    intro: asString(doctor?.intro),
    about: asString(doctor?.about),
    focusAreas: asStringArray(doctor?.focusAreas),
    credentials: asString(doctor?.credentials),
    tone: asString(doctor?.tone, "teal"),
    avatarLabel: asString(doctor?.avatarLabel),
    isAvailable: doctor?.isAvailable !== false,
    schedule: normalizeSchedule(doctor?.schedule),
  };
}

function normalizeUser(user) {
  return {
    ...user,
    id: asString(user?.id),
    role: asString(user?.role),
    name: asString(user?.name, "User"),
    email: asString(user?.email),
    phone: asString(user?.phone),
    linkedDoctorId: asString(user?.linkedDoctorId),
  };
}

function normalizeAppointment(appointment) {
  return {
    ...appointment,
    id: asString(appointment?.id),
    patientId: asString(appointment?.patientId),
    patientName: asString(appointment?.patientName, "Patient"),
    patientEmail: asString(appointment?.patientEmail),
    phone: asString(appointment?.phone),
    doctorId: asString(appointment?.doctorId),
    doctorName: asString(appointment?.doctorName, "Doctor"),
    specialty: asString(appointment?.specialty),
    appointmentDate: asString(appointment?.appointmentDate),
    appointmentSlot: asString(appointment?.appointmentSlot),
    consultationMode: asString(appointment?.consultationMode),
    priority: asString(appointment?.priority),
    reason: asString(appointment?.reason),
    symptoms: asString(appointment?.symptoms),
    status: asString(appointment?.status, "Requested"),
    adminSummary: asString(appointment?.adminSummary),
    doctorSummary: asString(appointment?.doctorSummary),
    prescription: asStringArray(appointment?.prescription),
    followUpDate: asString(appointment?.followUpDate),
    bookedAt: asString(appointment?.bookedAt || appointment?.createdAt),
    updatedAt: asString(appointment?.updatedAt || appointment?.createdAt),
    createdAt: asString(appointment?.createdAt || appointment?.bookedAt),
  };
}

function normalizeContactMessage(message) {
  return {
    ...message,
    id: asString(message?.id),
    name: asString(message?.name, "Visitor"),
    email: asString(message?.email),
    phone: asString(message?.phone),
    category: asString(message?.category, "General question"),
    subject: asString(message?.subject, "New message"),
    message: asString(message?.message),
    submittedByRole: asString(message?.submittedByRole, "guest"),
    createdAt: asString(message?.createdAt, new Date().toISOString()),
  };
}

function normalizeAppState(state) {
  return {
    appointments: (state?.appointments ?? []).map(normalizeAppointment),
    contactMessages: (state?.contactMessages ?? []).map(normalizeContactMessage),
    doctors: attachDoctorPhotos((state?.doctors ?? []).map(normalizeDoctor).map(refreshDoctorSchedule)),
    users: (state?.users ?? []).map(normalizeUser),
    stats: state?.stats ?? null,
  };
}

const DEFAULT_DOCTOR_SLOTS = [
  ["10:00 AM", "01:00 PM", "04:00 PM"],
  ["09:30 AM", "12:30 PM", "03:30 PM"],
  ["11:00 AM", "02:00 PM", "05:00 PM"],
];

function formatScheduleLabel(date) {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(date);
}

function refreshDoctorSchedule(doctor) {
  const today = new Date();
  const schedule = Array.from({ length: 3 }, (_, index) => {
    const date = new Date(today);
    date.setDate(date.getDate() + index + 1);
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
    schedule,
    nextAvailable: `${schedule[0].label} at ${schedule[0].slots[0]}`,
  };
}

function asErrorMessage(error) {
  return error instanceof Error ? error.message : "The care workspace could not complete that request.";
}

export function AppProvider({ children }) {
  const [appState, setAppState] = useState(EMPTY_STATE);
  const [sessionUserId, setSessionUserId] = useState(resolveInitialSession);
  const [isHydrating, setIsHydrating] = useState(true);
  const [backendError, setBackendError] = useState("");

  const refreshAppState = useCallback(async ({ allowSeedFallback = false } = {}) => {
    try {
      const state = await api.getAppState();
      setAppState(normalizeAppState(state));
      // A signed-in caller always gets at least their own user back. If a stored token
      // comes back with none, the server no longer accepts it, so drop it and sign out.
      if (getToken() && !(state?.users ?? []).length) {
        setToken("");
        setSessionUserId("");
      }
      setBackendError("");
      return { ok: true, state };
    } catch (error) {
      const message = asErrorMessage(error);

      if (allowSeedFallback) {
        setAppState(normalizeAppState(createSeedState()));
      }

      setBackendError(message);
      return { ok: false, error: message };
    } finally {
      setIsHydrating(false);
    }
  }, []);

  useEffect(() => {
    void refreshAppState({ allowSeedFallback: true });
  }, [refreshAppState]);

  useEffect(() => {
    writeStoredSession(sessionUserId);
  }, [sessionUserId]);

  useEffect(() => {
    const handleExpired = () => {
      setSessionUserId("");
      void refreshAppState({ allowSeedFallback: true });
    };

    window.addEventListener("novacare:session-expired", handleExpired);
    return () => window.removeEventListener("novacare:session-expired", handleExpired);
  }, [refreshAppState]);

  const currentUser =
    appState.users.find((user) => user.id === sessionUserId) ?? null;

  const login = useCallback(async ({ email, password }) => {
    try {
      const result = await api.login({ email, password });
      setToken(result.token);
      setSessionUserId(result.user.id);
      await refreshAppState();
      return result;
    } catch (error) {
      return {
        ok: false,
        error: asErrorMessage(error),
      };
    }
  }, [refreshAppState]);

  const logout = useCallback(async () => {
    setToken("");
    setSessionUserId("");
    await refreshAppState({ allowSeedFallback: true });
    return { ok: true };
  }, [refreshAppState]);

  const registerPatient = useCallback(
    async (form) => {
      try {
        const result = await api.registerPatient(form);
        // If email verification is pending, don't log the user in yet
        if (result.ok && !result.awaitingVerification) {
          setToken(result.token);
          setSessionUserId(result.user.id);
          await refreshAppState();
        }
        return result;
      } catch (error) {
        return {
          ok: false,
          error: asErrorMessage(error),
        };
      }
    },
    [refreshAppState],
  );

  const bookAppointment = useCallback(
    async (form) => {
      try {
        const result = await api.bookAppointment(form);
        await refreshAppState();
        return result;
      } catch (error) {
        return {
          ok: false,
          error: asErrorMessage(error),
        };
      }
    },
    [refreshAppState],
  );

  const updateAppointmentByAdmin = useCallback(
    async ({
      adminSummary,
      appointmentDate,
      appointmentId,
      appointmentSlot,
      consultationMode,
      status,
    }) => {
      try {
        const result = await api.updateAppointmentByAdmin(appointmentId, {
          adminSummary,
          appointmentDate,
          appointmentSlot,
          consultationMode,
          status,
        });
        await refreshAppState();
        return result;
      } catch (error) {
        return {
          ok: false,
          error: asErrorMessage(error),
        };
      }
    },
    [refreshAppState],
  );

  const updateAppointmentByDoctor = useCallback(
    async ({
      appointmentId,
      doctorSummary,
      followUpDate,
      prescriptionItems,
      status,
    }) => {
      try {
        const result = await api.updateAppointmentByDoctor(appointmentId, {
          doctorSummary,
          followUpDate,
          prescriptionItems,
          status,
        });
        await refreshAppState();
        return result;
      } catch (error) {
        return {
          ok: false,
          error: asErrorMessage(error),
        };
      }
    },
    [refreshAppState],
  );

  const submitContactMessage = useCallback(
    async (form) => {
      try {
        const result = await api.submitContactMessage(form);
        await refreshAppState();
        return result;
      } catch (error) {
        return {
          ok: false,
          error: asErrorMessage(error),
        };
      }
    },
    [refreshAppState],
  );

  const saveDoctorProfile = useCallback(
    async (form) => {
      try {
        const result = await api.saveDoctorProfile({ form });
        await refreshAppState();
        return result;
      } catch (error) {
        return {
          ok: false,
          error: asErrorMessage(error),
        };
      }
    },
    [refreshAppState],
  );

  const toggleDoctorAvailability = useCallback(
    async (doctorId, isAvailable) => {
      try {
        const result = await api.toggleDoctorAvailability(doctorId, {
          isAvailable,
        });
        await refreshAppState();
        return result;
      } catch (error) {
        return {
          ok: false,
          error: asErrorMessage(error),
        };
      }
    },
    [refreshAppState],
  );

  const resetDemoData = useCallback(async () => {
    try {
      const result = await api.resetDemoData();
      setToken("");
      setSessionUserId("");
      await refreshAppState({ allowSeedFallback: true });
      return result;
    } catch (error) {
      return {
        ok: false,
        error: asErrorMessage(error),
      };
    }
  }, [refreshAppState]);

  const value = useMemo(
    () => ({
      appointmentCount: appState.appointments.length,
      appointments: appState.appointments,
      backendError,
      bookAppointment,
      contactMessages: appState.contactMessages,
      currentUser,
      doctors: appState.doctors,
      isHydrating,
      login,
      logout,
      refreshAppState,
      registerPatient,
      resetDemoData,
      saveDoctorProfile,
      submitContactMessage,
      toggleDoctorAvailability,
      updateAppointmentByDoctor,
      updateAppointmentByAdmin,
      stats: appState.stats,
      users: appState.users,
    }),
    [
      appState.appointments,
      appState.contactMessages,
      appState.doctors,
      appState.users,
      appState.stats,
      backendError,
      bookAppointment,
      currentUser,
      isHydrating,
      login,
      logout,
      refreshAppState,
      registerPatient,
      resetDemoData,
      saveDoctorProfile,
      submitContactMessage,
      toggleDoctorAvailability,
      updateAppointmentByDoctor,
      updateAppointmentByAdmin,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

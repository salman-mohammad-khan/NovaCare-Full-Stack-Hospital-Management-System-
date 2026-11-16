const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";
export const TOKEN_KEY = "NovaCare:token:v1";

export function getToken() {
  try {
    return window.localStorage.getItem(TOKEN_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setToken(token) {
  try {
    if (token) {
      window.localStorage.setItem(TOKEN_KEY, token);
    } else {
      window.localStorage.removeItem(TOKEN_KEY);
    }
  } catch { /* ignore */ }
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers ?? {}),
  };

  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers,
    ...options,
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};

  if (!response.ok) {
    if (response.status === 401 && token && !path.startsWith("/auth/")) {
      setToken("");
      window.dispatchEvent(new Event("novacare:session-expired"));
    }

    throw new Error(payload.error ?? "The request could not be completed.");
  }

  return payload;
}

export const api = {
  async getAppState() {
    return request("/app-state");
  },
  async login(credentials) {
    return request("/auth/login", {
      body: JSON.stringify(credentials),
      method: "POST",
    });
  },
  async registerPatient(payload) {
    return request("/patients/register", {
      body: JSON.stringify(payload),
      method: "POST",
    });
  },
  async bookAppointment(payload) {
    return request("/appointments", {
      body: JSON.stringify(payload),
      method: "POST",
    });
  },
  async updateAppointmentByAdmin(appointmentId, payload) {
    return request(`/appointments/${appointmentId}/admin`, {
      body: JSON.stringify(payload),
      method: "PATCH",
    });
  },
  async updateAppointmentByDoctor(appointmentId, payload) {
    return request(`/appointments/${appointmentId}/doctor`, {
      body: JSON.stringify(payload),
      method: "PATCH",
    });
  },
  async completeAppointmentByDoctor(appointmentId, payload) {
    return request(`/appointments/${appointmentId}/doctor`, {
      body: JSON.stringify(payload),
      method: "PATCH",
    });
  },
  async submitContactMessage(payload) {
    return request("/contact-messages", {
      body: JSON.stringify(payload),
      method: "POST",
    });
  },
  async saveDoctorProfile(payload) {
    return request("/doctors/upsert", {
      body: JSON.stringify(payload),
      method: "POST",
    });
  },
  async toggleDoctorAvailability(doctorId, payload) {
    return request(`/doctors/${doctorId}/availability`, {
      body: JSON.stringify(payload),
      method: "PATCH",
    });
  },
  async resetDemoData() {
    return request("/reset", {
      method: "POST",
    });
  },
};

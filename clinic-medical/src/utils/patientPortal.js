export function resolveApiBaseUrl() {
  const configuredApiUrl = (import.meta.env.VITE_API_URL || '').trim();
  if (configuredApiUrl) {
    return configuredApiUrl.replace(/\/+$/, '');
  }

  if (typeof window === 'undefined') {
    return 'http://localhost:3001';
  }

  const localHosts = ['localhost', '127.0.0.1', '::1'];
  if (localHosts.includes(window.location.hostname)) {
    return 'http://localhost:3001';
  }

  // In local Vite dev, keep API calls pinned to the backend service.
  if (window.location.port === '5173') {
    return 'http://localhost:3001';
  }

  return window.location.origin.replace(/\/+$/, '');
}

export function getPatientPortalSession() {
  try {
    const raw = localStorage.getItem('patientPortalSession');
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!parsed?.patientId) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearPatientPortalSession() {
  localStorage.removeItem('patientPortalSession');
}

export function getAdminPortalSession() {
  try {
    const raw = localStorage.getItem('adminPortalSession');
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!parsed?.username || !parsed?.isAdmin) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function setAdminPortalSession(session) {
  localStorage.setItem('adminPortalSession', JSON.stringify(session));
}

export function clearAdminPortalSession() {
  localStorage.removeItem('adminPortalSession');
}

export function getDentistPortalSession() {
  try {
    const raw = localStorage.getItem('dentistPortalSession');
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!parsed?.userId && !parsed?.doctorId && !parsed?.username) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function setDentistPortalSession(session) {
  localStorage.setItem('dentistPortalSession', JSON.stringify(session));
}

export function clearDentistPortalSession() {
  localStorage.removeItem('dentistPortalSession');
}

export function getReceptionPortalSession() {
  try {
    const raw = localStorage.getItem('receptionPortalSession');
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!parsed?.staffId && !parsed?.username) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function setReceptionPortalSession(session) {
  localStorage.setItem('receptionPortalSession', JSON.stringify(session));
}

export function clearReceptionPortalSession() {
  localStorage.removeItem('receptionPortalSession');
}

export function formatDate(value) {
  if (!value) {
    return 'N/A';
  }
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(date);
}

export function formatTime(value) {
  if (!value) {
    return 'N/A';
  }
  const parts = String(value).split(':');
  const hour = Number(parts[0]);
  const minute = Number(parts[1]);
  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return String(value);
  }
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit'
  }).format(date);
}

export function formatMoney(value) {
  const numeric = Number(value || 0);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(numeric);
}

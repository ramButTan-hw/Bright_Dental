function createPatientPortalRoutes(handlers) {
  const {
    sendJSON,
    getDoctorAppointments,
    getPatientByUserId,
    getPatientPastAppointmentReport,
    getPatientAppointments,
    getPatientNewAppointmentPrefill,
    createPatientNewAppointmentRequest,
    getPatientPrimaryDentist,
    getPatientAppointmentReport,
    getPatientById,
    loginUser,
    checkPatientEmail,
    registerPatient,
    getPainSymptoms,
    getPreferredAppointmentAvailability,
    getAppointmentPreferenceRequests,
    getAppointmentPreferenceRequestById,
    assignAppointmentPreferenceRequest
  } = handlers;

  function handlePatientPortalRoutes(req, res, method, parts, parseJSON) {
    if (method === 'GET' && parts[0] === 'api' && parts[1] === 'doctors' && parts[2] && parts[3] === 'appointments') {
      const doctorId = parseInt(parts[2], 10);
      getDoctorAppointments(req, doctorId, res);
      return true;
    }

    if (method === 'GET' && parts[0] === 'api' && parts[1] === 'patients' && parts[2] === 'user' && parts[3]) {
      const userId = parseInt(parts[3], 10);
      getPatientByUserId(req, userId, res);
      return true;
    }

    if (method === 'GET' && parts[0] === 'api' && parts[1] === 'patients' && parts[2] && parts[3] === 'appointments') {
      if (parts[4] && parts[5] === 'report') {
        const patientId = parseInt(parts[2], 10);
        const appointmentId = parseInt(parts[4], 10);
        getPatientPastAppointmentReport(req, patientId, appointmentId, res);
        return true;
      }
      const patientId = parseInt(parts[2], 10);
      getPatientAppointments(req, patientId, res);
      return true;
    }

    if (method === 'GET' && parts[0] === 'api' && parts[1] === 'patients' && parts[2] && parts[3] === 'new-appointment-prefill') {
      const patientId = parseInt(parts[2], 10);
      getPatientNewAppointmentPrefill(req, patientId, res);
      return true;
    }

    if (method === 'POST' && parts[0] === 'api' && parts[1] === 'patients' && parts[2] && parts[3] === 'new-appointment-request') {
      const patientId = parseInt(parts[2], 10);
      parseJSON(req, (err, data) => {
        if (err) {
          return sendJSON(res, 400, { error: 'Invalid JSON' });
        }
        createPatientNewAppointmentRequest(req, patientId, data, res);
      });
      return true;
    }

    if (method === 'GET' && parts[0] === 'api' && parts[1] === 'patients' && parts[2] && parts[3] === 'primary-dentist') {
      const patientId = parseInt(parts[2], 10);
      getPatientPrimaryDentist(req, patientId, res);
      return true;
    }

    if (method === 'GET' && parts[0] === 'api' && parts[1] === 'patients' && parts[2] && parts[3] === 'report') {
      const patientId = parseInt(parts[2], 10);
      getPatientAppointmentReport(req, patientId, res);
      return true;
    }

    if (method === 'GET' && parts[0] === 'api' && parts[1] === 'patients' && parts[2] && !parts[3]) {
      const patientId = parseInt(parts[2], 10);
      getPatientById(req, patientId, res);
      return true;
    }

    if (method === 'POST' && parts[0] === 'api' && parts[1] === 'login') {
      parseJSON(req, (err, data) => {
        if (err) {
          return sendJSON(res, 400, { error: 'Invalid JSON' });
        }
        loginUser(req, data, res);
      });
      return true;
    }

    if (method === 'POST' && parts[0] === 'api' && parts[1] === 'patients' && parts[2] === 'check-email') {
      parseJSON(req, (err, data) => {
        if (err) {
          return sendJSON(res, 400, { error: 'Invalid JSON' });
        }
        checkPatientEmail(req, data, res);
      });
      return true;
    }

    if (method === 'POST' && parts[0] === 'api' && parts[1] === 'patients' && parts[2] === 'register') {
      parseJSON(req, (err, data) => {
        if (err) {
          return sendJSON(res, 400, { error: 'Invalid JSON' });
        }
        registerPatient(req, data, res);
      });
      return true;
    }

    if (method === 'GET' && parts[0] === 'api' && parts[1] === 'intake' && parts[2] === 'pain-symptoms') {
      getPainSymptoms(req, res);
      return true;
    }

    if (method === 'GET' && parts[0] === 'api' && parts[1] === 'appointments' && parts[2] === 'preferred-availability') {
      getPreferredAppointmentAvailability(req, res);
      return true;
    }
    if (method === 'GET' && parts[0] === 'api' && parts[1] === 'appointments' && parts[2] === 'preference-requests' && parts[3] && !parts[4]) {
      const preferenceRequestId = Number(parts[3]);
      if (!Number.isInteger(preferenceRequestId) || preferenceRequestId <= 0) {
        sendJSON(res, 400, { error: 'Invalid preference request id' });
        return true;
      }
      getAppointmentPreferenceRequestById(req, preferenceRequestId, res);
      return true;
    }

    if (method === 'GET' && parts[0] === 'api' && parts[1] === 'appointments' && parts[2] === 'preference-requests') {
      getAppointmentPreferenceRequests(req, res);
      return true;
    }

    if (method === 'PUT' && parts[0] === 'api' && parts[1] === 'appointments' && parts[2] === 'preference-requests' && parts[3] && parts[4] === 'assign') {
      const preferenceRequestId = Number(parts[3]);
      if (!Number.isInteger(preferenceRequestId) || preferenceRequestId <= 0) {
        sendJSON(res, 400, { error: 'Invalid preference request id' });
        return true;
      }

      parseJSON(req, (err, data) => {
        if (err) {
          return sendJSON(res, 400, { error: 'Invalid JSON' });
        }
        assignAppointmentPreferenceRequest(req, preferenceRequestId, data, res);
      });
      return true;
    }

    return false;
  }

  return {
    handlePatientPortalRoutes
  };
}

module.exports = {
  createPatientPortalRoutes
};

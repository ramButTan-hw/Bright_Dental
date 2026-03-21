function createAdminRoutes(handlers) {
  const {
    sendJSON,
    getAdminDashboardSummary,
    getAdminAppointmentsQueue,
    getAdminScheduledPatients,
    getAdminPatientsReport,
    getAdminStaffReport,
    getAdminDoctors,
    createAdminDoctor,
    getAdminLocations,
    createAdminLocation,
    getAdminDoctorTimeOff,
    getAdminStaffTimeOffRequests,
    createAdminDoctorTimeOff,
    approveAdminDoctorTimeOff,
    denyAdminDoctorTimeOff,
    createStaffTimeOffRequest,
    approveAdminStaffTimeOffRequest,
    denyAdminStaffTimeOffRequest,
    getAdminStaffMembersByRole,
    createAdminStaffMember
  } = handlers;

  function handleAdminRoutes(req, res, method, parts, parseJSON, parsedUrl) {
    if (method === 'GET' && parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'dashboard' && parts[3] === 'summary') {
      getAdminDashboardSummary(req, res);
      return true;
    }

    if (method === 'GET' && parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'appointments' && parts[3] === 'queue') {
      getAdminAppointmentsQueue(req, res);
      return true;
    }

    if (method === 'GET' && parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'patients' && parts[3] === 'scheduled') {
      getAdminScheduledPatients(req, res);
      return true;
    }

    if (method === 'GET' && parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'reports' && parts[3] === 'patients') {
      getAdminPatientsReport(req, res);
      return true;
    }

    if (method === 'GET' && parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'reports' && parts[3] === 'staff') {
      getAdminStaffReport(req, res);
      return true;
    }

    if (method === 'GET' && parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'doctors' && !parts[3]) {
      getAdminDoctors(req, res);
      return true;
    }

    if (method === 'POST' && parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'doctors' && !parts[3]) {
      parseJSON(req, (err, data) => {
        if (err) {
          return sendJSON(res, 400, { error: 'Invalid JSON' });
        }
        createAdminDoctor(req, data, res);
      });
      return true;
    }

    if (method === 'GET' && parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'locations') {
      getAdminLocations(req, res);
      return true;
    }

    if (method === 'POST' && parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'locations') {
      parseJSON(req, (err, data) => {
        if (err) {
          return sendJSON(res, 400, { error: 'Invalid JSON' });
        }
        createAdminLocation(req, data, res);
      });
      return true;
    }

    if (method === 'GET' && parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'doctors' && parts[3] === 'time-off') {
      getAdminDoctorTimeOff(req, res);
      return true;
    }

    if (method === 'GET' && parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'staff' && parts[3] === 'time-off-requests') {
      getAdminStaffTimeOffRequests(req, res);
      return true;
    }

    if (method === 'POST' && parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'doctors' && parts[3] === 'time-off') {
      parseJSON(req, (err, data) => {
        if (err) {
          return sendJSON(res, 400, { error: 'Invalid JSON' });
        }
        createAdminDoctorTimeOff(req, data, res);
      });
      return true;
    }

    if (method === 'PUT' && parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'doctors' && parts[3] === 'time-off' && parts[4] && parts[5] === 'approve') {
      const timeOffId = Number(parts[4]);
      if (!Number.isInteger(timeOffId) || timeOffId <= 0) {
        sendJSON(res, 400, { error: 'Invalid time-off id' });
        return true;
      }
      approveAdminDoctorTimeOff(req, timeOffId, res);
      return true;
    }

    if (method === 'PUT' && parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'doctors' && parts[3] === 'time-off' && parts[4] && parts[5] === 'deny') {
      const timeOffId = Number(parts[4]);
      if (!Number.isInteger(timeOffId) || timeOffId <= 0) {
        sendJSON(res, 400, { error: 'Invalid time-off id' });
        return true;
      }
      denyAdminDoctorTimeOff(req, timeOffId, res);
      return true;
    }

    if (method === 'POST' && parts[0] === 'api' && parts[1] === 'staff' && parts[2] === 'time-off-requests') {
      parseJSON(req, (err, data) => {
        if (err) {
          return sendJSON(res, 400, { error: 'Invalid JSON' });
        }
        createStaffTimeOffRequest(req, data, res);
      });
      return true;
    }

    if (method === 'PUT' && parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'staff' && parts[3] === 'time-off' && parts[4] && parts[5] === 'approve') {
      const requestId = Number(parts[4]);
      if (!Number.isInteger(requestId) || requestId <= 0) {
        sendJSON(res, 400, { error: 'Invalid request id' });
        return true;
      }
      const source = String(parsedUrl.query.source || 'STAFF_TIME_OFF').trim().toUpperCase();
      if (!['STAFF_TIME_OFF', 'DOCTOR_TIME_OFF'].includes(source)) {
        sendJSON(res, 400, { error: 'Invalid source value' });
        return true;
      }
      approveAdminStaffTimeOffRequest(req, requestId, source, res);
      return true;
    }

    if (method === 'PUT' && parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'staff' && parts[3] === 'time-off' && parts[4] && parts[5] === 'deny') {
      const requestId = Number(parts[4]);
      if (!Number.isInteger(requestId) || requestId <= 0) {
        sendJSON(res, 400, { error: 'Invalid request id' });
        return true;
      }
      const source = String(parsedUrl.query.source || 'STAFF_TIME_OFF').trim().toUpperCase();
      if (!['STAFF_TIME_OFF', 'DOCTOR_TIME_OFF'].includes(source)) {
        sendJSON(res, 400, { error: 'Invalid source value' });
        return true;
      }
      denyAdminStaffTimeOffRequest(req, requestId, source, res);
      return true;
    }

    if (method === 'GET' && parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'staff' && parts[3] === 'hygienists') {
      getAdminStaffMembersByRole(req, 'HYGIENIST', res);
      return true;
    }

    if (method === 'GET' && parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'staff' && parts[3] === 'receptionists') {
      getAdminStaffMembersByRole(req, 'RECEPTIONIST', res);
      return true;
    }

    if (method === 'POST' && parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'staff' && parts[3] === 'hygienists') {
      parseJSON(req, (err, data) => {
        if (err) {
          return sendJSON(res, 400, { error: 'Invalid JSON' });
        }
        createAdminStaffMember(req, data, 'HYGIENIST', res);
      });
      return true;
    }

    if (method === 'POST' && parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'staff' && parts[3] === 'receptionists') {
      parseJSON(req, (err, data) => {
        if (err) {
          return sendJSON(res, 400, { error: 'Invalid JSON' });
        }
        createAdminStaffMember(req, data, 'RECEPTIONIST', res);
      });
      return true;
    }

    return false;
  }

  return {
    handleAdminRoutes
  };
}

module.exports = {
  createAdminRoutes
};

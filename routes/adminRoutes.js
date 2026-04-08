function createAdminRoutes(handlers) {
  const {
    sendJSON,
    getAdminDashboardSummary,
    getAdminAppointmentsQueue,
    getAdminFollowUpQueue,
    getAdminScheduledPatients,
    getAdminPatientsReport,
    getAdminStaffReport,
    getClinicPerformanceReport,
    getRecallReport,
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
    getStaffTimeOffRequestsByStaffId,
    approveAdminStaffTimeOffRequest,
    denyAdminStaffTimeOffRequest,
    getAdminStaffMembersByRole,
    createAdminStaffMember,
    resetStaffPassword,
    toggleStaffVisibility,
    getAdminAllStaff,
    generateAdminReport,
    getReportFilterOptions,
    getNewPatientsReport,
    getCancelledAppointmentRequests,
    restoreAppointmentRequest,
    submitScheduleRequest,
    getScheduleRequestsByStaffId,
    getAdminScheduleRequests,
    approveScheduleRequest,
    denyScheduleRequest,
    getStaffSchedules,
    getAllStaffSchedules,
    getStaffScheduleGaps,
    adminUpdateStaffSchedule,
    processRefund,
    getRefundHistory,
    getInvoiceLookup,
    getCancelledAppointments,
    getSystemCancelledAppointments
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

    if (method === 'GET' && parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'follow-ups' && parts[3] === 'queue') {
      getAdminFollowUpQueue(req, res);
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

    if (method === 'GET' && parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'reports' && parts[3] === 'performance') {
      getClinicPerformanceReport(req, res);
      return true;
    }

    if (method === 'GET' && parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'reports' && parts[3] === 'recall') {
      getRecallReport(req, res);
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

    if (method === 'GET' && parts[0] === 'api' && parts[1] === 'staff' && parts[2] === 'time-off-requests') {
      const staffId = Number(parsedUrl.query.staffId || 0);
      if (!Number.isInteger(staffId) || staffId <= 0) {
        sendJSON(res, 400, { error: 'A valid staffId query parameter is required' });
        return true;
      }
      getStaffTimeOffRequestsByStaffId(req, res, staffId);
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

    if (method === 'GET' && parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'staff' && parts[3] === 'receptionists') {
      getAdminStaffMembersByRole(req, 'RECEPTIONIST', res);
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

    // GET /api/admin/reports/generate — comprehensive report with filters
    if (method === 'GET' && parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'reports' && parts[3] === 'generate') {
      generateAdminReport(req, res);
      return true;
    }

    // GET /api/admin/reports/filter-options — dropdown options for report filters
    if (method === 'GET' && parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'reports' && parts[3] === 'filter-options') {
      getReportFilterOptions(req, res);
      return true;
    }

    // GET /api/admin/reports/new-patients — new patient registrations by date range
    if (method === 'GET' && parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'reports' && parts[3] === 'new-patients') {
      getNewPatientsReport(req, res);
      return true;
    }

    // GET /api/admin/appointment-requests/cancelled — list cancelled requests
    if (method === 'GET' && parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'appointment-requests' && parts[3] === 'cancelled') {
      getCancelledAppointmentRequests(req, res);
      return true;
    }

    // PUT /api/admin/appointment-requests/:id/restore — restore a cancelled request
    if (method === 'PUT' && parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'appointment-requests' && parts[3] && parts[4] === 'restore') {
      const requestId = Number(parts[3]);
      if (!Number.isInteger(requestId) || requestId <= 0) {
        sendJSON(res, 400, { error: 'Invalid request id' });
        return true;
      }
      restoreAppointmentRequest(req, requestId, res);
      return true;
    }

    // GET /api/admin/staff/all — get all staff including hidden
    if (method === 'GET' && parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'staff' && parts[3] === 'all') {
      getAdminAllStaff(req, res);
      return true;
    }

    // PUT /api/admin/staff/:staffId/reset-password
    if (method === 'PUT' && parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'staff' && parts[3] && parts[4] === 'reset-password') {
      const staffId = Number(parts[3]);
      if (!Number.isInteger(staffId) || staffId <= 0) {
        sendJSON(res, 400, { error: 'Invalid staff id' });
        return true;
      }
      parseJSON(req, (err, data) => {
        if (err) {
          return sendJSON(res, 400, { error: 'Invalid JSON' });
        }
        resetStaffPassword(req, staffId, data, res);
      });
      return true;
    }

    // PUT /api/admin/staff/:staffId/toggle-visibility
    if (method === 'PUT' && parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'staff' && parts[3] && parts[4] === 'toggle-visibility') {
      const staffId = Number(parts[3]);
      if (!Number.isInteger(staffId) || staffId <= 0) {
        sendJSON(res, 400, { error: 'Invalid staff id' });
        return true;
      }
      toggleStaffVisibility(req, staffId, res);
      return true;
    }

    // POST /api/staff/schedule-requests — staff submits preferred schedule
    if (method === 'POST' && parts[0] === 'api' && parts[1] === 'staff' && parts[2] === 'schedule-requests') {
      parseJSON(req, (err, data) => {
        if (err) {
          return sendJSON(res, 400, {
            error: 'Invalid JSON (SCHEDULE_REQ_V2)',
            detail: 'Schedule request body could not be parsed'
          });
        }
        submitScheduleRequest(req, data, res);
      });
      return true;
    }

    // GET /api/staff/schedule-requests?staffId=X — staff views their requests
    if (method === 'GET' && parts[0] === 'api' && parts[1] === 'staff' && parts[2] === 'schedule-requests') {
      const staffId = Number(parsedUrl.query.staffId || 0);
      if (!Number.isInteger(staffId) || staffId <= 0) {
        sendJSON(res, 400, { error: 'A valid staffId query parameter is required' });
        return true;
      }
      getScheduleRequestsByStaffId(req, res, staffId);
      return true;
    }

    // GET /api/staff/schedules?staffId=X — staff views their approved schedule
    if (method === 'GET' && parts[0] === 'api' && parts[1] === 'staff' && parts[2] === 'schedules' && !parts[3]) {
      const staffId = Number(parsedUrl.query.staffId || 0);
      if (!Number.isInteger(staffId) || staffId <= 0) {
        sendJSON(res, 400, { error: 'A valid staffId query parameter is required' });
        return true;
      }
      getStaffSchedules(req, res, staffId);
      return true;
    }

    // GET /api/admin/schedule-requests — admin views pending requests
    if (method === 'GET' && parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'schedule-requests') {
      getAdminScheduleRequests(req, res);
      return true;
    }

    // PUT /api/admin/schedule-requests/:id/approve
    if (method === 'PUT' && parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'schedule-requests' && parts[3] && parts[4] === 'approve') {
      const requestId = Number(parts[3]);
      if (!Number.isInteger(requestId) || requestId <= 0) {
        sendJSON(res, 400, { error: 'Invalid request id' });
        return true;
      }
      approveScheduleRequest(req, requestId, res);
      return true;
    }

    // PUT /api/admin/schedule-requests/:id/deny
    if (method === 'PUT' && parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'schedule-requests' && parts[3] && parts[4] === 'deny') {
      const requestId = Number(parts[3]);
      if (!Number.isInteger(requestId) || requestId <= 0) {
        sendJSON(res, 400, { error: 'Invalid request id' });
        return true;
      }
      denyScheduleRequest(req, requestId, res);
      return true;
    }

    // GET /api/admin/staff-schedules — all approved schedules
    if (method === 'GET' && parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'staff-schedules' && !parts[3]) {
      getAllStaffSchedules(req, res);
      return true;
    }

    // GET /api/admin/staff-schedules/gaps — empty hours
    if (method === 'GET' && parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'staff-schedules' && parts[3] === 'gaps') {
      getStaffScheduleGaps(req, res);
      return true;
    }

    // PUT /api/admin/staff-schedules/update — admin directly updates a staff member's schedule
    if (method === 'PUT' && parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'staff-schedules' && parts[3] === 'update') {
      parseJSON(req, (err, data) => {
        if (err) { res.writeHead(400); return res.end(JSON.stringify({ error: 'Invalid JSON' })); }
        adminUpdateStaffSchedule(req, data, res);
      });
      return true;
    }

    // POST /api/admin/refunds — process a refund
    if (method === 'POST' && parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'refunds') {
      parseJSON(req, (err, data) => {
        if (err) return sendJSON(res, 400, { error: 'Invalid JSON' });
        processRefund(req, data, res);
      });
      return true;
    }

    // GET /api/admin/invoices/:id — invoice lookup for refund autofill
    if (method === 'GET' && parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'invoices' && parts[3]) {
      const invoiceId = Number(parts[3]);
      if (!Number.isInteger(invoiceId) || invoiceId <= 0) {
        sendJSON(res, 400, { error: 'Valid invoice ID is required' });
        return true;
      }
      getInvoiceLookup(req, res, invoiceId);
      return true;
    }

    // GET /api/admin/refunds — refund history
    if (method === 'GET' && parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'refunds') {
      getRefundHistory(req, res);
      return true;
    }

    if (method === 'GET' && parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'cancelled-appointments') {
      getCancelledAppointments(req, res);
      return true;
    }

    if (method === 'GET' && parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'system-cancelled-appointments') {
      getSystemCancelledAppointments(req, res);
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

function createPatientPortalRoutes(handlers) {
  const pool = handlers.pool;
  const {
    sendJSON,
    getDoctorAppointments,
    getPatientByUserId,
    getPatientPastAppointmentReport,
    getPatientAppointments,
    getPatientAppointmentRequests,
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
    assignAppointmentPreferenceRequest,
    revertAppointmentPreferenceRequest,
    getCancelReasons,
    cancelPatientAppointment,
    getDepartments,
    getInsuranceCompanies,
    updatePatientProfile,
    addPatientInsurance,
    removePatientInsurance,
    getLocations,
    changeUserPassword
  } = handlers;

  function handlePatientPortalRoutes(req, res, method, parts, parseJSON) {
    if (method === 'GET' && parts[0] === 'api' && parts[1] === 'locations') {
        getLocations(req, res);
        return true;
    }

    // Public: all locations with contact info
    if (method === 'GET' && parts[0] === 'api' && parts[1] === 'public' && parts[2] === 'locations') {
      pool.query(
        `SELECT location_id, location_city, location_state, loc_street_no, loc_street_name, loc_zip_code, loc_phone, loc_email, loc_fax
         FROM locations
         ORDER BY location_city`,
        (err, rows) => {
          if (err) {
            console.error('Error fetching public locations:', err);
            return sendJSON(res, 500, { error: 'Database error' });
          }
          sendJSON(res, 200, rows || []);
        }
      );
      return true;
    }

    // Public: all staff grouped by role for Meet Our Staff page
    if (method === 'GET' && parts[0] === 'api' && parts[1] === 'public' && parts[2] === 'staff') {
      // First check if profile_image column exists
      pool.query(
        `SELECT COLUMN_NAME FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'staff' AND COLUMN_NAME = 'profile_image'`,
        (colErr, colRows) => {
          const hasImage = !colErr && colRows && colRows.length > 0;
          const imageSelect = hasImage ? ', TO_BASE64(s.profile_image) AS profile_image_base64' : ', NULL AS profile_image_base64';

          pool.query(
            `SELECT
               s.staff_id,
               s.first_name,
               s.last_name,
               s.phone_number,
               u.user_email,
               u.user_role,
               d.doctor_id,
               d.npi,
               GROUP_CONCAT(
                 DISTINCT CONCAT(l.location_city, ', ', l.location_state, ' - ', l.loc_street_no, ' ', l.loc_street_name)
                 SEPARATOR '||'
               ) AS locations
               ${imageSelect}
             FROM staff s
             JOIN users u ON u.user_id = s.user_id
             LEFT JOIN doctors d ON d.staff_id = s.staff_id
             LEFT JOIN staff_locations sl ON sl.staff_id = s.staff_id
             LEFT JOIN locations l ON l.location_id = sl.location_id
             WHERE u.is_deleted = 0
             GROUP BY s.staff_id
             ORDER BY u.user_role, s.last_name, s.first_name`,
            (err, rows) => {
              if (err) {
                console.error('Error fetching public staff:', err);
                return sendJSON(res, 500, { error: 'Database error' });
              }
              sendJSON(res, 200, rows || []);
            }
          );
        }
      );
      return true;
    }

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

    if (method === 'PUT' && parts[0] === 'api' && parts[1] === 'patients' && parts[2] && parts[3] === 'appointments' && parts[4] && parts[5] === 'cancel') {
      const patientId = parseInt(parts[2], 10);
      const appointmentId = parseInt(parts[4], 10);
      parseJSON(req, (err, data) => {
        if (err) {
          return sendJSON(res, 400, { error: 'Invalid JSON' });
        }
        cancelPatientAppointment(req, patientId, appointmentId, data, res);
      });
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

    if (method === 'GET' && parts[0] === 'api' && parts[1] === 'patients' && parts[2] && parts[3] === 'appointment-requests') {
      const patientId = parseInt(parts[2], 10);
      getPatientAppointmentRequests(req, patientId, res);
      return true;
    }

    // Patient cancels their own appointment request
    if (method === 'PUT' && parts[0] === 'api' && parts[1] === 'patients' && parts[2] && parts[3] === 'appointment-requests' && parts[4] && parts[5] === 'cancel') {
      const patientId = parseInt(parts[2], 10);
      const requestId = parseInt(parts[4], 10);
      if (!Number.isInteger(patientId) || patientId <= 0 || !Number.isInteger(requestId) || requestId <= 0) {
        sendJSON(res, 400, { error: 'Invalid patient or request id' });
        return true;
      }
      pool.query(
        `UPDATE appointment_preference_requests
         SET request_status = 'CANCELLED', updated_by = 'PATIENT_PORTAL'
         WHERE preference_request_id = ? AND patient_id = ? AND request_status IN ('PREFERRED_PENDING', 'ASSIGNED')`,
        [requestId, patientId],
        (err, result) => {
          if (err) {
            console.error('Error cancelling appointment request:', err);
            return sendJSON(res, 500, { error: 'Database error' });
          }
          if (!result.affectedRows) {
            return sendJSON(res, 404, { error: 'Request not found or already cancelled' });
          }
          sendJSON(res, 200, { message: 'Appointment request cancelled' });
        }
      );
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

    if (method === 'GET' && parts[0] === 'api' && parts[1] === 'cancel-reasons') {
      getCancelReasons(req, res);
      return true;
    }

    if (method === 'GET' && parts[0] === 'api' && parts[1] === 'departments') {
      getDepartments(req, res);
      return true;
    }

    if (method === 'GET' && parts[0] === 'api' && parts[1] === 'insurance-companies') {
      getInsuranceCompanies(req, res);
      return true;
    }

    if (method === 'PUT' && parts[0] === 'api' && parts[1] === 'patients' && parts[2] && parts[3] === 'profile') {
      const patientId = parseInt(parts[2], 10);
      parseJSON(req, (err, data) => {
        if (err) {
          return sendJSON(res, 400, { error: 'Invalid JSON' });
        }
        updatePatientProfile(req, patientId, data, res);
      });
      return true;
    }

    if (method === 'POST' && parts[0] === 'api' && parts[1] === 'patients' && parts[2] && parts[3] === 'insurance') {
      const patientId = parseInt(parts[2], 10);
      parseJSON(req, (err, data) => {
        if (err) {
          return sendJSON(res, 400, { error: 'Invalid JSON' });
        }
        addPatientInsurance(req, patientId, data, res);
      });
      return true;
    }

    if (method === 'DELETE' && parts[0] === 'api' && parts[1] === 'patients' && parts[2] && parts[3] === 'insurance' && parts[4]) {
      const patientId = parseInt(parts[2], 10);
      const insuranceId = parseInt(parts[4], 10);
      removePatientInsurance(req, patientId, insuranceId, res);
      return true;
    }

    if (method === 'GET' && parts[0] === 'api' && parts[1] === 'patients' && parts[2] && parts[3] === 'prescriptions') {
      const patientId = parseInt(parts[2], 10);
      pool.query(
        `SELECT
          rx.prescription_id,
          rx.medication_name,
          rx.strength,
          rx.dosage,
          rx.frequency,
          rx.instructions,
          rx.date_prescribed,
          rx.start_date,
          rx.end_date,
          rx.quantity,
          rx.refills,
          CONCAT(st.first_name, ' ', st.last_name) AS prescribing_doctor,
          ph.pharm_name AS pharmacy_name,
          ph.pharm_phone AS pharmacy_phone
        FROM prescriptions rx
        LEFT JOIN doctors d ON d.doctor_id = rx.doctor_id
        LEFT JOIN staff st ON st.staff_id = d.staff_id
        LEFT JOIN pharmacies ph ON ph.pharm_id = rx.pharm_id
        WHERE rx.patient_id = ?
        ORDER BY rx.date_prescribed DESC, rx.prescription_id DESC`,
        [patientId],
        (err, rows) => {
          if (err) {
            console.error('Error fetching patient prescriptions:', err);
            return sendJSON(res, 500, { error: 'Database error' });
          }
          sendJSON(res, 200, rows || []);
        }
      );
      return true;
    }

    if (method === 'GET' && parts[0] === 'api' && parts[1] === 'patients' && parts[2] && parts[3] === 'pharmacy') {
      const patientId = parseInt(parts[2], 10);
      pool.query(
        `SELECT
          ph.pharm_id,
          ph.pharm_name,
          ph.pharm_phone,
          ph.ph_address_1,
          ph.ph_city,
          ph.ph_state,
          ph.ph_zipcode,
          pp.is_primary
        FROM patient_pharmacies pp
        JOIN pharmacies ph ON ph.pharm_id = pp.pharm_id
        WHERE pp.patient_id = ?
        ORDER BY pp.is_primary DESC`,
        [patientId],
        (err, rows) => {
          if (err) {
            console.error('Error fetching patient pharmacy:', err);
            return sendJSON(res, 500, { error: 'Database error' });
          }
          sendJSON(res, 200, rows || []);
        }
      );
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

    if (method === 'PUT' && parts[0] === 'api' && parts[1] === 'appointments' && parts[2] === 'preference-requests' && parts[3] && parts[4] === 'revert') {
      const preferenceRequestId = Number(parts[3]);
      if (!Number.isInteger(preferenceRequestId) || preferenceRequestId <= 0) {
        sendJSON(res, 400, { error: 'Invalid preference request id' });
        return true;
      }

      parseJSON(req, (err, data) => {
        if (err) {
          return sendJSON(res, 400, { error: 'Invalid JSON' });
        }
        revertAppointmentPreferenceRequest(req, preferenceRequestId, data, res);
      });
      return true;
    }

    // PUT /api/appointments/preference-requests/:id/cancel — receptionist cancels a request
    if (method === 'PUT' && parts[0] === 'api' && parts[1] === 'appointments' && parts[2] === 'preference-requests' && parts[3] && parts[4] === 'cancel') {
      const preferenceRequestId = Number(parts[3]);
      if (!Number.isInteger(preferenceRequestId) || preferenceRequestId <= 0) {
        sendJSON(res, 400, { error: 'Invalid preference request id' });
        return true;
      }
      pool.query(
        `UPDATE appointment_preference_requests
         SET request_status = 'CANCELLED', updated_by = 'RECEPTIONIST_PORTAL'
         WHERE preference_request_id = ? AND request_status IN ('PREFERRED_PENDING', 'ASSIGNED')`,
        [preferenceRequestId],
        (err, result) => {
          if (err) {
            console.error('Error cancelling preference request:', err);
            return sendJSON(res, 500, { error: 'Database error' });
          }
          if (!result.affectedRows) {
            return sendJSON(res, 404, { error: 'Request not found or already cancelled' });
          }
          sendJSON(res, 200, { message: 'Appointment request cancelled' });
        }
      );
      return true;
    }

    // PUT /api/users/:userId/password — any user changes their own password
    if (method === 'PUT' && parts[0] === 'api' && parts[1] === 'users' && parts[2] && parts[3] === 'password') {
      const userId = parseInt(parts[2], 10);
      if (!Number.isInteger(userId) || userId <= 0) {
        sendJSON(res, 400, { error: 'Invalid user id' });
        return true;
      }
      parseJSON(req, (err, data) => {
        if (err) {
          return sendJSON(res, 400, { error: 'Invalid JSON' });
        }
        changeUserPassword(req, userId, data, res);
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

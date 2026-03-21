function createPatientIntakeHandlers(deps) {
  const {
    pool,
    queries,
    sendJSON,
    allowedPatientGenderIds,
    weekdayOptions,
    preferredTimeOptions
  } = deps;

  function getPainSymptoms(req, res) {
    pool.query(
      'SELECT pain_symptom_id, symptom_label, display_order FROM intake_pain_symptoms WHERE is_active = TRUE ORDER BY display_order ASC',
      (err, results) => {
        if (err) {
          console.error('Error fetching pain symptoms:', err);
          return sendJSON(res, 500, { error: 'Database error' });
        }
        sendJSON(res, 200, results);
      }
    );
  }

  function getLocations(req, res) {
    pool.query('SELECT * FROM locations', (err, results) => {
      if (err) {
        console.error('Error fetching locations:', err);
        return sendJSON(res, 500, { error: 'Database error' });
      }
      sendJSON(res, 200, results);
    });
  }

  function registerPatient(req, data, res) {
    const {
      firstName, lastName, dob, gender, phone, email, ssn, driversLicense,
      username, password, locationId, reason, address, emergencyContactName, emergencyContactPhone,
      medicalHistory, medicalHistoryOtherText, adverseReactions, medications, dentalFindings, dentalHistory,
      sleepSocial, tobacco, caffeine, painAssessment, appointmentSelection
    } = data;

    if (!firstName || !lastName || !dob || !gender || !phone || !email || !ssn || !driversLicense || !username || !password || !address || !emergencyContactName || !emergencyContactPhone) {
      return sendJSON(res, 400, {
        error: 'All identity fields including address and emergency contact details are required'
      });
    }

    const numericGender = Number(gender);
    if (!Number.isInteger(numericGender) || !allowedPatientGenderIds.has(numericGender)) {
      return sendJSON(res, 400, { error: 'Please select a valid gender.' });
    }

    const phonePattern = /^\(\d{3}\) \d{3}-\d{4}$/;
    const normalizedPhone = String(phone).trim();
    const normalizedEmergencyContactPhone = String(emergencyContactPhone).trim();

    if (!phonePattern.test(normalizedPhone)) {
      return sendJSON(res, 400, { error: 'Phone must be in the format (XXX) XXX-XXXX' });
    }
    if (!phonePattern.test(normalizedEmergencyContactPhone)) {
      return sendJSON(res, 400, { error: 'Emergency contact phone must be in the format (XXX) XXX-XXXX' });
    }

    const normalizedSsn = String(ssn).trim();
    const normalizedDriversLicense = String(driversLicense).trim().toUpperCase();
    const normalizedAddress = String(address).trim();
    const normalizedEmergencyContactName = String(emergencyContactName).trim();
    const ssnPattern = /^\d{3}-\d{2}-\d{4}$/;
    const driversLicensePattern = /^[A-Z0-9-]{5,20}$/;
    const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

    if (!ssnPattern.test(normalizedSsn)) {
      return sendJSON(res, 400, {
        error: 'SSN must be in the format XXX-XX-XXXX'
      });
    }

    if (!driversLicensePattern.test(normalizedDriversLicense)) {
      return sendJSON(res, 400, {
        error: 'Driver\'s license must be 5-20 characters using letters, numbers, or hyphens'
      });
    }

    if (!normalizedAddress) {
      return sendJSON(res, 400, { error: 'Address is required' });
    }

    if (!normalizedEmergencyContactPhone) {
      return sendJSON(res, 400, { error: 'Emergency contact number is required' });
    }

    if (!normalizedEmergencyContactName) {
      return sendJSON(res, 400, { error: 'Emergency contact name is required' });
    }

    const isIsoDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));

    if (dentalHistory && typeof dentalHistory === 'object') {
      const hasPerioHistory = dentalHistory.periodontalDiseaseYesNo === 'yes';
      const hasBracesHistory = dentalHistory.bracesOrtho === 'yes';

      if (hasPerioHistory && !isIsoDate(dentalHistory.periodontalDiseaseWhen)) {
        return sendJSON(res, 400, {
          error: 'Please provide a valid periodontal disease date (YYYY-MM-DD)'
        });
      }

      if (hasBracesHistory && !isIsoDate(dentalHistory.bracesOrthoWhen)) {
        return sendJSON(res, 400, {
          error: 'Please provide a valid braces/ortho date (YYYY-MM-DD)'
        });
      }
    }

    if (tobacco && typeof tobacco === 'object' && Array.isArray(tobacco.quitHistory)) {
      const invalidQuitDate = tobacco.quitHistory.some((item) => {
        if (!item?.type) {
          return false;
        }
        return !isoDatePattern.test(String(item.quitDate || ''));
      });

      if (invalidQuitDate) {
        return sendJSON(res, 400, {
          error: 'Please provide a valid quit date (YYYY-MM-DD) for each previous tobacco type'
        });
      }
    }

    const preferredDate = String(appointmentSelection?.preferredDate || '').trim();
    const preferredTimeInput = String(appointmentSelection?.preferredTime || '').trim();
    const preferredTime = preferredTimeInput.length === 5
      ? `${preferredTimeInput}:00`
      : preferredTimeInput;
    const preferredWeekdaysRaw = Array.isArray(appointmentSelection?.preferredWeekdays)
      ? appointmentSelection.preferredWeekdays
      : [];
    const preferredTimesRaw = Array.isArray(appointmentSelection?.preferredTimes)
      ? appointmentSelection.preferredTimes
      : [];
    
    const preferredWeekdays = [...new Set(
      preferredWeekdaysRaw
        .map((day) => String(day || '').trim())
        .filter((day) => weekdayOptions.includes(day))
    )];

    const preferredTimes = [...new Set(
      preferredTimesRaw
        .map((timeValue) => String(timeValue || '').trim())
        .filter((timeValue) => /^\d{2}:\d{2}(:\d{2})?$/.test(timeValue))
        .map((timeValue) => (timeValue.length === 5 ? `${timeValue}:00` : timeValue))
        .filter((timeValue) => preferredTimeOptions.includes(timeValue))
        .map((timeValue) => timeValue.slice(0, 5))
    )];

    if (!/^\d{4}-\d{2}-\d{2}$/.test(preferredDate)) {
      return sendJSON(res, 400, { error: 'Please select a preferred appointment date' });
    }

    if (!preferredTimeOptions.includes(preferredTime)) {
      return sendJSON(res, 400, { error: 'Please select a preferred appointment time' });
    }

    if (preferredWeekdays.length === 0) {
      return sendJSON(res, 400, { error: 'Please choose at least one weekday you are available' });
    }

    if (preferredTimes.length === 0) {
      return sendJSON(res, 400, { error: 'Please choose at least one available time between 9:00 AM and 7:00 PM' });
    }

    pool.getConnection((err, conn) => {
      if (err) {
        console.error('DB connection error:', err);
        return sendJSON(res, 500, { error: 'Database connection failed' });
      }

      conn.beginTransaction((txErr) => {
        if (txErr) {
          conn.release();
          return sendJSON(res, 500, { error: 'Transaction failed' });
        }

        const userQuery = 'INSERT INTO users (user_username, password_hash, user_email, user_phone, user_role) VALUES (?, SHA2(?, 256), ?, ?, ?)';
        conn.query(userQuery, [username, password, email, phone, 'PATIENT'], (userErr, userResult) => {
          if (userErr) {
            return conn.rollback(() => {
              conn.release();
              if (userErr.code === 'ER_DUP_ENTRY') {
                return sendJSON(res, 409, { error: 'Username already exists' });
              }
              console.error('Error creating user:', userErr);
              return sendJSON(res, 500, { error: 'Failed to create user account' });
            });
          }

          const userId = userResult.insertId;
          const patientQuery = `
            INSERT INTO patients (
              user_id, p_first_name, p_last_name, p_dob, p_gender, p_phone, p_email,
              p_ssn, p_drivers_license, p_address, p_emergency_contact_name, p_emergency_contact_phone, created_by, updated_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PORTAL', 'PORTAL')
          `;
          conn.query(
            patientQuery,
            [
              userId,
              firstName,
              lastName,
              dob,
              numericGender,
              phone,
              email,
              normalizedSsn,
              normalizedDriversLicense,
              normalizedAddress,
              normalizedEmergencyContactName,
              normalizedEmergencyContactPhone
            ],
            (patientErr, patientResult) => {
              if (patientErr) {
                return conn.rollback(() => {
                  conn.release();
                  console.error('Error creating patient:', patientErr);
                  return sendJSON(res, 500, { error: 'Failed to create patient record' });
                });
              }

              const patientId = patientResult.insertId;

              saveIntakeData(
                conn,
                patientId,
                medicalHistory,
                medicalHistoryOtherText,
                adverseReactions,
                medications,
                dentalFindings,
                dentalHistory,
                sleepSocial,
                tobacco,
                caffeine,
                painAssessment,
                (intakeErr) => {
                  if (intakeErr) {
                    return conn.rollback(() => {
                      conn.release();
                      console.error('Error saving intake data:', intakeErr);
                      return sendJSON(res, 500, { error: 'Failed to save medical information' });
                    });
                  }

                  conn.query(
                    `INSERT INTO appointment_preference_requests (
                      patient_id,
                      preferred_date,
                      preferred_time,
                      location_id,
                      available_days,
                      available_times,
                      appointment_reason,
                      request_status,
                      created_by,
                      updated_by
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'PREFERRED_PENDING', 'PORTAL', 'PORTAL')`,
                    [
                      patientId,
                      preferredDate,
                      preferredTime,
                      locationId,
                      preferredWeekdays.join(', '),
                      preferredTimes.join(', '),
                      reason || null
                    ],
                    (preferenceErr, preferenceResult) => {
                      if (preferenceErr) {
                        return conn.rollback(() => {
                          conn.release();
                          console.error('Error saving preferred appointment request:', preferenceErr);
                          return sendJSON(res, 500, { error: 'Failed to save appointment preference' });
                        });
                      }

                      const insurance = data.insurance || {};
                      const insuranceCompanyId = Number(insurance.companyId);
                      const insuranceMemberId = String(insurance.memberId || '').trim();

                      const finishCommit = () => {
                        conn.commit((commitErr) => {
                          conn.release();
                          if (commitErr) {
                            return conn.rollback(() => {
                              console.error('Commit failed:', commitErr);
                              return sendJSON(res, 500, { error: 'Failed to complete registration' });
                            });
                          }

                          sendJSON(res, 201, {
                            message: 'Patient registered successfully',
                            patientId,
                            userId,
                            appointmentPreferenceRequestId: preferenceResult.insertId,
                            appointmentConfirmation: {
                              date: preferredDate,
                              startTime: preferredTime,
                              availabilityDays: preferredWeekdays,
                              availabilityTimes: preferredTimes,
                              status: 'PREFERRED_PENDING',
                              note: 'Preferences received. Our receptionist will contact you with your finalized appointment, doctor, and location.'
                            }
                          });
                        });
                      };

                      if (Number.isInteger(insuranceCompanyId) && insuranceCompanyId > 0 && insuranceMemberId) {
                        conn.query(
                          `INSERT INTO insurance (patient_id, company_id, member_id, group_number, is_primary, created_by, updated_by)
                           VALUES (?, ?, ?, ?, TRUE, 'PORTAL', 'PORTAL')`,
                          [patientId, insuranceCompanyId, insuranceMemberId, String(insurance.groupNumber || '').trim() || null],
                          (insuranceErr) => {
                            if (insuranceErr) {
                              console.error('Error saving insurance (non-fatal):', insuranceErr);
                            }
                            finishCommit();
                          }
                        );
                      } else {
                        finishCommit();
                      }
                    }
                  );
                }
              );
            }
          );
        });
      });
    });
  }

  function createPatientNewAppointmentRequest(req, patientId, data, res) {
    const {
      location,
      reason,
      medicalHistory,
      medicalHistoryOtherText,
      adverseReactions,
      medications,
      dentalFindings,
      dentalHistory,
      sleepSocial,
      tobacco,
      caffeine,
      painAssessment,
      appointmentSelection,
      isReschedule,
      appointmentId
    } = data || {};

    const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
    const preferredDate = String(appointmentSelection?.preferredDate || '').trim();
    const preferredTimeInput = String(appointmentSelection?.preferredTime || '').trim();
    const preferredTime = preferredTimeInput.length === 5
      ? `${preferredTimeInput}:00`
      : preferredTimeInput;
    const preferredWeekdaysRaw = Array.isArray(appointmentSelection?.preferredWeekdays)
      ? appointmentSelection.preferredWeekdays
      : [];
    const preferredTimesRaw = Array.isArray(appointmentSelection?.preferredTimes)
      ? appointmentSelection.preferredTimes
      : [];
    const normalizedPreferredLocation = location ? String(location).trim() : null;

    const preferredWeekdays = [...new Set(
      preferredWeekdaysRaw
        .map((day) => String(day || '').trim())
        .filter((day) => weekdayOptions.includes(day))
    )];

    const preferredTimes = [...new Set(
      preferredTimesRaw
        .map((timeValue) => String(timeValue || '').trim())
        .filter((timeValue) => /^\d{2}:\d{2}(:\d{2})?$/.test(timeValue))
        .map((timeValue) => (timeValue.length === 5 ? `${timeValue}:00` : timeValue))
        .filter((timeValue) => preferredTimeOptions.includes(timeValue))
        .map((timeValue) => timeValue.slice(0, 5))
    )];

    if (!reason || !String(reason).trim()) {
      return sendJSON(res, 400, { error: 'Please provide a reason for your new appointment.' });
    }

    if (!normalizedPreferredLocation) {
      return sendJSON(res, 400, { error: 'Please select a preferred location.' });
    }

    if (!isoDatePattern.test(preferredDate)) {
      return sendJSON(res, 400, { error: 'Please select a preferred appointment date.' });
    }

    if (!preferredTimeOptions.includes(preferredTime)) {
      return sendJSON(res, 400, { error: 'Please select a preferred appointment time.' });
    }

    if (preferredWeekdays.length === 0) {
      return sendJSON(res, 400, { error: 'Please choose at least one weekday you are available.' });
    }

    if (preferredTimes.length === 0) {
      return sendJSON(res, 400, { error: 'Please choose at least one available time between 9:00 AM and 7:00 PM.' });
    }

    pool.getConnection((err, conn) => {
      if (err) {
        console.error('DB connection error:', err);
        return sendJSON(res, 500, { error: 'Database connection failed' });
      }

      conn.beginTransaction((txErr) => {
        if (txErr) {
          conn.release();
          return sendJSON(res, 500, { error: 'Transaction failed' });
        }

        const enforceCreateRulesTask = (callback) => {
          if (isReschedule) {
            return callback();
          }

          conn.query(
            `SELECT
               SUM(CASE WHEN s.status_name IN ('SCHEDULED', 'CONFIRMED', 'RESCHEDULED', 'CHECKED_IN') THEN 1 ELSE 0 END) AS active_appointment_count,
               (
                 SELECT COUNT(*)
                 FROM appointment_preference_requests apr
                 WHERE apr.patient_id = ?
                   AND apr.request_status IN ('PREFERRED_PENDING', 'ASSIGNED')
               ) AS active_request_count
             FROM appointments a
             LEFT JOIN appointment_statuses s ON s.status_id = a.status_id
             WHERE a.patient_id = ?`,
            [patientId, patientId],
            (ruleErr, ruleRows) => {
              if (ruleErr) {
                return callback(ruleErr);
              }

              const row = ruleRows?.[0] || {};
              const hasActiveAppointment = Number(row.active_appointment_count || 0) > 0;
              const hasActiveRequest = Number(row.active_request_count || 0) > 0;

              if (hasActiveAppointment || hasActiveRequest) {
                const restrictionErr = new Error('You already have an active appointment or pending request. Please use reschedule or cancel instead.');
                restrictionErr.statusCode = 409;
                return callback(restrictionErr);
              }

              callback();
            }
          );
        };

        const rescheduleTask = (callback) => {
            if (isReschedule && appointmentId) {
              conn.query(
                `UPDATE appointments a
                 JOIN appointment_statuses current_status ON current_status.status_id = a.status_id
                 JOIN appointment_statuses s ON s.status_name = 'RESCHEDULED'
                 SET a.status_id = s.status_id
                 WHERE a.appointment_id = ?
                   AND a.patient_id = ?
                   AND current_status.status_name IN ('SCHEDULED', 'CONFIRMED', 'RESCHEDULED', 'CHECKED_IN')`,
                [appointmentId, patientId],
                (updateErr, updateResult) => {
                  if (updateErr) {
                    return callback(updateErr);
                  }
                  if (updateResult.affectedRows === 0) {
                    return callback(new Error('Appointment not found or not owned by patient'));
                  }
                  callback();
                }
              );
            } else {
              callback();
            }
          };

        enforceCreateRulesTask((ruleErr) => {
          if (ruleErr) {
            return conn.rollback(() => {
              conn.release();
              if (ruleErr.statusCode) {
                return sendJSON(res, ruleErr.statusCode, { error: ruleErr.message });
              }
              console.error('Error validating appointment request rules:', ruleErr);
              sendJSON(res, 500, { error: 'Failed to validate appointment request rules' });
            });
          }

          rescheduleTask((rescheduleErr) => {
            if (rescheduleErr) {
                return conn.rollback(() => {
                    conn.release();
                    console.error('Error rescheduling appointment:', rescheduleErr);
                    sendJSON(res, 409, { error: 'Failed to reschedule appointment. Only active scheduled appointments can be rescheduled.' });
                });
            }

            saveIntakeData(
                conn,
                patientId,
                medicalHistory,
                medicalHistoryOtherText,
                adverseReactions,
                medications,
                dentalFindings,
                dentalHistory,
                sleepSocial,
                tobacco,
                caffeine,
                painAssessment,
                (intakeErr) => {
                  if (intakeErr) {
                    return conn.rollback(() => {
                      conn.release();
                      console.error('Error saving updated intake data:', intakeErr);
                      sendJSON(res, 500, { error: 'Failed to save updated medical information' });
                    });
                  }
      
                  conn.query(
                    `INSERT INTO appointment_preference_requests (
                      patient_id,
                      preferred_date,
                      preferred_time,
                      preferred_location,
                      available_days,
                      available_times,
                      appointment_reason,
                      request_status,
                      created_by,
                      updated_by
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'PREFERRED_PENDING', 'PORTAL', 'PORTAL')`,
                    [
                      patientId,
                      preferredDate,
                      preferredTime,
                      normalizedPreferredLocation,
                      preferredWeekdays.join(', '),
                      preferredTimes.join(', '),
                      String(reason).trim()
                    ],
                    (preferenceErr, preferenceResult) => {
                      if (preferenceErr) {
                        return conn.rollback(() => {
                          conn.release();
                          console.error('Error saving new appointment preference request:', preferenceErr);
                          sendJSON(res, 500, { error: 'Failed to save appointment preference' });
                        });
                      }
      
                      conn.commit((commitErr) => {
                        conn.release();
                        if (commitErr) {
                          return conn.rollback(() => {
                            console.error('Commit failed:', commitErr);
                            sendJSON(res, 500, { error: 'Failed to submit new appointment request' });
                          });
                        }
      
                        sendJSON(res, 201, {
                          message: 'New appointment request submitted successfully.',
                          appointmentPreferenceRequestId: preferenceResult.insertId,
                          appointmentConfirmation: {
                            date: preferredDate,
                            startTime: preferredTime,
                            availabilityDays: preferredWeekdays,
                            availabilityTimes: preferredTimes,
                            status: 'PREFERRED_PENDING',
                            note: 'Your updated medical details and availability were received. Our receptionist will contact you to finalize your appointment.'
                          }
                        });
                      });
                    }
                  );
                }
              );
          });
        });
      });
    });
  }

  function getPatientNewAppointmentPrefill(req, patientId, res) {
    pool.query(queries.getLatestPatientRegistrationSnapshot, [patientId], (snapshotErr, snapshotRows) => {
      if (snapshotErr) {
        console.error('Error fetching patient intake snapshot:', snapshotErr);
        return sendJSON(res, 500, { error: 'Database error' });
      }

      pool.query(queries.getLatestPatientAppointmentPreferenceRequest, [patientId], (prefErr, prefRows) => {
        if (prefErr) {
          console.error('Error fetching patient appointment preference prefill:', prefErr);
          return sendJSON(res, 500, { error: 'Database error' });
        }

        let snapshot = null;
        if (snapshotRows?.[0]?.snapshot_json) {
          try {
            snapshot = typeof snapshotRows[0].snapshot_json === 'string'
              ? JSON.parse(snapshotRows[0].snapshot_json)
              : snapshotRows[0].snapshot_json;
          } catch {
            snapshot = null;
          }
        }

        const latestPreference = prefRows?.[0] || null;
        sendJSON(res, 200, {
          patientId,
          snapshot,
          latestPreference
        });
      });
    });
  }

  function saveIntakeData(conn, patientId, medicalHistory, medicalHistoryOtherText, adverseReactions, medications, dentalFindings, dentalHistory, sleepSocial, tobacco, caffeine, painAssessment, callback) {
    const db = conn.promise();
    const toYesNoUnknown = (value) => {
      if (value === 'yes') {
        return 'YES';
      }
      if (value === 'no') {
        return 'NO';
      }
      return 'UNKNOWN';
    };

    const keyToLabel = (key) => String(key)
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (char) => char.toUpperCase())
      .trim();

    (async () => {
      const filteredMedications = Array.isArray(medications)
        ? medications.filter((med) => med?.name)
        : [];

      const intakeSnapshot = {
        medicalHistory: medicalHistory || {},
        medicalHistoryOtherText: medicalHistoryOtherText || '',
        adverseReactions: adverseReactions || {},
        dentalFindings: dentalFindings || {},
        dentalHistory: dentalHistory || {},
        sleepSocial: sleepSocial || {},
        tobacco: tobacco || {},
        caffeine: caffeine || {},
        painAssessment: Array.isArray(painAssessment) ? painAssessment : []
      };

      await db.query(
        'INSERT INTO medical_alerts (patient_id, alert_condition, notes, created_by, updated_by) VALUES (?, ?, ?, ?, ?)',
        [patientId, 'PATIENT_INTAKE_SNAPSHOT', JSON.stringify(intakeSnapshot), 'PORTAL', 'PORTAL']
      );

      await db.query(
        `INSERT INTO patient_registration_snapshots (patient_id, snapshot_json, created_by, updated_by)
         VALUES (?, ?, 'PORTAL', 'PORTAL')
         ON DUPLICATE KEY UPDATE
           snapshot_json = VALUES(snapshot_json),
           updated_by = 'PORTAL'`,
        [patientId, JSON.stringify(intakeSnapshot)]
      );

      const periodontalDate = dentalHistory?.periodontalDiseaseYesNo === 'yes'
        ? (dentalHistory.periodontalDiseaseWhen || null)
        : null;
      const bracesDate = dentalHistory?.bracesOrtho === 'yes'
        ? (dentalHistory.bracesOrthoWhen || null)
        : null;

      await db.query(
        `INSERT INTO intake_dental_history (
          patient_id,
          periodontal_disease_yes_no,
          periodontal_disease_date,
          braces_ortho_yes_no,
          braces_ortho_date,
          created_by,
          updated_by
        ) VALUES (?, ?, ?, ?, ?, 'PORTAL', 'PORTAL')
        ON DUPLICATE KEY UPDATE
          periodontal_disease_yes_no = VALUES(periodontal_disease_yes_no),
          periodontal_disease_date = VALUES(periodontal_disease_date),
          braces_ortho_yes_no = VALUES(braces_ortho_yes_no),
          braces_ortho_date = VALUES(braces_ortho_date),
          updated_by = 'PORTAL'`,
        [
          patientId,
          toYesNoUnknown(dentalHistory?.periodontalDiseaseYesNo),
          periodontalDate,
          toYesNoUnknown(dentalHistory?.bracesOrtho),
          bracesDate
        ]
      );

      for (const med of filteredMedications) {
        await db.query(
          `INSERT INTO patient_current_medications (
            patient_id, medication_name, dosage, frequency, reason_for_use, created_by, updated_by
          ) VALUES (?, ?, ?, ?, ?, 'PORTAL', 'PORTAL')`,
          [patientId, med.name, med.dosage || null, med.frequency || null, med.reason || null]
        );
      }

      const [submissionResult] = await db.query(
        `INSERT INTO intake_form_submissions (
          patient_id, source, created_by, updated_by
        ) VALUES (?, 'PATIENT_PORTAL', 'PORTAL', 'PORTAL')`,
        [patientId]
      );
      const submissionId = submissionResult.insertId;

      let rowOrder = 1;
      for (const med of filteredMedications) {
        await db.query(
          `INSERT INTO intake_medication_rows (
            submission_id, row_order, medication_name, dosage, frequency, reason_for_using, created_by, updated_by
          ) VALUES (?, ?, ?, ?, ?, ?, 'PORTAL', 'PORTAL')
          ON DUPLICATE KEY UPDATE
            medication_name = VALUES(medication_name),
            dosage = VALUES(dosage),
            frequency = VALUES(frequency),
            reason_for_using = VALUES(reason_for_using),
            updated_by = 'PORTAL'`,
          [submissionId, rowOrder, med.name, med.dosage || null, med.frequency || null, med.reason || null]
        );
        rowOrder += 1;
      }

      const checklistEntries = [];
      Object.entries(medicalHistory || {}).forEach(([key, isSelected]) => {
        if (!isSelected) {
          return;
        }
        const isPreMed = key.startsWith('preMed');
        const isOther = key.toLowerCase().includes('other');
        checklistEntries.push({
          category: isPreMed ? 'PRE_MEDICATION' : 'CONDITION',
          label: keyToLabel(key),
          otherText: isOther ? (medicalHistoryOtherText || null) : null,
          requiresFreeText: isOther
        });
      });

      Object.entries(adverseReactions || {}).forEach(([key, isSelected]) => {
        if (key === 'hasAllergies' || !isSelected) {
          return;
        }
        const isOther = key.toLowerCase().includes('other');
        checklistEntries.push({
          category: 'ALLERGY',
          label: keyToLabel(key),
          otherText: isOther ? (medicalHistoryOtherText || null) : null,
          requiresFreeText: isOther
        });
      });

      Object.entries(dentalFindings || {}).forEach(([key, isSelected]) => {
        if (!isSelected) {
          return;
        }
        checklistEntries.push({
          category: 'DENTAL_SYMPTOM',
          label: keyToLabel(key),
          otherText: null,
          requiresFreeText: false
        });
      });

      for (const entry of checklistEntries) {
        const [itemResult] = await db.query(
          `INSERT INTO clinical_checklist_items (
            item_category, display_group, display_order, item_label, requires_free_text, is_active, created_by, updated_by
          ) VALUES (?, 'PORTAL_INTAKE', 0, ?, ?, TRUE, 'PORTAL', 'PORTAL')
          ON DUPLICATE KEY UPDATE
            checklist_item_id = LAST_INSERT_ID(checklist_item_id),
            requires_free_text = VALUES(requires_free_text),
            is_active = TRUE,
            updated_by = 'PORTAL'`,
          [entry.category, entry.label, entry.requiresFreeText]
        );

        const checklistItemId = itemResult.insertId;
        await db.query(
          `INSERT INTO patient_checklist_responses (
            patient_id, checklist_item_id, is_checked, other_text, severity, created_by, updated_by
          ) VALUES (?, ?, TRUE, ?, 'UNKNOWN', 'PORTAL', 'PORTAL')
          ON DUPLICATE KEY UPDATE
            is_checked = VALUES(is_checked),
            other_text = VALUES(other_text),
            updated_by = 'PORTAL'`,
          [patientId, checklistItemId, entry.otherText]
        );
      }

      const [questionRows] = await db.query(
        `SELECT question_id, question_code
         FROM intake_yes_no_questions
         WHERE question_code IN ('PERIO_HISTORY', 'ORTHO_HISTORY', 'WEAR_CPAP', 'SNORE')`
      );
      const questionMap = new Map(questionRows.map((row) => [row.question_code, row.question_id]));

      const yesNoAnswers = [
        {
          code: 'PERIO_HISTORY',
          answer: toYesNoUnknown(dentalHistory?.periodontalDiseaseYesNo),
          whenText: periodontalDate,
          detailsText: null
        },
        {
          code: 'ORTHO_HISTORY',
          answer: toYesNoUnknown(dentalHistory?.bracesOrtho),
          whenText: bracesDate,
          detailsText: null
        },
        {
          code: 'WEAR_CPAP',
          answer: sleepSocial?.cpap ? 'YES' : 'NO',
          whenText: null,
          detailsText: null
        },
        {
          code: 'SNORE',
          answer: sleepSocial?.snore ? 'YES' : 'NO',
          whenText: null,
          detailsText: null
        }
      ];

      for (const answer of yesNoAnswers) {
        if (!questionMap.has(answer.code)) {
          continue;
        }
        await db.query(
          `INSERT INTO intake_yes_no_answers (
            submission_id, question_id, answer_value, when_text, details_text, created_by, updated_by
          ) VALUES (?, ?, ?, ?, ?, 'PORTAL', 'PORTAL')
          ON DUPLICATE KEY UPDATE
            answer_value = VALUES(answer_value),
            when_text = VALUES(when_text),
            details_text = VALUES(details_text),
            updated_by = 'PORTAL'`,
          [submissionId, questionMap.get(answer.code), answer.answer, answer.whenText, answer.detailsText]
        );
      }

      const [caffeineTypeRows] = await db.query(
        `SELECT caffeine_type_id, caffeine_label
         FROM intake_caffeine_types
         WHERE caffeine_label IN ('None', 'Coffee', 'Tea', 'Soda')`
      );
      const caffeineTypeMap = new Map(caffeineTypeRows.map((row) => [row.caffeine_label, row.caffeine_type_id]));
      const caffeineSelections = [
        { label: 'None', selected: Boolean(caffeine?.none) },
        { label: 'Coffee', selected: Boolean(caffeine?.coffee) },
        { label: 'Tea', selected: Boolean(caffeine?.tea) },
        { label: 'Soda', selected: Boolean(caffeine?.soda) }
      ];

      for (const item of caffeineSelections) {
        if (!item.selected || !caffeineTypeMap.has(item.label)) {
          continue;
        }
        await db.query(
          `INSERT INTO intake_caffeine_use (
            submission_id, caffeine_type_id, is_selected, created_by, updated_by
          ) VALUES (?, ?, TRUE, 'PORTAL', 'PORTAL')
          ON DUPLICATE KEY UPDATE
            is_selected = VALUES(is_selected),
            updated_by = 'PORTAL'`,
          [submissionId, caffeineTypeMap.get(item.label)]
        );
      }

      const [tobaccoTypeRows] = await db.query(
        `SELECT tobacco_type_id, tobacco_label
         FROM intake_tobacco_types
         WHERE tobacco_label IN ('Never', 'Quit', 'Cigarettes', 'Cigars', 'Smokeless Tobacco')`
      );
      const tobaccoTypeMap = new Map(tobaccoTypeRows.map((row) => [row.tobacco_label, row.tobacco_type_id]));
      const tobaccoRows = [];

      if (tobacco?.never && tobaccoTypeMap.has('Never')) {
        tobaccoRows.push({
          tobaccoTypeId: tobaccoTypeMap.get('Never'),
          usesTobacco: 'NO',
          amountText: null,
          frequencyText: null,
          quitDate: null,
          notes: null,
          usageContext: 'NEVER'
        });
      }

      if (tobacco?.quit && tobaccoTypeMap.has('Quit')) {
        tobaccoRows.push({
          tobaccoTypeId: tobaccoTypeMap.get('Quit'),
          usesTobacco: 'NO',
          amountText: null,
          frequencyText: null,
          quitDate: null,
          notes: 'Patient reports quitting tobacco',
          usageContext: 'QUIT'
        });
      }

      (tobacco?.currentUses || []).forEach((item) => {
        if (!item?.type || !tobaccoTypeMap.has(item.type)) {
          return;
        }
        tobaccoRows.push({
          tobaccoTypeId: tobaccoTypeMap.get(item.type),
          usesTobacco: 'YES',
          amountText: item.amount || null,
          frequencyText: item.frequency || null,
          quitDate: null,
          notes: null,
          usageContext: 'CURRENT'
        });
      });

      (tobacco?.quitHistory || []).forEach((item) => {
        if (!item?.type || !tobaccoTypeMap.has(item.type)) {
          return;
        }
        const quitDate = item.quitDate || null;
        tobaccoRows.push({
          tobaccoTypeId: tobaccoTypeMap.get(item.type),
          usesTobacco: 'NO',
          amountText: null,
          frequencyText: quitDate,
          quitDate,
          notes: quitDate ? `Previously used; quit on ${quitDate}` : 'Previously used; now quit',
          usageContext: 'FORMER'
        });
      });

      for (const row of tobaccoRows) {
        await db.query(
          `INSERT INTO intake_tobacco_use (
            submission_id, tobacco_type_id, uses_tobacco, amount_text,
            frequency_text, quit_date, notes, usage_context, created_by, updated_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PORTAL', 'PORTAL')
          ON DUPLICATE KEY UPDATE
            uses_tobacco = VALUES(uses_tobacco),
            amount_text = VALUES(amount_text),
            frequency_text = VALUES(frequency_text),
            quit_date = VALUES(quit_date),
            notes = VALUES(notes),
            usage_context = VALUES(usage_context),
            updated_by = 'PORTAL'`,
          [
            submissionId,
            row.tobaccoTypeId,
            row.usesTobacco,
            row.amountText,
            row.frequencyText,
            row.quitDate,
            row.notes,
            row.usageContext
          ]
        );
      }

      for (const painItem of (Array.isArray(painAssessment) ? painAssessment : [])) {
        if (!painItem?.symptomId || painItem.pain === undefined) {
          continue;
        }
        await db.query(
          `INSERT INTO intake_pain_assessments (
            submission_id, pain_symptom_id, pain_level, created_by, updated_by
          ) VALUES (?, ?, ?, 'PORTAL', 'PORTAL')
          ON DUPLICATE KEY UPDATE
            pain_level = VALUES(pain_level),
            updated_by = 'PORTAL'`,
          [submissionId, painItem.symptomId, painItem.pain]
        );
      }

      callback(null);
    })().catch((err) => callback(err));
  }

  return {
    getPainSymptoms,
    getLocations,
    registerPatient,
    createPatientNewAppointmentRequest,
    getPatientNewAppointmentPrefill
  };
}

module.exports = {
  createPatientIntakeHandlers
};

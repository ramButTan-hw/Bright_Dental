const url = require('url');

function createDentistProfileRoutes({ pool, sendJSON }) {
  function getDentistProfile(req, res) {
    const parsedUrl = url.parse(req.url, true);
    const userId = Number(parsedUrl.query.userId || 0);
    if (!Number.isInteger(userId) || userId <= 0) {
      return sendJSON(res, 400, { error: 'A valid userId is required' });
    }

    pool.query(
      `SELECT
        u.user_id,
        u.user_username,
        u.user_email,
        d.doctor_id,
        st.staff_id,
        st.first_name,
        st.last_name,
        st.phone_number,
        st.date_of_birth,
        st.s_address,
        st.s_city,
        st.s_state,
        st.s_zipcode,
        st.s_country,
        st.emergency_contact_name,
        st.emergency_contact_phone,
        d.npi
      FROM users u
      JOIN staff st ON st.user_id = u.user_id
      JOIN doctors d ON d.staff_id = st.staff_id
      WHERE u.user_id = ? AND u.is_deleted = 0
      LIMIT 1`,
      [userId],
      (err, rows) => {
        if (err) {
          console.error('Error fetching dentist profile:', err);
          return sendJSON(res, 500, { error: 'Database error' });
        }
        if (!rows?.length) {
          return sendJSON(res, 404, { error: 'Dentist profile not found' });
        }
        sendJSON(res, 200, rows[0]);
      }
    );
  }

  function getDentistProfileByUsername(req, res) {
    const parsedUrl = url.parse(req.url, true);
    const username = String(parsedUrl.query.username || '').trim();
    if (!username) {
      return sendJSON(res, 400, { error: 'A valid username is required' });
    }

    pool.query(
      `SELECT
        u.user_id,
        u.user_username,
        u.user_email,
        d.doctor_id,
        st.staff_id,
        st.first_name,
        st.last_name,
        st.phone_number,
        st.date_of_birth,
        st.s_address,
        st.s_city,
        st.s_state,
        st.s_zipcode,
        st.s_country,
        st.emergency_contact_name,
        st.emergency_contact_phone,
        d.npi
      FROM users u
      JOIN staff st ON st.user_id = u.user_id
      JOIN doctors d ON d.staff_id = st.staff_id
      WHERE u.user_username = ? AND u.is_deleted = 0
      LIMIT 1`,
      [username],
      (err, rows) => {
        if (err) {
          console.error('Error fetching dentist profile by username:', err);
          return sendJSON(res, 500, { error: 'Database error' });
        }
        if (!rows?.length) {
          return sendJSON(res, 404, { error: 'Dentist profile not found' });
        }
        sendJSON(res, 200, rows[0]);
      }
    );
  }

  function updateDentistProfile(req, data, res) {
    const parsedUrl = url.parse(req.url, true);
    const userId = Number(parsedUrl.query.userId || 0);
    if (!Number.isInteger(userId) || userId <= 0) {
      return sendJSON(res, 400, { error: 'A valid userId is required' });
    }

    const firstName = String(data?.firstName || '').trim();
    const lastName = String(data?.lastName || '').trim();
    const email = String(data?.email || '').trim();
    const phone = String(data?.phone || '').replace(/\D/g, '');
    const dateOfBirth = String(data?.dateOfBirth || '').trim();
    const address = String(data?.address || '').trim();
    const city = String(data?.city || '').trim();
    const state = String(data?.state || '').trim().toUpperCase();
    const zipcode = String(data?.zipcode || '').trim();
    const country = String(data?.country || '').trim();
    const emergencyContactName = String(data?.emergencyContactName || '').trim();
    const emergencyContactPhone = String(data?.emergencyContactPhone || '').replace(/\D/g, '');
    const formattedEmergencyContactPhone = emergencyContactPhone
      ? `${emergencyContactPhone.slice(0, 3)}-${emergencyContactPhone.slice(3, 6)}-${emergencyContactPhone.slice(6, 10)}`
      : '';

    if (!firstName || !lastName || !email) {
      return sendJSON(res, 400, { error: 'First name, last name, and email are required' });
    }

    if (dateOfBirth && !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
      return sendJSON(res, 400, { error: 'dateOfBirth must use YYYY-MM-DD format' });
    }

    if (emergencyContactPhone && !/^\d{10}$/.test(emergencyContactPhone)) {
      return sendJSON(res, 400, { error: 'Emergency contact phone must be exactly 10 digits' });
    }

    if ((emergencyContactName && !emergencyContactPhone) || (!emergencyContactName && emergencyContactPhone)) {
      return sendJSON(res, 400, { error: 'Emergency contact name and phone must both be provided together' });
    }

    pool.getConnection((connErr, conn) => {
      if (connErr) {
        console.error('Error getting DB connection for dentist profile update:', connErr);
        return sendJSON(res, 500, { error: 'Database error' });
      }

      conn.beginTransaction((txErr) => {
        if (txErr) {
          conn.release();
          console.error('Error starting transaction for dentist profile update:', txErr);
          return sendJSON(res, 500, { error: 'Database error' });
        }

        conn.query(
          `SELECT st.staff_id, d.doctor_id
           FROM staff st
           JOIN doctors d ON d.staff_id = st.staff_id
           JOIN users u ON u.user_id = st.user_id
           WHERE u.user_id = ? AND u.is_deleted = 0
           LIMIT 1`,
          [userId],
          (profileErr, profileRows) => {
            if (profileErr || !profileRows?.length) {
              return conn.rollback(() => {
                conn.release();
                if (profileErr) {
                  console.error('Error resolving dentist profile mapping:', profileErr);
                  return sendJSON(res, 500, { error: 'Database error' });
                }
                return sendJSON(res, 404, { error: 'Dentist profile not found' });
              });
            }

            const staffId = profileRows[0].staff_id;
            conn.query(
              `UPDATE users
               SET user_email = ?, user_phone = ?
               WHERE user_id = ?`,
              [email, phone || null, userId],
              (userErr) => {
                if (userErr) {
                  return conn.rollback(() => {
                    conn.release();
                    if (userErr.code === 'ER_DUP_ENTRY') {
                      return sendJSON(res, 409, { error: 'Email or phone already exists' });
                    }
                    console.error('Error updating users table for dentist profile:', userErr);
                    return sendJSON(res, 500, { error: 'Database error' });
                  });
                }

                conn.query(
                  `UPDATE staff
                   SET first_name = ?,
                       last_name = ?,
                       phone_number = ?,
                       date_of_birth = COALESCE(?, date_of_birth),
                       s_address = ?,
                       s_city = ?,
                       s_state = ?,
                       s_zipcode = ?,
                       s_country = ?,
                       emergency_contact_name = ?,
                       emergency_contact_phone = ?,
                       updated_by = 'DENTIST_PORTAL'
                   WHERE staff_id = ?`,
                  [
                    firstName,
                    lastName,
                    phone || null,
                    dateOfBirth || null,
                    address || null,
                    city || null,
                    state || null,
                    zipcode || null,
                    country || null,
                    emergencyContactName || null,
                    formattedEmergencyContactPhone || null,
                    staffId
                  ],
                  (staffErr) => {
                    if (staffErr) {
                      return conn.rollback(() => {
                        conn.release();
                        console.error('Error updating staff table for dentist profile:', staffErr);
                        return sendJSON(res, 500, { error: 'Database error' });
                      });
                    }

                    conn.commit((commitErr) => {
                      conn.release();
                      if (commitErr) {
                        console.error('Error committing dentist profile update:', commitErr);
                        return sendJSON(res, 500, { error: 'Database error' });
                      }
                      return sendJSON(res, 200, { message: 'Profile updated successfully' });
                    });
                  }
                );
              }
            );
          }
        );
      });
    });
  }

  function getStaffLocations(req, res) {
    const parsedUrl = url.parse(req.url, true);
    const staffId = Number(parsedUrl.query.staffId || 0);
    if (!Number.isInteger(staffId) || staffId <= 0) {
      return sendJSON(res, 400, { error: 'A valid staffId is required' });
    }

    pool.query(
      `SELECT sl.staff_locations_id, sl.location_id, sl.is_primary,
              CONCAT(l.loc_street_no, ' ', l.loc_street_name, ', ', l.location_city, ', ', l.location_state, ' ', l.loc_zip_code) AS full_address, l.location_city, l.location_state
       FROM staff_locations sl
       JOIN locations l ON l.location_id = sl.location_id
       WHERE sl.staff_id = ?
       ORDER BY sl.is_primary DESC, l.location_city ASC`,
      [staffId],
      (err, rows) => {
        if (err) {
          console.error('Error fetching staff locations:', err);
          return sendJSON(res, 500, { error: 'Database error' });
        }
        sendJSON(res, 200, rows || []);
      }
    );
  }

  function updateStaffLocations(req, data, res) {
    const parsedUrl = url.parse(req.url, true);
    const staffId = Number(parsedUrl.query.staffId || 0);
    if (!Number.isInteger(staffId) || staffId <= 0) {
      return sendJSON(res, 400, { error: 'A valid staffId is required' });
    }

    const locations = Array.isArray(data?.locations) ? data.locations : [];
    if (!locations.length) {
      return sendJSON(res, 400, { error: 'At least one location is required' });
    }

    const primaryCount = locations.filter((loc) => loc.isPrimary).length;
    if (primaryCount !== 1) {
      return sendJSON(res, 400, { error: 'Exactly one location must be marked as primary' });
    }

    pool.getConnection((connErr, conn) => {
      if (connErr) {
        console.error('Error getting connection for staff locations update:', connErr);
        return sendJSON(res, 500, { error: 'Database error' });
      }

      conn.beginTransaction(async (txErr) => {
        if (txErr) {
          conn.release();
          return sendJSON(res, 500, { error: 'Database error' });
        }

        try {
          await conn.promise().query('DELETE FROM staff_locations WHERE staff_id = ?', [staffId]);

          for (const loc of locations) {
            const locationId = Number(loc.locationId);
            if (!Number.isInteger(locationId) || locationId <= 0) continue;
            await conn.promise().query(
              'INSERT INTO staff_locations (staff_id, location_id, is_primary) VALUES (?, ?, ?)',
              [staffId, locationId, loc.isPrimary ? 1 : 0]
            );
          }

          conn.commit((commitErr) => {
            conn.release();
            if (commitErr) {
              console.error('Error committing staff locations:', commitErr);
              return sendJSON(res, 500, { error: 'Database error' });
            }
            return sendJSON(res, 200, { message: 'Locations updated successfully' });
          });
        } catch (error) {
          conn.rollback(() => {
            conn.release();
            console.error('Error updating staff locations:', error);
            return sendJSON(res, 500, { error: 'Database error' });
          });
        }
      });
    });
  }

  function getStaffProfileImage(req, res) {
    const parsedUrl = url.parse(req.url, true);
    const staffId = Number(parsedUrl.query.staffId || 0);
    if (!Number.isInteger(staffId) || staffId <= 0) {
      return sendJSON(res, 400, { error: 'A valid staffId is required' });
    }
    pool.query(
      `SELECT TO_BASE64(profile_image) AS profile_image_base64 FROM staff WHERE staff_id = ?`,
      [staffId],
      (err, rows) => {
        if (err) {
          console.error('Error fetching staff profile image:', err);
          return sendJSON(res, 500, { error: 'Database error' });
        }
        if (!rows.length) return sendJSON(res, 404, { error: 'Staff not found' });
        sendJSON(res, 200, { profile_image_base64: rows[0].profile_image_base64 });
      }
    );
  }

  function saveStaffProfileImage(req, data, res) {
    const staffId = Number(data?.staffId || 0);
    const imageBase64 = data?.imageBase64 || null;
    if (!Number.isInteger(staffId) || staffId <= 0) {
      return sendJSON(res, 400, { error: 'A valid staffId is required' });
    }
    if (!imageBase64) {
      // Remove image
      pool.query(`UPDATE staff SET profile_image = NULL WHERE staff_id = ?`, [staffId], (err) => {
        if (err) {
          console.error('Error removing staff profile image:', err);
          return sendJSON(res, 500, { error: 'Database error' });
        }
        sendJSON(res, 200, { message: 'Profile image removed' });
      });
      return;
    }
    // Strip data URL prefix if present (e.g. "data:image/jpeg;base64,...")
    const raw = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const buf = Buffer.from(raw, 'base64');
    pool.query(`UPDATE staff SET profile_image = ? WHERE staff_id = ?`, [buf, staffId], (err) => {
      if (err) {
        console.error('Error saving staff profile image:', err);
        return sendJSON(res, 500, { error: 'Database error' });
      }
      sendJSON(res, 200, { message: 'Profile image saved' });
    });
  }

  function handleDentistProfileRoutes(req, res, method, parts, parseJSON) {
    if (method === 'GET' && parts[0] === 'api' && parts[1] === 'dentist' && parts[2] === 'profile') {
      getDentistProfile(req, res);
      return true;
    }

    if (method === 'GET' && parts[0] === 'api' && parts[1] === 'dentist' && parts[2] === 'profile-by-username') {
      getDentistProfileByUsername(req, res);
      return true;
    }

    if (method === 'PUT' && parts[0] === 'api' && parts[1] === 'dentist' && parts[2] === 'profile') {
      parseJSON(req, (err, data) => {
        if (err) {
          return sendJSON(res, 400, { error: 'Invalid JSON' });
        }
        return updateDentistProfile(req, data, res);
      });
      return true;
    }

    if (method === 'GET' && parts[0] === 'api' && parts[1] === 'staff' && parts[2] === 'locations') {
      getStaffLocations(req, res);
      return true;
    }

    if (method === 'PUT' && parts[0] === 'api' && parts[1] === 'staff' && parts[2] === 'locations') {
      parseJSON(req, (err, data) => {
        if (err) {
          return sendJSON(res, 400, { error: 'Invalid JSON' });
        }
        return updateStaffLocations(req, data, res);
      });
      return true;
    }

    if (method === 'GET' && parts[0] === 'api' && parts[1] === 'staff' && parts[2] === 'profile-image') {
      getStaffProfileImage(req, res);
      return true;
    }

    if (method === 'PUT' && parts[0] === 'api' && parts[1] === 'staff' && parts[2] === 'profile-image') {
      parseJSON(req, (err, data) => {
        if (err) {
          return sendJSON(res, 400, { error: 'Invalid JSON' });
        }
        saveStaffProfileImage(req, data, res);
      });
      return true;
    }

    return false;
  }

  return {
    handleDentistProfileRoutes
  };
}

module.exports = {
  createDentistProfileRoutes
};

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
    const npi = String(data?.npi || '').trim();

    if (!firstName || !lastName || !email) {
      return sendJSON(res, 400, { error: 'First name, last name, and email are required' });
    }

    if (dateOfBirth && !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
      return sendJSON(res, 400, { error: 'dateOfBirth must use YYYY-MM-DD format' });
    }

    if (npi && !/^\d{10}$/.test(npi)) {
      return sendJSON(res, 400, { error: 'NPI must be a 10-digit number' });
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
            const doctorId = profileRows[0].doctor_id;

            conn.query(
              `UPDATE users
               SET user_email = ?, user_phone = ?, updated_by = 'DENTIST_PORTAL'
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
                       date_of_birth = ?,
                       updated_by = 'DENTIST_PORTAL'
                   WHERE staff_id = ?`,
                  [firstName, lastName, phone || null, dateOfBirth || null, staffId],
                  (staffErr) => {
                    if (staffErr) {
                      return conn.rollback(() => {
                        conn.release();
                        console.error('Error updating staff table for dentist profile:', staffErr);
                        return sendJSON(res, 500, { error: 'Database error' });
                      });
                    }

                    conn.query(
                      `UPDATE doctors
                       SET npi = ?, updated_by = 'DENTIST_PORTAL'
                       WHERE doctor_id = ?`,
                      [npi || null, doctorId],
                      (doctorErr) => {
                        if (doctorErr) {
                          return conn.rollback(() => {
                            conn.release();
                            if (doctorErr.code === 'ER_DUP_ENTRY') {
                              return sendJSON(res, 409, { error: 'NPI already exists' });
                            }
                            console.error('Error updating doctor profile:', doctorErr);
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
          }
        );
      });
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

    return false;
  }

  return {
    handleDentistProfileRoutes
  };
}

module.exports = {
  createDentistProfileRoutes
};

const pool = require('../../../database/db');

const login = (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  pool.query(
    'SELECT user_id, user_username, user_email, user_role, user_phone FROM users WHERE user_username = ? AND user_password = ? AND is_deleted = 0',
    [username, password],
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      if (results.length === 0) return res.status(401).json({ error: 'Invalid username or password' });
      res.json({ message: 'Login successful', user: results[0] });
    }
  );
};

const getUsers = (req, res) => {
  pool.query(
    'SELECT user_id, user_username, user_email, user_role, user_phone, account_created_at FROM users WHERE is_deleted = 0',
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(results);
    }
  );
};

module.exports = { login, getUsers };

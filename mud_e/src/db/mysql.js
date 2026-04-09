const mysql = require("mysql2/promise");

let pool;

async function initDatabase() {
  const host = process.env.MYSQL_HOST || "127.0.0.1";
  const port = Number(process.env.MYSQL_PORT || 3306);
  const user = process.env.MYSQL_USER || "root";
  const password = process.env.MYSQL_PASSWORD || "root";
  const dbName = process.env.MYSQL_DB || "mud_app";
  const conn = await mysql.createConnection({ host, port, user, password });
  await conn.query(
    `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  );
  await conn.end();
  pool = mysql.createPool({
    host,
    port,
    user,
    password,
    database: dbName,
    connectionLimit: 10,
  });
  await migrate();
}

async function migrate() {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(255) UNIQUE,
      username VARCHAR(64) UNIQUE,
      password_hash VARCHAR(255),
      password_salt VARCHAR(255),
      role VARCHAR(32) NOT NULL DEFAULT 'user',
      status TINYINT NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  );
  try {
    await pool.query(
      `ALTER TABLE users ADD COLUMN username VARCHAR(64) UNIQUE`,
    );
  } catch (e) {}
  try {
    await pool.query(`ALTER TABLE users ADD COLUMN password_hash VARCHAR(255)`);
  } catch (e) {}
  try {
    await pool.query(`ALTER TABLE users ADD COLUMN password_salt VARCHAR(255)`);
  } catch (e) {}
  try {
    await pool.query(
      `ALTER TABLE users ADD COLUMN role VARCHAR(32) NOT NULL DEFAULT 'user'`,
    );
  } catch (e) {}
  try {
    await pool.query(
      `ALTER TABLE users ADD COLUMN status TINYINT NOT NULL DEFAULT 1`,
    );
  } catch (e) {}
  try {
    await pool.query(
      `ALTER TABLE users ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
    );
  } catch (e) {}
  await pool.query(
    `CREATE TABLE IF NOT EXISTS user_configs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL UNIQUE,
      account VARCHAR(255),
      passwd VARCHAR(255),
      bind_email VARCHAR(255),
      commands MEDIUMTEXT,
      interval_sec DECIMAL(6,2) DEFAULT 0.50,
      loop_count INT DEFAULT 0,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_uc_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  );
  await pool.query(
    `CREATE TABLE IF NOT EXISTS user_groups (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      slot TINYINT NOT NULL,
      name VARCHAR(64) NOT NULL DEFAULT '',
      commands MEDIUMTEXT,
      loop_count INT DEFAULT 1,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_user_slot (user_id, slot),
      CONSTRAINT fk_ug_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  );
  await pool.query(
    `CREATE TABLE IF NOT EXISTS tasks (
      id VARCHAR(36) PRIMARY KEY,
      user_id INT NOT NULL,
      status VARCHAR(16) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_t_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  );
  await pool.query(
    `CREATE TABLE IF NOT EXISTS mud_servers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(64) UNIQUE NOT NULL,
      base_host VARCHAR(255) NOT NULL,
      login_path VARCHAR(255) NOT NULL,
      check_path VARCHAR(255) NOT NULL,
      login_params JSON NOT NULL,
      headers JSON NOT NULL,
      token_strip_chars VARCHAR(32) DEFAULT 'f0',
      default_key VARCHAR(128),
      default_page INT DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  );
  await pool.query(
    `CREATE TABLE IF NOT EXISTS user_server_configs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      server_id INT NOT NULL,
      account VARCHAR(255),
      bind_email VARCHAR(255),
      commands MEDIUMTEXT,
      interval_sec DECIMAL(6,2) DEFAULT 0.50,
      loop_count INT DEFAULT 0,
      wait_timeout_ms INT DEFAULT 500,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_user_srv (user_id, server_id),
      CONSTRAINT fk_usc_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT fk_usc_server FOREIGN KEY (server_id) REFERENCES mud_servers(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  );
  try {
    const [rows] = await pool.query(`SELECT COUNT(*) AS c FROM mud_servers`);
    const c = rows[0]?.c || 0;
    if (c === 0) {
      await pool.query(
        `INSERT INTO mud_servers (name, base_host, login_path, check_path, login_params, headers, token_strip_chars, default_key, default_page)
         VALUES (?,?,?,?,?,?,?,?,?), (?,?,?,?,?,?,?,?,?)`,
        [
          '铁索',
          '43.142.168.253',
          '/mobi/loginto.php',
          '/mobi/check.php',
          JSON.stringify({ id: 'id', pass: 'pass', key: 'key', page: 'page' }),
          JSON.stringify({ 'User-Agent': 'Apache-HttpClient/UNAVAILABLE (java 1.4)', Host: '43.142.168.253', Connection: 'Keep-Alive' }),
          'f0',
          '6a3b7616ec790e33aa34d5b69275cf0',
          1,
          '极仙',
          '118.24.89.147',
          '/mobi/loginto.php',
          '/mobi/check.php',
          JSON.stringify({ id: 'id', pass: 'pass', key: 'key', page: 'page' }),
          JSON.stringify({ 'User-Agent': 'Apache-HttpClient/UNAVAILABLE (java 1.4)', Host: '118.24.89.147', Connection: 'Keep-Alive' }),
          'f0',
          'c6f097320b7a40a0a0515a27ec222ff8',
          1,
        ],
      );
    }
  } catch (e) {}
}

function getPool() {
  if (!pool) throw new Error("DB not initialized");
  return pool;
}

module.exports = { initDatabase, getPool };

const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./mi_negocio.db');

db.serialize(() => {
  // 1. Tabla Productos
  db.run(`CREATE TABLE IF NOT EXISTS productos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT,
    precio REAL,
    stock INTEGER
  )`);

  // 2. Tabla Turnos (ESTA ES LA QUE TE FALTA)
  db.run(`CREATE TABLE IF NOT EXISTS turnos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha_inicio DATETIME DEFAULT (datetime('now', 'localtime')),
    fecha_fin DATETIME,
    total_recaudado REAL DEFAULT 0,
    estado TEXT DEFAULT 'abierto'
  )`);

  // 3. Tabla Ventas (Ahora vinculada al Turno)
  db.run(`CREATE TABLE IF NOT EXISTS ventas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    producto_id INTEGER,
    turno_id INTEGER,
    fecha DATETIME DEFAULT (datetime('now', 'localtime')),
    total REAL
  )`);

  // Datos de prueba si está vacía
  db.get("SELECT count(*) as count FROM productos", (err, row) => {
    if (row && row.count === 0) {
      console.log("Creando datos de prueba...");
      db.run("INSERT INTO productos (nombre, precio, stock) VALUES ('Coca Cola 2L', 2500, 20)");
      db.run("INSERT INTO productos (nombre, precio, stock) VALUES ('Alfajor Triple', 800, 50)");
    }
  });
});

module.exports = db;
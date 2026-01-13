const express = require('express');
const db = require('./database');
const app = express();
const multer = require('multer');
const xlsx = require('xlsx');
const upload = multer({ storage: multer.memoryStorage() }); // Para guardar en memoria RAM un ratito
const PORT = 3000;

app.use(express.json());
app.use(express.static('public'));

// --- RUTAS DE PRODUCTOS ---
app.get('/api/productos', (req, res) => {
    db.all("SELECT * FROM productos", [], (err, rows) => {
        if (err) return res.status(500).json(err);
        res.json(rows);
    });
});

app.post('/api/actualizar', (req, res) => {
    const { id, stock, precio } = req.body;
    db.run("UPDATE productos SET stock = ?, precio = ? WHERE id = ?", [stock, precio, id], function(err) {
        if (err) return res.status(500).json(err);
        res.json({ message: "Actualizado" });
    });
});

// --- RUTAS DE TURNOS (ESTAS TE FALTAN) ---

// 1. Preguntar estado del turno (Para el botón de arriba)
// TIENE QUE ESTAR ESTO EN SERVER.JS:

app.get('/api/turno/actual', (req, res) => {
    db.get("SELECT * FROM turnos WHERE estado = 'abierto' ORDER BY id DESC LIMIT 1", (err, row) => {
        if (err) return res.status(500).json(err);
        res.json(row || null);
    });
});

// 2. Abrir turno
app.post('/api/turno/abrir', (req, res) => {
    db.run("INSERT INTO turnos (total_recaudado) VALUES (0)", function(err) {
        if (err) return res.status(500).json(err);
        res.json({ message: "Turno abierto", id: this.lastID });
    });
});

// 3. Cerrar turno
app.post('/api/turno/cerrar', (req, res) => {
    const { id } = req.body;
    // Sumar ventas de este turno
    db.get("SELECT SUM(total) as total FROM ventas WHERE turno_id = ?", [id], (err, row) => {
        const total = row.total || 0;
        // Cerrar el turno en la BD
        db.run("UPDATE turnos SET estado = 'cerrado', fecha_fin = datetime('now', 'localtime'), total_recaudado = ? WHERE id = ?", [total, id], function(err) {
            if (err) return res.status(500).json(err);
            res.json({ message: "Cerrado", total: total });
        });
    });
});

// 4. Historial de cierres
app.get('/api/turnos/historial', (req, res) => {
    db.all("SELECT * FROM turnos WHERE estado = 'cerrado' ORDER BY id DESC LIMIT 20", [], (err, rows) => res.json(rows));
});

// --- RUTA DE VENTAS (MODIFICADA PARA TURNOS) ---
app.post('/api/vender', (req, res) => {
    const { carrito, turno_id } = req.body;

    if (!turno_id) return res.status(400).json({ error: "Caja cerrada" });

    db.serialize(() => {
        const stmtStock = db.prepare("UPDATE productos SET stock = stock - ? WHERE id = ?");
        const stmtVenta = db.prepare("INSERT INTO ventas (producto_id, turno_id, total) VALUES (?, ?, ?)");

        db.run("BEGIN TRANSACTION");
        try {
            carrito.forEach(item => {
                stmtStock.run(item.cantidad, item.id);
                stmtVenta.run(item.id, turno_id, item.precio * item.cantidad);
            });
            db.run("COMMIT");
            stmtStock.finalize();
            stmtVenta.finalize();
            res.json({ message: "Venta ok" });
        } catch (error) {
            db.run("ROLLBACK");
            res.status(500).json({ error: "Error" });
        }
    });
});

// Historial de ventas sueltas
app.get('/api/ventas', (req, res) => {
    const sql = `SELECT v.id, p.nombre, v.total, v.fecha FROM ventas v JOIN productos p ON v.producto_id = p.id ORDER BY v.id DESC LIMIT 50`;
    db.all(sql, [], (err, rows) => res.json(rows));
});

// 5. CREAR NUEVO PRODUCTO
app.post('/api/productos/nuevo', (req, res) => {
    const { nombre, stock, precio } = req.body;
    
    if (!nombre || !precio) {
        return res.status(400).json({ error: "Faltan datos" });
    }

    const sql = "INSERT INTO productos (nombre, stock, precio) VALUES (?, ?, ?)";
    db.run(sql, [nombre, stock, precio], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Producto creado", id: this.lastID });
    });
});

// 6. IMPORTAR EXCEL
app.post('/api/productos/importar', upload.single('archivo'), (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No subiste ningún archivo" });

        // Leemos el Excel desde la memoria
        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const datos = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

        // Preparamos la inserción masiva
        db.serialize(() => {
            db.run("BEGIN TRANSACTION");
            const stmt = db.prepare("INSERT INTO productos (nombre, precio, stock) VALUES (?, ?, ?)");

            datos.forEach(row => {
                // Buscamos las columnas por nombre (Ojo mayúsculas/minúsculas)
                const nombre = row['Nombre'] || row['nombre'];
                const precio = row['Precio'] || row['precio'];
                const stock = row['Stock'] || row['stock'];

                if (nombre && precio) {
                    stmt.run(nombre, precio, stock || 0);
                }
            });

            stmt.finalize();
            db.run("COMMIT", (err) => {
                if (err) {
                    console.error(err);
                    return res.status(500).json({ error: "Error guardando datos" });
                }
                res.json({ message: `Se importaron ${datos.length} productos` });
            });
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 7. BORRAR UN PRODUCTO
app.delete('/api/productos/:id', (req, res) => {
    const { id } = req.params;
    db.run("DELETE FROM productos WHERE id = ?", [id], function(err) {
        if (err) return res.status(500).json(err);
        res.json({ message: "Eliminado" });
    });
});

// 8. BORRAR TODO (CUIDADO CON ESTO)
app.delete('/api/productos/todo/borrar', (req, res) => {
    db.run("DELETE FROM productos", function(err) {
        if (err) return res.status(500).json(err);
        res.json({ message: "Se borró todo el inventario" });
    });
});

app.listen(PORT, () => {
    console.log(`Sistema listo en http://localhost:${PORT}`);
});
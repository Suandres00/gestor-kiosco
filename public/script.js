let productos = [];
let carrito = [];
let turnoActual = null;

// --- INICIO ---
async function iniciarSistema() {
    console.log("Iniciando sistema...");
    await verificarTurno();
    await cargarProductos();
}

// --- TURNOS ---
async function verificarTurno() {
    const btn = document.getElementById('btn-estado-turno');
    const btnPagar = document.getElementById('btn-pagar');
    const cartel = document.getElementById('carrito-lista');

    try {
        const res = await fetch('/api/turno/actual');
        const data = await res.json();
        
        if (data && data.id) {
            turnoActual = data;
            btn.innerText = "🟢 TURNO ABIERTO (CERRAR)";
            btn.className = "btn-turno abierto";
            btnPagar.disabled = carrito.length === 0;
            if(carrito.length === 0) cartel.innerHTML = '<p style="text-align: center; color: #666; margin-top: 50px;">ESCANEAR O SELECCIONAR</p>';
        } else {
            turnoActual = null;
            btn.innerText = "🔴 TURNO CERRADO (ABRIR)";
            btn.className = "btn-turno cerrado";
            btnPagar.disabled = true;
            cartel.innerHTML = '<p style="text-align: center; color: #ff4444; margin-top: 50px;">🔴 CAJA CERRADA</p>';
        }
    } catch (error) { 
        console.error(error);
        btn.innerText = "⚠️ ERROR CONEXIÓN";
    }
}

async function gestionarTurno() {
    if (turnoActual) {
        if (!confirm("¿Cerrar caja y terminar turno?")) return;
        const res = await fetch('/api/turno/cerrar', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ id: turnoActual.id })
        });
        const data = await res.json();
        alert(`Turno cerrado. Total: $${data.total}`);
    } else {
        const res = await fetch('/api/turno/abrir', { method: 'POST' });
        if(res.ok) alert("✅ Caja abierta.");
    }
    await verificarTurno();
}

// --- PRODUCTOS ---
async function cargarProductos() {
    try {
        const res = await fetch('/api/productos');
        productos = await res.json();
        renderizarProductos(productos);
    } catch (error) { console.error(error); }
}

function renderizarProductos(lista) {
    const grid = document.getElementById('grid-productos');
    grid.innerHTML = '';
    
    lista.forEach(prod => {
        const div = document.createElement('div');
        div.className = 'card';
        
        // ESTA ES LA LINEA QUE SEGURO TE FALTABA (EL CLICK EN LA TARJETA)
        div.onclick = () => agregarAlCarrito(prod.id);
        
        div.innerHTML = `
            <button class="btn-delete" onclick="event.stopPropagation(); borrarProducto(${prod.id})">🗑️</button>
            
            <button class="btn-edit" onclick="event.stopPropagation(); abrirEditar(${prod.id})">✏️</button>
            
            <h3>${prod.nombre}</h3>
            <div class="price">$${prod.precio}</div>
            <div class="stock" style="color: gray;">Stock: ${prod.stock}</div>
        `;
        grid.appendChild(div);
    });
}

// --- CARRITO ---
function agregarAlCarrito(id) {
    if (!turnoActual) { alert("❌ Abrí la caja primero."); return; }
    
    const prod = productos.find(p => p.id === id);
    const item = carrito.find(i => i.id === id);

    if (item) {
        if (item.cantidad < prod.stock) item.cantidad++;
        else return alert("No hay más stock");
    } else {
        if (prod.stock > 0) carrito.push({ ...prod, cantidad: 1 });
        else return alert("Sin stock");
    }
    renderizarCarrito();
}

function cambiarCantidad(id, delta) {
    const item = carrito.find(i => i.id === id);
    const prod = productos.find(p => p.id === id);
    item.cantidad += delta;
    if (item.cantidad <= 0) carrito = carrito.filter(i => i.id !== id);
    else if (item.cantidad > prod.stock) { item.cantidad = prod.stock; alert("Tope de stock"); }
    renderizarCarrito();
}

function renderizarCarrito() {
    const lista = document.getElementById('carrito-lista');
    const totalSpan = document.getElementById('total-precio');
    const btnPagar = document.getElementById('btn-pagar');
    lista.innerHTML = '';
    let total = 0;

    if (!turnoActual) {
        lista.innerHTML = '<p style="text-align: center; color: #ff4444; margin-top: 50px;">🔴 CAJA CERRADA</p>';
        btnPagar.disabled = true;
        totalSpan.innerText = '0'; return;
    }
    if (carrito.length === 0) {
        lista.innerHTML = '<p style="text-align: center; color: #666; margin-top: 50px;">ESCANEAR...</p>';
        btnPagar.disabled = true;
        totalSpan.innerText = '0'; return;
    }

    carrito.forEach(item => {
        total += item.precio * item.cantidad;
        const div = document.createElement('div');
        div.className = 'item';
        div.style.cssText = "display: flex; justify-content: space-between; padding: 10px; border-bottom: 1px solid #333; align-items: center;";
        div.innerHTML = `
            <div><strong style="color:white;">${item.nombre}</strong><br><small style="color:gray;">$${item.precio}</small></div>
            <div class="controles-cantidad">
                <button onclick="cambiarCantidad(${item.id}, -1)">-</button>
                <span style="margin: 0 10px; color:white;">${item.cantidad}</span>
                <button onclick="cambiarCantidad(${item.id}, 1)">+</button>
            </div>
            <div style="font-weight: bold; color: var(--blue);">$${item.precio * item.cantidad}</div>
        `;
        lista.appendChild(div);
    });
    totalSpan.innerText = total;
    btnPagar.disabled = false;
}

async function finalizarVenta() {
    if(!confirm("¿CONFIRMAR VENTA?")) return;
    try {
        const res = await fetch('/api/vender', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ carrito, turno_id: turnoActual.id })
        });
        if (res.ok) {
            carrito = []; renderizarCarrito(); cargarProductos();
            alert("✅ Venta registrada!");
        }
    } catch (e) { console.error(e); }
}

// --- BUSCADOR ---
function filtrarProductos() {
    const txt = document.getElementById('buscador').value.toLowerCase();
    const filtrados = productos.filter(p => p.nombre.toLowerCase().includes(txt));
    renderizarProductos(filtrados);
}

// --- NUEVO / EDITAR / BORRAR / EXCEL ---
function abrirNuevo() {
    document.getElementById('nuevo-nombre').value = '';
    document.getElementById('nuevo-stock').value = '';
    document.getElementById('nuevo-precio').value = '';
    document.getElementById('modal-nuevo').style.display = 'flex';
    document.getElementById('nuevo-nombre').focus();
}
function cerrarNuevo() { document.getElementById('modal-nuevo').style.display = 'none'; }
async function guardarNuevo() {
    const nombre = document.getElementById('nuevo-nombre').value;
    const stock = document.getElementById('nuevo-stock').value;
    const precio = document.getElementById('nuevo-precio').value;
    if(!nombre || !precio) return alert("Falta nombre o precio");
    await fetch('/api/productos/nuevo', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ nombre, stock, precio })
    });
    cerrarNuevo(); cargarProductos();
}

function abrirEditar(id) {
    const p = productos.find(x => x.id === id);
    document.getElementById('edit-id').value = p.id;
    document.getElementById('edit-nombre').value = p.nombre;
    document.getElementById('edit-stock').value = p.stock;
    document.getElementById('edit-precio').value = p.precio;
    document.getElementById('modal-editar').style.display = 'flex';
}
function cerrarEditar() { document.getElementById('modal-editar').style.display = 'none'; }
async function guardarEdicion() {
    const id = document.getElementById('edit-id').value;
    const stock = document.getElementById('edit-stock').value;
    const precio = document.getElementById('edit-precio').value;
    await fetch('/api/actualizar', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ id, stock, precio })
    });
    cerrarEditar(); cargarProductos();
}

async function borrarProducto(id) {
    if(!confirm("¿Borrar producto?")) return;
    await fetch(`/api/productos/${id}`, { method: 'DELETE' });
    cargarProductos();
}

async function borrarTodo() {
    const conf = prompt("ESCRIBÍ 'SI' PARA BORRAR TODO EL INVENTARIO:");
    if (conf === "SI") {
        await fetch('/api/productos/todo/borrar', { method: 'DELETE' });
        cargarProductos();
        alert("todo borrado.");
    }
}

async function subirExcel() {
    const input = document.getElementById('input-excel');
    if (!input.files.length) return;
    const formData = new FormData();
    formData.append('archivo', input.files[0]);
    if(!confirm(`¿Importar ${input.files[0].name}?`)) return;
    
    const res = await fetch('/api/productos/importar', { method: 'POST', body: formData });
    const data = await res.json();
    if (res.ok) { alert(data.message); cargarProductos(); }
    else alert("Error: " + data.error);
    input.value = '';
}

// --- HISTORIAL ---
async function abrirHistorial() {
    document.getElementById('modal-historial').style.display = 'flex';
    verPestana('ventas');
}
async function verPestana(tipo) {
    document.getElementById('tab-ventas').className = tipo==='ventas'?'tab-btn active':'tab-btn';
    document.getElementById('tab-turnos').className = tipo==='turnos'?'tab-btn active':'tab-btn';
    const tV = document.getElementById('tabla-ventas');
    const tT = document.getElementById('tabla-turnos');
    const formatear = (f) => {
        if(!f) return "🔴 En curso...";
        const d = new Date(f);
        return `${d.getDate()}/${d.getMonth()+1} ${d.getHours()}:${d.getMinutes().toString().padStart(2,'0')}`;
    };

    if(tipo==='ventas'){
        tV.style.display='table'; tT.style.display='none';
        const res = await fetch('/api/ventas');
        const data = await res.json();
        document.getElementById('lista-ventas').innerHTML = data.map(v => 
            `<tr><td>${v.fecha?v.fecha.slice(11,16):'--'}</td><td>${v.nombre}</td><td style="color:var(--blue)">$${v.total}</td></tr>`
        ).join('');
    } else {
        tV.style.display='none'; tT.style.display='table';
        const res = await fetch('/api/turnos/historial');
        const data = await res.json();
        document.getElementById('lista-turnos').innerHTML = data.map(t => 
            `<tr><td>${formatear(t.fecha_inicio)}</td><td>${formatear(t.fecha_fin)}</td><td style="color:var(--green)">$${t.total_recaudado}</td></tr>`
        ).join('');
    }
}
function cerrarHistorial() { document.getElementById('modal-historial').style.display = 'none'; }

// --- TECLADO Y CIERRE ---
document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !document.getElementById('btn-pagar').disabled) {
        e.preventDefault(); finalizarVenta();
    }
});
window.onclick = e => {
    if(e.target.className === 'modal') e.target.style.display = 'none';
};

iniciarSistema();
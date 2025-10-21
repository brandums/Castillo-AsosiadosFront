let user = JSON.parse(sessionStorage.getItem('user'));
let urbanizacionesCache = [];
let prospectosCache = [];
let globalProspectos = [];
let prorrogasCache = [];
let proyectosCache = [];
let reservasCache = [];
let clientesCache = [];

const $ = (id) => document.getElementById(id);
const qs = (sel) => document.querySelector(sel);
const qsa = (sel) => Array.from(document.querySelectorAll(sel));

const getAuthHeaders = (extra = {}) => ({
    'Content-Type': 'application/json',
    email: user?.email || '',
    password: user?.password || '',
    ...extra
});

async function fetchJson(url, options = {}, defaultErrorMsg = 'Error en la solicitud', button = null) {
    try {
        if (button) setButtonLoading(button, true);
        
        const mergedOptions = {
            ...options
        };

        if (!mergedOptions.headers) mergedOptions.headers = getAuthHeaders();

        const response = await fetch(url, mergedOptions);

        let body = null;
        const text = await response.text();
        try { body = text ? JSON.parse(text) : null; } catch { body = text; }

        if (!response.ok) {
            const message = (body && (body.error || body.message || body.msg)) || defaultErrorMsg;
            throw new Error(message);
        }
        
        return body;
    } catch (err) {
        throw new Error(err.message || defaultErrorMsg);
    } finally {
        if (button) setButtonLoading(button, false);
    }
}

let _alertTimeout = null;
function showAlert(message, type = 'success', position = 'top-end') {
    const Toast = Swal.mixin({
        toast: true,
        position: position,
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
        didOpen: (toast) => {
            toast.addEventListener('mouseenter', Swal.stopTimer)
            toast.addEventListener('mouseleave', Swal.resumeTimer)
        }
    });

    let icon = 'success';
    let background = '#28a745';
    let color = 'white';

    switch(type) {
        case 'error':
            icon = 'error';
            background = '#dc3545';
            break;
        case 'warning':
            icon = 'warning';
            background = '#ffc107';
            color = '#212529';
            break;
        case 'info':
            icon = 'info';
            background = '#17a2b8';
            break;
        case 'question':
            icon = 'question';
            background = '#6c757d';
            break;
    }

    Toast.fire({
        icon: icon,
        title: message,
        background: background,
        color: color
    });
}

function getBadgeClass(estado) {
    switch (estado) {
        case 'aprobado': return 'badge-success';
        case 'rechazado': return 'badge-warning';
        case 'pendiente': return 'badge-info';
        default: return '';
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    try {
        if (!user || user.rol !== 'Agente') {
            window.location.href = 'index.html';
            return;
        }

        const userNameEl = $('userName');
        if (userNameEl) userNameEl.textContent = `${user.nombre} ${user.apellido}`;

        await Promise.all([
            await loadUrbanizaciones(),
            await loadProspectos(),
            await loadGlobalProspectos(),
            await loadProrrogas(),
            await loadProyectos(),
            await loadReservas(),
            await loadClientesFijos(),
        ]);

        initFiltroReservas();
        setupEventListeners();
    } catch (err) {
        console.error('Error en DOMContentLoaded:', err);
        showAlert('Ocurrió un error inicializando la página', 'error');
    }
});

function fillUrbanizacionSelect(selectElement) {
    if (!selectElement) return;
    selectElement.innerHTML = '<option value="">Seleccione una urbanización</option>';
    urbanizacionesCache.forEach(urbanizacion => {
        const option = document.createElement('option');
        option.value = urbanizacion.id;
        option.textContent = urbanizacion.nombre;
        selectElement.appendChild(option);
    });
}

async function loadUrbanizaciones() {
    try {
        const urbanSelect = $('urbanizacion');
        if (urbanSelect) urbanSelect.innerHTML = '<option value="">Cargando urbanizaciones...</option>';

        const data = await fetchJson(`${API_URL}/proyectos`, { headers: getAuthHeaders() }, 'Error al cargar urbanizaciones');
        urbanizacionesCache = Array.isArray(data) ? data : [];

        // Llenar los selects de urbanizaciones (si existen)
        fillUrbanizacionSelect($('urbanizacion'));
        fillUrbanizacionSelect($('editUrbanizacion'));

        return urbanizacionesCache;
    } catch (error) {
        console.error('Error al cargar urbanizaciones:', error);
        if ($('urbanizacion')) $('urbanizacion').innerHTML = '<option value="">Error al cargar</option>';
        showAlert('Error al cargar las urbanizaciones', 'error');
        urbanizacionesCache = [];
        return [];
    }
}

async function loadGlobalProspectos() { 
    const headers = { 'Content-Type': 'application/json', 'email': "acastilla466@gmail.com", 'password': "Vilu101110" }; 
    const response = await fetch(`${API_URL}/prospectos`, { headers }); 
    
    if (!response.ok) throw new Error('Error al cargar clientes globales'); 
    globalProspectos = await response.json(); 
}

async function loadProyectos() {
    try {
        const data = await fetchJson(`${API_URL}/proyectos`, { headers: getAuthHeaders() }, 'Error al cargar urbanizaciones');
        proyectosCache = Array.isArray(data) ? data : [];
        return proyectosCache;
    } catch (error) {
        console.error('Error al cargar urbanizacion:', error);
        showAlert('Error al cargar los urbanizacion', 'error');
        proyectosCache = [];
        return [];
    }
}

async function loadReservas() {
    const tbody = document.getElementById('reservasTableBody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="10" class="text-center">Cargando reservas...</td></tr>';
    
    try {
        let reservas = [];
        if (reservasCache.length === 0) {
            const headers = {
                'Content-Type': 'application/json',
                'email': user.email,
                'password': user.password
            };

            const reservasResponse = await fetch(`${API_URL}/reservas`, { headers });
            
            if (!reservasResponse.ok) {
                if (reservasResponse.status === 404) {
                    if (tbody) tbody.innerHTML = '<tr><td colspan="10" class="text-center">No hay reservas registradas</td></tr>';
                    return;
                }
                
                const errorData = await reservasResponse.json().catch(() => ({}));
                throw new Error(errorData.error || `Error ${reservasResponse.status} al cargar reservas`);
            }
            
            reservas = await reservasResponse.json();
            reservasCache = reservas;
        } else {
            reservas = reservasCache;
        }

        if (tbody) tbody.innerHTML = '';
        
        if (!reservas || reservas.length === 0) {
            if (tbody) tbody.innerHTML = '<tr><td colspan="10" class="text-center">No hay reservas registradas</td></tr>';
            return;
        }
        
        const clientes = globalProspectos;
        const proyectos = proyectosCache;

        // 🔹 Filtro de proyecto
        const filtroProyecto = document.getElementById('filtroReservas')?.value || 'todos';
        if (filtroProyecto !== 'todos') {
            reservas = reservas.filter(r => String(r.proyectoId) === String(filtroProyecto));
        }
        
        reservas.forEach(reserva => {
            const proyecto = proyectos.find(p => p.id === reserva.proyectoId)?.nombre || 'N/A';
            const cliente = clientes.find(c => c.id === reserva.clienteId);
            const nombreCliente = cliente ? `${cliente.nombre} ${cliente.apellido}` : 'N/A';
            
            // Calcular expiración exacta con hora
            const fechaHoraReserva = new Date(`${reserva.fechaReserva}T${reserva.horaReserva || '00:00'}`);
            const fechaVencimiento = new Date(fechaHoraReserva);
            fechaVencimiento.setDate(fechaHoraReserva.getDate() + parseInt(reserva.tiempoEspera));
            
            const ahora = new Date();
            const milisegundosRestantes = fechaVencimiento - ahora;
            const diasRestantes = Math.ceil(milisegundosRestantes / (1000 * 60 * 60 * 24));
            const horasRestantes = Math.ceil((milisegundosRestantes % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            
            // Determinar clase del badge según tiempo restante
            let badgeClass = 'badge-success';
            let textoRestante = '';
            
            if (milisegundosRestantes <= 0) {
                badgeClass = 'badge-danger';
                textoRestante = 'Vencido';
            } else if (diasRestantes === 0) {
                badgeClass = 'badge-warning';
                textoRestante = `${horasRestantes} horas`;
            } else if (diasRestantes <= 3) {
                badgeClass = 'badge-warning';
                textoRestante = `${diasRestantes} días`;
            } else {
                textoRestante = `${diasRestantes} días`;
            }
            
            // 🔹 CORRECCIÓN: Usar el campo 'estado' en lugar de solo 'firmado'
            const estado = reserva.estado || (reserva.firmado == "TRUE" ? 'Firmado' : 'Activa');
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${proyecto}</td>
                <td>${reserva.manzano}</td>
                <td>${reserva.nroTerreno}</td>
                <td>${nombreCliente}</td>
                <td>${reserva.montoReserva} Bs</td>
                <td>
                    <div>${formatDate(reserva.fechaReserva)}</div>
                    <small class="text-muted">${reserva.horaReserva || '00:00'}</small>
                </td>
                <td>
                    <span class="badge ${badgeClass}">
                        ${textoRestante}
                    </span>
                </td>
                <td>
                    <span class="badge ${getBadgeClassAgente(estado)}">
                        ${estado}
                    </span>
                </td>
                <td>
                    <button class="btn btn-sm btn-primary editar-lote-btn" 
                            data-id="${reserva.id}" 
                            data-manzano="${reserva.manzano}" 
                            data-terreno="${reserva.nroTerreno}">
                        Editar Lote
                    </button>
                </td>
            `;
            if (tbody) tbody.appendChild(row);
        });        

        // 🔹 Enganchar botones después de renderizar
        setupTableButtons();

    } catch (error) {
        console.error('Error al cargar reservas:', error);
        if (tbody) tbody.innerHTML = `<tr><td colspan="10" class="text-center error">${error.message}</td></tr>`;
        showAlert(`Error al cargar reservas: ${error.message}`, 'error');
    }
}

function getBadgeClassAgente(estado) {
    switch (estado) {
        case 'Firmado':
            return 'badge-success';
        case 'Activa':
        case 'Pendiente':
            return 'badge-info';
        case 'En espera':
        case 'Declinado sin Devolución':
        case 'Declinado con Devolución':
            return 'badge-danger';
        default:
            return 'badge-warning';
    }
}

function setupTableButtons() {
    qsa('.editar-lote-btn').forEach(btn => {
        try { btn.removeEventListener('click', handleEditarLoteClick); } catch (e) {}
        btn.addEventListener('click', handleEditarLoteClick);
    });

    qsa('.edit-btn').forEach(btn => {
        try { btn.removeEventListener('click', handleEditClick); } catch (e) { /* ignore */ }
        btn.addEventListener('click', handleEditClick);
    });

    qsa('.solicitar-btn').forEach(btn => {
        try { btn.removeEventListener('click', handleProrrogaClick); } catch (e) { /* ignore */ }
        btn.addEventListener('click', handleProrrogaClick);
    });

    qsa('.contrato-btn').forEach(btn => {
        try { btn.removeEventListener('click', handleContratoClick); } catch (e) {}
        btn.addEventListener('click', handleContratoClick);
    });
}

function handleEditarLoteClick(e) {
    const id = e.currentTarget.dataset.id;
    const manzano = e.currentTarget.dataset.manzano;
    const terreno = e.currentTarget.dataset.terreno;

    // Pasar valores al modal
    document.getElementById('editarReservaId').value = id;
    document.getElementById('editarManzano').value = manzano;
    document.getElementById('editarTerreno').value = terreno;

    // Mostrar modal
    document.getElementById('editarLoteModal').style.display = 'flex';
}


// 👉 Enganchar formulario del modal
document.getElementById('editarLoteForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    const id = document.getElementById('editarReservaId').value;
    const nuevoManzano = document.getElementById('editarManzano').value.trim();
    const nuevoTerreno = document.getElementById('editarTerreno').value.trim();

    if (!id || !nuevoManzano || !nuevoTerreno) {
        showAlert("Debes llenar todos los campos", "error");
        return;
    }

    const submitButton = e.target.querySelector('button[type="submit"]');
    setButtonLoading(submitButton, true, 'Cargando...');

    try {
        const headers = {
            'Content-Type': 'application/json',
            'email': user.email,
            'password': user.password
        };

        const response = await fetch(`${API_URL}/reservas/${id}/editar-lote`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({ nuevoManzano, nuevoTerreno })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Error al actualizar lote/terreno");
        }

        showAlert(data.message || "Lote/Terreno actualizado", "success");

        // 🔹 Actualizar cache
        const reservaIndex = reservasCache.findIndex(r => String(r.id) === String(id));
        if (reservaIndex !== -1) {
            reservasCache[reservaIndex].manzano = nuevoManzano;
            reservasCache[reservaIndex].nroTerreno = nuevoTerreno;
        }

        // 🔹 Cerrar modal
        document.getElementById('editarLoteModal').style.display = 'none';

        // 🔹 Recargar tabla
        loadReservas();

    } catch (error) {
        console.error("Error al guardar lote/terreno:", error);
        showAlert(error.message, "error");
    } finally {
        setButtonLoading(submitButton, false);
    }
});


// 👉 Botón cancelar modal
document.getElementById('cancelEditarLoteBtn').addEventListener('click', () => {
    document.getElementById('editarLoteModal').style.display = 'none';
});

// 👉 Botón cerrar modal (X)
document.getElementById('closeEditarLoteModal').addEventListener('click', () => {
    document.getElementById('editarLoteModal').style.display = 'none';
});




function handleEditClick() {
    openEditModal(this.dataset.id);
}

function handleProrrogaClick() {
    openProrrogaModal(this.dataset.id, this.dataset.fecha);
}

function handleContratoClick(e) {
    const id = e.currentTarget.getAttribute('data-id');
    openClientFijoModal(id);
}

async function loadProrrogas() {
    try {
        const data = await fetchJson(`${API_URL}/prorrogas`, { headers: getAuthHeaders() }, 'Error al cargar prórrogas');
        prorrogasCache = Array.isArray(data) ? data : [];
        renderProrrogas();
        return prorrogasCache;
    } catch (error) {
        console.error('Error al cargar prórrogas:', error);
        showAlert('Error al cargar las prórrogas', 'error');
        prorrogasCache = [];
        return [];
    }
}

function renderProrrogas() {
    const tbody = $('prorrogasTableBody');
    if (!tbody) {
        console.warn('No se encontró #prorrogasTableBody');
        return;
    }
    tbody.innerHTML = '';

    prorrogasCache.forEach(prorroga => {
        const cliente = prospectosCache.find(c => c.id === prorroga.clienteId);
        const nombreCliente = cliente ? `${cliente.nombre} ${cliente.apellido}` : 'N/A';

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${nombreCliente}</td>
            <td>${prorroga.descripcion || ''}</td>
            <td>
            ${prorroga.imagenUrl ? 
                `<a href="${prorroga.imagenUrl}" target="_blank" class="image-icon-link" title="Ver imagen">
                <i class="fas fa-image"></i>
                </a>` 
                : 'N/A'}
            </td>
            <td>${formatDate(prorroga.fechaLimite)}</td>
            <td><span class="badge ${getBadgeClass(prorroga.estado)}">${prorroga.estado}</span></td>
            <td>${prorroga.fechaResolucion ? formatDate(prorroga.fechaResolucion) : 'Pendiente'}</td>
        `;
        tbody.appendChild(row);
    });
}

function openEditModal(clienteId) {
    const modal = $('editClientModal');
    if (modal) modal.style.display = 'flex';

    const cliente = prospectosCache.find(c => c.id == clienteId);

    if (!cliente) {
        showAlert('Prospecto no encontrado', 'error');
        if (modal) modal.style.display = 'none';
        return;
    }

    $('editClienteId').value = cliente.id;
    $('editNombre').value = cliente.nombre || '';
    $('editApellido').value = cliente.apellido || '';
    $('editCelular').value = cliente.celular || '';
}

async function saveEditedClient(e) {
    e.preventDefault();
    const submitButton = e.target.querySelector('button[type="submit"]');
    
    const clienteId = $('editClienteId').value;
    const nombre = $('editNombre').value;
    const apellido = $('editApellido').value;
    const celular = $('editCelular').value;

    try {
        const body = {
            nombre,
            apellido,
            celular,
            agenteId: user.id
        };

        const result = await fetchJson(`${API_URL}/prospectos/${clienteId}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(body)
        }, 'Error al actualizar prospecto', submitButton);

        showAlert(result?.message || 'Prospecto actualizado correctamente', 'success');
        const editModal = $('editClientModal');
        if (editModal) editModal.style.display = 'none';

        const old = prospectosCache.find(c => c.id == clienteId) || {};
        const updatedCliente = {
            id: clienteId,
            nombre,
            apellido,
            celular,
            agenteId: user.id,
            fecha: old.fecha || new Date().toISOString().split('T')[0],
        };

        prospectosCache = prospectosCache.map(c => (c.id == clienteId ? updatedCliente : c));
        renderProspectos();
    } catch (error) {
        console.error('Error al actualizar prospecto:', error);
        showAlert(error.message, 'error');
    }
}

function setupEventListeners() {
    if (user) {
        const userNameEl = $('userName');
        if (userNameEl) userNameEl.textContent = `${user.nombre} ${user.apellido}`;
    }

    const logoutBtn = $('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            sessionStorage.removeItem('user');
            window.location.href = 'index.html';
        });
    }

    qsa('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            qsa('.tab-btn').forEach(b => b.classList.remove('active'));
            qsa('.tab-content').forEach(c => c.classList.remove('active'));

            btn.classList.add('active');
            const tabId = btn.getAttribute('data-tab') + 'Tab';
            const tabEl = $(tabId);
            if (tabEl) tabEl.classList.add('active');
        });
    });

    const addClientBtn = $('addProspectoBtn');
    const closeClientModalBtn = $('closeClientModalBtn');
    const cancelClientBtn = $('cancelClientBtn');
    const clientForm = $('clientForm');

    if (addClientBtn) {
        addClientBtn.addEventListener('click', () => {
            const modal = $('clientModal');
            if (modal) modal.style.display = 'flex';
            fillUrbanizacionSelect($('urbanizacion'));
            if ($('urbanizacion')) $('urbanizacion').value = '';
        });
    }

    if (closeClientModalBtn) {
        closeClientModalBtn.addEventListener('click', () => {
            const modal = $('clientModal');
            if (modal) modal.style.display = 'none';
        });
    }

    if (cancelClientBtn) {
        cancelClientBtn.addEventListener('click', () => {
            const modal = $('clientModal');
            if (modal) modal.style.display = 'none';
        });
    }

    if (clientForm) {
        clientForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitButton = clientForm.querySelector('button[type="submit"]');
            
            try {
                const nombre = $('nombre').value;
                const apellido = $('apellido').value;
                const celular = $('celular').value;

                const body = { nombre, apellido, celular};

                const result = await fetchJson(`${API_URL}/prospectos`, {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify(body)
                }, 'Error al registrar prospecto', submitButton);

                showAlert(result?.message || 'Prospecto registrado correctamente', 'success');
                const modal = $('clientModal');
                if (modal) modal.style.display = 'none';
                clientForm.reset();

                // Actualizar cache
                const newCliente = {
                    id: result?.clienteId ?? (new Date().getTime()),
                    nombre,
                    apellido,
                    celular,
                    agenteId: user.id,
                    fecha: new Date().toISOString().split('T')[0],
                };

                prospectosCache.push(newCliente);
                renderProspectos();
            } catch (error) {
                console.error('Error al registrar prospecto:', error);
                showAlert(error.message, 'error');
            }
        });
    }

    const closeEditClientModalBtn = $('closeEditClientModalBtn');
    const cancelEditClientBtn = $('cancelEditClientBtn');
    const editClientForm = $('editClientForm');

    if (closeEditClientModalBtn) {
        closeEditClientModalBtn.addEventListener('click', () => {
            const modal = $('editClientModal');
            if (modal) modal.style.display = 'none';
        });
    }

    if (cancelEditClientBtn) {
        cancelEditClientBtn.addEventListener('click', () => {
            const modal = $('editClientModal');
            if (modal) modal.style.display = 'none';
        });
    }

    if (editClientForm) {
        editClientForm.addEventListener('submit', saveEditedClient);
    }

    const prorrogaModal = $('prorrogaModal');
    const closeProrrogaModalBtn = $('closeProrrogaModalBtn');
    const cancelProrrogaBtn = $('cancelProrrogaBtn');
    const prorrogaForm = $('prorrogaForm');

    if (closeProrrogaModalBtn) {
        closeProrrogaModalBtn.addEventListener('click', () => {
            if (prorrogaModal) prorrogaModal.style.display = 'none';
        });
    }

    if (cancelProrrogaBtn) {
        cancelProrrogaBtn.addEventListener('click', () => {
            if (prorrogaModal) prorrogaModal.style.display = 'none';
        });
    }

    if (prorrogaForm) {
        prorrogaForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitButton = prorrogaForm.querySelector('button[type="submit"]');

            const clienteId = $('prorrogaClienteId').value;
            const fechaLimite = $('prorrogaFechaLimite').value;
            const descripcion = $('prorrogaDescripcion').value;
            const imagenUrl = $('prorrogaImagen').value;

            try {
                const body = { clienteId, descripcion, imagenUrl, fechaLimite };

                const result = await fetchJson(`${API_URL}/prorrogas`, {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify(body)
                }, 'Error al crear solicitud de prórroga', submitButton);

                showAlert(result?.message || 'Prórroga solicitada', 'success');
                if (prorrogaModal) prorrogaModal.style.display = 'none';
                prorrogaForm.reset();

                const newProrroga = {
                    id: result?.prorrogaId ?? (new Date().getTime()),
                    clienteId,
                    agenteId: user.id,
                    administradorId: '',
                    descripcion,
                    imagenUrl,
                    fechaSolicitud: new Date().toISOString().split('T')[0],
                    fechaLimite,
                    estado: 'pendiente',
                    fechaResolucion: ''
                };

                prorrogasCache.push(newProrroga);
                renderProrrogas();
            } catch (error) {
                console.error('Error al crear prórroga:', error);
                showAlert(error.message, 'error');
            }
        });
    }



    const addReservaBtn = document.getElementById('addReservaBtn');
    if (addReservaBtn) {
        addReservaBtn.addEventListener('click', () => openReservaModal(null));
    }

    const reservaModal = document.getElementById('reservaModal');
    const closeReservaModalBtn = document.getElementById('closeReservaModalBtn');
    const cancelReservaBtn = document.getElementById('cancelReservaBtn');
    const reservaForm = document.getElementById('reservaForm');
    
    if (closeReservaModalBtn) {
        closeReservaModalBtn.addEventListener('click', () => {
            if (reservaModal) reservaModal.style.display = 'none';
        });
    }
    
    if (cancelReservaBtn) {
        cancelReservaBtn.addEventListener('click', () => {
            if (reservaModal) reservaModal.style.display = 'none';
        });
    }
    
    if (reservaForm) {
        reservaForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitButton = reservaForm.querySelector('button[type="submit"]');
            
            const reservaId = document.getElementById('reservaId').value;
            const proyectoId = document.getElementById('reservaProyecto').value;
            const manzano = document.getElementById('reservaManzano').value;
            const nroTerreno = document.getElementById('reservaTerreno').value;
            const clienteId = document.getElementById('reservaCliente').value;
            const montoReserva = document.getElementById('reservaMonto').value;
            const metodoPago = document.getElementById('reservaMetodoPago').value;
            const observacion = document.getElementById('reservaObservacion').value;
            const formularioNro = document.getElementById('reservaFormulario').value;
            
            try {
                const headers = {
                    'Content-Type': 'application/json',
                    'email': user.email,
                    'password': user.password
                };

                const method = reservaId ? 'PUT' : 'POST';
                const url = reservaId ? `${API_URL}/reservas/${reservaId}` : `${API_URL}/reservas`;
                
                setButtonLoading(submitButton, true);
                
                const response = await fetch(url, {
                    method,
                    headers,
                    body: JSON.stringify({
                        manzano,
                        nroTerreno,
                        montoReserva,
                        metodoPago,
                        clienteId,
                        observacion,
                        formularioNro,
                        proyectoId
                    })
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Error al guardar reserva');
                }
                
                const result = await response.json();
                showAlert(result.message, 'success');
                if (reservaModal) reservaModal.style.display = 'none';
                reservasCache = [];
                await loadReservas();
            } catch (error) {
                console.error('Error al guardar reserva:', error);
                showAlert(error.message, 'error');
            } finally {
                setButtonLoading(submitButton, false);
            }
        });
    }

    // Configurar evento para el botón de nuevo cliente fijo
    const addClientFBtn = document.getElementById('addClientFBtn');
    if (addClientFBtn) {
        addClientFBtn.addEventListener('click', openClientFijoModal);
    }

    // Configurar eventos para cerrar el modal de cliente fijo
    const closeClientFModalBtn = document.getElementById('closeClientFModalBtn');
    if (closeClientFModalBtn) {
        closeClientFModalBtn.addEventListener('click', closeClientFijoModal);
    }

    const cancelClientFBtn = document.getElementById('cancelClientFBtn');
    if (cancelClientFBtn) {
        cancelClientFBtn.addEventListener('click', closeClientFijoModal);
    }

    // Configurar envío del formulario de cliente fijo
    const clientFijoForm = document.getElementById('clientFijoForm');
    if (clientFijoForm) {
        clientFijoForm.addEventListener('submit', handleClientFijoSubmit);
    }


    window.addEventListener('click', (e) => {
        if (e.target === $('clientModal')) {
            if ($('clientModal')) $('clientModal').style.display = 'none';
        }
        if (e.target === prorrogaModal) {
            if (prorrogaModal) prorrogaModal.style.display = 'none';
        }
        if (e.target === $('editClientModal')) {
            if ($('editClientModal')) $('editClientModal').style.display = 'none';
        }
        if (e.target === reservaModal) {
            if (reservaModal) reservaModal.style.display = 'none';
        }
        if (e.target === document.getElementById('clientFijoModal')) {
            closeClientFijoModal();
        }
    });
}

    async function openReservaModal(reservaId) {
        const reservaModal = document.getElementById('reservaModal');
        const reservaModalTitle = document.getElementById('reservaModalTitle');
        const reservaIdInput = document.getElementById('reservaId');
        const reservaForm = document.getElementById('reservaForm');
        
        try {
            const headers = {
                'Content-Type': 'application/json',
                'email': user.email,
                'password': user.password
            };

            const proyectos = proyectosCache;        
            const clientes = prospectosCache;
            
            const proyectoSelect = document.getElementById('reservaProyecto');
            if (proyectoSelect) {
                proyectoSelect.innerHTML = '<option value="">Seleccionar proyecto</option>';
                proyectos.forEach(proyecto => {
                    const option = document.createElement('option');
                    option.value = proyecto.id;
                    option.textContent = proyecto.nombre;
                    proyectoSelect.appendChild(option);
                    proyectoSelect.addEventListener('change', actualizarMontosReserva);
                });
            }
            
            const clienteSelect = document.getElementById('reservaCliente');
            if (clienteSelect) {
                clienteSelect.innerHTML = '<option value="">Seleccionar cliente</option>';
                const hoy = new Date();

                clientes
                    .filter(cliente => {
                        if (!cliente.fecha) return false; // si no tiene fecha, no mostrar
                        const fechaCliente = new Date(cliente.fecha);
                        const diffMs = hoy - fechaCliente; // diferencia en milisegundos
                        const diffDias = diffMs / (1000 * 60 * 60 * 24); // convertir a días
                        return diffDias <= 30; // solo mostrar si tiene 30 días o menos
                    })
                    .forEach(cliente => {
                        const option = document.createElement('option');
                        option.value = cliente.id;
                        option.textContent = `${cliente.nombre} ${cliente.apellido}`;
                        clienteSelect.appendChild(option);
                    });
            }

            const closeReservaModalBtn = document.getElementById('closeReservaModalBtn');
            if (closeReservaModalBtn) {
                closeReservaModalBtn.addEventListener('click', () => {
                    if (proyectoSelect) {
                        proyectoSelect.removeEventListener('change', actualizarMontosReserva);
                    }
                });
            }

            const cancelReservaBtn = document.getElementById('cancelReservaBtn');
            if (cancelReservaBtn) {
                cancelReservaBtn.addEventListener('click', () => {
                    if (proyectoSelect) {
                        proyectoSelect.removeEventListener('change', actualizarMontosReserva);
                    }
                });
            }
            
            if (reservaId) {
                reservaModalTitle.textContent = 'Editar Reserva';
                reservaModal.dataset.editing = 'true';
                
                const reservaResponse = await fetch(`${API_URL}/reservas/${reservaId}`, { headers });
                if (!reservaResponse.ok) throw new Error('Error al cargar reserva');
                const reserva = await reservaResponse.json();
                
                if (reserva) {
                    document.getElementById('reservaProyecto').value = reserva.proyectoId;
                    // Guardar el monto actual para usarlo después de actualizar las opciones
                    reservaModal.dataset.currentMonto = reserva.montoReserva;
                    
                    // Actualizar montos basado en el proyecto seleccionado
                    actualizarMontosReserva();

                    document.getElementById('reservaProyecto').value = reserva.proyectoId;
                    document.getElementById('reservaManzano').value = reserva.manzano;
                    document.getElementById('reservaTerreno').value = reserva.nroTerreno;
                    document.getElementById('reservaCliente').value = reserva.clienteId;
                    document.getElementById('reservaMonto').value = reserva.montoReserva;
                    document.getElementById('reservaMetodoPago').value = reserva.metodoPago;
                    document.getElementById('reservaObservacion').value = reserva.observacion || '';
                    document.getElementById('reservaFormulario').value = reserva.formularioNro || '';
                    
                    reservaIdInput.value = reserva.id;
                }
            } else {
                reservaModalTitle.textContent = 'Nueva Reserva';
                reservaModal.dataset.editing = 'false';

                reservaForm.reset();
                reservaIdInput.value = '';
                actualizarMontosReserva();
            }
            
            if (reservaModal) reservaModal.style.display = 'flex';
        } catch (error) {
            console.error('Error al abrir modal de reserva:', error);
            showAlert(error.message, 'error');
        }
    }

    function actualizarMontosReserva() {
        const proyectoSelect = document.getElementById('reservaProyecto');
        const montoSelect = document.getElementById('reservaMonto');
        
        if (!proyectoSelect || !montoSelect) return;
        
        const proyectoId = proyectoSelect.value;
        
        montoSelect.innerHTML = '<option value="">Seleccionar monto</option>';

        montoSelect.innerHTML += `
            <option value="100">100 Bs (Precio Feria - 7 días)</option>
        `;

        if (proyectoId === '2') { // VILLA DEL SUR
            montoSelect.innerHTML += `
                <option value="200">200 Bs (7 días)</option>
                <option value="1000">1000 Bs (20 días)</option>
            `;
        } else if (proyectoId === '1') { // SUCINI
            montoSelect.innerHTML += `
                <option value="290">290 Bs (7 días)</option>
                <option value="1000">1000 Bs (20 días)</option>
            `;
        } else if (proyectoId === '3') { // LAS LOMAS
            montoSelect.innerHTML += `
                <option value="340">340 Bs (7 días)</option>
                <option value="1000">1000 Bs (20 días)</option>
            `;
        } else {
            montoSelect.innerHTML += `
                <option value="1000">1000 Bs (20 días)</option>
            `;
        }
        
        if (reservaModal.dataset.editing === 'true') {
            const currentMonto = reservaModal.dataset.currentMonto;
            if (currentMonto && montoSelect.querySelector(`option[value="${currentMonto}"]`)) {
                montoSelect.value = currentMonto;
            }
        }
    }

    function openProrrogaModal(clienteId, fechaLimite) {
        const prorrogaModal = $('prorrogaModal');
        const clienteIdEl = $('prorrogaClienteId');
        const fechaEl = $('prorrogaFechaLimite');
        const descEl = $('prorrogaDescripcion');
        const imgEl = $('prorrogaImagen');

        if (clienteIdEl) clienteIdEl.value = clienteId;
        if (fechaEl) fechaEl.value = fechaLimite || '';
        if (descEl) descEl.value = '';
        if (imgEl) imgEl.value = '';
        if (prorrogaModal) prorrogaModal.style.display = 'flex';
    }


    function initFiltroReservas() {
        const select = document.getElementById('filtroReservas');
        if (!select) return;

        select.innerHTML = '<option value="todos">Todos</option>';

        proyectosCache.forEach(proyecto => {
            const opt = document.createElement('option');
            opt.value = proyecto.id;
            opt.textContent = proyecto.nombre;
            select.appendChild(opt);
        });

        select.addEventListener('change', () => {
            loadReservas();
        });
    }

    // Agregar esta función en common.js o agent.js
    function setButtonLoading(button, isLoading, loadingText = 'Procesando...') {
        if (!button) return;
        
        if (isLoading) {
            button.dataset.originalText = button.innerHTML;
            button.innerHTML = `
                <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                ${loadingText}
            `;
            button.disabled = true;
        } else {
            if (button.dataset.originalText) {
                button.innerHTML = button.dataset.originalText;
            }
            button.disabled = false;
        }
    }

    let clientesSearchQuery = ""; // búsqueda actual en clientes

    async function loadClientesFijos() {
        const tbody = document.getElementById('clientesFijosTableBody');
        if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="text-center">Cargando clientes...</td></tr>';
        
        try {
            let clientesF = [];
            if (clientesCache.length === 0) {
                const headers = {
                    'Content-Type': 'application/json',
                    'email': user.email,
                    'password': user.password
                };

                const clientesFResponse = await fetch(`${API_URL}/clientes-fijos`, { headers });
                
                if (!clientesFResponse.ok) {
                    if (clientesFResponse.status === 404) {
                        if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="text-center">No hay clientes registrados</td></tr>';
                        return;
                    }
                    
                    const errorData = await clientesFResponse.json().catch(() => ({}));
                    throw new Error(errorData.error || `Error ${clientesFResponse.status} al cargar clientes`);
                }
                
                clientesF = await clientesFResponse.json();
                clientesCache = clientesF;
            } else {
                clientesF = clientesCache;
            }

            renderClientesFijos();

        } catch (error) {
            console.error('Error al cargar clientes:', error);
            if (tbody) tbody.innerHTML = `<tr><td colspan="8" class="text-center error">${error.message}</td></tr>`;
            showAlert(`Error al cargar clientes: ${error.message}`, 'error');
        }
    }

    function renderClientesFijos() {
        const tbody = document.getElementById('clientesFijosTableBody');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (!clientesCache || clientesCache.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center">No hay clientes registrados</td></tr>';
            return;
        }

        // 🔹 Agrupamos por teléfono
        const clientesAgrupados = {};
        clientesCache.forEach(cliente => {
            if (!clientesAgrupados[cliente.telefono]) {
                clientesAgrupados[cliente.telefono] = { 
                    ...cliente, 
                    firmas: 1 
                };
            } else {
                clientesAgrupados[cliente.telefono].firmas += 1;
            }
        });

        // 🔹 Convertimos a array
        const clientesUnicos = Object.values(clientesAgrupados);

        // 🔎 Filtrar por búsqueda (nombre, apellido, teléfono o lote)
        const clientesFiltrados = clientesUnicos.filter(c => {
            const texto = `${c.nombre || ''} ${c.apellido || ''} ${c.telefono || ''} ${c.lote || ''}`.toLowerCase();
            return texto.includes(clientesSearchQuery.toLowerCase());
        });

        // 🔹 Mostrar en tabla
        if (clientesFiltrados.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center">No se encontraron clientes</td></tr>';
            return;
        }

        clientesFiltrados.forEach(cliente => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${cliente.nombre}</td>
                <td>${cliente.apellido}</td>
                <td>${cliente.telefono}</td>
                <td>${cliente.firmas}</td>
            `;
            tbody.appendChild(row);
        });
    }

    // Detectar cambios en el buscador
    document.addEventListener('DOMContentLoaded', () => {
        const searchInput = document.getElementById('clientesFijosSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                clientesSearchQuery = e.target.value;
                renderClientesFijos();
            });
        }
    });

    // Cargar prospectos y guardarlos en cache
    async function loadProspectos() {
        try {
            const data = await fetchJson(`${API_URL}/prospectos`, { headers: getAuthHeaders() }, 'Error al cargar prospectos');
            prospectosCache = Array.isArray(data) ? data : [];
            renderProspectos();

            return prospectosCache;
        } catch (error) {
            console.error('Error al cargar prospectos:', error);
            showAlert('Error al cargar los prospectos', 'error');
            prospectosCache = [];
            return [];
        }
    }

    let searchQuery = "";     // búsqueda actual

    // Renderizar tabla de prospectos
    function renderProspectos() {
        const tbody = document.getElementById('prospectosTableBody');
        if (!tbody) {
            console.warn('No se encontró #prospectosTableBody');
            return;
        }
        tbody.innerHTML = '';

        // Filtrar por búsqueda
        const prospectosFiltrados = prospectosCache.filter(p => {
            const texto = `${p.nombre || ''} ${p.apellido || ''} ${p.celular || ''}`.toLowerCase();
            return texto.includes(searchQuery.toLowerCase());
        });

        prospectosFiltrados.forEach(prospecto => {
            const fechaISO = prospecto.fecha ? new Date(prospecto.fecha).toISOString().split('T')[0] : '';
            const diasRestantes = calcularDiasRestantes(prospecto.fecha); 
            const esCritico = diasRestantes <= 5 && diasRestantes >= 0; 
            const estaExpirado = diasRestantes < 0;

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${(prospecto.nombre || '') + " " + (prospecto.apellido || '')}</td>
                <td>${prospecto.celular || ''}</td>
                <td>${formatDate(prospecto.fecha)}</td>
                <td class="dias-restantes ${esCritico ? 'critico' : ''} ${estaExpirado ? 'expirado' : ''}">
                    ${estaExpirado ? 'Expirado' : `${diasRestantes} días`}
                </td>
                <td class="actions">
                    ${estaExpirado ? 'N/A' : `
                        <button class="btn btn-sm btn-primary edit-btn" data-id="${prospecto.id}">
                            <i class="fas fa-edit"></i> Editar
                        </button>
                        ${esCritico ? `
                            <button class="btn btn-sm btn-warning solicitar-btn" 
                                    data-id="${prospecto.id}" 
                                    data-fecha="${fechaISO}">
                                <i class="fas fa-clock"></i> Prórroga
                            </button>
                        ` : ''}
                        <button class="btn btn-sm btn-success contrato-btn" data-id="${prospecto.id}">
                            <i class="fas fa-file-signature"></i> Registrar
                        </button>
                    `}
                </td>
            `;
            tbody.appendChild(row);
        });

        setupTableButtons();
    }

    // Detectar cambios en el buscador
    document.addEventListener('DOMContentLoaded', () => {
        const searchInput = document.getElementById('prospectoSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                searchQuery = e.target.value;
                renderProspectos();
            });
        }
    });

let selectedProspectoId = null;

// Abrir modal para un prospecto específico
function openClientFijoModal(prospectoId) {
  selectedProspectoId = prospectoId;

  const modal = document.getElementById('clientFijoModal');
  if (!modal) return;
  // Llenar proyectos
  const proyectoSelect = document.getElementById('cfProyecto');
  proyectoSelect.innerHTML = '<option value="">Seleccionar proyecto</option>';
  urbanizacionesCache.forEach(proyecto => {
    const option = document.createElement('option');
    option.value = proyecto.id;
    option.textContent = proyecto.nombre;
    proyectoSelect.appendChild(option);
  });

  // Fecha por defecto = hoy
  const fechaFirmaInput = document.getElementById('cfFechaFirma');
  fechaFirmaInput.value = new Date().toISOString().split('T')[0];

  modal.style.display = 'flex';
}

function closeClientFijoModal() {
  const modal = document.getElementById('clientFijoModal');
  if (modal) {
    modal.style.display = 'none';
    
    // resetear el formulario completo
    const form = document.getElementById('clientFijoForm');
    if (form) form.reset();
  }

  selectedProspectoId = null;
}

async function handleClientFijoSubmit(e) {
  e.preventDefault();
  if (!selectedProspectoId) {
    showAlert('No se seleccionó un prospecto válido', 'error');
    return;
  }

  const proyecto = document.getElementById('cfProyecto').value;
  const lote = document.getElementById('cfLote').value;
  const manzano = document.getElementById('cfManzano').value;
  const fechaFirma = document.getElementById('cfFechaFirma').value;
  const metodoPago = document.getElementById('cfMetodoPago').value;
  const monto = document.getElementById('cfMonto').value;

  if (!proyecto || !lote || !manzano || !fechaFirma || !metodoPago || !monto) {
    showAlert('Por favor complete todos los campos', 'error');
    return;
  }

  const submitButton = e.target.querySelector('button[type="submit"]');
  setButtonLoading(submitButton, true, 'Cargando...');

  try {
    const result = await fetchJson(
      `${API_URL}/prospectos/${selectedProspectoId}/crear-contrato`,
      {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ proyecto, lote, manzano, fechaFirma, metodoPago, monto })
      },
      'Error al crear contrato y cliente fijo'
    );

    showAlert(result?.message || 'Contrato y cliente fijo creados exitosamente', 'success');

    closeClientFijoModal();
    document.getElementById('clientFijoForm').reset();

    // Refrescar clientes fijos
    clientesCache = [];
    await loadClientesFijos();

  } catch (error) {
    console.error('Error al crear contrato desde prospecto:', error);
    showAlert(error.message, 'error');
  } finally {
    setButtonLoading(submitButton, false);
  }
}


// Eventos
document.getElementById('clientFijoForm').addEventListener('submit', handleClientFijoSubmit);
document.getElementById('closeClientFModalBtn').addEventListener('click', closeClientFijoModal);
document.getElementById('cancelClientFBtn').addEventListener('click', closeClientFijoModal);

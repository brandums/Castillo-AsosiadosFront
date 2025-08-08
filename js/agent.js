let user = JSON.parse(sessionStorage.getItem('user'));
let urbanizacionesCache = [];
let clientesCache = [];
let prorrogasCache = [];

const $ = (id) => document.getElementById(id);
const qs = (sel) => document.querySelector(sel);
const qsa = (sel) => Array.from(document.querySelectorAll(sel));

const getAuthHeaders = (extra = {}) => ({
    'Content-Type': 'application/json',
    email: user?.email || '',
    password: user?.password || '',
    ...extra
});

async function fetchJson(url, options = {}, defaultErrorMsg = 'Error en la solicitud') {
    try {
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
    }
}

let _alertTimeout = null;
function showAlert(message, type = 'success') {
    const alertBox = $('alertBox');
    if (!alertBox) {
        console.warn('No se encontró #alertBox para showAlert');
        return;
    }
    alertBox.textContent = message;
    alertBox.className = `alert ${type}`;
    alertBox.style.display = 'block';

    if (_alertTimeout) clearTimeout(_alertTimeout);
    _alertTimeout = setTimeout(() => {
        alertBox.style.display = 'none';
        _alertTimeout = null;
    }, 5000);
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
            loadUrbanizaciones(),
            loadClientes(),
            loadProrrogas()
        ]);

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

async function loadClientes() {
    try {
        const data = await fetchJson(`${API_URL}/clientes`, { headers: getAuthHeaders() }, 'Error al cargar clientes');
        clientesCache = Array.isArray(data) ? data : [];
        renderClientes();
        return clientesCache;
    } catch (error) {
        console.error('Error al cargar clientes:', error);
        showAlert('Error al cargar los clientes', 'error');
        clientesCache = [];
        return [];
    }
}

function renderClientes() {
    const tbody = $('clientsTableBody');
    if (!tbody) {
        console.warn('No se encontró #clientsTableBody');
        return;
    }
    tbody.innerHTML = '';

    clientesCache.forEach(cliente => {
        const urbanizacion = urbanizacionesCache.find(u => u.id === cliente.proyectoId)?.nombre || 'N/A';
        const diasRestantes = calcularDiasRestantes(cliente.fecha);
        const esCritico = diasRestantes <= 5 && diasRestantes >= 0;
        const estaExpirado = diasRestantes < 0;

        const fechaISO = cliente.fecha ? new Date(cliente.fecha).toISOString().split('T')[0] : '';

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${cliente.nombre} ${cliente.apellido}</td>
            <td>${cliente.celular}</td>
            <td>${urbanizacion}</td>
            <td>${cliente.lote || ''}</td>
            <td>${cliente.manzano || ''}</td>
            <td>${formatDate(cliente.fecha)}</td>
            <td class="dias-restantes ${esCritico ? 'critico' : ''} ${estaExpirado ? 'expirado' : ''}">
                ${estaExpirado ? 'Expirado' : `${diasRestantes} días`}
            </td>
            <td class="actions">
                <button class="btn btn-sm btn-primary edit-btn" data-id="${cliente.id}">
                    <i class="fas fa-edit"></i> Editar
                </button>
                ${esCritico ? `
                <button class="btn btn-sm btn-warning solicitar-btn" 
                        data-id="${cliente.id}" 
                        data-fecha="${fechaISO}">
                    <i class="fas fa-clock"></i> Prórroga
                </button>
                ` : (estaExpirado ? 'N/A' : '')}
            </td>
        `;
        tbody.appendChild(row);
    });

    setupTableButtons();
}

function setupTableButtons() {
    qsa('.edit-btn').forEach(btn => {
        try { btn.removeEventListener('click', handleEditClick); } catch (e) { /* ignore */ }
        btn.addEventListener('click', handleEditClick);
    });

    qsa('.solicitar-btn').forEach(btn => {
        try { btn.removeEventListener('click', handleProrrogaClick); } catch (e) { /* ignore */ }
        btn.addEventListener('click', handleProrrogaClick);
    });
}

function handleEditClick() {
    openEditModal(this.dataset.id);
}

function handleProrrogaClick() {
    openProrrogaModal(this.dataset.id, this.dataset.fecha);
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
        const cliente = clientesCache.find(c => c.id === prorroga.clienteId);
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

    const cliente = clientesCache.find(c => c.id == clienteId);

    if (!cliente) {
        showAlert('Cliente no encontrado', 'error');
        if (modal) modal.style.display = 'none';
        return;
    }

    $('editClienteId').value = cliente.id;
    $('editNombre').value = cliente.nombre || '';
    $('editApellido').value = cliente.apellido || '';
    $('editCelular').value = cliente.celular || '';
    $('editLote').value = cliente.lote || '';
    $('editManzano').value = cliente.manzano || '';

    const urbanizacionSelect = $('editUrbanizacion');
    if (urbanizacionSelect) {
        urbanizacionSelect.innerHTML = '<option value="">Seleccione una urbanización</option>';
        urbanizacionesCache.forEach(urbanizacion => {
            const option = document.createElement('option');
            option.value = urbanizacion.id;
            option.textContent = urbanizacion.nombre;
            option.selected = (urbanizacion.id == cliente.proyectoId);
            urbanizacionSelect.appendChild(option);
        });
    }
}

async function saveEditedClient(e) {
    e.preventDefault();

    const clienteId = $('editClienteId').value;
    const nombre = $('editNombre').value;
    const apellido = $('editApellido').value;
    const celular = $('editCelular').value;
    const urbanizacion = $('editUrbanizacion').value;
    const lote = $('editLote').value;
    const manzano = $('editManzano').value;

    try {
        const body = {
            nombre,
            apellido,
            celular,
            proyectoId: urbanizacion,
            lote,
            manzano,
            agenteId: user.id
        };

        const result = await fetchJson(`${API_URL}/clientes/${clienteId}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(body)
        }, 'Error al actualizar cliente');

        showAlert(result?.message || 'Cliente actualizado correctamente');
        const editModal = $('editClientModal');
        if (editModal) editModal.style.display = 'none';

        const old = clientesCache.find(c => c.id == clienteId) || {};
        const updatedCliente = {
            id: clienteId,
            nombre,
            apellido,
            celular,
            proyectoId: urbanizacion,
            agenteId: user.id,
            fecha: old.fecha || new Date().toISOString().split('T')[0],
            lote,
            manzano
        };

        clientesCache = clientesCache.map(c => (c.id == clienteId ? updatedCliente : c));
        renderClientes();
    } catch (error) {
        console.error('Error al actualizar cliente:', error);
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

    const addClientBtn = $('addClientBtn');
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

            const nombre = $('nombre').value;
            const apellido = $('apellido').value;
            const celular = $('celular').value;
            const urbanizacion = $('urbanizacion').value;
            const lote = $('lote').value;
            const manzano = $('manzano').value;

            try {
                const body = { nombre, apellido, celular, proyectoId: urbanizacion, lote, manzano };

                const result = await fetchJson(`${API_URL}/clientes`, {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify(body)
                }, 'Error al registrar cliente');

                showAlert(result?.message || 'Cliente registrado correctamente');
                const modal = $('clientModal');
                if (modal) modal.style.display = 'none';
                clientForm.reset();

                // Actualizar cache
                const newCliente = {
                    id: result?.clienteId ?? (new Date().getTime()), // fallback id si no viene
                    nombre,
                    apellido,
                    celular,
                    proyectoId: urbanizacion,
                    agenteId: user.id,
                    fecha: new Date().toISOString().split('T')[0],
                    lote,
                    manzano
                };

                clientesCache.push(newCliente);
                renderClientes();
            } catch (error) {
                console.error('Error al registrar cliente:', error);
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
                }, 'Error al crear solicitud de prórroga');

                showAlert(result?.message || 'Prórroga solicitada');
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
    });
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

const user = JSON.parse(sessionStorage.getItem('user'));

let globalUsuarios = [];
let globalProyectos = [];
let globalClientes = [];
let globalEquipos = [];
let reservasCache = [];
let contratosCache = [];
let clientesCache = [];
let rankinCache = [];

document.addEventListener('DOMContentLoaded', async () => {
    if (!user || user.rol !== 'Admin') {
        window.location.href = 'index.html';
        return;
    }
    
    setupEventListeners();

    try {
        await Promise.all([
            loadGlobalUsuarios(),
            loadGlobalProyectos(),
            loadGlobalClientes(),
            loadGlobalEquipos(),
        ]);

        initFiltroReservas();
        initFiltroContratos();
        initFiltroClientesFijos();
        initFiltroRanking();
        await loadUsuarios();
        await loadClientes();
        await loadProrrogas();
        await loadEquipos();
        await loadReservas();
        await loadContratos();
        await loadClientesFijos();
        await loadRanking();
    } catch (error) {
        console.error('Error inicial:', error);
        showAlert(`Error al cargar datos iniciales: ${error.message}`, 'error');
    }
});

async function loadGlobalClientes() {
    const headers = {
        'Content-Type': 'application/json',
        'email': user.email,
        'password': user.password
    };

    const response = await fetch(`${API_URL}/clientes`, { headers });
    if (!response.ok) throw new Error('Error al cargar clientes globales');
    globalClientes = await response.json();
}


async function loadGlobalUsuarios() {
    try {
        const headers = {
            'Content-Type': 'application/json',
            'email': user.email,
            'password': user.password
        };

        const response = await fetch(`${API_URL}/usuarios`, { headers });
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || 'Error al cargar usuarios globales');
        }
        globalUsuarios = await response.json();
    } catch (error) {
        console.error('Error loadGlobalUsuarios:', error);
        globalUsuarios = [];
        showAlert(`No se pudieron cargar los usuarios globales: ${error.message}`, 'error');
    }
}

async function loadGlobalProyectos() {
    try {
        const headers = {
            'Content-Type': 'application/json',
            'email': user.email,
            'password': user.password
        };

        const response = await fetch(`${API_URL}/proyectos`, { headers });
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || 'Error al cargar proyectos globales');
        }
        globalProyectos = await response.json();
    } catch (error) {
        console.error('Error loadGlobalProyectos:', error);
        globalProyectos = [];
        showAlert(`No se pudieron cargar los proyectos globales: ${error.message}`, 'error');
    }
}

async function loadGlobalEquipos() {
    try {
        const headers = {
            'Content-Type': 'application/json',
            'email': user.email,
            'password': user.password
        };

        const response = await fetch(`${API_URL}/equipos`, { headers });
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || 'Error al cargar equipos globales');
        }
        globalEquipos = await response.json();
    } catch (error) {
        console.error('Error loadGlobalEquipos:', error);
        globalEquipos = [];
        showAlert(`No se pudieron cargar los equipos globales: ${error.message}`, 'error');
    }
}

async function loadClientes() {
    try {
        const urbanizaciones = globalProyectos;
        const usuarios = globalUsuarios;

        const tbody = document.getElementById('clientsTableBody');
        if (!tbody) return;
        tbody.innerHTML = '';
        
        if (!globalClientes || globalClientes.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center">No hay clientes registrados</td></tr>';
            return;
        }

        globalClientes.forEach(cliente => {
            const urbanizacion = urbanizaciones.find(u => u.id === cliente.proyectoId)?.nombre || 'N/A';
            const agente = usuarios.find(u => u.id === cliente.agenteId);
            const nombreAgente = agente ? `${agente.nombre} ${agente.apellido}` : 'N/A';
            
            const diasRestantes = calcularDiasRestantes(cliente.fecha);
            const esReciente = diasRestantes >= 7;
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${cliente.nombre} ${cliente.apellido}</td>
                <td>${cliente.celular}</td>
                <td>${urbanizacion}</td>
                <td>${cliente.lote}</td>
                <td>${cliente.manzano}</td>
                <td>${nombreAgente}</td>
                <td>${formatDate(cliente.fecha)}</td>
                <td>
                    <span class="badge ${esReciente ? 'badge-success' : 'badge-warning'}">
                        ${esReciente ? 'Reciente' : 'Antiguo'}
                    </span>
                </td>
            `;
            tbody.appendChild(row);
        });

    } catch (error) {
        console.error('Error al cargar clientes:', error);
        showAlert(`Error al cargar clientes: ${error.message}`, 'error');
        
        const tbody = document.getElementById('clientsTableBody');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="8" class="text-center error">${error.message}</td></tr>`;
        }
    }
}

async function loadProrrogas() {
    const tbody = document.getElementById('prorrogasTableBody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="text-center">Cargando prórrogas...</td></tr>';
    
    try {
        const headers = {
            'Content-Type': 'application/json',
            'email': user.email,
            'password': user.password
        };

        const response = await fetch(`${API_URL}/prorrogas`, { headers });
        
        if (!response.ok) {
            if (response.status === 404) {
                if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="text-center">No hay solicitudes de prórroga registradas</td></tr>';
                return;
            }
            
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Error ${response.status} al cargar prórrogas`);
        }
        
        const prorrogas = await response.json();
        if (tbody) tbody.innerHTML = '';
        
        if (!prorrogas || prorrogas.length === 0) {
            if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="text-center">No hay solicitudes de prórroga registradas</td></tr>';
            return;
        }

        const clientes = globalClientes;
        const usuarios = globalUsuarios;

        prorrogas.forEach(prorroga => {
            const cliente = clientes.find(c => c.id === prorroga.clienteId);
            const nombreCliente = cliente ? `${cliente.nombre} ${cliente.apellido}` : 'N/A';
            
            const agente = usuarios.find(u => u.id === prorroga.agenteId);
            const nombreAgente = agente ? `${agente.nombre} ${agente.apellido}` : 'N/A';
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${nombreCliente}</td>
                <td>${nombreAgente}</td>
                <td>${prorroga.descripcion}</td>
                <td>
                    ${prorroga.imagenUrl ? 
                        `<a href="${prorroga.imagenUrl}" target="_blank" class="image-icon-link" title="Ver imagen">
                            <i class="fas fa-image"></i>
                        </a>` 
                        : 'N/A'}
                </td>
                <td>${formatDate(prorroga.fechaLimite)}</td>
                <td><span class="badge ${getBadgeClass(prorroga.estado)}">${prorroga.estado}</span></td>
                <td class="action-buttons">
                    ${prorroga.estado === 'pendiente' ? `
                        <div class="btn-container">
                            <button class="btn btn-sm btn-primary review-btn" data-id="${prorroga.id}">
                                Revisar
                            </button>
                        </div>
                    ` : '<span>N/A</span>'}
                </td>
            `;
            if (tbody) tbody.appendChild(row);
        });
        
        document.querySelectorAll('.review-btn').forEach(btn => {
            btn.addEventListener('click', () => openProrrogaModal(btn.dataset.id, prorrogas));
        });
        
    } catch (error) {
        console.error('Error al cargar prórrogas:', error);
        if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="text-center error">${error.message}</td></tr>`;
        showAlert(`Error al cargar prórrogas: ${error.message}`, 'error');
    }
}

async function loadUsuarios() {
    try {
        const headers = {
            'Content-Type': 'application/json',
            'email': user.email,
            'password': user.password
        };

        const usuarios = globalUsuarios;
        const tbody = document.getElementById('usersTableBody');
        if (!tbody) return;
        tbody.innerHTML = '';
        
        usuarios.forEach(usuario => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${usuario.nombre} ${usuario.apellido}</td>
                <td>${usuario.email}</td>
                <td>${usuario.rol}</td>
                <td>${usuario.celular || 'N/A'}</td>
                <td>${formatDate(usuario.fechaCreacion)}</td>
                <td class="user-actions">
                    <button class="btn btn-sm btn-primary edit-user-btn" data-id="${usuario.id}">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-danger delete-user-btn" data-id="${usuario.id}">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
        
        document.querySelectorAll('.edit-user-btn').forEach(btn => {
            btn.addEventListener('click', () => openUserModal(btn.dataset.id, usuarios));
        });
        
        document.querySelectorAll('.delete-user-btn').forEach(btn => {
            btn.addEventListener('click', () => confirmDeleteUser(btn.dataset.id));
        });
    } catch (error) {
        console.error('Error al cargar usuarios:', error);
        showAlert('Error al cargar los usuarios', 'error');
    }
}

function getBadgeClass(estado) {
    switch (estado) {
        case 'aprobado': return 'badge-success';
        case 'rechazado': return 'badge-warning';
        case 'pendiente': return 'badge-info';
        default: return '';
    }
}

function setupEventListeners() {
    const addUserBtn = document.getElementById('addUserBtn');
    if (addUserBtn) {
        addUserBtn.addEventListener('click', () => openUserModal());
    }
    
    const prorrogaModal = document.getElementById('prorrogaModal');
    const closeProrrogaModalBtn = document.getElementById('closeProrrogaModalBtn');
    const cancelProrrogaBtn = document.getElementById('cancelProrrogaBtn');
    const confirmProrrogaBtn = document.getElementById('confirmProrrogaBtn');
    
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
    
    if (confirmProrrogaBtn) {
        confirmProrrogaBtn.addEventListener('click', async () => {
            const submitButton = confirmProrrogaBtn;
            const prorrogaId = confirmProrrogaBtn.dataset.id;
            const decisionInput = document.querySelector('input[name="decision"]:checked');
            const decision = decisionInput ? decisionInput.value : null;
            const diasExtraInput = document.getElementById('diasExtra');
            const diasExtra = diasExtraInput ? diasExtraInput.value : '';
            const comentarioInput = document.getElementById('comentario');
            const comentario = comentarioInput ? comentarioInput.value : '';
            
            try {
                setButtonLoading(submitButton, true);
                
                const headers = {
                    'Content-Type': 'application/json',
                    'email': user.email,
                    'password': user.password
                };

                const response = await fetch(`${API_URL}/prorrogas/${prorrogaId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify({
                        estado: decision,
                        diasExtra: parseInt(diasExtra),
                        comentario
                    })
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Error al actualizar prórroga');
                }
                
                const result = await response.json();
                showAlert(result.message, 'success');
                if (prorrogaModal) prorrogaModal.style.display = 'none';
                
                await loadProrrogas();
                
            } catch (error) {
                console.error('Error al actualizar prórroga:', error);
                showAlert(error.message, 'error');
            } finally {
                setButtonLoading(submitButton, false);
            }
        });
    }
    
    const userModal = document.getElementById('userModal');
    const closeUserModalBtn = document.getElementById('closeUserModalBtn');
    const cancelUserBtn = document.getElementById('cancelUserBtn');
    const userForm = document.getElementById('userForm');
    
    if (closeUserModalBtn) {
        closeUserModalBtn.addEventListener('click', () => {
            if (userModal) userModal.style.display = 'none';
        });
    }
    
    if (cancelUserBtn) {
        cancelUserBtn.addEventListener('click', () => {
            if (userModal) userModal.style.display = 'none';
        });
    }
    
    window.addEventListener('click', (e) => {
        if (e.target === prorrogaModal) {
            if (prorrogaModal) prorrogaModal.style.display = 'none';
        }
        if (e.target === userModal) {
            if (userModal) userModal.style.display = 'none';
        }
    });

    const addTeamBtn = document.getElementById('addTeamBtn');
    if (addTeamBtn) {
        addTeamBtn.addEventListener('click', async () => {
            try {
                const usuarios = globalUsuarios;
                openTeamModal(null, [], usuarios);
            } catch (error) {
                console.error('Error al preparar modal de equipo:', error);
                showAlert(error.message, 'error');
            }
        });
    }
    
    const addReservaBtn = document.getElementById('addReservaBtn');
    if (addReservaBtn) {
        addReservaBtn.addEventListener('click', () => openReservaModal(null));
    }
    
    const teamModal = document.getElementById('teamModal');
    const closeTeamModalBtn = document.getElementById('closeTeamModalBtn');
    const cancelTeamBtn = document.getElementById('cancelTeamBtn');
    const teamForm = document.getElementById('teamForm');
    
    if (closeTeamModalBtn) {
        closeTeamModalBtn.addEventListener('click', () => {
            if (teamModal) teamModal.style.display = 'none';
        });
    }
    
    if (cancelTeamBtn) {
        cancelTeamBtn.addEventListener('click', () => {
            if (teamModal) teamModal.style.display = 'none';
        });
    }
    
    if (teamForm) {
    teamForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitButton = teamForm.querySelector('button[type="submit"]');
        
        try {
            const teamId = document.getElementById('teamId').value;
            const nombre = document.getElementById('teamNombre').value;
            const miembrosSelect = document.getElementById('teamMiembros');
            const miembros = Array.from(miembrosSelect.selectedOptions).map(opt => opt.value);
            
            setButtonLoading(submitButton, true);
            
            const headers = {
                'Content-Type': 'application/json',
                'email': user.email,
                'password': user.password
            };

            const method = teamId ? 'PUT' : 'POST';
            const url = teamId ? `${API_URL}/equipos/${teamId}` : `${API_URL}/equipos`;
            
            const response = await fetch(url, {
                method,
                headers,
                body: JSON.stringify({ nombre, miembros })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error al guardar equipo');
            }
            
            const result = await response.json();
            showAlert(result.message, 'success');
            if (teamModal) teamModal.style.display = 'none';
            
            if (!teamId) {
                const nuevoEquipo = {
                    id: result.id || result.equipoId,
                    nombre,
                    miembros
                };
                globalEquipos.unshift(nuevoEquipo);
            } else {
                const index = globalEquipos.findIndex(t => t.id === teamId);
                if (index !== -1) {
                    globalEquipos[index] = {
                        ...globalEquipos[index],
                        nombre,
                        miembros
                    };
                }
            }
            
            loadGlobalEquipos();
            loadEquipos();
        } catch (error) {
            console.error('Error al guardar equipo:', error);
            showAlert(error.message, 'error');
        } finally {
            setButtonLoading(submitButton, false);
        }
    });
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
                showAlert(result.message);
                if (reservaModal) reservaModal.style.display = 'none';
                reservasCache = [];
                await loadReservas();
            } catch (error) {
                console.error('Error al guardar reserva:', error);
                showAlert(error.message, 'error');
            }
        });
    }
    
    window.addEventListener('click', (e) => {
        if (e.target === prorrogaModal) {
            if (prorrogaModal) prorrogaModal.style.display = 'none';
        }
        if (e.target === userModal) {
            if (userModal) userModal.style.display = 'none';
        }
        if (e.target === teamModal) {
            if (teamModal) teamModal.style.display = 'none';
        }
        if (e.target === reservaModal) {
            if (reservaModal) reservaModal.style.display = 'none';
        }
    });
}

function openProrrogaModal(prorrogaId, prorrogas) {
    const prorrogaModal = document.getElementById('prorrogaModal');
    const prorrogaDetails = document.getElementById('prorrogaDetails');
    const confirmProrrogaBtn = document.getElementById('confirmProrrogaBtn');
    
    const prorroga = prorrogas.find(p => p.id === prorrogaId);
    if (!prorroga) return;
    
    const fechaOriginal = new Date(prorroga.fechaLimite + 'T00:00:00');

    const fechaLimite = new Date(fechaOriginal);
    fechaLimite.setDate(fechaLimite.getDate() + 30);
    if (prorrogaDetails) {
        prorrogaDetails.innerHTML = `
            <p><strong>ID Solicitud:</strong> ${prorroga.id}</p>
            <p><strong>Fecha Solicitud:</strong> ${formatDate(prorroga.fechaSolicitud)}</p>
            <p><strong>Fecha Límite Original:</strong> ${formatDate(fechaLimite.toISOString().split('T')[0])}</p>
        `;
    }
    
    if (confirmProrrogaBtn) confirmProrrogaBtn.dataset.id = prorrogaId;
    
    if (prorrogaModal) prorrogaModal.style.display = 'flex';
}

function openUserModal(userId, usuarios) {
    const userModal = document.getElementById('userModal');
    const userModalTitle = document.getElementById('userModalTitle');
    const userIdInput = document.getElementById('userId');
    const userForm = document.getElementById('userForm');
    
    if (userId) {
        userModalTitle.textContent = 'Editar Usuario';
        const usuario = usuarios.find(u => u.id === userId);
        
        if (usuario) {
            document.getElementById('userNombre').value = usuario.nombre;
            document.getElementById('userApellido').value = usuario.apellido;
            document.getElementById('userEmail').value = usuario.email;
            document.getElementById('userCelular').value = usuario.celular || '';
            document.getElementById('userRol').value = usuario.rol;
            document.getElementById('userPassword').value = '';
            
            userIdInput.value = usuario.id;
        }
    } else {
        userModalTitle.textContent = 'Nuevo Usuario';
        userForm.reset();
        userIdInput.value = '';
    }
    
    if (userModal) userModal.style.display = 'flex';
}

async function loadEquipos() {
    const tbody = document.getElementById('teamsTableBody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="2" class="text-center">Cargando equipos...</td></tr>';
    
    try {        
        const equipos = globalEquipos;
        if (tbody) tbody.innerHTML = '';
        
        if (!equipos || equipos.length === 0) {
            if (tbody) tbody.innerHTML = '<tr><td colspan="2" class="text-center">No hay equipos registrados</td></tr>';
            return;
        }

        const usuarios = globalUsuarios;

        equipos.forEach(equipo => {
            const miembrosNombres = equipo.miembros.map(miembroId => {
                const usuario = usuarios.find(u => u.id === miembroId);
                return usuario ? `${usuario.nombre} ${usuario.apellido}` : miembroId;
            }).join(', ');
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${equipo.nombre}</td>
                <td>${miembrosNombres}</td>
            `;
            if (tbody) tbody.appendChild(row);
        });
        
    } catch (error) {
        console.error('Error al cargar equipos:', error);
        if (tbody) tbody.innerHTML = `<tr><td colspan="2" class="text-center error">${error.message}</td></tr>`;
        showAlert(`Error al cargar equipos: ${error.message}`, 'error');
    }
}

async function loadReservas() {
    const tbody = document.getElementById('reservasTableBody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="9" class="text-center">Cargando reservas...</td></tr>';
    
    try {
        const headers = {
            'Content-Type': 'application/json',
            'email': user.email,
            'password': user.password
        };

        let reservas = [];
        if(reservasCache.length === 0)
        {
            const reservasResponse = await fetch(`${API_URL}/reservas`, { headers });
            
            if (!reservasResponse.ok) {
                if (reservasResponse.status === 404) {
                    if (tbody) tbody.innerHTML = '<tr><td colspan="9" class="text-center">No hay reservas registradas</td></tr>';
                    return;
                }
                
                const errorData = await reservasResponse.json().catch(() => ({}));
                throw new Error(errorData.error || `Error ${reservasResponse.status} al cargar reservas`);
            }
            
            reservas = await reservasResponse.json();
            reservasCache = reservas;
        }
        else{
            reservas = reservasCache;
        }
        
        if (tbody) tbody.innerHTML = '';
        
        if (!reservas || reservas.length === 0) {
            if (tbody) tbody.innerHTML = '<tr><td colspan="9" class="text-center">No hay reservas registradas</td></tr>';
            return;
        }

        const clientes = globalClientes;
        const proyectos = globalProyectos;
        const usuarios = globalUsuarios;
        

        // 🔹 Obtener valor del filtro de proyecto
        const filtroProyecto = document.getElementById('filtroReservas')?.value || 'todos';
        if (filtroProyecto !== 'todos') {
            reservas = reservas.filter(r => String(r.proyectoId) === String(filtroProyecto));
        }

        if (reservas.length === 0) {
            if (tbody) tbody.innerHTML = '<tr><td colspan="9" class="text-center">No hay reservas para este proyecto</td></tr>';
            return;
        }

        reservas.forEach(reserva => {
            const proyecto = proyectos.find(p => p.id === reserva.proyectoId)?.nombre || 'N/A';
            const cliente = clientes.find(c => c.id === reserva.clienteId);
            const nombreCliente = cliente ? `${cliente.nombre} ${cliente.apellido}` : 'N/A';
            const asesor = usuarios.find(u => u.id === reserva.asesorId);
            const nombreAsesor = asesor ? `${asesor.nombre} ${asesor.apellido}` : 'N/A';
            
            const fechaReserva = new Date(reserva.fechaReserva);
            const fechaVencimiento = new Date(fechaReserva);
            fechaVencimiento.setDate(fechaReserva.getDate() + parseInt(reserva.tiempoEspera));
            const hoy = new Date();
            const diasRestantes = Math.ceil((fechaVencimiento - hoy) / (1000 * 60 * 60 * 24));
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${proyecto}</td>
                <td>${reserva.manzano}</td>
                <td>${reserva.nroTerreno}</td>
                <td>${nombreCliente}</td>
                <td>${reserva.montoReserva} Bs</td>
                <td>${formatDate(reserva.fechaReserva)}</td>
                <td>
                    <span class="badge ${diasRestantes > 3 ? 'badge-success' : 'badge-warning'}">
                        ${diasRestantes > 0 ? diasRestantes : 'Vencido'}
                    </span>
                </td>
                <td>
                    <span class="badge ${reserva.firmado == "TRUE" ? 'badge-success' : 'badge-info'}">
                        ${reserva.firmado == "TRUE" ? 'Firmado' : 'Pendiente'}
                    </span>
                </td>
                <td class="action-buttons">
                    <div class="btn-container">
                        ${reserva.firmado != "TRUE" ? `
                            <button class="btn btn-sm btn-primary ampliar-btn" data-id="${reserva.id}" data-dias="7">
                                +7
                            </button>
                            <button class="btn btn-sm btn-primary ampliar-btn" data-id="${reserva.id}" data-dias="20">
                                +20
                            </button>
                            <button class="btn btn-sm btn-success firmar-btn" data-id="${reserva.id}">
                                <i class="fas fa-file-signature"></i> Firmar
                            </button>
                        ` : '<span>N/A</span>'}
                    </div>
                </td>
            `;
            if (tbody) tbody.appendChild(row);
        });
        
        document.querySelectorAll('.ampliar-btn').forEach(btn => {
            btn.addEventListener('click', () => ampliarReserva(btn.dataset.id, btn.dataset.dias));
        });
        
        document.querySelectorAll('.firmar-btn').forEach(btn => {
            btn.addEventListener('click', () => firmarReserva(btn.dataset.id));
        });
        
    } catch (error) {
        console.error('Error al cargar reservas:', error);
        if (tbody) tbody.innerHTML = `<tr><td colspan="9" class="text-center error">${error.message}</td></tr>`;
        showAlert(`Error al cargar reservas: ${error.message}`, 'error');
    }
}

async function loadContratos() {
    const tbody = document.getElementById('contratosTableBody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="9" class="text-center">Cargando contratos...</td></tr>';
    
    try {
        let contratos = [];

        if(contratosCache.length === 0)
        {
            const headers = {
                'Content-Type': 'application/json',
                'email': user.email,
                'password': user.password
            };

            const contratosResponse = await fetch(`${API_URL}/contratos`, { headers });
            
            if (!contratosResponse.ok) {
                if (contratosResponse.status === 404) {
                    if (tbody) tbody.innerHTML = '<tr><td colspan="9" class="text-center">No hay contratos registrados</td></tr>';
                    return;
                }
                
                const errorData = await contratosResponse.json().catch(() => ({}));
                throw new Error(errorData.error || `Error ${contratosResponse.status} al cargar contratos`);
            }
            
            contratos = await contratosResponse.json();
            contratosCache = contratos;
        }
        else{
            contratos = contratosCache;
        }
        
        if (tbody) tbody.innerHTML = '';
        
        if (!contratos || contratos.length === 0) {
            if (tbody) tbody.innerHTML = '<tr><td colspan="9" class="text-center">No hay contratos registradas</td></tr>';
            return;
        }

        const clientes = globalClientes;
        const proyectos = globalProyectos;
        const usuarios = globalUsuarios;

        const filtroProyecto = document.getElementById('filtroContratos')?.value || 'todos';
        if (filtroProyecto !== 'todos') {
            contratos = contratos.filter(c => String(c.proyectoId) === String(filtroProyecto));
        }

        contratos.forEach(contrato => {
            const proyecto = proyectos.find(p => p.id === contrato.proyectoId)?.nombre || 'N/A';
            const cliente = clientes.find(c => c.id === contrato.clienteId);
            const asesor = usuarios.find(u => u.id === contrato.asesorId);
            let equipoNombre = 'N/A'
            
            if(contrato.equipoId != "0")
            {
                const equipo = globalEquipos.find( c => c.id == contrato.equipoId);
                equipoNombre = equipo.nombre;
            }
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${contrato.manzano}</td>
                <td>${contrato.nroTerreno}</td>
                <td>${formatDate(contrato.fechaFirma)}</td>
                <td>${asesor.nombre}</td>
                <td>${cliente.nombre + " " + cliente.apellido}</td>
                <td>${equipoNombre}</td>
                <td>${contrato.metodoPago}</td>
                <td>${contrato.monto}</td>
                <td>${proyecto}</td>
            `;
            if (tbody) tbody.appendChild(row);
        });
        
    } catch (error) {
        console.error('Error al cargar contratos:', error);
        if (tbody) tbody.innerHTML = `<tr><td colspan="9" class="text-center error">${error.message}</td></tr>`;
        showAlert(`Error al cargar contratos: ${error.message}`, 'error');
    }
}

async function loadClientesFijos() {
    const tbody = document.getElementById('clientesFijosTableBody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="text-center">Cargando clientes...</td></tr>';
    
    try {
        let clientesF = [];
        if(clientesCache.length === 0){
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
        }
        else{
            clientesF = clientesCache;
        }

        if (tbody) tbody.innerHTML = '';
        
        if (!clientesF || clientesF.length === 0) {
            if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="text-center">No hay clientes registradas</td></tr>';
            return;
        }

        const proyectos = globalProyectos;

        const filtroProyecto = document.getElementById('filtroClientesF')?.value || 'todos';
        if (filtroProyecto !== 'todos') {
            clientesF = clientesF.filter(c => String(c.proyectoId) === String(filtroProyecto));
        }

        clientesF.forEach(cliente => {
            const proyecto = proyectos.find(p => p.id === cliente.proyectoId)?.nombre || 'N/A';

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${cliente.nombre}</td>
                <td>${cliente.apellido}</td>
                <td>${cliente.telefono}</td>
                <td>${proyecto}</td>
                <td>${cliente.lote}</td>
                <td>${cliente.manzano}</td>
                <td>${cliente.firmaContrato}</td>
                <td>${formatDate(cliente.fechaPago)}</td>
            `;
            if (tbody) tbody.appendChild(row);
        });
        
    } catch (error) {
        console.error('Error al cargar clientes:', error);
        if (tbody) tbody.innerHTML = `<tr><td colspan="8" class="text-center error">${error.message}</td></tr>`;
        showAlert(`Error al cargar clientes: ${error.message}`, 'error');
    }
}

function openTeamModal(teamId, equipos, usuarios) {
    const teamModal = document.getElementById('teamModal');
    const teamModalTitle = document.getElementById('teamModalTitle');
    const teamIdInput = document.getElementById('teamId');
    const teamForm = document.getElementById('teamForm');
    const miembrosSelect = document.getElementById('teamMiembros');
    
    if (miembrosSelect) miembrosSelect.innerHTML = '';
    usuarios.forEach(usuario => {
        const option = document.createElement('option');
        option.value = usuario.id;
        option.textContent = `${usuario.nombre} ${usuario.apellido} (${usuario.rol})`;
        if (miembrosSelect) miembrosSelect.appendChild(option);
    });
    
    if (teamId) {
        teamModalTitle.textContent = 'Editar Equipo';
        const equipo = equipos.find(t => t.id === teamId);
        
        if (equipo) {
            document.getElementById('teamNombre').value = equipo.nombre;
            
            Array.from(miembrosSelect.options).forEach(option => {
                option.selected = equipo.miembros.includes(option.value);
            });
            
            teamIdInput.value = equipo.id;
        }
    } else {
        teamModalTitle.textContent = 'Nuevo Equipo';
        teamForm.reset();
        teamIdInput.value = '';
    }
    
    if (teamModal) teamModal.style.display = 'flex';
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

        const proyectos = globalProyectos;        
        const clientes = globalClientes;
        
        const proyectoSelect = document.getElementById('reservaProyecto');
        if (proyectoSelect) {
            proyectoSelect.innerHTML = '<option value="">Seleccionar proyecto</option>';
            proyectos.forEach(proyecto => {
                const option = document.createElement('option');
                option.value = proyecto.id;
                option.textContent = proyecto.nombre;
                proyectoSelect.appendChild(option);
            });
        }
        
        const clienteSelect = document.getElementById('reservaCliente');
        if (clienteSelect) {
            clienteSelect.innerHTML = '<option value="">Seleccionar cliente</option>';
            clientes.forEach(cliente => {
                const option = document.createElement('option');
                option.value = cliente.id;
                option.textContent = `${cliente.nombre} ${cliente.apellido}`;
                clienteSelect.appendChild(option);
            });
        }
        
        if (reservaId) {
            reservaModalTitle.textContent = 'Editar Reserva';
            
            const reservaResponse = await fetch(`${API_URL}/reservas/${reservaId}`, { headers });
            if (!reservaResponse.ok) throw new Error('Error al cargar reserva');
            const reserva = await reservaResponse.json();
            
            if (reserva) {
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
            reservaForm.reset();
            reservaIdInput.value = '';
        }
        
        if (reservaModal) reservaModal.style.display = 'flex';
    } catch (error) {
        console.error('Error al abrir modal de reserva:', error);
        showAlert(error.message, 'error');
    }
}

async function ampliarReserva(reservaId, dias) {
    const { isConfirmed } = await Swal.fire({
        title: 'Ampliar Reserva',
        text: `¿Está seguro que desea ampliar esta reserva por ${dias} días?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Sí, ampliar',
        cancelButtonText: 'Cancelar'
    });

    if (isConfirmed) {
        try {
            const headers = {
                'Content-Type': 'application/json',
                'email': user.email,
                'password': user.password
            };

            const response = await fetch(`${API_URL}/reservas/${reservaId}/ampliar`, {
                method: 'PUT',
                headers,
                body: JSON.stringify({ dias: parseInt(dias) })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error al ampliar reserva');
            }
            
            const result = await response.json();
            showAlert(result.message, 'success');
            reservasCache = [];
            await loadReservas();
        } catch (error) {
            console.error('Error al ampliar reserva:', error);
            showAlert(error.message, 'error');
        }
    }
}

function openFirmarReservaModal(reservaId) {
    const modal = document.getElementById('firmarReservaModal');
    const reservaIdInput = document.getElementById('firmarReservaId');
    
    if (reservaIdInput) reservaIdInput.value = reservaId;
    if (modal) modal.style.display = 'flex';
}

async function firmarReserva(reservaId) {
    openFirmarReservaModal(reservaId);
}


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





// Firmar Reserva Modal
const firmarReservaModal = document.getElementById('firmarReservaModal');
const closeFirmarReservaModalBtn = document.getElementById('closeFirmarReservaModalBtn');
const cancelFirmarReservaBtn = document.getElementById('cancelFirmarReservaBtn');
const firmarReservaForm = document.getElementById('firmarReservaForm');

if (closeFirmarReservaModalBtn) {
    closeFirmarReservaModalBtn.addEventListener('click', () => {
        if (firmarReservaModal) firmarReservaModal.style.display = 'none';
    });
}

if (cancelFirmarReservaBtn) {
    cancelFirmarReservaBtn.addEventListener('click', () => {
        if (firmarReservaModal) firmarReservaModal.style.display = 'none';
    });
}

if (firmarReservaForm) {
    firmarReservaForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitButton = firmarReservaForm.querySelector('button[type="submit"]');
        
        try {
            const reservaId = document.getElementById('firmarReservaId').value;
            const metodoPago = document.getElementById('firmarMetodoPago').value;
            const monto = document.getElementById('firmarMonto').value;
            
            if (!metodoPago || !monto) {
                showAlert('Por favor complete todos los campos requeridos', 'warning');
                return;
            }
            
            setButtonLoading(submitButton, true);
            
            const headers = {
                'Content-Type': 'application/json',
                'email': user.email,
                'password': user.password
            };

            const response = await fetch(`${API_URL}/reservas/${reservaId}/firmar`, {
                method: 'PUT',
                headers,
                body: JSON.stringify({ metodoPago, monto })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error al firmar reserva');
            }
            
            const result = await response.json();
            showAlert(result.message, 'success');
            if (firmarReservaModal) firmarReservaModal.style.display = 'none';
            reservasCache = [];
            contratosCache = [];
            await loadReservas();
            await loadContratos();
            
        } catch (error) {
            console.error('Error al firmar reserva:', error);
            showAlert(error.message, 'error');
        } finally {
            setButtonLoading(submitButton, false);
        }
    });
}

async function loadRanking() {
    const asesorTbody = document.getElementById('rankingAsesorTableBody');
    const equipoTbody = document.getElementById('rankingEquipoTableBody');
    
    if (asesorTbody) asesorTbody.innerHTML = '<tr><td colspan="5" class="text-center">Cargando ranking por asesor...</td></tr>';
    if (equipoTbody) equipoTbody.innerHTML = '<tr><td colspan="5" class="text-center">Cargando ranking por equipo...</td></tr>';
    
    try {
        const headers = {
            'Content-Type': 'application/json',
            'email': user.email,
            'password': user.password
        };

        let response = null;
        const filtroProyecto = document.getElementById('filtroRanking')?.value || 'todos';

        if(filtroProyecto !== "todos")
        {
            response = await fetch(`${API_URL}/contratos/ranking?proyectoId=${filtroProyecto}`, { headers });
        }
        else{
            response = await fetch(`${API_URL}/contratos/ranking`, { headers });
        }

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Error al cargar ranking');
        }
        
        const rankingData = await response.json();
        // Mostrar ranking por asesor
        if (asesorTbody) {
            asesorTbody.innerHTML = '';
            
            if (!rankingData.porAsesor || rankingData.porAsesor.length === 0) {
                asesorTbody.innerHTML = '<tr><td colspan="5" class="text-center">No hay datos de ranking por asesor</td></tr>';
            } else {
                rankingData.porAsesor.forEach((asesor, index) => {
                    const row = document.createElement('tr');
                    
                    // Iconos de medalla para los primeros puestos
                    let posicion = '';
                    if (index === 0) {
                        posicion = '<i class="fas fa-trophy medal-gold"></i>';
                    } else if (index === 1) {
                        posicion = '<i class="fas fa-trophy medal-silver"></i>';
                    } else if (index === 2) {
                        posicion = '<i class="fas fa-trophy medal-bronze"></i>';
                    } else {
                        posicion = `<span class="badge-ranking">${index + 1}</span>`;
                    }
                    
                    const promedio = asesor.cantidad > 0 ? (asesor.montoTotal / asesor.cantidad).toFixed(2) : 0;
                    
                    row.innerHTML = `
                        <td>${posicion}</td>
                        <td>${asesor.nombre}</td>
                        <td>${asesor.cantidad}</td>
                        <td class="monto-total">${asesor.montoTotal.toFixed(2)} Bs</td>
                        <td class="promedio">${promedio} Bs</td>
                    `;
                    asesorTbody.appendChild(row);
                });
            }
        }
        
        // Mostrar ranking por equipo
        if (equipoTbody) {
            equipoTbody.innerHTML = '';
            
            if (!rankingData.porEquipo || rankingData.porEquipo.length === 0) {
                equipoTbody.innerHTML = '<tr><td colspan="5" class="text-center">No hay datos de ranking por equipo</td></tr>';
            } else {
                rankingData.porEquipo.forEach((equipo, index) => {
                    const row = document.createElement('tr');
                    
                    // Iconos de medalla para los primeros puestos
                    let posicion = '';
                    if (index === 0) {
                        posicion = '<i class="fas fa-trophy medal-gold"></i>';
                    } else if (index === 1) {
                        posicion = '<i class="fas fa-trophy medal-silver"></i>';
                    } else if (index === 2) {
                        posicion = '<i class="fas fa-trophy medal-bronze"></i>';
                    } else {
                        posicion = `<span class="badge-ranking">${index + 1}</span>`;
                    }
                    
                    const promedio = equipo.cantidad > 0 ? (equipo.montoTotal / equipo.cantidad).toFixed(2) : 0;
                    
                    row.innerHTML = `
                        <td>${posicion}</td>
                        <td>${equipo.nombre}</td>
                        <td>${equipo.cantidad}</td>
                        <td class="monto-total">${equipo.montoTotal.toFixed(2)} Bs</td>
                        <td class="promedio">${promedio} Bs</td>
                    `;
                    equipoTbody.appendChild(row);
                });
            }
        }
        
    } catch (error) {
        console.error('Error al cargar ranking:', error);
        if (asesorTbody) asesorTbody.innerHTML = `<tr><td colspan="5" class="text-center error">${error.message}</td></tr>`;
        if (equipoTbody) equipoTbody.innerHTML = `<tr><td colspan="5" class="text-center error">${error.message}</td></tr>`;
        showAlert(`Error al cargar ranking: ${error.message}`, 'error');
    }
}
// Botón para actualizar ranking
const refreshRankingBtn = document.getElementById('refreshRankingBtn');
if (refreshRankingBtn) {
    refreshRankingBtn.addEventListener('click', async () => {
        await loadRanking();
        showAlert('Ranking actualizado correctamente');
    });
}

// Cerrar modal al hacer clic fuera
window.addEventListener('click', (e) => {
    if (e.target === firmarReservaModal) {
        if (firmarReservaModal) firmarReservaModal.style.display = 'none';
    }
});



function initFiltroReservas() {
    const select = document.getElementById('filtroReservas');
    if (!select) return;

    // Limpiar y agregar "Todos"
    select.innerHTML = '<option value="todos">Todos</option>';

    // Agregar cada proyecto
    globalProyectos.forEach(proyecto => {
        const opt = document.createElement('option');
        opt.value = proyecto.id;
        opt.textContent = proyecto.nombre;
        select.appendChild(opt);
    });

    // Evento cambio -> recargar tablas
    select.addEventListener('change', () => {
        loadReservas();
    });
}

function initFiltroContratos() {
    const select = document.getElementById('filtroContratos');
    if (!select) return;

    // Limpiar y agregar "Todos"
    select.innerHTML = '<option value="todos">Todos</option>';

    // Agregar cada proyecto
    globalProyectos.forEach(proyecto => {
        const opt = document.createElement('option');
        opt.value = proyecto.id;
        opt.textContent = proyecto.nombre;
        select.appendChild(opt);
    });

    // Evento cambio -> recargar tablas
    select.addEventListener('change', () => {
        loadContratos();
    });
}


function initFiltroClientesFijos() {
    const select = document.getElementById('filtroClientesF');
    if (!select) return;

    // Limpiar y agregar "Todos"
    select.innerHTML = '<option value="todos">Todos</option>';

    // Agregar cada proyecto
    globalProyectos.forEach(proyecto => {
        const opt = document.createElement('option');
        opt.value = proyecto.id;
        opt.textContent = proyecto.nombre;
        select.appendChild(opt);
    });

    // Evento cambio -> recargar tablas
    select.addEventListener('change', () => {
        loadClientesFijos();
    });
}

function initFiltroRanking() {
    const select = document.getElementById('filtroRanking');
    if (!select) return;

    // Limpiar y agregar "Todos"
    select.innerHTML = '<option value="todos">Todos</option>';

    // Agregar cada proyecto
    globalProyectos.forEach(proyecto => {
        const opt = document.createElement('option');
        opt.value = proyecto.id;
        opt.textContent = proyecto.nombre;
        select.appendChild(opt);
    });

    // Evento cambio -> recargar tablas
    select.addEventListener('change', () => {
        loadRanking();
    });
}
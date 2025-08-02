const user = JSON.parse(sessionStorage.getItem('user'));

document.addEventListener('DOMContentLoaded', async () => {
    if (!user || user.rol !== 'Admin') {
        window.location.href = 'index.html';
        return;
    }
    
    // Configurar eventos
    setupEventListeners();

    try {
        await loadUsuarios();
    } catch (error) {
        console.error('Error al cargar usuarios:', error);
        showAlert(`Error al cargar usuarios: ${error.message}`, 'error');
    }

    try {
        await loadClientes();
    } catch (error) {
        console.error('Error al cargar clientes:', error);
        showAlert(`Error al cargar clientes: ${error.message}`, 'error');
    }
    
    try {
        await loadProrrogas();
    } catch (error) {
        console.error('Error al cargar prórrogas:', error);
        showAlert(`Error al cargar prórrogas: ${error.message}`, 'error');
    }
});

async function loadClientes() {
    try {
        const headers = {
            'Content-Type': 'application/json',
            'email': user.email,
            'password': user.password
        };

        // 1. Obtener clientes
        const clientesResponse = await fetch(`${API_URL}/clientes`, { headers });
        
        if (!clientesResponse.ok) {
            const errorData = await clientesResponse.json().catch(() => ({}));
            throw new Error(errorData.error || 'Error al cargar clientes');
        }

        const clientes = await clientesResponse.json();

        // 2. Obtener urbanizaciones
        const urbanizaciones = await loadUrbanizaciones();
        
        // 3. Obtener usuarios
        const usuariosResponse = await fetch(`${API_URL}/usuarios`, { headers });
        if (!usuariosResponse.ok) {
            throw new Error('Error al cargar usuarios');
        }
        const usuarios = await usuariosResponse.json();

        // 4. Renderizar tabla
        const tbody = document.getElementById('clientsTableBody');
        tbody.innerHTML = '';
        
        if (!clientes || clientes.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center">No hay clientes registrados</td></tr>';
            return;
        }

        clientes.forEach(cliente => {
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
        
        // Mostrar mensaje en la tabla
        const tbody = document.getElementById('clientsTableBody');
        tbody.innerHTML = `<tr><td colspan="8" class="text-center error">${error.message}</td></tr>`;
    }
}

async function loadProrrogas() {
    const tbody = document.getElementById('prorrogasTableBody');
    tbody.innerHTML = '<tr><td colspan="7" class="text-center">Cargando prórrogas...</td></tr>';
    
    try {
        const headers = {
            'Content-Type': 'application/json',
            'email': user.email,
            'password': user.password
        };

        // 1. Obtener prórrogas
        const response = await fetch(`${API_URL}/prorrogas`, { headers });
        
        if (!response.ok) {
            // Si es 404, probablemente no hay prórrogas
            if (response.status === 404) {
                tbody.innerHTML = '<tr><td colspan="7" class="text-center">No hay solicitudes de prórroga registradas</td></tr>';
                return;
            }
            
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Error ${response.status} al cargar prórrogas`);
        }
        
        const prorrogas = await response.json();
        tbody.innerHTML = '';
        
        if (!prorrogas || prorrogas.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center">No hay solicitudes de prórroga registradas</td></tr>';
            return;
        }

        // 2. Obtener datos adicionales (clientes y usuarios)
        const [clientesResponse, usuariosResponse] = await Promise.all([
            fetch(`${API_URL}/clientes`, { headers }),
            fetch(`${API_URL}/usuarios`, { headers })
        ]);
        
        if (!clientesResponse.ok) throw new Error('Error al cargar clientes');
        if (!usuariosResponse.ok) throw new Error('Error al cargar usuarios');
        
        const clientes = await clientesResponse.json();
        const usuarios = await usuariosResponse.json();

        // 3. Renderizar tabla
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
            tbody.appendChild(row);
        });
        
        // Configurar eventos de los botones de revisión
        document.querySelectorAll('.review-btn').forEach(btn => {
            btn.addEventListener('click', () => openProrrogaModal(btn.dataset.id, prorrogas));
        });
        
    } catch (error) {
        console.error('Error al cargar prórrogas:', error);
        tbody.innerHTML = `<tr><td colspan="7" class="text-center error">${error.message}</td></tr>`;
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

        const response = await fetch(`${API_URL}/usuarios`, { headers });
        
        if (!response.ok) throw new Error('Error al cargar usuarios');
        
        const usuarios = await response.json();
        const tbody = document.getElementById('usersTableBody');
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
        
        // Configurar eventos de los botones de usuario
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
    // Botón para agregar nuevo usuario
    const addUserBtn = document.getElementById('addUserBtn');
    if (addUserBtn) {
        addUserBtn.addEventListener('click', () => openUserModal());
    }
    
    // Modal de prórroga
    const prorrogaModal = document.getElementById('prorrogaModal');
    const closeProrrogaModalBtn = document.getElementById('closeProrrogaModalBtn');
    const cancelProrrogaBtn = document.getElementById('cancelProrrogaBtn');
    const confirmProrrogaBtn = document.getElementById('confirmProrrogaBtn');
    
    if (closeProrrogaModalBtn) {
        closeProrrogaModalBtn.addEventListener('click', () => {
            prorrogaModal.style.display = 'none';
        });
    }
    
    if (cancelProrrogaBtn) {
        cancelProrrogaBtn.addEventListener('click', () => {
            prorrogaModal.style.display = 'none';
        });
    }
    
    if (confirmProrrogaBtn) {
        confirmProrrogaBtn.addEventListener('click', async () => {
            const prorrogaId = confirmProrrogaBtn.dataset.id;
            const decision = document.querySelector('input[name="decision"]:checked').value;
            const diasExtra = document.getElementById('diasExtra').value;
            const comentario = document.getElementById('comentario').value;
            
        const headers = {
            'Content-Type': 'application/json',
            'email': user.email,
            'password': user.password
        };

        // 1. Obtener clientes
        const clientesResponse = await fetch(`${API_URL}/clientes`, { headers });

            try {
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
                showAlert(result.message);
                prorrogaModal.style.display = 'none';
                await loadProrrogas();
            } catch (error) {
                console.error('Error al actualizar prórroga:', error);
                showAlert(error.message, 'error');
            }
        });
    }
    
    // Modal de usuario
    const userModal = document.getElementById('userModal');
    const closeUserModalBtn = document.getElementById('closeUserModalBtn');
    const cancelUserBtn = document.getElementById('cancelUserBtn');
    const userForm = document.getElementById('userForm');
    
    if (closeUserModalBtn) {
        closeUserModalBtn.addEventListener('click', () => {
            userModal.style.display = 'none';
        });
    }
    
    if (cancelUserBtn) {
        cancelUserBtn.addEventListener('click', () => {
            userModal.style.display = 'none';
        });
    }
    
    if (userForm) {
        userForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const userId = document.getElementById('userId').value;
            const nombre = document.getElementById('userNombre').value;
            const apellido = document.getElementById('userApellido').value;
            const email = document.getElementById('userEmail').value;
            const celular = document.getElementById('userCelular').value;
            const rol = document.getElementById('userRol').value;
            const password = document.getElementById('userPassword').value;
            
            try {
                // Aquí deberías implementar la lógica para crear/actualizar usuarios
                // Esto dependerá de cómo hayas implementado el backend
                showAlert('Funcionalidad de usuarios aún no implementada', 'warning');
                userModal.style.display = 'none';
            } catch (error) {
                console.error('Error al guardar usuario:', error);
                showAlert(error.message, 'error');
            }
        });
    }
    
    // Cerrar modales al hacer clic fuera
    window.addEventListener('click', (e) => {
        if (e.target === prorrogaModal) {
            prorrogaModal.style.display = 'none';
        }
        if (e.target === userModal) {
            userModal.style.display = 'none';
        }
    });
}

function openProrrogaModal(prorrogaId, prorrogas) {
    const prorrogaModal = document.getElementById('prorrogaModal');
    const prorrogaDetails = document.getElementById('prorrogaDetails');
    const confirmProrrogaBtn = document.getElementById('confirmProrrogaBtn');
    
    const prorroga = prorrogas.find(p => p.id === prorrogaId);
    if (!prorroga) return;
    
    // 1. Parsear la fecha correctamente (asegurando formato YYYY-MM-DD)
    const fechaOriginal = new Date(prorroga.fechaLimite + 'T00:00:00');

    // 2. Crear nueva fecha para la prórroga
    const fechaLimite = new Date(fechaOriginal);
    fechaLimite.setDate(fechaLimite.getDate() + 30);
    // Mostrar detalles de la prórroga
    prorrogaDetails.innerHTML = `
        <p><strong>ID Solicitud:</strong> ${prorroga.id}</p>
        <p><strong>Fecha Solicitud:</strong> ${formatDate(prorroga.fechaSolicitud)}</p>
        <p><strong>Fecha Límite Original:</strong> ${formatDate(fechaLimite.toISOString().split('T')[0])}</p>
    `;
    
    // Configurar botón de confirmación
    confirmProrrogaBtn.dataset.id = prorrogaId;
    
    // Mostrar modal
    prorrogaModal.style.display = 'flex';
}

function openUserModal(userId, usuarios) {
    const userModal = document.getElementById('userModal');
    const userModalTitle = document.getElementById('userModalTitle');
    const userIdInput = document.getElementById('userId');
    const userForm = document.getElementById('userForm');
    
    if (userId) {
        // Modo edición
        userModalTitle.textContent = 'Editar Usuario';
        const usuario = usuarios.find(u => u.id === userId);
        
        if (usuario) {
            document.getElementById('userNombre').value = usuario.nombre;
            document.getElementById('userApellido').value = usuario.apellido;
            document.getElementById('userEmail').value = usuario.email;
            document.getElementById('userCelular').value = usuario.celular || '';
            document.getElementById('userRol').value = usuario.rol;
            document.getElementById('userPassword').value = ''; // No mostramos la contraseña actual
            
            userIdInput.value = usuario.id;
        }
    } else {
        // Modo creación
        userModalTitle.textContent = 'Nuevo Usuario';
        userForm.reset();
        userIdInput.value = '';
    }
    
    userModal.style.display = 'flex';
}

function confirmDeleteUser(userId) {
    if (confirm('¿Está seguro que desea eliminar este usuario?')) {
        // Aquí deberías implementar la lógica para eliminar el usuario
        showAlert('Funcionalidad de eliminar usuario aún no implementada', 'warning');
    }
}
const user = JSON.parse(sessionStorage.getItem('user'));

document.addEventListener('DOMContentLoaded', async () => {
    
    if (!user || user.rol !== 'Agente') {
        window.location.href = 'index.html';
        return;
    }
    
    // Cargar datos iniciales
    await Promise.all([
        loadClientes(),
        loadProrrogas()
    ]);
    
    // Configurar eventos
    setupEventListeners();
});

// Cargar urbanizaciones
async function loadUrbanizaciones() {
    try {
        const response = await fetch(`${API_URL}/proyectos`);
        if (!response.ok) throw new Error('Error al cargar urbanizaciones');
        
        const urbanizaciones = await response.json(); // Agrega const aquí
        
        const select = document.getElementById('urbanizacion');
        select.innerHTML = '<option value="">Seleccione una urbanización</option>';
        
        urbanizaciones.forEach(urbanizacion => {
            const option = document.createElement('option');
            option.value = urbanizacion.id;
            option.textContent = urbanizacion.nombre;
            select.appendChild(option);
        });
        
        return urbanizaciones; // Añade este return
    } catch (error) {
        console.error('Error al cargar urbanizaciones:', error);
        return []; // Retorna un array vacío en caso de error
    }
}

async function loadClientes() {
    try {
        const headers = {
            'Content-Type': 'application/json',
            'email': user.email,
            'password': user.password
        };

        const response = await fetch(`${API_URL}/clientes`, { headers });
        if (!response.ok) throw new Error('Error al cargar clientes');
        
        const clientes = await response.json();
        const tbody = document.getElementById('clientsTableBody');
        tbody.innerHTML = '';
        
        const urbanizaciones = await loadUrbanizaciones();
        

        clientes.forEach(cliente => {
            const urbanizacion = urbanizaciones.find(u => u.id === cliente.proyectoId)?.nombre || 'N/A';
            
            const diasRestantes = calcularDiasRestantes(cliente.fecha);
            const esCritico = diasRestantes <= 5 && diasRestantes >= 0;
            const estaExpirado = diasRestantes < 0;
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${cliente.nombre} ${cliente.apellido}</td>
                <td>${cliente.celular}</td>
                <td>${urbanizacion}</td>
                <td>${cliente.lote}</td>
                <td>${cliente.manzano}</td>
                <td>${formatDate(cliente.fecha)}</td>
                <td class="dias-restantes ${esCritico ? 'critico' : ''} ${estaExpirado ? 'expirado' : ''}">
                    ${estaExpirado ? 'Expirado' : `${diasRestantes} días`}
                </td>
                <td>
                    ${esCritico ? `
                    <button class="btn btn-sm btn-primary solicitar-btn" 
                            data-id="${cliente.id}" 
                            data-fecha="${new Date(new Date(cliente.fecha)).toISOString().split('T')[0]}">
                        Solicitar Prórroga
                    </button>
                    ` : (estaExpirado ? 'N/A' : 'N/A')}
                </td>
            `;
            tbody.appendChild(row);
        });
        
        document.querySelectorAll('.solicitar-btn').forEach(btn => {
            btn.addEventListener('click', () => openProrrogaModal(btn.dataset.id, btn.dataset.fecha));
        });
    } catch (error) {
        console.error('Error al cargar clientes:', error);
        showAlert('Error al cargar los clientes', 'error');
    }
}

async function loadProrrogas() {
    try {
        const headers = {
            'Content-Type': 'application/json',
            'email': user.email,
            'password': user.password
        };

        const response = await fetch(`${API_URL}/prorrogas`, { headers });
        
        if (!response.ok) throw new Error('Error al cargar prórrogas');
        
        const prorrogas = await response.json();
        const tbody = document.getElementById('prorrogasTableBody');
        tbody.innerHTML = '';
        
        // Cargar clientes para mostrar nombres
        const clientesResponse = await fetch(`${API_URL}/clientes`, { headers });
        const clientes = await clientesResponse.json();
        
        prorrogas.forEach(prorroga => {
            const cliente = clientes.find(c => c.id === prorroga.clienteId);
            const nombreCliente = cliente ? `${cliente.nombre} ${cliente.apellido}` : 'N/A';
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${nombreCliente}</td>
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
                <td>${prorroga.fechaResolucion ? formatDate(prorroga.fechaResolucion) : 'Pendiente'}</td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('Error al cargar prórrogas:', error);
        showAlert('Error al cargar las solicitudes de prórroga', 'error');
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
    // Botón para agregar nuevo cliente
    const addClientBtn = document.getElementById('addClientBtn');
    const closeClientModalBtn = document.getElementById('closeClientModalBtn');
    const cancelClientBtn = document.getElementById('cancelClientBtn');
    const clientForm = document.getElementById('clientForm');
    
    if (addClientBtn) {
        addClientBtn.addEventListener('click', () => {
            document.getElementById('clientModal').style.display = 'flex';
        });
    }
    
    if (closeClientModalBtn) {
        closeClientModalBtn.addEventListener('click', () => {
            document.getElementById('clientModal').style.display = 'none';
        });
    }
    
    if (cancelClientBtn) {
        cancelClientBtn.addEventListener('click', () => {
            document.getElementById('clientModal').style.display = 'none';
        });
    }
    
    if (clientForm) {
        clientForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const nombre = document.getElementById('nombre').value;
            const apellido = document.getElementById('apellido').value;
            const celular = document.getElementById('celular').value;
            const urbanizacion = document.getElementById('urbanizacion').value;
            const lote = document.getElementById('lote').value;
            const manzano = document.getElementById('manzano').value;
            
            try {
                const headers = {
                    'Content-Type': 'application/json',
                    'email': user.email,
                    'password': user.password
                };

                const response = await fetch(`${API_URL}/clientes`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        nombre,
                        apellido,
                        celular,
                        proyectoId: urbanizacion,
                        lote,
                        manzano
                    })
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Error al registrar cliente');
                }
                
                const result = await response.json();
                showAlert(result.message);
                document.getElementById('clientModal').style.display = 'none';
                clientForm.reset();
                await loadClientes();
            } catch (error) {
                console.error('Error al registrar cliente:', error);
                showAlert(error.message, 'error');
            }
        });
    }
    
    // Modal para solicitar prórroga
    const prorrogaModal = document.getElementById('prorrogaModal');
    const closeProrrogaModalBtn = document.getElementById('closeProrrogaModalBtn');
    const cancelProrrogaBtn = document.getElementById('cancelProrrogaBtn');
    const prorrogaForm = document.getElementById('prorrogaForm');
    
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
    
    if (prorrogaForm) {
        prorrogaForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const clienteId = document.getElementById('prorrogaClienteId').value;
            const fechaLimite = document.getElementById('prorrogaFechaLimite').value;
            const descripcion = document.getElementById('prorrogaDescripcion').value;
            const imagenUrl = document.getElementById('prorrogaImagen').value;
            
            try {
                const headers = {
                    'Content-Type': 'application/json',
                    'email': user.email,
                    'password': user.password
                };

                const response = await fetch(`${API_URL}/prorrogas`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        clienteId,
                        descripcion,
                        imagenUrl,
                        fechaLimite
                    })
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Error al crear solicitud de prórroga');
                }
                
                const result = await response.json();
                showAlert(result.message);
                prorrogaModal.style.display = 'none';
                prorrogaForm.reset();
                await loadProrrogas();
            } catch (error) {
                console.error('Error al crear prórroga:', error);
                showAlert(error.message, 'error');
            }
        });
    }
    
    // Cerrar modales al hacer clic fuera
    window.addEventListener('click', (e) => {
        if (e.target === document.getElementById('clientModal')) {
            document.getElementById('clientModal').style.display = 'none';
        }
        if (e.target === prorrogaModal) {
            prorrogaModal.style.display = 'none';
        }
    });
}

function openProrrogaModal(clienteId, fechaLimite) {
    const prorrogaModal = document.getElementById('prorrogaModal');
    document.getElementById('prorrogaClienteId').value = clienteId;
    
    // Usar la fecha límite directamente (ya incluye los 30 días)
    document.getElementById('prorrogaFechaLimite').value = fechaLimite;
    document.getElementById('prorrogaDescripcion').value = '';
    document.getElementById('prorrogaImagen').value = '';
    prorrogaModal.style.display = 'flex';
}
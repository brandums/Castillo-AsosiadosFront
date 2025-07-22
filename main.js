// URL de tu backend en Fly.io
const API_URL = 'https://urbanizacion-backend.fly.dev';

// Elementos del DOM
const clientsTableBody = document.getElementById('clientsTableBody');
const addClientBtn = document.getElementById('addClientBtn');
const clientModal = document.getElementById('clientModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const cancelBtn = document.getElementById('cancelBtn');
const clientForm = document.getElementById('clientForm');
const loadingElement = document.getElementById('loading');
const alertBox = document.getElementById('alertBox');
const currentDateElement = document.getElementById('currentDate');

// Variables para almacenar datos
let urbanizaciones = [];
let asesores = [];
let clientes = [];

// Mostrar fecha actual
function updateCurrentDate() {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    currentDateElement.textContent = new Date().toLocaleDateString('es-ES', options);
}

// Mostrar alerta
function showAlert(message, type = 'success') {
    alertBox.textContent = message;
    alertBox.className = `alert alert-${type}`;
    alertBox.style.display = 'block';
    
    setTimeout(() => {
        alertBox.style.display = 'none';
    }, 5000);
}

// Cargar urbanizaciones
async function loadUrbanizaciones() {
    try {
        const response = await fetch(`${API_URL}/proyectos`);
        if (!response.ok) throw new Error('Error al cargar urbanizaciones');
        
        urbanizaciones = await response.json();
        
        const select = document.getElementById('urbanizacion');
        select.innerHTML = '<option value="">Seleccione una urbanización</option>';
        
        urbanizaciones.forEach(urbanizacion => {
            const option = document.createElement('option');
            option.value = urbanizacion.id;
            option.textContent = urbanizacion.nombre;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error al cargar urbanizaciones:', error);
        showAlert('Error al cargar las urbanizaciones', 'error');
    }
}

// Cargar asesores
async function loadAsesores() {
    try {
        const response = await fetch(`${API_URL}/agentes`);
        if (!response.ok) throw new Error('Error al cargar asesores');
        
        asesores = await response.json();
        
        const select = document.getElementById('asesor');
        select.innerHTML = '<option value="">Seleccione un asesor</option>';
        
        asesores.forEach(asesor => {
            const option = document.createElement('option');
            option.value = asesor.id;
            option.textContent = `${asesor.nombre} ${asesor.apellido}`;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error al cargar asesores:', error);
        showAlert('Error al cargar los asesores', 'error');
    }
}

// Cargar clientes
async function loadClientes() {
    try {
        loadingElement.style.display = 'block';
        clientsTableBody.innerHTML = '';
        
        const response = await fetch(`${API_URL}/clientes`);
        if (!response.ok) throw new Error('Error al cargar clientes');
        
        clientes = await response.json();

        console.log("clientes: ", clientes);
        
        // Cargar urbanizaciones y asesores si no están cargados
        if (urbanizaciones.length === 0) await loadUrbanizaciones();
        if (asesores.length === 0) await loadAsesores();
        
        clientes.forEach(cliente => {
            const urbanizacion = urbanizaciones.find(u => u.id === cliente.proyectoId)?.nombre || 'N/A';
            const asesorObj = asesores.find(a => a.id === cliente.agenteId);
            const asesor = asesorObj ? `${asesorObj.nombre} ${asesorObj.apellido}` : 'N/A';
            
            // Corregir el manejo de fechas
            const fechaParts = cliente.fecha.split('-');
            const fechaRegistro = new Date(
                parseInt(fechaParts[0]), // año
                parseInt(fechaParts[1]) - 1, // mes (0-11)
                parseInt(fechaParts[2]) // día
            );
            
            // Forzar la fecha sin conversión horaria
            const fechaLocal = new Date(fechaRegistro.getTime() + fechaRegistro.getTimezoneOffset() * 60000);
            
            const hoy = new Date();
            const diferenciaDias = Math.floor((hoy - fechaRegistro) / (1000 * 60 * 60 * 24));
            const esReciente = diferenciaDias <= 7;
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${cliente.nombre} ${cliente.apellido}</td>
                <td>${cliente.celular}</td>
                <td>${urbanizacion}</td>
                <td>${cliente.lote}</td>
                <td>${asesor}</td>
                <td>${fechaLocal.toLocaleDateString('es-ES', { timeZone: 'UTC' })}</td>
                <td>
                    <span class="badge ${esReciente ? 'badge-success' : 'badge-warning'}">
                        ${esReciente ? 'Reciente' : 'Antiguo'}
                    </span>
                </td>
            `;
            clientsTableBody.appendChild(row);
        });
        
        loadingElement.style.display = 'none';
    } catch (error) {
        console.error('Error al cargar clientes:', error);
        showAlert('Error al cargar los clientes', 'error');
        loadingElement.style.display = 'none';
    }
}

// Registrar nuevo cliente
async function registerClient(clientData) {
    try {
        console.log("cliente: ", clientData);
        const response = await fetch(`${API_URL}/clientes`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(clientData),
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detalles || errorData.error || 'Error desconocido al registrar cliente');
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error al registrar cliente:', error);
        showAlert(error.message || 'Ocurrió un error al registrar el cliente', 'error');
        throw error;
    }
}

// Validar duplicidad de cliente
async function checkDuplicateClient(celular) {
    try {
        const response = await fetch(`${API_URL}/clientes/duplicado?celular=${celular}`);
        if (!response.ok) throw new Error('Error al validar duplicado');
        
        return await response.json();
    } catch (error) {
        console.error('Error al validar duplicado:', error);
        throw error;
    }
}

// Event Listeners
addClientBtn.addEventListener('click', () => {
    clientModal.style.display = 'flex';
});

closeModalBtn.addEventListener('click', () => {
    clientModal.style.display = 'none';
});

cancelBtn.addEventListener('click', () => {
    clientModal.style.display = 'none';
});

clientForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const nombre = document.getElementById('nombre').value;
    const apellido = document.getElementById('apellido').value;
    const celular = document.getElementById('celular').value;
    const urbanizacion = document.getElementById('urbanizacion').value;
    const lote = document.getElementById('lote').value;
    const asesor = document.getElementById('asesor').value;
    
    try {
        // Validar duplicidad
        const duplicateCheck = await checkDuplicateClient(celular);
        if (duplicateCheck.isDuplicate) {
            clientModal.style.display = 'none';
            showAlert(duplicateCheck.message, 'error');
            return;
        }
        
        // Crear objeto cliente
        const cliente = {
            nombre,
            apellido,
            celular,
            proyectoId: urbanizacion,
            agenteId: asesor,
            lote
        };
        
        // Registrar cliente
        const result = await registerClient(cliente);
        
        if (result.success) {
            showAlert(result.message);
            clientModal.style.display = 'none';
            clientForm.reset();
            await loadClientes();
        }
    } catch (error) {
        console.error('Error:', error);
        showAlert(error.message || 'Ocurrió un error al registrar el cliente', 'error');
    }
});

// Cerrar modal al hacer clic fuera del contenido
window.addEventListener('click', (e) => {
    if (e.target === clientModal) {
        clientModal.style.display = 'none';
    }
});

// Inicializar la aplicación
async function init() {
    updateCurrentDate();
    await Promise.all([loadUrbanizaciones(), loadAsesores()]);
    await loadClientes();
}

// Iniciar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', init);

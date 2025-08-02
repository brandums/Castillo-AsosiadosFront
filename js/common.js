const API_URL = 'https://urbanizacion-backend.fly.dev';

// Verificar autenticación al cargar las páginas
function checkAuth() {
    const user = JSON.parse(sessionStorage.getItem('user'));
    if (!user) {
        window.location.href = 'index.html';
    }
    return user;
}

// Mostrar nombre de usuario
function displayUserName() {
    const user = JSON.parse(sessionStorage.getItem('user'));
    if (user && document.getElementById('userName')) {
        document.getElementById('userName').textContent = `${user.nombre} ${user.apellido}`;
    }
}

// Configurar logout
function setupLogout() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            sessionStorage.removeItem('user');
            window.location.href = 'index.html';
        });
    }
}

// Mostrar alerta
function showAlert(message, type = 'success') {
    const alertBox = document.getElementById('alertBox');
    if (alertBox) {
        alertBox.textContent = message;
        alertBox.className = `alert alert-${type}`;
        alertBox.style.display = 'block';
        
        setTimeout(() => {
            alertBox.style.display = 'none';
        }, 5000);
    }
}

// Configurar tabs
function setupTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remover activo de todos los botones y contenidos
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            // Activar el seleccionado
            btn.classList.add('active');
            const tabId = btn.getAttribute('data-tab') + 'Tab';
            document.getElementById(tabId).classList.add('active');
        });
    });
}

// Cargar urbanizaciones
async function loadUrbanizaciones(selectElementId) {
    try {
        const response = await fetch(`${API_URL}/proyectos`);
        if (!response.ok) throw new Error('Error al cargar urbanizaciones');
        
        const urbanizaciones = await response.json();
        const select = document.getElementById(selectElementId);
        
        if (select) {
            select.innerHTML = '<option value="">Seleccione una urbanización</option>';
            
            urbanizaciones.forEach(urbanizacion => {
                const option = document.createElement('option');
                option.value = urbanizacion.id;
                option.textContent = urbanizacion.nombre;
                select.appendChild(option);
            });
        }
        
        return urbanizaciones;
    } catch (error) {
        console.error('Error al cargar urbanizaciones:', error);
        showAlert('Error al cargar las urbanizaciones', 'error');
        return [];
    }
}

// Formatear fecha
function formatDate(dateString) {
    const date = new Date(dateString + 'T00:00:00');
    
    const options = { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        timeZone: 'America/La_Paz'
    };
    
    return date.toLocaleDateString('es-ES', options);
}

// Calcular días restantes (considerando 30 días desde la fecha del cliente)
function calcularDiasRestantes(fechaCliente) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0); // Normalizar a inicio del día
    
    const fechaLimiteReal = new Date(fechaCliente);
    fechaLimiteReal.setDate(fechaLimiteReal.getDate() + 30); // Agregar 30 días
    fechaLimiteReal.setHours(0, 0, 0, 0); // Normalizar a inicio del día
    
    const diffTime = fechaLimiteReal - hoy;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
}

// Inicializar componentes comunes
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    displayUserName();
    setupLogout();
    setupTabs();
});
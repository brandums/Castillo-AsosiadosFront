const API_URL = 'https://urbanizacion-backend.fly.dev';

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const alertBox = document.getElementById('alertBox');
    const loginButton = document.getElementById('loginButton');
    const buttonText = document.getElementById('buttonText');
    const buttonLoading = document.getElementById('buttonLoading');
    
    // Función para mostrar alertas
    function showAlert(message, type = 'error') {
        alertBox.textContent = message;
        alertBox.className = 'alert'; // Reset classes
        alertBox.classList.add(type);
        alertBox.style.display = 'block';
        
        // Ocultar la alerta después de 5 segundos
        setTimeout(() => {
            alertBox.style.display = 'none';
        }, 5000);
    }
    
    // Función para resetear el estado del botón
    function resetButtonState() {
        loginButton.disabled = false;
        buttonText.style.display = 'inline-block';
        buttonLoading.style.display = 'none';
    }
    
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Deshabilitar botón y mostrar spinner
        loginButton.disabled = true;
        buttonText.style.display = 'none';
        buttonLoading.style.display = 'inline-block';
        alertBox.style.display = 'none'; // Ocultar alertas previas
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        
        try {
            const response = await fetch(`${API_URL}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                // Mostrar mensaje de error específico del servidor o uno genérico
                throw new Error(data.message || data.error || 'Credenciales incorrectas');
            }
            
            // Guardar datos de usuario en sessionStorage
            sessionStorage.setItem('user', JSON.stringify(data));
            
            // Redirigir según el rol
            if (data.rol === 'Admin') {
                window.location.href = 'admin.html';
            } else {
                window.location.href = 'agent.html';
            }
        } catch (error) {
            console.error('Error en login:', error);
            showAlert(error.message, 'error');
            resetButtonState();
        }
    });
    
    // Alternar visibilidad de contraseña
    document.getElementById('togglePassword').addEventListener('click', function() {
        const passwordInput = document.getElementById('password');
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        this.classList.toggle('fa-eye-slash');
    });
});
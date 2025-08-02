const API_URL = 'https://urbanizacion-backend.fly.dev';

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const alertBox = document.getElementById('alertBox');
    const loginButton = document.getElementById('loginButton');
    const buttonText = document.getElementById('buttonText');
    const buttonLoading = document.getElementById('buttonLoading');
    
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        console.log("entrooo");
        // Deshabilitar botón y mostrar spinner
        loginButton.disabled = true;
        buttonText.style.display = 'none';
        buttonLoading.style.display = 'inline-block';
        
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
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error al iniciar sesión');
            }
            
            const user = await response.json();
            
            // Guardar datos de usuario en sessionStorage
            sessionStorage.setItem('user', JSON.stringify(user));
            
            // Redirigir según el rol
            if (user.rol === 'Admin') {
                window.location.href = 'admin.html';
            } else {
                window.location.href = 'agent.html';
            }
        } catch (error) {
            console.error('Error en login:', error);
            showAlert(error.message, 'error');
            
            // Rehabilitar botón y ocultar spinner
            loginButton.disabled = false;
            buttonText.style.display = 'inline-block';
            buttonLoading.style.display = 'none';
        }
    });
});


document.getElementById('togglePassword').addEventListener('click', function() {
            const passwordInput = document.getElementById('password');
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            this.classList.toggle('fa-eye-slash');
        });
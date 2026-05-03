function showForm(formId) {
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('signup-form').classList.add('hidden');
    document.getElementById('forgot-form').classList.add('hidden');
    document.getElementById('error-message').classList.add('hidden');
    document.getElementById('success-message').classList.add('hidden');

    document.getElementById(`${formId}-form`).classList.remove('hidden');
    clearErrors();
}

function displayMessage(type, message, fieldId = null) {
    const messageDiv = document.getElementById(`${type}-message`);
    const messageText = messageDiv.querySelector('.message-text');
    messageText.innerText = message;
    messageDiv.classList.remove('hidden');

    if (fieldId && type === 'error') {
        const field = document.getElementById(fieldId);
        if (field) {
            field.classList.add('error');
            field.parentElement.classList.add('shake');
            setTimeout(() => field.parentElement.classList.remove('shake'), 500);
        }
    }
}

function clearErrors() {
    const inputs = document.querySelectorAll('.form-input');
    inputs.forEach(input => input.classList.remove('error'));

    document.getElementById('error-message').classList.add('hidden');
    document.getElementById('success-message').classList.add('hidden');
}

document.addEventListener('input', (e) => {
    if (e.target.tagName === 'INPUT') {
        e.target.classList.remove('error');
        document.getElementById('error-message').classList.add('hidden');

        if (e.target.id === 'reg-password') {
            validatePasswordRequirements(e.target.value);
        }

        if (e.target.id === 'reg-confirm-password') {
            validatePasswordMatch();
        }
    }
});

function validatePasswordRequirements(password) {
    const hasMinLength = password.length >= 8;
    const hasUppercase = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);

    const lengthReq = document.getElementById('req-length');
    const uppercaseReq = document.getElementById('req-uppercase');
    const numberReq = document.getElementById('req-number');

    if (lengthReq) lengthReq.classList.toggle('valid', hasMinLength);
    if (uppercaseReq) uppercaseReq.classList.toggle('valid', hasUppercase);
    if (numberReq) numberReq.classList.toggle('valid', hasNumber);

    return hasMinLength && hasUppercase && hasNumber;
}

function validatePasswordMatch() {
    const password = document.getElementById('reg-password');
    const confirmPassword = document.getElementById('reg-confirm-password');

    if (!password || !confirmPassword) return false;

    if (confirmPassword.value && password.value !== confirmPassword.value) {
        confirmPassword.classList.add('error');
        return false;
    }

    confirmPassword.classList.remove('error');
    return true;
}

function validateSignupForm() {
    const fname = document.getElementById('reg-fname');
    const lname = document.getElementById('reg-lname');
    const username = document.getElementById('reg-username');
    const email = document.getElementById('reg-email');
    const phone = document.getElementById('reg-phone');
    const location = document.getElementById('reg-location');
    const password = document.getElementById('reg-password');
    const confirmPassword = document.getElementById('reg-confirm-password');

    if (!fname.value || !lname.value || !username.value || !email.value || !password.value || !confirmPassword.value) {
        displayMessage('error', 'Please fill in all required fields');
        return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.value)) {
        displayMessage('error', 'Please enter a valid email address', 'reg-email');
        return false;
    }

    if (!validatePasswordRequirements(password.value)) {
        displayMessage('error', 'Password does not meet requirements', 'reg-password');
        return false;
    }

    if (!validatePasswordMatch()) {
        displayMessage('error', 'Passwords do not match', 'reg-confirm-password');
        return false;
    }

    return true;
}

function validateLoginForm() {
    const email = document.getElementById('login-email');
    const password = document.getElementById('login-password');

    if (!email.value || !password.value) {
        displayMessage('error', 'Please fill in all fields');
        return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.value)) {
        displayMessage('error', 'Please enter a valid email address', 'login-email');
        return false;
    }

    return true;
}

function validateForgotForm() {
    const email = document.getElementById('forgot-email');

    if (!email.value) {
        displayMessage('error', 'Please enter your email address');
        return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.value)) {
        displayMessage('error', 'Please enter a valid email address', 'forgot-email');
        return false;
    }

    return true;
}

const API_BASE = '/api';

async function handleSignup() {
    if (!validateSignupForm()) return;

    const data = {
        first_name: document.getElementById('reg-fname').value,
        last_name: document.getElementById('reg-lname').value,
        username: document.getElementById('reg-username').value,
        email: document.getElementById('reg-email').value,
        phone_number: document.getElementById('reg-phone').value,
        location: document.getElementById('reg-location').value,
        password: document.getElementById('reg-password').value
    };

    try {
        const response = await fetch(API_BASE + '/signup.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (response.ok) {
            displayMessage('success', result.message || 'Account created successfully! You can now login.');
            document.getElementById('signup-form').querySelectorAll('input').forEach(input => {
                input.value = '';
            });
            setTimeout(() => showForm('login'), 2000);
        } else {
            let fieldId = null;
            if (result.error && result.error.toLowerCase().includes("username")) fieldId = 'reg-username';
            if (result.error && result.error.toLowerCase().includes("email")) fieldId = 'reg-email';
            if (result.error && result.error.toLowerCase().includes("phone")) fieldId = 'reg-phone';
            displayMessage('error', result.error || 'Registration failed', fieldId);
        }
    } catch (e) {
        displayMessage('error', 'Connection error. Please try again later.');
    }
}

async function handleLogin() {
    if (!validateLoginForm()) return;

    const data = {
        email: document.getElementById('login-email').value,
        password: document.getElementById('login-password').value
    };

    try {
        const response = await fetch(API_BASE + '/login.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (response.ok) {
            displayMessage('success', 'Login successful! Redirecting...');
            localStorage.setItem('bora_token', result.access_token);
            localStorage.setItem('user_data', JSON.stringify(result.user));
            setTimeout(() => {
                window.location.href = "browse.html";
            }, 1500);
        } else {
            displayMessage('error', result.error || 'Login failed', 'login-password');
        }
    } catch (e) {
        displayMessage('error', 'API is offline. Please try again later.');
    }
}

async function handleForgot() {
    if (!validateForgotForm()) return;

    const email = document.getElementById('forgot-email').value;

    try {
        const response = await fetch(API_BASE + '/forgot-password.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email })
        });

        if (response.ok) {
            const result = await response.json();
            displayMessage('success', result.message || 'If this email is registered, you will receive a password reset link shortly.');
            document.getElementById('forgot-email').value = '';
            setTimeout(() => showForm('login'), 3000);
        } else {
            const result = await response.json();
            displayMessage('error', result.error || 'Error sending reset link. Please try again.');
        }
    } catch (e) {
        displayMessage('error', 'Connection error. Please try again later.');
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const passwordInput = document.getElementById('reg-password');
    const confirmPasswordInput = document.getElementById('reg-confirm-password');

    if (passwordInput) {
        passwordInput.addEventListener('input', function(e) {
            validatePasswordRequirements(e.target.value);
        });
    }

    if (confirmPasswordInput) {
        confirmPasswordInput.addEventListener('input', validatePasswordMatch);
    }

    const forms = document.querySelectorAll('.form-container');
    forms.forEach(form => {
        form.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                if (form.id === 'login-form') {
                    handleLogin();
                } else if (form.id === 'signup-form') {
                    handleSignup();
                } else if (form.id === 'forgot-form') {
                    handleForgot();
                }
            }
        });
    });

    console.log('Auth.js initialized successfully');
});

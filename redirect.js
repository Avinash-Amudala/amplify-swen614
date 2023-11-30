document.addEventListener('DOMContentLoaded', function () {
    const currentUser = localStorage.getItem('currentUser');
    const isLoginPage = window.location.pathname.includes('login.html');

    if (!currentUser && !isLoginPage) {
        // Not logged in and not on login page, redirect to login
        window.location.href = 'login.html';
    } else if (currentUser && isLoginPage) {
        // Logged in but on login page, redirect to main page
        window.location.href = 'index.html';
    }
});

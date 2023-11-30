document.addEventListener('DOMContentLoaded', function () {
    function handleLogin() {
        const username = document.getElementById('usernameInput').value;
        if (username) {
            // Save username in localStorage or session
            localStorage.setItem('currentUser', username);
            // Redirect to the main page
            window.location.href = 'index.html';
        } else {
            alert("Please enter a username.");
        }
    }
    document.getElementById('loginButton').addEventListener('click', handleLogin);
});

// assets/js/auth.js

async function protectPage() {
    // ১. যদি আগে থেকেই সেশন ক্যাশ থাকে, তবে সাথে সাথে লোডার বন্ধ করার সিগন্যাল দাও
    if (localStorage.getItem('supabase_session_exists')) {
        const loader = document.getElementById('globalLoader');
        if (loader) loader.style.display = 'none';
    }

    const { data } = await window.db.auth.getSession();
    if (!data.session) {
        localStorage.removeItem('supabase_session_exists');
        window.location.href = "login.html";
    } else {
        localStorage.setItem('supabase_session_exists', 'true');
    }
}
protectPage();
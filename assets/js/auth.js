// assets/js/auth.js

async function protectPage() {
    // চেক করা হচ্ছে ইউজার লগইন আছে কিনা
    const { data } = await window.db.auth.getSession();

    if (!data.session) {
        // যদি লগইন না থাকে, ঘাড় ধাক্কা দিয়ে লগইন পেজে পাঠাও
        window.location.href = "login.html";
    }
}

// লগআউট ফাংশন (সব পেজের জন্য)
window.logout = async function() {
    await window.db.auth.signOut();
    window.location.href = "login.html";
}

// পেজ লোড হলেই চেক করবে
protectPage();
// assets/js/login.js

let isLogin = true; 

const form = document.getElementById('authForm');
const msg = document.getElementById('msg');
const btn = document.getElementById('submitBtn');
const title = document.getElementById('pageTitle');
const toggleBtn = document.querySelector('.toggle-text');

// ১. টগল ফাংশন
function toggleMode() {
    isLogin = !isLogin;
    if (isLogin) {
        title.innerText = "Welcome Back";
        btn.innerText = "Login";
        toggleBtn.innerText = "Don't have an account? Sign Up";
    } else {
        title.innerText = "Create Account";
        btn.innerText = "Sign Up";
        toggleBtn.innerText = "Already have an account? Login";
    }
    msg.style.display = 'none';
    form.reset();
}

// ২. ফর্ম সাবমিট লজিক
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    btn.disabled = true;
    btn.innerText = "Processing...";
    msg.style.display = 'none';

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    let data, error;

    if (isLogin) {
        // --- লগইন লজিক ---
        ({ data, error } = await window.db.auth.signInWithPassword({ email, password }));
        
        if (error) {
            showError(error.message);
        } else {
            showSuccess("✅ Login Successful! Redirecting...");
            setTimeout(() => { window.location.href = "index.html"; }, 1000);
        }

    } else {
        // --- সাইন আপ লজিক (ভেরিফিকেশন সহ) ---
        ({ data, error } = await window.db.auth.signUp({ 
            email, 
            password,
            options: {
                emailRedirectTo: window.location.origin + '/index.html' // ভেরিফাই লিংকে ক্লিক করলে যেখানে যাবে
            }
        }));

        if (error) {
            showError(error.message);
        } else {
            // যদি ভেরিফিকেশন অন থাকে, তাহলে সেশন null থাকবে
            if (data.user && !data.session) {
                showSuccess("✅ Sign up successful! Please check your email to verify your account.");
                // বাটন রিসেট
                btn.disabled = false;
                btn.innerText = "Sign Up";
            } else {
                // যদি ভেরিফিকেশন অফ থাকে (অটো লগইন)
                showSuccess("✅ Account Created! Redirecting...");
                setTimeout(() => { window.location.href = "index.html"; }, 1000);
            }
        }
    }
});

function showError(message) {
    msg.style.display = 'block';
    msg.innerText = "❌ " + message;
    msg.className = "status error";
    btn.disabled = false;
    btn.innerText = isLogin ? "Login" : "Sign Up";
}

function showSuccess(message) {
    msg.style.display = 'block';
    msg.innerText = message;
    msg.className = "status success";
}

// ৩. অটো রিডাইরেক্ট (যদি ইউজার আগে থেকেই লগইন থাকে)
async function checkLogin() {
    const { data } = await window.db.auth.getSession();
    if (data.session) {
        window.location.href = "index.html";
    }
}
checkLogin();
// ব্যাকগ্রাউন্ড অ্যানিমেশন লজিক
function initBackgroundAnimation() {
    const container = document.getElementById('falling-bg');
    if (!container) return;

    const name = "KESHAB";
    const letters = name.split('');

    letters.forEach((char, i) => {
        const span = document.createElement('span');
        span.innerText = char;
        span.className = 'falling-letter';
        
        // অক্ষরগুলোকে স্ক্রিনের চওড়া অনুযায়ী সাজানো
        const spacing = 100 / (letters.length + 1);
        span.style.left = `${(i + 1) * spacing}%`;
        
        // একটির পর একটি পড়ার জন্য ডিলে (Delay) সেট করা
        span.style.animationDelay = `${i * 1.5}s`;
        
        container.appendChild(span);
    });
}

// পেজ লোড হলে অ্যানিমেশন শুরু হবে
document.addEventListener('DOMContentLoaded', initBackgroundAnimation);
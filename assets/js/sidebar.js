document.addEventListener('DOMContentLoaded', function() {
    
    // ১. সাইডবার টগল লজিক
    const sidebar = document.getElementById('sidebar');
    const menuToggle = document.getElementById('menuToggle');
    const closeSidebar = document.getElementById('closeSidebar');
    const globalLoader = document.getElementById('globalLoader'); // লোডার ধরা হলো

    if (sidebar && menuToggle) {
        // মেনু খোলা
        menuToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            sidebar.classList.add('active');
        });

        // মেনু বন্ধ করা (X বাটন)
        if (closeSidebar) {
            closeSidebar.addEventListener('click', () => {
                sidebar.classList.remove('active');
            });
        }

        // বাইরে ক্লিক করলে মেনু বন্ধ
        document.addEventListener('click', (e) => {
            if (sidebar.classList.contains('active') && 
                !sidebar.contains(e.target) && 
                !menuToggle.contains(e.target)) {
                sidebar.classList.remove('active');
            }
        });
    }

    // ২. হেডার প্রোফাইল ছবি লোড কল
    loadHeaderAvatar();

    // ============================================================
    // ৩. পেজ চেঞ্জ হওয়ার সময় লোডার দেখানো (নতুন লজিক)
    // ============================================================
    const allLinks = document.querySelectorAll('a');

    allLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            const href = this.getAttribute('href');

            // যদি লিংক না থাকে, অথবা '#' হয়, অথবা জাভাস্ক্রিপ্ট কল হয় -> তাহলে লোডার দেখাবো না
            if (!href || href === '#' || href.startsWith('javascript:')) return;

            // সাধারণ ক্লিক বন্ধ করে আগে লোডার দেখাবো
            e.preventDefault();

            if (globalLoader) {
                globalLoader.style.display = 'flex'; // লোডার চালু
            }

            // সামান্য সময় দিয়ে পেজ চেঞ্জ করবো (যাতে লোডার রেন্ডার হতে পারে)
            setTimeout(() => {
                window.location.href = href;
            }, 50);
        });
    });
});

// ৩. ছবি লোড করার ফাংশন
async function loadHeaderAvatar() {
    const avatarImg = document.getElementById('headerAvatar');
    
    // চেক করা হচ্ছে db এবং ইমেজ ট্যাগ আছে কিনা
    if (!avatarImg || typeof window.db === 'undefined') return;

    try {
        // ১. ইউজার চেক
        const { data: { user } } = await window.db.auth.getUser();
        
        if (user) {
            // ২. ডাটাবেস থেকে avatar_url আনা
            const { data } = await window.db
                .from('profiles')
                .select('avatar_url')
                .eq('id', user.id)
                .single();

            if (data && data.avatar_url) {
                let finalUrl = data.avatar_url;

                // ৩. চেক করা হচ্ছে এটা ফুল লিংক নাকি শুধু পাথ
                if (!finalUrl.startsWith('http')) {
                    const { data: publicData } = window.db
                        .storage
                        .from('avatars')
                        .getPublicUrl(finalUrl);
                    finalUrl = publicData.publicUrl;
                }

                // ৪. ছবি সেট করা (ক্যাশ এড়াতে টাইমস্ট্যাম্প সহ)
                avatarImg.src = finalUrl + '?t=' + new Date().getTime();
            }
        }
    } catch (err) {
        console.error("Avatar Load Error:", err);
    }
}

// ৪. গ্লোবাল লগআউট ফাংশন (উইন্ডো অবজেক্টে সেট করা যাতে HTML থেকে কল করা যায়)
window.logout = async function() {
    const globalLoader = document.getElementById('globalLoader');
    if(globalLoader) globalLoader.style.display = 'flex'; // লগআউটের সময়ও লোডার দেখাবে
    
    try {
        await window.db.auth.signOut();
        window.location.href = 'login.html';
    } catch (error) {
        console.error("Logout failed:", error);
        window.location.href = 'login.html'; // এরর হলেও লগইন পেজে পাঠাবে
    }
}
// Smart Caching for Header Avatar
async function loadHeaderAvatarWithCache() {
    const avatarImg = document.getElementById('headerAvatar');
    if (!avatarImg) return;

    try {
        const { data: { user } } = await window.db.auth.getUser();
        if (!user) return;

        // প্রথমে লোকাল ক্যাশ চেক করা (Instant Load)
        const cachedUrl = localStorage.getItem(`avatar_${user.id}`);
        if (cachedUrl) {
            avatarImg.src = cachedUrl;
            return; // ক্যাশ থাকলে আর সার্ভারে যাওয়ার দরকার নেই
        }

        // ক্যাশ না থাকলে ডাটাবেস থেকে আনা
        const { data } = await window.db.from('profiles').select('avatar_url').eq('id', user.id).single();
        if (data && data.avatar_url) {
            avatarImg.src = data.avatar_url;
            localStorage.setItem(`avatar_${user.id}`, data.avatar_url); // ক্যাশে সেভ করা
        }
    } catch (err) {
        console.log("Avatar load skipped");
    }
}

// Replace the original loadHeaderAvatar call
document.addEventListener('DOMContentLoaded', function() {
    loadHeaderAvatarWithCache();
});
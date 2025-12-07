document.addEventListener('DOMContentLoaded', function() {
    
    // ১. সাইডবার টগল লজিক
    const sidebar = document.getElementById('sidebar');
    const menuToggle = document.getElementById('menuToggle');
    const closeSidebar = document.getElementById('closeSidebar');

    if (sidebar && menuToggle) {
        menuToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            sidebar.classList.add('active');
        });

        if (closeSidebar) {
            closeSidebar.addEventListener('click', () => {
                sidebar.classList.remove('active');
            });
        }

        document.addEventListener('click', (e) => {
            if (sidebar.classList.contains('active') && 
                !sidebar.contains(e.target) && 
                !menuToggle.contains(e.target)) {
                sidebar.classList.remove('active');
            }
        });
    }

    // ২. হেডার প্রোফাইল ছবি লোড করার কল
    loadHeaderAvatar();
});

// ৩. ছবি লোড করার ফাংশন (উন্নত ডিবাগিং সহ)
async function loadHeaderAvatar() {
    const avatarImg = document.getElementById('headerAvatar');
    
    // ডিফল্ট ছবি যদি লোড না হয়, তবে একটি আইকন বা সলিড কালার দেখানোর জন্য
    if(avatarImg) {
        avatarImg.onerror = function() {
            this.src = 'https://cdn-icons-png.flaticon.com/512/149/149071.png'; // একটি নির্ভরযোগ্য ডিফল্ট আইকন
        };
    }

    if (!avatarImg || typeof window.db === 'undefined') {
        console.warn("⚠️ loadHeaderAvatar: Image tag missing or DB not connected.");
        return;
    }

    try {
        console.log("🔹 1. Checking Auth User...");
        const { data: { user } } = await window.db.auth.getUser();
        
        if (!user) {
            console.log("❌ No user logged in.");
            return;
        }
        console.log("✅ User found:", user.id);

        console.log("🔹 2. Fetching Profile Data...");
        const { data, error } = await window.db
            .from('profiles')
            .select('avatar_url')
            .eq('id', user.id)
            .single();

        if (error) {
            console.error("❌ Profile Fetch Error:", error.message);
            return;
        }

        console.log("✅ Profile Data:", data);

        if (data && data.avatar_url) {
            let finalUrl = "";

            // চেক করা হচ্ছে এটা কি পূর্ণ লিংক নাকি শুধু পাথ
            if (data.avatar_url.startsWith('http')) {
                finalUrl = data.avatar_url;
                console.log("🔹 Direct Link Found");
            } else {
                // স্টোরেজ থেকে পাবলিক লিংক তৈরি
                const { data: publicData } = window.db
                    .storage
                    .from('avatars') // আপনার বাকেটের নাম
                    .getPublicUrl(data.avatar_url);
                
                finalUrl = publicData.publicUrl;
                console.log("🔹 Generated Public URL:", finalUrl);
            }

            // সোর্স সেট করা
            avatarImg.src = finalUrl + '?t=' + new Date().getTime(); // ক্যাশ এড়াতে
            console.log("✅ Image Source Updated!");
        } else {
            console.warn("⚠️ No avatar_url found in database for this user.");
        }

    } catch (err) {
        console.error("❌ Unexpected Error in loadHeaderAvatar:", err);
    }
}
document.addEventListener('DOMContentLoaded', function() {
    
    // ১. সাইডবার টগল লজিক
    const sidebar = document.getElementById('sidebar');
    const menuToggle = document.getElementById('menuToggle');
    const closeSidebar = document.getElementById('closeSidebar');

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
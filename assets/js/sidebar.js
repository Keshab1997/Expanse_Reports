document.addEventListener('DOMContentLoaded', function() {
    
    // --- ১. সাইডবার টগল লজিক (আপনার আগের কোড) ---
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

    // --- ২. হেডার প্রোফাইল ছবি লোড করার কল ---
    loadHeaderAvatar();
});

// --- ৩. ছবি লোড করার মেইন ফাংশন ---
async function loadHeaderAvatar() {
    const avatarImg = document.getElementById('headerAvatar');
    
    // যদি পেজে এই আইডি না থাকে, তাহলে থামিয়ে দাও
    if (!avatarImg) return;

    try {
        // ১. বর্তমান ইউজারকে চেক করা
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
            // ২. 'profiles' টেবিল থেকে ছবির পাথ (path) আনা
            const { data, error } = await supabase
                .from('profiles')
                .select('avatar_url')
                .eq('id', user.id)
                .single();

            // ৩. যদি ডাটাবেসে path পাওয়া যায়
            if (data && data.avatar_url) {
                
                // ৪. 'avatars' বাকেট থেকে পাবলিক লিংক তৈরি করা
                const { data: publicData } = supabase
                    .storage
                    .from('avatars') // আপনার বাকেটের নাম
                    .getPublicUrl(data.avatar_url);

                // ৫. ইমেজ ট্যাগে লিংক বসিয়ে দেওয়া
                if (publicData.publicUrl) {
                    avatarImg.src = publicData.publicUrl;
                }
            }
        }
    } catch (err) {
        console.error("Header Avatar Error:", err);
    }
}
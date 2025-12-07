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

// ৩. ছবি লোড করার ফাংশন (window.db ব্যবহার করে)
async function loadHeaderAvatar() {
    const avatarImg = document.getElementById('headerAvatar');
    
    // চেক করা হচ্ছে db লোড হয়েছে কিনা এবং ইমেজ ট্যাগ আছে কিনা
    if (!avatarImg || typeof window.db === 'undefined') {
        // যদি db না পায়, কনসোলে ওয়ার্নিং দেখাবে (ডিবাগিংয়ের জন্য)
        if(typeof window.db === 'undefined') console.warn("window.db not found via sidebar.js");
        return;
    }

    try {
        // ১. বর্তমান ইউজার চেক করা (window.db ব্যবহার করে)
        const { data: { user } } = await window.db.auth.getUser();
        
        if (user) {
            // ২. 'profiles' টেবিল থেকে ছবির নাম (path) আনা
            const { data, error } = await window.db
                .from('profiles')
                .select('avatar_url')
                .eq('id', user.id)
                .single();

            if (data && data.avatar_url) {
                
                // ৩. স্টোরেজ থেকে পাবলিক লিংক তৈরি করা
                const { data: publicData } = window.db
                    .storage
                    .from('avatars') // আপনার বাকেটের নাম
                    .getPublicUrl(data.avatar_url);

                // ৪. ইমেজ সোর্স সেট করা
                if (publicData.publicUrl) {
                    // ক্যাশ এড়ানোর জন্য টাইমস্ট্যাম্প যোগ করা হলো
                    avatarImg.src = publicData.publicUrl + '?t=' + new Date().getTime();
                }
            }
        }
    } catch (err) {
        console.error("Header Avatar Error:", err);
    }
}
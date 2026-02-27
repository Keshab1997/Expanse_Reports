document.addEventListener('DOMContentLoaded', function() {
    
    setTimeout(() => {
        const loader = document.getElementById('globalLoader');
        if (loader && loader.style.display !== 'none') {
            loader.style.display = 'none';
        }
    }, 2000);
    
    const sidebar = document.getElementById('sidebar');
    const menuToggle = document.getElementById('menuToggle');
    const closeSidebar = document.getElementById('closeSidebar');
    const globalLoader = document.getElementById('globalLoader');

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

    loadHeaderAvatar();

    window.onbeforeunload = function() {
        if (globalLoader) {
            globalLoader.style.display = 'flex';
        }
    };
});

async function loadHeaderAvatar() {
    const avatarImg = document.getElementById('headerAvatar');
    
    if (!avatarImg || typeof window.db === 'undefined') return;

    try {
        const { data: { user } } = await window.db.auth.getUser();
        if (!user) return;

        const cachedUrl = localStorage.getItem(`avatar_${user.id}`);
        if (cachedUrl) {
            avatarImg.src = cachedUrl;
            avatarImg.loading = 'lazy';
            return;
        }

        const { data } = await window.db.from('profiles').select('avatar_url').eq('id', user.id).single();
        if (data && data.avatar_url) {
            let finalUrl = data.avatar_url;
            if (!finalUrl.startsWith('http')) {
                const { data: publicData } = window.db.storage.from('avatars').getPublicUrl(finalUrl);
                finalUrl = publicData.publicUrl;
            }
            
            const optimizedUrl = finalUrl + '?width=80&quality=80';
            avatarImg.src = optimizedUrl;
            avatarImg.loading = 'lazy';
            localStorage.setItem(`avatar_${user.id}`, optimizedUrl);
        }
    } catch (err) {
        // Silent fail
    }
}

window.logout = async function() {
    const globalLoader = document.getElementById('globalLoader');
    if(globalLoader) globalLoader.style.display = 'flex';
    
    try {
        await window.db.auth.signOut();
    } catch (error) {
        // Silent fail
    } finally {
        window.location.href = 'login.html';
    }
}

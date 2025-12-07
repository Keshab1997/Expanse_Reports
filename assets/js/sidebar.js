document.addEventListener('DOMContentLoaded', function() {
    
    const sidebar = document.getElementById('sidebar');
    const menuToggle = document.getElementById('menuToggle');
    const closeSidebar = document.getElementById('closeSidebar');

    if (sidebar && menuToggle) {

        // ১. মেনু খোলা (Toggle)
        menuToggle.addEventListener('click', (e) => {
            e.stopPropagation(); // ইভেন্ট বাবলিং বন্ধ
            sidebar.classList.add('active');
        });

        // ২. মেনু বন্ধ করা (X বাটন)
        if (closeSidebar) {
            closeSidebar.addEventListener('click', () => {
                sidebar.classList.remove('active');
            });
        }

        // ৩. বাইরে ক্লিক করলে মেনু বন্ধ হবে (ডেস্কটপ + মোবাইল উভয়েই)
        document.addEventListener('click', (e) => {
            if (sidebar.classList.contains('active') && 
                !sidebar.contains(e.target) && 
                !menuToggle.contains(e.target)) {
                
                sidebar.classList.remove('active');
            }
        });
    }
});
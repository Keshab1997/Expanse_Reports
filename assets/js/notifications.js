// Notification Manager
class NotificationManager {
    constructor() {
        this.permission = 'default';
        this.init();
    }

    async init() {
        if ('Notification' in window) {
            this.permission = await Notification.requestPermission();
        }
    }

    // Show browser notification
    show(title, options = {}) {
        if (this.permission === 'granted') {
            const notification = new Notification(title, {
                icon: 'https://cdn-icons-png.flaticon.com/512/2344/2344132.png',
                badge: 'https://cdn-icons-png.flaticon.com/512/2344/2344132.png',
                ...options
            });

            notification.onclick = () => {
                window.focus();
                notification.close();
            };
        }
    }

    // Show in-app notification banner
    showBanner(message, type = 'info', duration = 5000) {
        const banner = document.createElement('div');
        banner.className = `notification-banner ${type}`;
        
        const icons = {
            info: 'fa-circle-info',
            success: 'fa-circle-check',
            warning: 'fa-triangle-exclamation',
            error: 'fa-circle-xmark'
        };

        banner.innerHTML = `
            <i class="fa-solid ${icons[type]}"></i>
            <span>${message}</span>
            <button onclick="this.parentElement.remove()">
                <i class="fa-solid fa-xmark"></i>
            </button>
        `;

        document.body.appendChild(banner);

        setTimeout(() => {
            banner.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => banner.remove(), 300);
        }, duration);
    }
}

// App Update Manager
class AppUpdateManager {
    constructor() {
        this.registration = null;
        this.init();
    }

    async init() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                window.notificationManager.showBanner(
                    'App updated! Refresh to see new features.',
                    'success'
                );
            });

            // Check for updates every 30 minutes
            setInterval(() => this.checkForUpdates(), 30 * 60 * 1000);
        }
    }

    async checkForUpdates() {
        if (!this.registration) {
            this.registration = await navigator.serviceWorker.getRegistration();
        }

        if (this.registration) {
            await this.registration.update();
        }
    }

    showUpdatePrompt() {
        const banner = document.createElement('div');
        banner.className = 'update-banner';
        banner.innerHTML = `
            <div class="update-content">
                <i class="fa-solid fa-download"></i>
                <div>
                    <strong>New Update Available!</strong>
                    <p>Click to update and get the latest features</p>
                </div>
            </div>
            <button onclick="location.reload()" class="update-btn">
                Update Now
            </button>
        `;
        document.body.appendChild(banner);
    }
}

// Initialize
window.notificationManager = new NotificationManager();
window.appUpdateManager = new AppUpdateManager();

// Service Worker Update Detection
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then(reg => {
        reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            
            newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    window.appUpdateManager.showUpdatePrompt();
                }
            });
        });
    });
}

// Add CSS for notifications
const style = document.createElement('style');
style.textContent = `
    .notification-banner {
        position: fixed;
        top: 20px;
        right: 20px;
        background: white;
        padding: 15px 20px;
        border-radius: 10px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        display: flex;
        align-items: center;
        gap: 12px;
        z-index: 10001;
        min-width: 300px;
        animation: slideIn 0.3s ease-out;
    }

    .notification-banner.info { border-left: 4px solid #3b82f6; }
    .notification-banner.success { border-left: 4px solid #10b981; }
    .notification-banner.warning { border-left: 4px solid #f59e0b; }
    .notification-banner.error { border-left: 4px solid #ef4444; }

    .notification-banner i:first-child {
        font-size: 1.3rem;
    }

    .notification-banner.info i:first-child { color: #3b82f6; }
    .notification-banner.success i:first-child { color: #10b981; }
    .notification-banner.warning i:first-child { color: #f59e0b; }
    .notification-banner.error i:first-child { color: #ef4444; }

    .notification-banner span {
        flex: 1;
        font-size: 0.9rem;
        color: #1f2937;
    }

    .notification-banner button {
        background: none;
        border: none;
        cursor: pointer;
        color: #6b7280;
        font-size: 1.1rem;
        padding: 5px;
    }

    .update-banner {
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(135deg, #4f46e5, #7c3aed);
        color: white;
        padding: 20px 25px;
        border-radius: 12px;
        box-shadow: 0 8px 20px rgba(79, 70, 229, 0.3);
        display: flex;
        align-items: center;
        gap: 20px;
        z-index: 10001;
        animation: slideUp 0.4s ease-out;
    }

    .update-content {
        display: flex;
        align-items: center;
        gap: 15px;
    }

    .update-content i {
        font-size: 2rem;
    }

    .update-content strong {
        display: block;
        font-size: 1rem;
        margin-bottom: 3px;
    }

    .update-content p {
        font-size: 0.85rem;
        opacity: 0.9;
        margin: 0;
    }

    .update-btn {
        background: white;
        color: #4f46e5;
        border: none;
        padding: 10px 20px;
        border-radius: 8px;
        font-weight: 700;
        cursor: pointer;
        transition: transform 0.2s;
    }

    .update-btn:hover {
        transform: scale(1.05);
    }

    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }

    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }

    @keyframes slideUp {
        from {
            transform: translateX(-50%) translateY(100px);
            opacity: 0;
        }
        to {
            transform: translateX(-50%) translateY(0);
            opacity: 1;
        }
    }

    @media (max-width: 768px) {
        .notification-banner {
            right: 10px;
            left: 10px;
            min-width: auto;
        }

        .update-banner {
            left: 10px;
            right: 10px;
            transform: none;
            flex-direction: column;
            text-align: center;
        }

        .update-btn {
            width: 100%;
        }
    }
`;
document.head.appendChild(style);

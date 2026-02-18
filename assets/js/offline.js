// Offline Data Manager
const OFFLINE_QUEUE_KEY = 'expensepro_offline_queue';

// Check if online
function isOnline() {
    return navigator.onLine;
}

// Save data to offline queue
function saveToOfflineQueue(data) {
    const queue = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
    queue.push({
        ...data,
        timestamp: Date.now(),
        synced: false
    });
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    updateOfflineIndicator();
}

// Get offline queue
function getOfflineQueue() {
    return JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
}

// Sync offline data when online
async function syncOfflineData() {
    if (!isOnline()) return;
    
    const queue = getOfflineQueue();
    const unsynced = queue.filter(item => !item.synced);
    
    if (unsynced.length === 0) return;
    
    console.log(`Syncing ${unsynced.length} offline entries...`);
    
    for (const item of unsynced) {
        try {
            const { data: { user } } = await window.db.auth.getUser();
            
            const { error } = await window.db
                .from('expenses')
                .insert([{
                    user_id: user.id,
                    date: item.date,
                    category: item.category,
                    paid_by: item.paid_by,
                    payee: item.payee,
                    purpose: item.purpose,
                    amount: item.amount,
                    status: item.status
                }]);
            
            if (!error) {
                item.synced = true;
            }
        } catch (err) {
            console.error('Sync error:', err);
        }
    }
    
    // Update queue
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    
    // Remove synced items
    const remaining = queue.filter(item => !item.synced);
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
    
    updateOfflineIndicator();
    
    if (remaining.length === 0) {
        showToast('All offline data synced!');
    }
}

// Update offline indicator
function updateOfflineIndicator() {
    const queue = getOfflineQueue();
    const unsynced = queue.filter(item => !item.synced).length;
    
    let indicator = document.getElementById('offlineIndicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'offlineIndicator';
        indicator.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            background: #f59e0b;
            color: white;
            padding: 10px 15px;
            border-radius: 8px;
            font-size: 0.85rem;
            font-weight: 600;
            z-index: 9999;
            display: none;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        `;
        document.body.appendChild(indicator);
    }
    
    if (unsynced > 0) {
        indicator.textContent = `📴 ${unsynced} offline entry(s)`;
        indicator.style.display = 'block';
    } else {
        indicator.style.display = 'none';
    }
}

// Show toast notification
function showToast(message) {
    const toast = document.getElementById('toast');
    if (toast) {
        toast.textContent = message;
        toast.style.display = 'block';
        setTimeout(() => toast.style.display = 'none', 3000);
    }
}

// Listen for online/offline events
window.addEventListener('online', () => {
    console.log('Back online! Syncing data...');
    syncOfflineData();
});

window.addEventListener('offline', () => {
    console.log('Gone offline. Data will be saved locally.');
    updateOfflineIndicator();
});

// Auto-sync on page load
window.addEventListener('load', () => {
    updateOfflineIndicator();
    if (isOnline()) {
        syncOfflineData();
    }
});

// Export functions
window.offlineManager = {
    isOnline,
    saveToOfflineQueue,
    getOfflineQueue,
    syncOfflineData,
    updateOfflineIndicator
};

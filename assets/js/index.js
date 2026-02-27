document.addEventListener('DOMContentLoaded', async () => {
    
    if (typeof window.db === 'undefined') {
        return;
    }

    try {
        const { data: { user } } = await window.db.auth.getUser();
        if (!user) return window.location.href = 'login.html';

        loadUserName(user.id);
        await loadDashboardStats(user.id);
    } catch (error) {
        // Silent fail
    }
});

async function loadUserName(userId) {
    try {
        const { data: profile } = await window.db
            .from('profiles')
            .select('full_name')
            .eq('id', userId)
            .single();

        const nameEl = document.getElementById('userName');
        if (nameEl) {
            if (profile && profile.full_name) {
                nameEl.innerText = profile.full_name;
            } else {
                const { data: { user } } = await window.db.auth.getUser();
                if(user) nameEl.innerText = user.email.split('@')[0];
            }
        }
    } catch (error) {
        // Silent fail
    }
}

// স্ট্যাটাস এবং চার্ট লোড ফাংশন (Local Storage Caching)
async function loadDashboardStats(userId) {
    const cacheKey = `dashboard_data_${userId}`;
    
    // ১. ক্যাশ থেকে ডাটা চেক করা (Instant Load)
    const cachedData = localStorage.getItem(cacheKey);
    if (cachedData) {
        const expenses = JSON.parse(cachedData);
        processAndRender(expenses); // ক্যাশ ডাটা দিয়ে সাথে সাথে রেন্ডার
        // console.log("⚡ Dashboard loaded instantly from Cache");
    }

    // ২. ব্যাকগ্রাউন্ডে সুপাবেস থেকে লেটেস্ট ডাটা আনা
    try {
        const { data: expenses, error } = await window.db
            .from('expenses')
            .select('*')
            .eq('user_id', userId)
            .order('date', { ascending: false });

        if (error) throw error;

        if (expenses) {
            // ৩. নতুন ডাটা ক্যাশে সেভ করা
            localStorage.setItem(cacheKey, JSON.stringify(expenses));
            
            // ৪. যদি ক্যাশ ডাটা আর নতুন ডাটা আলাদা হয়, তবে UI আপডেট করা
            processAndRender(expenses);
            // console.log("🔄 Dashboard updated from Server in background");
        }
    } catch (err) {
        // Silent fail
    } finally {
        // লোডার বন্ধ করা
        const loader = document.getElementById('globalLoader');
        if (loader) loader.style.display = 'none';
    }
}

// ৫. ডাটা প্রসেস এবং রেন্ডার করার জন্য আলাদা ফাংশন (যাতে দুইবার কল করা যায়)
function processAndRender(expenses) {
    let totalAmount = 0;
    let totalToday = 0;
    let categoryMap = {};
    let dailyMap = {};
    const todayStr = new Date().toISOString().split('T')[0];

    expenses.forEach(item => {
        const amt = Number(item.amount) || 0;
        totalAmount += amt;
        if (item.date === todayStr) totalToday += amt;

        const cat = item.category || 'General';
        categoryMap[cat] = (categoryMap[cat] || 0) + amt;

        const dayKey = item.date;
        dailyMap[dayKey] = (dailyMap[dayKey] || 0) + amt;
    });

    // UI আপডেট (Stats)
    document.getElementById('totalMonth').innerText = totalAmount.toLocaleString('en-IN');
    document.getElementById('totalToday').innerText = totalToday.toLocaleString('en-IN');
    document.getElementById('txCount').innerText = expenses.length;

    // রিসেন্ট টেবিল আপডেট
    renderRecentTable(expenses.slice(0, 5));

    // চার্ট রেন্ডার
    renderCharts(categoryMap, dailyMap);
}

function renderRecentTable(data) {
    const recentTable = document.getElementById('recentTableBody');
    if (!recentTable) return;
    
    let html = data.map(item => `
        <tr>
            <td>${item.date}</td>
            <td>${item.payee}</td>
            <td class="text-right">₹${Number(item.amount).toLocaleString('en-IN')}</td>
        </tr>`).join('');
    
    recentTable.innerHTML = html || `<tr><td colspan="3" style="text-align:center;">No data</td></tr>`;
}

function renderCharts(categoryData, dailyData) {
    // আগের চার্ট থাকলে ডিলেট করা
    const pieCanvas = document.getElementById('pieChart');
    const barCanvas = document.getElementById('barChart');

    if (window.myPieChart) window.myPieChart.destroy();
    if (window.myBarChart) window.myBarChart.destroy();

    // Pie Chart
    if (pieCanvas) {
        window.myPieChart = new Chart(pieCanvas, {
            type: 'doughnut',
            data: {
                labels: Object.keys(categoryData),
                datasets: [{
                    data: Object.values(categoryData),
                    backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#6366f1'],
                    borderWidth: 0
                }]
            },
            options: { 
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'right', labels: { boxWidth: 10 } } } 
            }
        });
    }

    // Bar Chart
    if (barCanvas) {
        // তারিখ অনুযায়ী সর্ট করা
        const sortedDates = Object.keys(dailyData).sort();
        // লেবেলের জন্য শুধু দিন/মাস দেখানো (UX এর জন্য)
        const displayLabels = sortedDates.map(d => {
            const parts = d.split('-');
            return `${parts[2]}/${parts[1]}`; // DD/MM format
        });

        window.myBarChart = new Chart(barCanvas, {
            type: 'bar',
            data: {
                labels: displayLabels,
                datasets: [{
                    label: 'Daily Expense',
                    data: sortedDates.map(d => dailyData[d]),
                    backgroundColor: '#3b82f6',
                    borderRadius: 4
                }]
            },
            options: { 
                responsive: true,
                maintainAspectRatio: false,
                scales: { 
                    y: { beginAtZero: true, grid: { display: false } }, 
                    x: { grid: { display: false }, ticks: { maxTicksLimit: 10 } } // বেশি ডাটা হলে লেবেল কমাবে
                } 
            }
        });
    }
}
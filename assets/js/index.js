document.addEventListener('DOMContentLoaded', async () => {
    
    // ১. ডাটাবেস কানেকশন চেক (সতর্কতা)
    if (typeof window.db === 'undefined') {
        console.error("Database connection not found. Check config.js");
        return;
    }

    // ২. ইউজার লগইন চেক
    const { data: { user } } = await window.db.auth.getUser();
    if (!user) return window.location.href = 'login.html';

    // ৩. ইউজারের নাম লোড করা (ছবি sidebar.js লোড করবে)
    loadUserName(user.id);

    // ৪. ড্যাশবোর্ড ডাটা লোড
    const date = new Date();
    const monthName = date.toLocaleString('default', { month: 'long', year: 'numeric' });
    const monthEl = document.getElementById('currentMonthName');
    if(monthEl) monthEl.innerText = monthName;
    
    await loadDashboardStats(user.id);
});

// শুধু নাম লোড করার ফাংশন
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
                // প্রোফাইল না থাকলে ইমেইল থেকে নাম দেখানো
                const { data: { user } } = await window.db.auth.getUser();
                if(user) nameEl.innerText = user.email.split('@')[0];
            }
        }
    } catch (error) {
        console.error("Name load error:", error);
    }
}

// স্ট্যাটাস এবং চার্ট লোড ফাংশন (অপটিমাইজড)
async function loadDashboardStats(userId) {
    const date = new Date();
    // মাসের প্রথম দিন
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).toISOString();
    // মাসের শেষ দিন
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString();
    
    const todayStr = new Date().toISOString().split('T')[0];

    // ডাটা আনা (চলতি মাসের)
    const { data: expenses, error } = await window.db
        .from('expenses')
        .select('*')
        .gte('date', firstDay)
        .lte('date', lastDay)
        .eq('user_id', userId)
        .order('date', { ascending: false });

    if (error || !expenses) {
        console.error("Error loading expenses:", error);
        return;
    }

    // ক্যালকুলেশন
    let totalMonth = 0;
    let totalToday = 0;
    let categoryMap = {};
    let dailyMap = {};

    expenses.forEach(item => {
        totalMonth += item.amount;
        if (item.date === todayStr) totalToday += item.amount;

        const cat = item.category || 'General';
        categoryMap[cat] = (categoryMap[cat] || 0) + item.amount;

        const day = item.date.split('-')[2]; // শুধু তারিখ (DD)
        dailyMap[day] = (dailyMap[day] || 0) + item.amount;
    });

    // UI আপডেট
    const totalMonthEl = document.getElementById('totalMonth');
    const totalTodayEl = document.getElementById('totalToday');
    const txCountEl = document.getElementById('txCount');

    if(totalMonthEl) totalMonthEl.innerText = totalMonth.toLocaleString('en-IN');
    if(totalTodayEl) totalTodayEl.innerText = totalToday.toLocaleString('en-IN');
    if(txCountEl) txCountEl.innerText = expenses.length;

    // রিসেন্ট টেবিল (DOM Performance Optimized)
    const recentTable = document.getElementById('recentTableBody');
    if (recentTable) {
        if (expenses.length === 0) {
            recentTable.innerHTML = `<tr><td colspan="3" style="text-align:center; padding:15px;">No transactions this month</td></tr>`;
        } else {
            // লুপের বাইরে HTML তৈরি করা হচ্ছে (ফাস্ট লোডিংয়ের জন্য)
            let html = "";
            expenses.slice(0, 5).forEach(item => {
                html += `
                    <tr>
                        <td>${item.date}</td>
                        <td>${item.payee}</td>
                        <td class="text-right">₹${item.amount.toLocaleString('en-IN')}</td>
                    </tr>`;
            });
            recentTable.innerHTML = html;
        }
    }

    // চার্ট রেন্ডার
    renderCharts(categoryMap, dailyMap);
}

function renderCharts(categoryData, dailyData) {
    // আগের চার্ট থাকলে ডিলেট করা (Chart.js এর বাগ এড়াতে)
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
        const sortedDays = Object.keys(dailyData).sort();
        window.myBarChart = new Chart(barCanvas, {
            type: 'bar',
            data: {
                labels: sortedDays,
                datasets: [{
                    label: 'Daily Expense',
                    data: sortedDays.map(d => dailyData[d]),
                    backgroundColor: '#3b82f6',
                    borderRadius: 4
                }]
            },
            options: { 
                responsive: true,
                maintainAspectRatio: false,
                scales: { 
                    y: { beginAtZero: true, grid: { display: false } }, 
                    x: { grid: { display: false } } 
                } 
            }
        });
    }
}
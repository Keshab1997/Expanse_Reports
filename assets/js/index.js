document.addEventListener('DOMContentLoaded', async () => {
    // ১. ইউজার চেক
    const { data: { user } } = await window.db.auth.getUser();
    if (!user) return window.location.href = 'login.html';

    // ২. প্রোফাইল ডাটা লোড (নাম এবং ছবি)
    loadUserProfile(user.id);

    // ৩. ড্যাশবোর্ড ডাটা লোড
    const date = new Date();
    const monthName = date.toLocaleString('default', { month: 'long', year: 'numeric' });
    document.getElementById('currentMonthName').innerText = monthName;
    
    await loadDashboardStats(user.id);
});

// প্রোফাইল লোড ফাংশন
async function loadUserProfile(userId) {
    const { data: profile } = await window.db
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('id', userId)
        .single();

    if (profile) {
        if(profile.full_name) document.getElementById('userName').innerText = profile.full_name;
        if(profile.avatar_url) document.getElementById('dashAvatar').src = profile.avatar_url;
    } else {
        // ডিফল্ট নাম ইমেইল থেকে
        const { data: { user } } = await window.db.auth.getUser();
        const emailName = user.email.split('@')[0];
        document.getElementById('userName').innerText = emailName;
    }
}

// স্ট্যাটাস এবং চার্ট লোড ফাংশন
async function loadDashboardStats(userId) {
    const date = new Date();
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];
    const todayStr = new Date().toISOString().split('T')[0];

    // ডাটা আনা
    const { data: expenses } = await window.db
        .from('expenses')
        .select('*')
        .gte('date', firstDay)
        .lte('date', lastDay)
        .eq('user_id', userId)
        .order('date', { ascending: false });

    if (!expenses) return;

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

        const day = item.date.split('-')[2];
        dailyMap[day] = (dailyMap[day] || 0) + item.amount;
    });

    // UI আপডেট
    document.getElementById('totalMonth').innerText = totalMonth.toLocaleString('en-IN');
    document.getElementById('totalToday').innerText = totalToday.toLocaleString('en-IN');
    document.getElementById('txCount').innerText = expenses.length;

    // রিসেন্ট টেবিল
    const recentTable = document.getElementById('recentTableBody');
    recentTable.innerHTML = "";
    expenses.slice(0, 5).forEach(item => {
        recentTable.innerHTML += `
            <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 10px; font-size:0.9rem;">${item.date}</td>
                <td style="padding: 10px;">${item.payee}</td>
                <td style="padding: 10px; text-align: right; font-weight:600;">₹${item.amount.toLocaleString('en-IN')}</td>
            </tr>`;
    });

    // চার্ট রেন্ডার
    renderCharts(categoryMap, dailyMap);
}

function renderCharts(categoryData, dailyData) {
    // Pie Chart
    new Chart(document.getElementById('pieChart'), {
        type: 'doughnut',
        data: {
            labels: Object.keys(categoryData),
            datasets: [{
                data: Object.values(categoryData),
                backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'],
                borderWidth: 0
            }]
        },
        options: { plugins: { legend: { position: 'right', labels: { boxWidth: 10 } } } }
    });

    // Bar Chart
    const sortedDays = Object.keys(dailyData).sort();
    new Chart(document.getElementById('barChart'), {
        type: 'bar',
        data: {
            labels: sortedDays,
            datasets: [{
                label: 'Expense',
                data: sortedDays.map(d => dailyData[d]),
                backgroundColor: '#3b82f6',
                borderRadius: 4
            }]
        },
        options: { scales: { y: { beginAtZero: true, grid: { display: false } }, x: { grid: { display: false } } } }
    });
}
document.addEventListener('DOMContentLoaded', async () => {
    
    // ১. ডাটাবেস কানেকশন চেক
    if (typeof window.db === 'undefined') {
        console.error("Database connection not found. Check config.js");
        return;
    }

    // ২. ইউজার লগইন চেক
    const { data: { user } } = await window.db.auth.getUser();
    if (!user) return window.location.href = 'login.html';

    // ৩. ইউজারের নাম লোড করা
    loadUserName(user.id);

    // ৪. ড্যাশবোর্ড ডাটা লোড (আপডেটেড লজিক সহ)
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
                const { data: { user } } = await window.db.auth.getUser();
                if(user) nameEl.innerText = user.email.split('@')[0];
            }
        }
    } catch (error) {
        console.error("Name load error:", error);
    }
}

// স্ট্যাটাস এবং চার্ট লোড ফাংশন (UPDATED LOGIC: Lifetime Range)
async function loadDashboardStats(userId) {
    try {
        const today = new Date();
        const formatDate = (d) => d.toISOString().split('T')[0];

        // ১. শেষের তারিখ: বর্তমান মাসের শেষ দিন (Last Day of Current Month)
        const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        const endDate = formatDate(lastDayOfMonth);

        // ২. শুরুর তারিখ: ডাটাবেস থেকে সবচেয়ে পুরনো খরচের তারিখ বের করা
        let startDate;
        
        const { data: oldestExpense, error: dateError } = await window.db
            .from('expenses')
            .select('date')
            .order('date', { ascending: true }) // সবচেয়ে পুরনো তারিখ
            .limit(1)
            .maybeSingle();

        if (oldestExpense && oldestExpense.date) {
            startDate = oldestExpense.date;
        } else {
            // ডাটা না থাকলে বর্তমান মাসের ১ তারিখ
            const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            startDate = formatDate(firstDayOfMonth);
        }

        // ৩. তারিখের রেঞ্জ UI তে দেখানো (অপশনাল, যাতে বোঝা যায় কোন সময়ের হিসাব)
        const monthEl = document.getElementById('currentMonthName');
        if(monthEl) {
            // তারিখ সুন্দরভাবে ফরম্যাট করা (e.g. 01 Jan 2023 - 31 Oct 2023)
            const formatUI = (d) => {
                const dt = new Date(d);
                return dt.toLocaleDateString('default', { day: '2-digit', month: 'short', year: 'numeric' });
            };
            monthEl.innerText = `${formatUI(startDate)} - ${formatUI(endDate)}`;
        }

        // ৪. মেইন ডাটা আনা (Start Date থেকে End Date পর্যন্ত)
        const { data: expenses, error } = await window.db
            .from('expenses')
            .select('*')
            .gte('date', startDate)
            .lte('date', endDate)
            .eq('user_id', userId)
            .order('date', { ascending: false });

        if (error || !expenses) {
            console.error("Error loading expenses:", error);
            return;
        }

        // ৫. ক্যালকুলেশন
        let totalAmount = 0; // টোটাল খরচ (Total Lifetime/Range)
        let totalToday = 0;
        let categoryMap = {};
        let dailyMap = {};
        const todayStr = formatDate(today);

        expenses.forEach(item => {
            totalAmount += item.amount;
            
            // আজকের খরচ
            if (item.date === todayStr) totalToday += item.amount;

            // ক্যাটাগরি চার্টের জন্য
            const cat = item.category || 'General';
            categoryMap[cat] = (categoryMap[cat] || 0) + item.amount;

            // বারের চার্টের জন্য (তারিখ অনুযায়ী)
            // নোট: ডাটা অনেক বেশি হলে বার চার্ট দেখতে হিজিবিজি হতে পারে
            const dayKey = item.date; // পুরো তারিখ নেওয়া হলো ইউনিক করার জন্য
            dailyMap[dayKey] = (dailyMap[dayKey] || 0) + item.amount;
        });

        // UI আপডেট
        const totalMonthEl = document.getElementById('totalMonth'); // এখানে এখন টোটাল রেঞ্জের খরচ দেখাবে
        const totalTodayEl = document.getElementById('totalToday');
        const txCountEl = document.getElementById('txCount');

        if(totalMonthEl) totalMonthEl.innerText = totalAmount.toLocaleString('en-IN');
        if(totalTodayEl) totalTodayEl.innerText = totalToday.toLocaleString('en-IN');
        if(txCountEl) txCountEl.innerText = expenses.length;

        // রিসেন্ট টেবিল (Top 5)
        const recentTable = document.getElementById('recentTableBody');
        if (recentTable) {
            if (expenses.length === 0) {
                recentTable.innerHTML = `<tr><td colspan="3" style="text-align:center; padding:15px;">No transactions found</td></tr>`;
            } else {
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

    } catch (err) {
        console.error("Dashboard Load Error:", err);
    }
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
        // তারিখ অনুযায়ী সর্ট করা
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
// assets/js/index.js

async function loadDashboard() {
    // window.db ব্যবহার করছি (config.js থেকে আসবে)
    let { data, error } = await window.db
        .from('expenses')
        .select('*');

    if (error) {
        console.error(error);
        document.getElementById('totalAmount').innerText = "Error";
        return;
    }

    let total = 0;
    let payeeMap = {};
    
    data.forEach(item => {
        total += item.amount;
        
        // Payee অনুযায়ী যোগ করা (Logic)
        if (payeeMap[item.payee]) {
            payeeMap[item.payee] += item.amount;
        } else {
            payeeMap[item.payee] = item.amount;
        }
    });

    document.getElementById('totalAmount').innerText = total.toLocaleString();

    // লাস্ট এন্ট্রি লজিক
    if (data.length > 0) {
        // ডাটাবেস থেকে আসা ডাটা সর্ট করা না থাকলে লাস্ট এন্ট্রি ভুল হতে পারে
        // তাই আমরা নিশ্চিত হই শেষেরটা নিচ্ছি (অথবা আপনি চাইলে date দিয়ে sort করতে পারেন)
        const last = data[data.length - 1];
        document.getElementById('lastEntry').innerText = `${last.payee} - ₹${last.amount}`;
    } else {
        document.getElementById('lastEntry').innerText = "No Data";
    }

    createChart(payeeMap);
}

function createChart(dataObj) {
    const ctx = document.getElementById('expenseChart');
    
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(dataObj),
            datasets: [{
                label: 'Amount Spent (₹)',
                data: Object.values(dataObj),
                backgroundColor: '#2563eb',
                borderRadius: 5
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}

// ফাংশন কল
loadDashboard();
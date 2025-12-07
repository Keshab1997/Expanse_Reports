let allExpenses = [];

// ১. ডাটা লোড (অটোমেটিক ইউজারের ডাটাই আসবে RLS এর কারণে)
async function loadInitialData() {
    // ক্যাটাগরি লোড
    const catSelect = document.getElementById('catFilter');
    let { data: categories } = await window.db.from('categories').select('*').order('name');
    if (categories) {
        categories.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat.name;
            opt.textContent = cat.name;
            catSelect.appendChild(opt);
        });
    }

    // এক্সপেন্স ডাটা লোড
    loadExpenses();
}

async function loadExpenses() {
    let { data, error } = await window.db
        .from('expenses')
        .select('*')
        .order('date', { ascending: false });

    if (error) {
        console.error(error);
    } else {
        allExpenses = data;
        populatePayee(data);
        renderTable(data);
    }
}

// ২. Payee ড্রপডাউন
function populatePayee(data) {
    const unique = [...new Set(data.map(i => i.payee))];
    const sel = document.getElementById('payeeFilter');
    sel.innerHTML = '<option value="">All Payees</option>'; // রিসেট
    unique.sort().forEach(p => {
        const opt = document.createElement('option');
        opt.value = p;
        opt.textContent = p;
        sel.appendChild(opt);
    });
}

// ৩. ফিল্টার লজিক
function applyFilters() {
    const from = document.getElementById('fromDate').value;
    const to = document.getElementById('toDate').value;
    const cat = document.getElementById('catFilter').value;
    const payee = document.getElementById('payeeFilter').value;

    const filtered = allExpenses.filter(item => {
        const matchFrom = from ? item.date >= from : true;
        const matchTo = to ? item.date <= to : true;
        const matchCat = cat ? item.category === cat : true;
        const matchPayee = payee ? item.payee === payee : true;
        
        return matchFrom && matchTo && matchCat && matchPayee;
    });

    renderTable(filtered);
}

['fromDate', 'toDate', 'catFilter', 'payeeFilter'].forEach(id => {
    document.getElementById(id).addEventListener('change', applyFilters);
});

// ৪. টেবিল রেন্ডার এবং ডিলিট বাটন যোগ
function renderTable(data) {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = "";
    let total = 0;

    if(data.length === 0) {
        tbody.innerHTML = "<tr><td colspan='6' style='text-align:center; padding:30px; color:#ef4444;'>No records found!</td></tr>";
        document.getElementById('totalAmount').innerText = "0";
        return;
    }

    data.forEach(item => {
        total += item.amount;
        const catDisplay = item.category ? item.category : "General";
        
        let row = `<tr>
            <td>${item.date}</td>
            <td><span class="cat-badge">${catDisplay}</span></td>
            <td>${item.payee}</td>
            <td>${item.purpose}</td>
            <td style="text-align: right; font-weight: 700;">₹${item.amount.toLocaleString()}</td>
            <td style="text-align: center;">
                <button onclick="deleteExpense(${item.id})" style="background:#fee2e2; border:none; color:#dc2626; cursor:pointer; padding:5px 10px; border-radius:4px; font-size:0.8rem;">🗑</button>
            </td>
        </tr>`;
        tbody.innerHTML += row;
    });

    document.getElementById('totalAmount').innerText = total.toLocaleString();
}

// ৫. ডিলিট ফাংশন
async function deleteExpense(id) {
    if(confirm("Are you sure you want to delete this expense?")) {
        const { error } = await window.db
            .from('expenses')
            .delete()
            .eq('id', id);

        if(error) {
            alert("Error deleting: " + error.message);
        } else {
            // লিস্ট রিফ্রেশ
            loadExpenses();
        }
    }
}

// ৬. রিসেট এবং পিডিএফ
function resetFilters() {
    document.getElementById('fromDate').value = "";
    document.getElementById('toDate').value = "";
    document.getElementById('catFilter').value = "";
    document.getElementById('payeeFilter').value = "";
    renderTable(allExpenses);
}

window.downloadPDF = function() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text("Expense Report", 14, 15);
    doc.autoTable({
        html: '#expenseTable',
        startY: 30,
        columns: [
            {header: 'Date', dataKey: 'date'},
            {header: 'Category', dataKey: 'category'},
            {header: 'Payee', dataKey: 'payee'},
            {header: 'Purpose', dataKey: 'purpose'},
            {header: 'Amount', dataKey: 'amount'}
        ]
        // Note: PDF এ ডিলিট বাটন কলাম হাইড করার জন্য html id থেকে ডিলিট কলাম বাদ দিতে হতে পারে অথবা ম্যানুয়াল কলাম সিলেক্ট করতে হবে।
    });
    doc.save('Expense_Report.pdf');
}

loadInitialData();
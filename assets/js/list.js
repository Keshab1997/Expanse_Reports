let allExpenses = [];
let currentFilteredData = []; // পিডিএফ এর জন্য বর্তমান ডাটা রাখার ভেরিয়েবল

// ১. ডাটা লোড
async function loadInitialData() {
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
        currentFilteredData = data; // প্রথমে সব ডাটাই সিলেক্টেড থাকবে
        populatePayee(data);
        renderTable(data);
    }
}

// ২. Payee ড্রপডাউন
function populatePayee(data) {
    const unique = [...new Set(data.map(i => i.payee))];
    const sel = document.getElementById('payeeFilter');
    sel.innerHTML = '<option value="">All Payees</option>';
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

    currentFilteredData = filtered; // ফিল্টার করা ডাটা গ্লোবাল ভেরিয়েবলে আপডেট করা হলো
    renderTable(filtered);
}

['fromDate', 'toDate', 'catFilter', 'payeeFilter'].forEach(id => {
    document.getElementById(id).addEventListener('change', applyFilters);
});

// ৪. টেবিল রেন্ডার
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
            loadExpenses();
        }
    }
}

// ৬. রিসেট
function resetFilters() {
    document.getElementById('fromDate').value = "";
    document.getElementById('toDate').value = "";
    document.getElementById('catFilter').value = "";
    document.getElementById('payeeFilter').value = "";
    currentFilteredData = allExpenses;
    renderTable(allExpenses);
}

// ==========================================
// ৭. আপডেটেড পিডিএফ ফাংশন (Professional Footer)
// ==========================================
window.downloadPDF = function() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // ১. কোম্পানি/টাইটেল সেকশন
    doc.setFontSize(22);
    doc.setTextColor(41, 128, 185); // নীল কালার
    doc.text("Expense Report", 14, 20);

    doc.setFontSize(10);
    doc.setTextColor(100);
    const dateStr = new Date().toLocaleDateString('en-IN');
    doc.text(`Generated on: ${dateStr}`, 14, 27);

    // ২. ডাটা প্রসেসিং
    const totalAmount = currentFilteredData.reduce((sum, item) => sum + item.amount, 0);

    const tableBody = currentFilteredData.map(item => [
        item.date,
        item.category || 'General',
        item.payee,
        item.purpose,
        `Rs. ${item.amount.toLocaleString('en-IN')}`
    ]);

    // ৩. টেবিল জেনারেশন
    doc.autoTable({
        startY: 35,
        head: [['Date', 'Category', 'Payee', 'Purpose', 'Amount']],
        body: tableBody,
        
        // --- এই অংশটি পরিবর্তন করা হয়েছে ---
        foot: [
            [
                { 
                    content: 'Total Amount:', 
                    colSpan: 4, // প্রথম ৪টি কলাম জোড়া লাগানো হলো
                    styles: { halign: 'right', fontStyle: 'bold', fontSize: 11 } 
                },
                { 
                    content: `Rs. ${totalAmount.toLocaleString('en-IN')}`, 
                    styles: { halign: 'right', fontStyle: 'bold', fontSize: 11 } 
                }
            ]
        ],
        // ---------------------------------

        // স্টাইলিং
        theme: 'striped', 
        headStyles: { 
            fillColor: [41, 128, 185],
            textColor: 255,
            halign: 'center',
            fontStyle: 'bold'
        },
        // ফুটার ডিজাইন (টোটাল এরিয়া)
        footStyles: {
            fillColor: [255, 255, 255], // সাদা ব্যাকগ্রাউন্ড
            textColor: [0, 0, 0],       // কালো লেখা
            lineColor: [41, 128, 185],  // উপরে নীল বর্ডার
            lineWidth: { top: 0.5 },    // শুধু উপরে চিকন লাইন
        },
        columnStyles: {
            0: { halign: 'center' }, // Date Center
            4: { halign: 'right' }   // Amount Right aligned
        },
        styles: {
            fontSize: 10,
            cellPadding: 4,
            valign: 'middle',
            lineColor: [200, 200, 200], // টেবিলের সাইড লাইন হালকা
            lineWidth: 0.1
        }
    });

    // পিডিএফ সেভ
    doc.save(`Expense_Report_${dateStr}.pdf`);
}

loadInitialData();
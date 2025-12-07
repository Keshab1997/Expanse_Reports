let currentData = [];
let payeeTomSelect = null;

// ১. পেজ লোড হলে ডিফল্ট ডেট সেট এবং অপশন লোড
async function loadInitialData() {
    // চলতি মাসের ১ তারিখ থেকে আজ পর্যন্ত ডেট সেট করা
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    
    const formatDate = (date) => date.toISOString().split('T')[0];

    document.getElementById('fromDate').value = formatDate(firstDay);
    document.getElementById('toDate').value = formatDate(today);

    // প্রথমে ফিল্টার অপশনগুলো পপুলেট করা
    await loadFilterOptions();

    // তারপর ডাটা লোড
    applyFilters(); 
}

// ২. ক্যাটাগরি এবং Payee লিস্ট লোড (অপ্টিমাইজড)
async function loadFilterOptions() {
    // ইউজার চেক
    const { data: { user } } = await window.db.auth.getUser();
    if(!user) return window.location.href = 'login.html';

    // --- ক্যাটাগরি লোড ---
    const catSelect = document.getElementById('catFilter');
    const { data: cats } = await window.db
        .from('categories')
        .select('name')
        .order('name');
    
    catSelect.innerHTML = '<option value="">All Categories</option>';
    if(cats) {
        cats.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.name;
            opt.textContent = c.name;
            catSelect.appendChild(opt);
        });
    }

    // --- Payee লোড (Tom Select) ---
    // আমরা expenses টেবিল থেকে ইউনিক payee আনব
    const { data: payees } = await window.db
        .from('expenses')
        .select('payee')
        .not('payee', 'is', null); // নাল ভ্যালু বাদ

    // ইউনিক নাম বের করা
    const uniquePayees = [...new Set(payees.map(p => p.payee))].sort();
    
    const payeeSelect = document.getElementById('payeeFilter');
    
    // আগের Tom Select থাকলে ডিলিট করা (রিলোড এর সময়)
    if (payeeTomSelect) {
        payeeTomSelect.destroy();
        payeeSelect.innerHTML = '<option value="">Select Payees...</option>';
    }

    // অপশন যোগ করা
    uniquePayees.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p;
        opt.textContent = p;
        payeeSelect.appendChild(opt);
    });

    // Tom Select ইনিশিয়ালাইজ করা
    payeeTomSelect = new TomSelect("#payeeFilter", {
        plugins: ['remove_button'],
        create: false,
        placeholder: "Search & Select Payees...",
        maxItems: null,
        onItemAdd: function() { applyFilters(); },
        onItemRemove: function() { applyFilters(); }
    });
}

// ৩. মেইন ফিল্টার ফাংশন (Server-side Filtering for Speed)
async function applyFilters() {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = "<tr><td colspan='6' style='text-align:center; padding:20px; color:#64748b;'>⏳ Loading data...</td></tr>";

    const from = document.getElementById('fromDate').value;
    const to = document.getElementById('toDate').value;
    const cat = document.getElementById('catFilter').value;
    const selectedPayees = payeeTomSelect ? payeeTomSelect.getValue() : [];

    // সার্ভার সাইড কুয়েরি বিল্ড করা
    let query = window.db
        .from('expenses')
        .select('*')
        .order('date', { ascending: false });

    // কন্ডিশন যোগ করা
    if (from) query = query.gte('date', from);
    if (to) query = query.lte('date', to);
    if (cat) query = query.eq('category', cat);
    if (selectedPayees.length > 0) query = query.in('payee', selectedPayees);

    // ডাটা আনা
    const { data, error } = await query;

    if (error) {
        console.error(error);
        tbody.innerHTML = `<tr><td colspan="6" style="color:red; text-align:center;">Error: ${error.message}</td></tr>`;
        document.getElementById('totalAmount').innerText = "0";
    } else {
        currentData = data; // গ্লোবাল ভেরিয়েবলে রাখা (PDF এর জন্য)
        renderTable(data);
    }
}

// ৪. টেবিল রেন্ডার
function renderTable(data) {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = "";
    let total = 0;

    if (!data || data.length === 0) {
        tbody.innerHTML = "<tr><td colspan='6' style='text-align:center; padding:30px; color:#ef4444;'>No records found for this period!</td></tr>";
        document.getElementById('totalAmount').innerText = "0";
        return;
    }

    // ফ্র্যাগমেন্ট ব্যবহার (Fast DOM update)
    const fragment = document.createDocumentFragment();

    data.forEach(item => {
        total += item.amount;
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${item.date}</td>
            <td><span class="cat-badge">${item.category || 'General'}</span></td>
            <td>${item.payee}</td>
            <td style="color:#6b7280; font-size:0.9em;">${item.purpose || '-'}</td>
            <td style="text-align: right; font-weight: 700;">₹${item.amount.toLocaleString('en-IN')}</td>
            <td style="text-align: center;">
                <button onclick="deleteExpense(${item.id})" title="Delete" style="background:#fee2e2; border:none; color:#dc2626; cursor:pointer; padding:6px 10px; border-radius:4px;">🗑</button>
            </td>
        `;
        fragment.appendChild(tr);
    });

    tbody.appendChild(fragment);
    document.getElementById('totalAmount').innerText = total.toLocaleString('en-IN');
}

// ৫. ইভেন্ট লিসেনার
document.getElementById('fromDate').addEventListener('change', applyFilters);
document.getElementById('toDate').addEventListener('change', applyFilters);
document.getElementById('catFilter').addEventListener('change', applyFilters);
// Payee change is handled inside TomSelect config

// ৬. রিসেট বাটন
function resetFilters() {
    // চলতি মাস রিসেট
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const formatDate = (d) => d.toISOString().split('T')[0];

    document.getElementById('fromDate').value = formatDate(firstDay);
    document.getElementById('toDate').value = formatDate(today);
    document.getElementById('catFilter').value = "";
    
    if(payeeTomSelect) payeeTomSelect.clear();

    applyFilters();
}

// ৭. ডিলিট ফাংশন
async function deleteExpense(id) {
    if(confirm("Are you sure you want to delete this record?")) {
        const { error } = await window.db.from('expenses').delete().eq('id', id);
        if(error) {
            alert("Error: " + error.message);
        } else {
            // ডাটাবেস থেকে ডিলিট হলে UI আপডেট (পুরো রিলোড না করে)
            currentData = currentData.filter(item => item.id !== id);
            renderTable(currentData);
        }
    }
}

// ৮. এক্সেল আপলোড ফাংশন
async function handleFileUpload(input) {
    const file = input.files[0];
    if (!file) return;

    // ইউজার আইডি নেওয়া
    const { data: { user } } = await window.db.auth.getUser();

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { raw: false, dateNF: 'yyyy-mm-dd' });

            const formattedData = jsonData.map(row => ({
                date: row['Date'], 
                category: row['Category'] || 'General',
                payee: row['Payee'] || 'Unknown',
                purpose: row['Purpose'] || '',
                amount: parseFloat(row['Amount']) || 0,
                user_id: user.id
            })).filter(d => d.amount > 0);

            if(formattedData.length > 0 && confirm(`Ready to upload ${formattedData.length} records?`)) {
                const { error } = await window.db.from('expenses').insert(formattedData);
                if(error) throw error;
                
                alert("✅ Successfully Uploaded!");
                input.value = '';
                // নতুন ডাটা দেখতে লিস্ট রিফ্রেশ (Payee list আপডেট হতে পারে তাই ফুল রিলোড)
                loadFilterOptions().then(applyFilters);
            }
        } catch(err) {
            console.error(err);
            alert("Upload Failed: " + err.message);
        }
    };
    reader.readAsArrayBuffer(file);
}

// ৯. পিডিএফ জেনারেশন (Top Total & Date Range)
window.downloadPDF = function() {
    if (!window.jspdf) return alert("PDF Library missing!");
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // ক্যালকুলেশন
    const totalAmount = currentData.reduce((sum, item) => sum + item.amount, 0);
    const fromDate = document.getElementById('fromDate').value;
    const toDate = document.getElementById('toDate').value;
    
    // ডেট ফরম্যাট সুন্দর করা (DD/MM/YYYY)
    const fmt = (d) => d ? d.split('-').reverse().join('/') : '';
    const dateRangeText = (fromDate && toDate) ? `${fmt(fromDate)} to ${fmt(toDate)}` : `Generated: ${new Date().toLocaleDateString('en-IN')}`;

    // --- Header Design ---
    doc.setFontSize(20);
    doc.setTextColor(41, 128, 185);
    doc.text("Expense Report", 14, 20);

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Period: ${dateRangeText}`, 14, 27);

    // Top Right Total
    doc.setFontSize(11);
    doc.setTextColor(80);
    doc.text("Total Expenses:", 196, 18, { align: "right" }); 

    doc.setFontSize(16);
    doc.setTextColor(220, 38, 38); // লাল কালার
    doc.setFont("helvetica", "bold");
    doc.text(`Rs. ${totalAmount.toLocaleString('en-IN')}`, 196, 26, { align: "right" });
    
    doc.setFont("helvetica", "normal"); // ফন্ট রিসেট

    // --- Table ---
    const tableBody = currentData.map(item => [
        item.date,
        item.category || 'General',
        item.payee,
        item.purpose,
        `Rs. ${item.amount.toLocaleString('en-IN')}`
    ]);

    doc.autoTable({
        startY: 35,
        head: [['Date', 'Category', 'Payee', 'Purpose', 'Amount']],
        body: tableBody,
        // ফুটার অপশনাল (উপরে টোটাল আছে, তাও স্ট্যান্ডার্ড রাখতে নিচে দিলাম)
        foot: [[
            { content: 'Grand Total', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold' } },
            { content: `Rs. ${totalAmount.toLocaleString('en-IN')}`, styles: { halign: 'right', fontStyle: 'bold' } }
        ]],
        theme: 'striped',
        headStyles: { 
            fillColor: [41, 128, 185], 
            halign: 'center', 
            fontStyle: 'bold' 
        },
        columnStyles: {
            0: { cellWidth: 25 },
            4: { halign: 'right', fontStyle: 'bold' }
        },
        styles: { fontSize: 9, cellPadding: 3, valign: 'middle' }
    });

    const fileName = `Expense_Report_${fromDate}_to_${toDate}.pdf`;
    doc.save(fileName);
}

// Start Application
loadInitialData();
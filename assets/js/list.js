let currentData = [];
let payeeTomSelect = null;

// ১. পেজ লোড এবং ইনিশিয়াল সেটআপ
async function loadInitialData() {
    // ডিফল্ট: চলতি মাসের ১ তারিখ থেকে আজ পর্যন্ত
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    
    const formatDate = (date) => date.toISOString().split('T')[0];

    document.getElementById('fromDate').value = formatDate(firstDay);
    document.getElementById('toDate').value = formatDate(today);

    // প্রথমে ফিল্টার অপশন লোড (Category & Payee)
    await loadFilterOptions();

    // তারপর ডাটা লোড
    applyFilters(); 
}

// ২. ডাইনামিক ফিল্টার লোড (Category & Payee) - Expenses টেবিল থেকে
async function loadFilterOptions() {
    // Auth check
    const { data: { session } } = await window.db.auth.getSession();
    if(!session) return window.location.href = 'login.html';

    // --- Category এবং Payee লোড ---
    const { data: expenseData } = await window.db
        .from('expenses')
        .select('category, payee') 
        .not('category', 'is', null);

    if (expenseData) {
        // ১. ইউনিক ক্যাটাগরি বের করা
        const uniqueCats = [...new Set(expenseData.map(item => item.category))].filter(Boolean).sort();
        
        const catSelect = document.getElementById('catFilter');
        catSelect.innerHTML = '<option value="">All Categories</option>';
        
        uniqueCats.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat;
            opt.textContent = cat;
            catSelect.appendChild(opt);
        });

        // ২. ইউনিক Payee বের করা (Tom Select এর জন্য)
        const uniquePayees = [...new Set(expenseData.map(item => item.payee))].filter(Boolean).sort();
        
        const payeeSelect = document.getElementById('payeeFilter');
        
        // আগের Tom Select ক্লিন করা
        if (payeeTomSelect) {
            payeeTomSelect.destroy();
            payeeSelect.innerHTML = '<option value="">Select Payees...</option>';
        }

        uniquePayees.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p;
            opt.textContent = p;
            payeeSelect.appendChild(opt);
        });

        // Tom Select পুনরায় চালু করা
        payeeTomSelect = new TomSelect("#payeeFilter", {
            plugins: ['remove_button'],
            create: false,
            placeholder: "Search & Select Payees...",
            maxItems: null,
            onItemAdd: function() { applyFilters(); },
            onItemRemove: function() { applyFilters(); }
        });
    }
}

// ৩. মেইন ফিল্টার লজিক (Server-side Filtering)
async function applyFilters() {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = "<tr><td colspan='6' style='text-align:center; padding:20px; color:#64748b;'>⏳ Loading data...</td></tr>";

    const from = document.getElementById('fromDate').value;
    const to = document.getElementById('toDate').value;
    const cat = document.getElementById('catFilter').value;
    // Purpose value নেওয়া
    const purpose = document.getElementById('purposeFilter').value.trim();
    const selectedPayees = payeeTomSelect ? payeeTomSelect.getValue() : [];

    // কুয়েরি তৈরি
    let query = window.db
        .from('expenses')
        .select('*')
        .order('date', { ascending: false });

    // কন্ডিশন যোগ করা
    if (from) query = query.gte('date', from);
    if (to) query = query.lte('date', to);
    if (cat) query = query.eq('category', cat);
    if (selectedPayees.length > 0) query = query.in('payee', selectedPayees);
    
    // Purpose দিয়ে সার্চ লজিক (Case Insensitive Search)
    if (purpose) query = query.ilike('purpose', `%${purpose}%`);

    // ডাটা আনা
    const { data, error } = await query;

    if (error) {
        console.error(error);
        tbody.innerHTML = `<tr><td colspan="6" style="color:red; text-align:center;">Error: ${error.message}</td></tr>`;
        document.getElementById('totalAmount').innerText = "0";
    } else {
        currentData = data;
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

    const fragment = document.createDocumentFragment();

    data.forEach(item => {
        total += item.amount;
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${formatDateDisplay(item.date)}</td>
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

// হেল্পার: সুন্দর তারিখ দেখানোর জন্য (DD/MM/YYYY)
function formatDateDisplay(dateStr) {
    if(!dateStr) return '';
    const parts = dateStr.split('-');
    return `${parts[2]}/${parts[1]}/${parts[0]}`; 
}

// ৫. ইভেন্ট লিসেনার
document.getElementById('fromDate').addEventListener('change', applyFilters);
document.getElementById('toDate').addEventListener('change', applyFilters);
document.getElementById('catFilter').addEventListener('change', applyFilters);
// Purpose ইনপুটে টাইপ করলে সার্চ হবে
document.getElementById('purposeFilter').addEventListener('input', applyFilters);

// ৬. রিসেট বাটন
function resetFilters() {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const formatDate = (d) => d.toISOString().split('T')[0];

    document.getElementById('fromDate').value = formatDate(firstDay);
    document.getElementById('toDate').value = formatDate(today);
    document.getElementById('catFilter').value = "";
    document.getElementById('purposeFilter').value = ""; // Purpose Clear
    
    if(payeeTomSelect) payeeTomSelect.clear();

    applyFilters();
}

// ৭. ডিলিট ফাংশন
async function deleteExpense(id) {
    if(confirm("Are you sure you want to delete this record?")) {
        const { error } = await window.db.from('expenses').delete().eq('id', id);
        if(error) alert(error.message);
        else {
            currentData = currentData.filter(i => i.id !== id);
            renderTable(currentData);
        }
    }
}

// ৮. এক্সেল আপলোড
async function handleFileUpload(input) {
    const file = input.files[0];
    if (!file) return;

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

            if(formattedData.length > 0 && confirm(`Upload ${formattedData.length} records?`)) {
                const { error } = await window.db.from('expenses').insert(formattedData);
                if(error) throw error;
                
                alert("✅ Upload Successful!");
                input.value = '';
                await loadFilterOptions();
                applyFilters();
            }
        } catch(err) {
            console.error(err);
            alert("Error: " + err.message);
        }
    };
    reader.readAsArrayBuffer(file);
}

// ৯. পিডিএফ ডাউনলোড (Alignment Fixed)
window.downloadPDF = function() {
    if (!window.jspdf) return alert("PDF Library missing!");
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const totalAmount = currentData.reduce((sum, item) => sum + item.amount, 0);
    const fromDate = document.getElementById('fromDate').value;
    const toDate = document.getElementById('toDate').value;
    
    const fmt = (d) => d ? d.split('-').reverse().join('/') : '';
    const dateRangeText = (fromDate && toDate) ? `${fmt(fromDate)} to ${fmt(toDate)}` : `Generated: ${new Date().toLocaleDateString('en-IN')}`;

    // Header
    doc.setFontSize(20); doc.setTextColor(41, 128, 185); doc.text("Expense Report", 14, 20);
    doc.setFontSize(10); doc.setTextColor(100); doc.text(`Period: ${dateRangeText}`, 14, 27);

    // Top Total
    doc.setFontSize(11); doc.setTextColor(80); doc.text("Total Expenses:", 196, 18, { align: "right" }); 
    doc.setFontSize(16); doc.setTextColor(220, 38, 38); doc.setFont("helvetica", "bold");
    doc.text(`Rs. ${totalAmount.toLocaleString('en-IN')}`, 196, 26, { align: "right" });
    doc.setFont("helvetica", "normal");

    // Table Data Body
    const tableBody = currentData.map(item => [
        formatDateDisplay(item.date), // Date Display Helper ব্যবহার করা হয়েছে
        item.category || 'General', 
        item.payee, 
        item.purpose, 
        `Rs. ${item.amount.toLocaleString('en-IN')}`
    ]);

    doc.autoTable({
        startY: 35,
        head: [['Date', 'Category', 'Payee', 'Purpose', 'Amount']],
        body: tableBody,
        foot: [[ { content: 'Grand Total', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold' } }, { content: `Rs. ${totalAmount.toLocaleString('en-IN')}`, styles: { halign: 'right', fontStyle: 'bold' } } ]],
        theme: 'striped',
        
        // --- এই অংশটি Alignment ঠিক করবে ---
        headStyles: { 
            fillColor: [41, 128, 185], 
            halign: 'left',  // Header বামে থাকবে
            fontStyle: 'bold',
            valign: 'middle'
        },
        columnStyles: { 
            0: { cellWidth: 25, halign: 'left' },  // Date Left
            1: { halign: 'left' },                 // Category Left
            2: { halign: 'left' },                 // Payee Left
            3: { halign: 'left' },                 // Purpose Left
            4: { halign: 'right', fontStyle: 'bold' } // Amount Right
        },
        // ------------------------------------

        styles: { fontSize: 9, cellPadding: 3, valign: 'middle' }
    });

    doc.save(`Expense_Report.pdf`);
}

// Start App
loadInitialData();
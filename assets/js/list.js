let currentData = [];
let payeeTomSelect = null;

// ১. পেজ লোড এবং ইনিশিয়াল সেটআপ
async function loadInitialData() {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    
    const formatDate = (date) => date.toISOString().split('T')[0];

    document.getElementById('fromDate').value = formatDate(firstDay);
    document.getElementById('toDate').value = formatDate(today);

    await loadFilterOptions();
    applyFilters(); 
}

// ২. ডাইনামিক ফিল্টার লোড
async function loadFilterOptions() {
    const { data: { session } } = await window.db.auth.getSession();
    if(!session) return window.location.href = 'login.html';

    const { data: expenseData } = await window.db
        .from('expenses')
        .select('category, payee') 
        .not('category', 'is', null);

    if (expenseData) {
        // Categories
        const uniqueCats = [...new Set(expenseData.map(item => item.category))].filter(Boolean).sort();
        const catSelect = document.getElementById('catFilter');
        const editCatSelect = document.getElementById('editCategory'); // For Edit Modal

        catSelect.innerHTML = '<option value="">All Categories</option>';
        editCatSelect.innerHTML = ''; // Clear edit modal categories

        uniqueCats.forEach(cat => {
            // Filter Dropdown
            const opt = document.createElement('option');
            opt.value = cat; opt.textContent = cat;
            catSelect.appendChild(opt);

            // Edit Modal Dropdown
            const editOpt = document.createElement('option');
            editOpt.value = cat; editOpt.textContent = cat;
            editCatSelect.appendChild(editOpt);
        });

        // Payees
        const uniquePayees = [...new Set(expenseData.map(item => item.payee))].filter(Boolean).sort();
        const payeeSelect = document.getElementById('payeeFilter');
        
        if (payeeTomSelect) {
            payeeTomSelect.destroy();
            payeeSelect.innerHTML = '<option value="">Select Payees...</option>';
        }

        uniquePayees.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p; opt.textContent = p;
            payeeSelect.appendChild(opt);
        });

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

// ৩. মেইন ফিল্টার লজিক
async function applyFilters() {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = "<tr><td colspan='6' style='text-align:center; padding:20px; color:#64748b;'>⏳ Loading data...</td></tr>";

    const from = document.getElementById('fromDate').value;
    const to = document.getElementById('toDate').value;
    const cat = document.getElementById('catFilter').value;
    const purpose = document.getElementById('purposeFilter').value.trim();
    const selectedPayees = payeeTomSelect ? payeeTomSelect.getValue() : [];

    let query = window.db.from('expenses').select('*').order('date', { ascending: false });

    if (from) query = query.gte('date', from);
    if (to) query = query.lte('date', to);
    if (cat) query = query.eq('category', cat);
    if (selectedPayees.length > 0) query = query.in('payee', selectedPayees);
    if (purpose) query = query.ilike('purpose', `%${purpose}%`);

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

// ৪. টেবিল রেন্ডার (Edit Button Added)
function renderTable(data) {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = "";
    let total = 0;

    if (!data || data.length === 0) {
        tbody.innerHTML = "<tr><td colspan='6' style='text-align:center; padding:30px; color:#ef4444;'>No records found!</td></tr>";
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
            <td style="text-align: center; white-space: nowrap;">
                <button onclick="openEditModal(${item.id})" class="edit-btn" title="Edit"><i class="fa-solid fa-pen"></i></button>
                <button onclick="deleteExpense(${item.id})" class="delete-btn" title="Delete"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        fragment.appendChild(tr);
    });

    tbody.appendChild(fragment);
    document.getElementById('totalAmount').innerText = total.toLocaleString('en-IN');
}

// ---------------- EDIT FUNCTIONS START ----------------

// A. মডাল ওপেন করা এবং ডাটা সেট করা
window.openEditModal = function(id) {
    const item = currentData.find(d => d.id === id);
    if (!item) return;

    document.getElementById('editId').value = item.id;
    document.getElementById('editDate').value = item.date;
    document.getElementById('editCategory').value = item.category;
    document.getElementById('editPayee').value = item.payee;
    document.getElementById('editPurpose').value = item.purpose || '';
    document.getElementById('editAmount').value = item.amount;

    document.getElementById('editModal').style.display = 'flex';
}

// B. মডাল বন্ধ করা
window.closeEditModal = function() {
    document.getElementById('editModal').style.display = 'none';
}

// C. আপডেট সেভ করা
window.saveUpdate = async function() {
    const id = document.getElementById('editId').value;
    const date = document.getElementById('editDate').value;
    const category = document.getElementById('editCategory').value;
    const payee = document.getElementById('editPayee').value;
    const purpose = document.getElementById('editPurpose').value;
    const amount = parseFloat(document.getElementById('editAmount').value);

    if (!date || !amount || !payee) {
        alert("Please fill all required fields!");
        return;
    }

    // Supabase Update Call
    const { error } = await window.db
        .from('expenses')
        .update({ date, category, payee, purpose, amount })
        .eq('id', id);

    if (error) {
        alert("Update failed: " + error.message);
    } else {
        alert("✅ Updated Successfully!");
        closeEditModal();
        applyFilters(); // টেবিল রিফ্রেশ
        loadFilterOptions(); // ক্যাটাগরি বা Payee চেঞ্জ হলে লিস্ট আপডেট হবে
    }
}
// ---------------- EDIT FUNCTIONS END ----------------

// হেল্পার
function formatDateDisplay(dateStr) {
    if(!dateStr) return '';
    const parts = dateStr.split('-');
    return `${parts[2]}/${parts[1]}/${parts[0]}`; 
}

// ইভেন্ট লিসেনার
document.getElementById('fromDate').addEventListener('change', applyFilters);
document.getElementById('toDate').addEventListener('change', applyFilters);
document.getElementById('catFilter').addEventListener('change', applyFilters);
document.getElementById('purposeFilter').addEventListener('input', applyFilters);

// রিসেট
function resetFilters() {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const formatDate = (d) => d.toISOString().split('T')[0];

    document.getElementById('fromDate').value = formatDate(firstDay);
    document.getElementById('toDate').value = formatDate(today);
    document.getElementById('catFilter').value = "";
    document.getElementById('purposeFilter').value = ""; 
    
    if(payeeTomSelect) payeeTomSelect.clear();
    applyFilters();
}

// ডিলিট
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

// এক্সেল আপলোড
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

// পিডিএফ ডাউনলোড
window.downloadPDF = function() {
    if (!window.jspdf) return alert("PDF Library missing!");
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const totalAmount = currentData.reduce((sum, item) => sum + item.amount, 0);
    const fromDate = document.getElementById('fromDate').value;
    const toDate = document.getElementById('toDate').value;
    
    const fmt = (d) => d ? d.split('-').reverse().join('/') : '';
    const dateRangeText = (fromDate && toDate) ? `${fmt(fromDate)} to ${fmt(toDate)}` : `Generated: ${new Date().toLocaleDateString('en-IN')}`;

    doc.setFontSize(20); doc.setTextColor(41, 128, 185); doc.text("Expense Report", 14, 20);
    doc.setFontSize(10); doc.setTextColor(100); doc.text(`Period: ${dateRangeText}`, 14, 27);

    doc.setFontSize(11); doc.setTextColor(80); doc.text("Total Expenses:", 196, 18, { align: "right" }); 
    doc.setFontSize(16); doc.setTextColor(220, 38, 38); doc.setFont("helvetica", "bold");
    doc.text(`Rs. ${totalAmount.toLocaleString('en-IN')}`, 196, 26, { align: "right" });
    doc.setFont("helvetica", "normal");

    const tableBody = currentData.map(item => [
        formatDateDisplay(item.date), 
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
        headStyles: { fillColor: [41, 128, 185], halign: 'left', fontStyle: 'bold', valign: 'middle' },
        columnStyles: { 
            0: { cellWidth: 25, halign: 'left' },
            1: { halign: 'left' },
            2: { halign: 'left' },
            3: { halign: 'left' },
            4: { halign: 'right', fontStyle: 'bold' }
        },
        styles: { fontSize: 9, cellPadding: 3, valign: 'middle' }
    });

    doc.save(`Expense_Report.pdf`);
}

// Start
loadInitialData();
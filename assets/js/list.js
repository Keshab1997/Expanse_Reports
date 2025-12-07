let allExpenses = [];
let currentFilteredData = []; 
let payeeTomSelect = null; // Tom Select এর কন্ট্রোলার

// ১. ডাটা লোড (Category ডাটাবেস থেকে না এনে, সরাসরি খরচের লিস্ট থেকে বানানো হবে)
async function loadInitialData() {
    await loadExpenses();
}

async function loadExpenses() {
    // লোডিং...
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = "<tr><td colspan='6' style='text-align:center;'>Loading data...</td></tr>";

    let { data, error } = await window.db
        .from('expenses')
        .select('*')
        .order('date', { ascending: false });

    if (error) {
        console.error(error);
        alert("Error loading data");
    } else {
        allExpenses = data;
        currentFilteredData = data;
        
        // ফিল্টার ড্রপডাউন পপুলেট করা
        populateFilters(data);
        
        // টেবিল রেন্ডার
        renderTable(data);
    }
}

// ২. ডাইনামিক ফিল্টার পপুলেট (Category & Payee)
function populateFilters(data) {
    // --- Category Setup ---
    const catSelect = document.getElementById('catFilter');
    // ডাটা থেকে ইউনিক ক্যাটাগরি বের করা
    const uniqueCats = [...new Set(data.map(item => item.category || 'General'))].sort();
    
    catSelect.innerHTML = '<option value="">All Categories</option>';
    uniqueCats.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        catSelect.appendChild(opt);
    });

    // --- Payee Setup (with Tom Select) ---
    const payeeSelect = document.getElementById('payeeFilter');
    // ডাটা থেকে ইউনিক Payee বের করা
    const uniquePayees = [...new Set(data.map(item => item.payee))].sort();

    // আগের Tom Select থাকলে ধ্বংস করে নতুন করে বানাবো
    if (payeeTomSelect) {
        payeeTomSelect.destroy();
    }

    payeeSelect.innerHTML = ''; // ক্লিয়ার
    uniquePayees.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p;
        opt.textContent = p;
        payeeSelect.appendChild(opt);
    });

    // Tom Select ইনিশিলাইজ করা (Search + Multi Select)
    payeeTomSelect = new TomSelect("#payeeFilter", {
        plugins: ['remove_button'], // ক্রস বাটন যোগ করা
        create: false,
        placeholder: "Search & Select Payees...",
        maxItems: null, // যত খুশি সিলেক্ট করা যাবে
        onItemAdd: function() {
            applyFilters(); // সিলেক্ট করলেই ফিল্টার হবে
        },
        onItemRemove: function() {
            applyFilters(); // রিমুভ করলেই ফিল্টার হবে
        }
    });
}

// ৩. অ্যাডভান্সড ফিল্টার লজিক
function applyFilters() {
    const from = document.getElementById('fromDate').value;
    const to = document.getElementById('toDate').value;
    const cat = document.getElementById('catFilter').value;
    
    // মাল্টিপল Payee ভ্যালু নেওয়া
    const selectedPayees = payeeTomSelect.getValue(); // এটি একটি Array রিটার্ন করে

    const filtered = allExpenses.filter(item => {
        // ডেট চেকিং
        const itemDate = item.date;
        const matchFrom = from ? itemDate >= from : true;
        const matchTo = to ? itemDate <= to : true;
        
        // ক্যাটাগরি চেকিং
        const matchCat = cat ? item.category === cat : true;
        
        // Payee চেকিং (Multi-select Logic)
        // যদি কোনো Payee সিলেক্ট না থাকে, তবে সব দেখাও (True)
        // আর যদি সিলেক্ট থাকে, তবে চেক করো এই আইটেমের Payee লিস্টে আছে কিনা
        const matchPayee = selectedPayees.length === 0 ? true : selectedPayees.includes(item.payee);
        
        return matchFrom && matchTo && matchCat && matchPayee;
    });

    currentFilteredData = filtered;
    renderTable(filtered);
}

// ইভেন্ট লিসেনার
['fromDate', 'toDate', 'catFilter'].forEach(id => {
    document.getElementById(id).addEventListener('change', applyFilters);
});

// ৪. টেবিল রেন্ডার
function renderTable(data) {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = "";
    let total = 0;

    if(data.length === 0) {
        tbody.innerHTML = "<tr><td colspan='6' style='text-align:center; padding:30px; color:#ef4444;'>No records found matching filters!</td></tr>";
        document.getElementById('totalAmount').innerText = "0";
        return;
    }

    data.forEach(item => {
        total += item.amount;
        const catDisplay = item.category ? item.category : "General";
        const purposeDisplay = item.purpose ? item.purpose : "-";
        
        let row = `<tr>
            <td>${item.date}</td>
            <td><span class="cat-badge">${catDisplay}</span></td>
            <td>${item.payee}</td>
            <td style="color:#6b7280; font-size:0.9em;">${purposeDisplay}</td>
            <td style="text-align: right; font-weight: 700;">₹${item.amount.toLocaleString('en-IN')}</td>
            <td style="text-align: center;">
                <button onclick="deleteExpense(${item.id})" title="Delete" style="background:#fee2e2; border:none; color:#dc2626; cursor:pointer; padding:6px 10px; border-radius:4px;">🗑</button>
            </td>
        </tr>`;
        tbody.innerHTML += row;
    });

    document.getElementById('totalAmount').innerText = total.toLocaleString('en-IN');
}

// ৫. রিসেট ফিল্টার
function resetFilters() {
    document.getElementById('fromDate').value = "";
    document.getElementById('toDate').value = "";
    document.getElementById('catFilter').value = "";
    
    // Tom Select ক্লিয়ার করা
    if(payeeTomSelect) {
        payeeTomSelect.clear(); 
    }

    currentFilteredData = allExpenses;
    renderTable(allExpenses);
}

// ৬. ডিলিট এবং এক্সেল আপলোড (আগের মতোই)
async function deleteExpense(id) {
    if(confirm("Are you sure?")) {
        const { error } = await window.db.from('expenses').delete().eq('id', id);
        if(!error) loadExpenses();
        else alert(error.message);
    }
}

// এক্সেল আপলোড আগের কোড থেকে কপি করে এখানে রাখতে পারেন অথবা আমি নিচে ছোট করে দিচ্ছি
async function handleFileUpload(input) {
    // ... আপনার আগের এক্সেল আপলোড কোড এখানে থাকবে ...
    // আপলোড শেষ হলে loadExpenses() কল করতে ভুলবেন না
    // নিচের অংশটুকু শর্টকাট:
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { raw: false, dateNF: 'yyyy-mm-dd' });
            const { data: { user } } = await window.db.auth.getUser();
            
            const formattedData = jsonData.map(row => ({
                date: row['Date'], 
                category: row['Category'] || 'General',
                payee: row['Payee'] || 'Unknown',
                purpose: row['Purpose'] || '',
                amount: parseFloat(row['Amount']) || 0,
                user_id: user.id
            })).filter(d => d.amount > 0);

            if(confirm(`Upload ${formattedData.length} items?`)) {
                await window.db.from('expenses').insert(formattedData);
                alert("Uploaded!");
                input.value = '';
                loadExpenses(); // রিলোড
            }
        } catch(err) { console.error(err); alert("Excel Error"); }
    };
    reader.readAsArrayBuffer(file);
}

// পিডিএফ ডাউনলোড ফাংশন (আগেরটাই থাকবে)
window.downloadPDF = function() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text("Expense Report", 14, 20);
    const dateStr = new Date().toLocaleDateString('en-IN');
    doc.setFontSize(10);
    doc.text(`Generated: ${dateStr}`, 14, 26);

    const totalAmount = currentFilteredData.reduce((sum, item) => sum + item.amount, 0);
    const tableBody = currentFilteredData.map(item => [
        item.date, item.category, item.payee, item.purpose, `Rs. ${item.amount.toLocaleString('en-IN')}`
    ]);

    doc.autoTable({
        startY: 30,
        head: [['Date', 'Category', 'Payee', 'Purpose', 'Amount']],
        body: tableBody,
        foot: [['', '', '', 'Total', `Rs. ${totalAmount.toLocaleString('en-IN')}`]],
        theme: 'striped',
        headStyles: { fillColor: [41, 128, 185] },
        columnStyles: { 4: { halign: 'right' } }
    });
    doc.save(`Report_${dateStr}.pdf`);
}

loadInitialData();
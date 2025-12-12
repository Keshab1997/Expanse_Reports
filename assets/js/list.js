let currentData = [];
let payeeTomSelect = null;

// ==========================================
// 0. LOADER FUNCTIONS
// ==========================================
function showLoader() {
    const loader = document.getElementById('globalLoader');
    if (loader) loader.style.display = 'flex';
}

function hideLoader() {
    const loader = document.getElementById('globalLoader');
    if (loader) loader.style.display = 'none';
}

// ১. পেজ লোড এবং ইনিশিয়াল সেটআপ (Optimized)
document.addEventListener('DOMContentLoaded', loadInitialData);

async function loadInitialData() {
    showLoader(); // লোডার শুরু

    try {
        const today = new Date();
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        const formatDate = (date) => date.toISOString().split('T')[0];

        // তারিখ সেট করা যদি আগে থেকে না থাকে
        if(!document.getElementById('fromDate').value) {
            document.getElementById('fromDate').value = formatDate(firstDay);
            document.getElementById('toDate').value = formatDate(today);
        }

        // --- SPEED OPTIMIZATION ---
        // ফিল্টার এবং টেবিল ডাটা একসাথে লোড হবে (Parallel Execution)
        // applyFilters(true) পাঠানো হচ্ছে যাতে সে নিজে লোডার বন্ধ না করে দেয়
        await Promise.all([
            loadFilterOptions(), 
            applyFilters(true) 
        ]);

    } catch (error) {
        console.error("Init Error:", error);
        alert("Something went wrong loading data.");
    } finally {
        hideLoader(); // দুটি কাজ শেষ হওয়ার পর লোডার বন্ধ হবে
    }
}

// ২. ডাইনামিক ফিল্টার লোড (Payee Search Fix Here)
async function loadFilterOptions() {
    const { data: { session } } = await window.db.auth.getSession();
    if(!session) return window.location.href = 'login.html';

    // ডাটা নিয়ে আসা
    const { data: expenseData } = await window.db
        .from('expenses')
        .select('category, payee');

    if (expenseData) {
        // --- Categories Setup ---
        const uniqueCats = [...new Set(expenseData.map(item => item.category))].filter(Boolean).sort();
        const catSelect = document.getElementById('catFilter');
        const editCatSelect = document.getElementById('editCategory');

        // আগের অপশন ক্লিয়ার
        catSelect.innerHTML = '<option value="">All Categories</option>';
        editCatSelect.innerHTML = ''; 

        uniqueCats.forEach(cat => {
            catSelect.add(new Option(cat, cat));
            editCatSelect.add(new Option(cat, cat));
        });

        // --- Payees Setup (TomSelect Fixed) ---
        const uniquePayees = [...new Set(expenseData.map(item => item.payee))].filter(Boolean).sort();
        const payeeSelect = document.getElementById('payeeFilter');
        
        // ১. পুরনো TomSelect থাকলে ধ্বংস করা
        if (payeeTomSelect) {
            payeeTomSelect.destroy();
            payeeTomSelect = null;
        }

        // ২. DOM এলিমেন্ট ক্লিয়ার করা
        payeeSelect.innerHTML = '';

        // ৩. অপশন যোগ করা
        uniquePayees.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p; 
            opt.textContent = p;
            payeeSelect.appendChild(opt);
        });

        // ৪. নতুন করে TomSelect তৈরি (Robust Config)
        payeeTomSelect = new TomSelect("#payeeFilter", {
            plugins: ['remove_button', 'dropdown_input'], // dropdown_input সার্চের জন্য ভালো
            create: false,
            placeholder: "Search & Select Payees...",
            maxItems: null,
            valueField: 'value',
            labelField: 'text',
            searchField: ['text'], 
            dropdownParent: 'body', // CSS z-index সমস্যা সমাধানের জন্য
            onItemAdd: function() { applyFilters(); },
            onItemRemove: function() { applyFilters(); }
        });
    }
}

// ৩. মেইন ফিল্টার লজিক (Updated for Speed)
async function applyFilters(isInitialLoad = false) {
    // ইনিশিয়াল লোড হলে লোডার এখানে অন করব না, loadInitialData সেটা হ্যান্ডেল করবে
    if (!isInitialLoad) showLoader(); 

    const tbody = document.getElementById('tableBody');
    
    // লোডিং টেক্সট দেখান (শুধু ম্যানুয়াল ফিল্টারের সময়)
    if (!isInitialLoad) {
        tbody.innerHTML = "<tr><td colspan='6' style='text-align:center; padding:20px; color:#64748b;'>⏳ Updating...</td></tr>";
    }

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

    // ইনিশিয়াল লোড না হলে লোডার বন্ধ করুন
    if (!isInitialLoad) hideLoader();

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

window.closeEditModal = function() {
    document.getElementById('editModal').style.display = 'none';
}

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

    showLoader(); // আপডেটের সময় লোডার

    const { error } = await window.db
        .from('expenses')
        .update({ date, category, payee, purpose, amount })
        .eq('id', id);

    if (error) {
        hideLoader();
        alert("Update failed: " + error.message);
    } else {
        alert("✅ Updated Successfully!");
        closeEditModal();
        // ফিল্টার এবং অপশন দুটোই আপডেট করতে হবে যাতে নতুন নাম লিস্টে আসে
        await loadFilterOptions();
        await applyFilters(); 
        // hideLoader() applyFilters এর শেষে কল হবে
    }
}

// ---------------- EDIT FUNCTIONS END ----------------

function formatDateDisplay(dateStr) {
    if(!dateStr) return '';
    const parts = dateStr.split('-');
    return `${parts[2]}/${parts[1]}/${parts[0]}`; 
}

// ইভেন্ট লিসেনার
document.getElementById('fromDate').addEventListener('change', () => applyFilters());
document.getElementById('toDate').addEventListener('change', () => applyFilters());
document.getElementById('catFilter').addEventListener('change', () => applyFilters());

// টাইপ করার সময় একটু ডিলে দিয়ে ফিল্টার কল হবে (Performance)
let debounceTimer;
document.getElementById('purposeFilter').addEventListener('input', function() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => applyFilters(), 500);
});

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
        showLoader();
        const { error } = await window.db.from('expenses').delete().eq('id', id);
        if(error) {
            hideLoader();
            alert(error.message);
        } else {
            // পুরো পেজ রিলোড না করে অ্যারে থেকে বাদ দেওয়া (Performance)
            currentData = currentData.filter(i => i.id !== id);
            renderTable(currentData);
            hideLoader();
        }
    }
}

// এক্সেল আপলোড
async function handleFileUpload(input) {
    const file = input.files[0];
    if (!file) return;

    showLoader(); // আপলোড প্রসেসিং শুরু

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

            if(formattedData.length > 0) {
                 // Confirm dialog ব্রাউজারের থ্রেড ব্লক করে, তাই লোডার দেখা যাবে না।
                 // তাই কনফার্মেশন আগে নেওয়া ভালো, কিন্তু এখানে কোড ফ্লো ঠিক আছে।
                if(confirm(`Ready to upload ${formattedData.length} records?`)) {
                    const { error } = await window.db.from('expenses').insert(formattedData);
                    if(error) throw error;
                    
                    alert("✅ Upload Successful!");
                    input.value = '';
                    await loadFilterOptions();
                    applyFilters();
                } else {
                    hideLoader();
                }
            } else {
                hideLoader();
                alert("No valid data found!");
            }
        } catch(err) {
            hideLoader();
            console.error(err);
            alert("Error: " + err.message);
        }
    };
    reader.readAsArrayBuffer(file);
}

// পিডিএফ ডাউনলোড
window.downloadPDF = function() {
    showLoader(); // পিডিএফ জেনারেট হতে সময় লাগতে পারে

    // UI রেন্ডার হতে একটু সময় দেওয়ার জন্য setTimeout ব্যবহার
    setTimeout(() => {
        try {
            if (!window.jspdf) {
                alert("PDF Library missing!");
                hideLoader();
                return;
            }
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

            if (window.ReactNativeWebView) {
                const pdfData = doc.output('datauristring');
                window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'downloadPDF',
                    data: pdfData, 
                    filename: 'Expense_Report.pdf'
                }));
            } else {
                doc.save('Expense_Report.pdf');
            }
        } catch (e) {
            console.error(e);
            alert("Error generating PDF");
        } finally {
            hideLoader(); // ডাউনলোড শুরু হলে লোডার বন্ধ
        }
    }, 100);
}
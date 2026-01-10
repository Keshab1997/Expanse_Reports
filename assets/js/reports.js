/* =========================================
   FILE: assets/js/reports.js
   DESCRIPTION: Advanced Reports Page with Multiple Selection & Inline Editing
========================================= */

// গ্লোবাল ভেরিয়েবল
let catTom, sourceTom, statusTom, payeeTom;
let expenseCache = []; // Fast loading এর জন্য ক্যাশ
let currentFilteredData = [];
let firstEntryDate = null; // সর্বপ্রথম হিসাবের তারিখ রাখার জন্য

document.addEventListener('DOMContentLoaded', () => {
    loadInitialData();
    setupEventListeners();
});

// =========================================
// 1. LOADER FUNCTIONS
// =========================================
function showLoader() {
    const loader = document.getElementById('globalLoader');
    if (loader) loader.style.display = 'flex';
}

function hideLoader() {
    const loader = document.getElementById('globalLoader');
    if (loader) loader.style.display = 'none';
}

// =========================================
// 2. INITIAL SETUP WITH FAST LOADING
// =========================================
async function loadInitialData() {
    showLoader();
    
    // ক্যাশ থেকে ডাটা দেখানো (যদি থাকে)
    if (expenseCache.length > 0) renderTable(expenseCache);
    
    try {
        if (!window.db) {
            console.error("Supabase client not found!");
            return;
        }

        const today = new Date();
        const fromInput = document.getElementById('fromDate');
        const toInput = document.getElementById('toDate');

        // ১. From Date: চলতি মাসের ১ তারিখ (Timezone সমস্যা এড়াতে ম্যানুয়াল ফরম্যাট)
        const y = today.getFullYear();
        const m = today.getMonth();
        const firstDay = new Date(y, m, 1);
        
        // YYYY-MM-DD ফরম্যাটে লোকাল তারিখ তৈরি
        const fromDateStr = `${firstDay.getFullYear()}-${String(firstDay.getMonth() + 1).padStart(2, '0')}-01`;
        
        // ২. To Date: আজকের তারিখ
        const toDateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

        if (fromInput) fromInput.value = fromDateStr;
        if (toInput) toInput.value = toDateStr;

        // ৩. ডাটাবেস থেকে সর্বপ্রথম হিসাবের তারিখটি খুঁজে বের করা
        const { data: { user } } = await window.db.auth.getUser();
        if (user) {
            const { data: oldestRecord } = await window.db
                .from('expenses')
                .select('date')
                .eq('user_id', user.id)
                .order('date', { ascending: true })
                .limit(1)
                .maybeSingle();

            if (oldestRecord) {
                firstEntryDate = oldestRecord.date;
            }
        }

        await initTomSelects();
        await applyFilters();

    } catch (error) {
        console.error("Init Error:", error);
    } finally {
        hideLoader();
    }
}

// =========================================
// 3. TOM SELECT INITIALIZATION (Multiple Selection)
// =========================================
async function initTomSelects() {
    try {
        const { data: { user } } = await window.db.auth.getUser();
        if (!user) return;
        
        const { data: expenses } = await window.db
            .from('expenses')
            .select('category, paid_by, payee, status')
            .eq('user_id', user.id);
            
        if (expenses) {
            const settings = { 
                plugins: ['remove_button'], 
                maxItems: null, 
                valueField: 'value', 
                labelField: 'text', 
                searchField: 'text',
                onChange: function() { applyFilters(); }
            };
            
            // 1. Category Filter (Multiple)
            const cats = [...new Set(expenses.map(i => i.category))].map(v => ({value: v, text: v}));
            catTom = new TomSelect('#catFilter', {
                ...settings,
                options: cats,
                placeholder: 'Select Categories...'
            });
            
            // 2. Source Filter (Multiple)
            const sources = [...new Set(expenses.map(i => i.paid_by).filter(Boolean))].map(v => ({value: v, text: v}));
            sourceTom = new TomSelect('#sourceFilter', {
                ...settings,
                options: sources,
                placeholder: 'Select Sources...'
            });
            
            // 3. Status Filter (Multiple)
            statusTom = new TomSelect('#statusFilter', {
                ...settings,
                placeholder: 'Select Status...'
            });
            
            // 4. Payee Filter (Multiple)
            const payees = [...new Set(expenses.map(i => i.payee))].map(v => ({value: v, text: v}));
            payeeTom = new TomSelect('#payeeFilter', {
                ...settings,
                options: payees,
                placeholder: 'Select Payees...'
            });
        }
    } catch (err) { 
        console.error("TomSelect Init Error:", err); 
    }
}

// =========================================
// 4. ADVANCED FILTER LOGIC (Multiple Selection Support)
// =========================================
async function applyFilters() {
    const tableBody = document.getElementById('tableBody');
    if (!tableBody) return;

    tableBody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:20px;">Updating...</td></tr>';
    
    try {
        const { data: { user } } = await window.db.auth.getUser();
        if (!user) return;

        // ফিল্টার ভ্যালু নেওয়া
        const fromDate = document.getElementById('fromDate')?.value || '';
        const toDate = document.getElementById('toDate')?.value || '';
        const purpose = document.getElementById('purposeFilter')?.value?.toLowerCase() || '';
        
        const cats = catTom ? catTom.getValue() : [];
        const sources = sourceTom ? sourceTom.getValue() : [];
        const statuses = statusTom ? statusTom.getValue() : [];
        const payees = payeeTom ? payeeTom.getValue() : [];

        // Supabase Query
        let query = window.db
            .from('expenses')
            .select('*')
            .eq('user_id', user.id)
            .order('date', { ascending: false });

        if (fromDate) query = query.gte('date', fromDate);
        if (toDate) query = query.lte('date', toDate);
        if (cats.length) query = query.in('category', cats);
        if (sources.length) query = query.in('paid_by', sources);
        if (statuses.length) query = query.in('status', statuses);
        if (payees.length) query = query.in('payee', payees);

        const { data: expenses, error } = await query;
        if (error) throw error;

        // Client side search for Purpose
        currentFilteredData = expenses.filter(item => {
            if (!purpose) return true;
            return (item.purpose && item.purpose.toLowerCase().includes(purpose));
        });

        expenseCache = currentFilteredData; // ক্যাশ আপডেট
        renderTable(currentFilteredData);

    } catch (error) {
        console.error("Filter Error:", error);
        tableBody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:red;">Error loading data</td></tr>';
    }
}

// =========================================
// 5. RENDER TABLE WITH INLINE EDITING & STATUS
// =========================================
function renderTable(data) {
    const tableBody = document.getElementById('tableBody');
    const totalEl = document.getElementById('totalAmount');
    
    if (!tableBody) return;

    tableBody.innerHTML = '';
    let total = 0;

    if (data.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:30px; color:#64748b;">No records found</td></tr>';
        if (totalEl) totalEl.innerText = '0';
        return;
    }

    data.forEach(item => {
        total += Number(item.amount);
        
        const dateObj = new Date(item.date);
        const dateStr = dateObj.toLocaleDateString('en-GB');
        const status = item.status || 'Unpaid';

        // চেক করা হচ্ছে এই তারিখটিই সর্বপ্রথম তারিখ কি না
        const isFirstDay = item.date === firstEntryDate;
        const dateHighlightClass = isFirstDay ? 'first-record-date' : '';

        const row = document.createElement('tr');
        row.innerHTML = `
            <td><span class="${dateHighlightClass}">${dateStr}</span></td>
            <td class="editable-cell" contenteditable="true" onblur="updateInline('${item.id}', 'category', this.innerText)">
                <span class="badge badge-cat">${item.category}</span>
            </td>
            <td class="editable-cell" contenteditable="true" onblur="updateInline('${item.id}', 'paid_by', this.innerText)" style="font-weight:600; color:#555;">
                ${item.paid_by || '-'}
            </td>
            <td class="editable-cell" contenteditable="true" onblur="updateInline('${item.id}', 'payee', this.innerText)">
                ${item.payee}
            </td>
            <td class="editable-cell" contenteditable="true" onblur="updateInline('${item.id}', 'purpose', this.innerText)" style="font-size: 0.9rem; color:#666;">
                ${item.purpose || '-'}
            </td>
            <td class="editable-cell" contenteditable="true" onblur="updateInline('${item.id}', 'amount', this.innerText)" style="text-align: right; font-weight: 600;">
                ₹${Number(item.amount).toFixed(2)}
            </td>
            <td style="text-align: center;">
                <span class="${status === 'Paid' ? 'status-paid' : 'status-unpaid'}" 
                      onclick="toggleStatus('${item.id}', '${status}')">
                    ${status}
                </span>
            </td>
            <td style="text-align: center;">
                <button onclick="openEditModal('${item.id}')" class="btn-icon edit"><i class="fa-solid fa-pen"></i></button>
            </td>
        `;
        tableBody.appendChild(row);
    });

    if (totalEl) totalEl.innerText = total.toLocaleString('en-IN', { minimumFractionDigits: 2 });
}

// =========================================
// 6. INLINE EDITING FUNCTIONS
// =========================================
async function updateInline(id, field, value) {
    try {
        // ভ্যালিডেশন
        if (field === 'amount' && (isNaN(value) || value <= 0)) {
            alert("Please enter a valid amount");
            applyFilters(); // রিফ্রেশ
            return;
        }

        const updateData = { [field]: value };
        if (field === 'amount') updateData[field] = parseFloat(value);

        const { error } = await window.db
            .from('expenses')
            .update(updateData)
            .eq('id', id);
            
        if (error) throw error;
        
        console.log(`Updated ${field}:`, value);
        
        // ক্যাশ আপডেট
        const itemIndex = expenseCache.findIndex(item => item.id === id);
        if (itemIndex !== -1) {
            expenseCache[itemIndex][field] = field === 'amount' ? parseFloat(value) : value;
        }
        
    } catch (err) {
        alert("Update failed: " + err.message);
        applyFilters(); // রিফ্রেশ
    }
}

// =========================================
// 7. STATUS TOGGLE (Paid/Unpaid)
// =========================================
async function toggleStatus(id, currentStatus) {
    const newStatus = currentStatus === 'Paid' ? 'Unpaid' : 'Paid';
    await updateInline(id, 'status', newStatus);
    applyFilters(); // রিফ্রেশ
}

// =========================================
// 8. EDIT MODAL (Enhanced)
// =========================================
async function openEditModal(id) {
    showLoader();
    try {
        const { data, error } = await window.db
            .from('expenses')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !data) throw new Error("Record not found");

        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if(el) el.value = val;
        };

        setVal('editId', data.id);
        setVal('editDate', data.date);
        setVal('editPayee', data.payee);
        setVal('editPurpose', data.purpose || '');
        setVal('editAmount', data.amount);
        setVal('editPaidBy', data.paid_by || '');

        // Category dropdown
        const catSelect = document.getElementById('editCategory');
        if (catSelect) {
            catSelect.innerHTML = '';
            const uniqueCats = [...new Set(expenseCache.map(item => item.category))];
            uniqueCats.forEach(cat => {
                const opt = document.createElement('option');
                opt.value = cat;
                opt.textContent = cat;
                catSelect.appendChild(opt);
            });
            catSelect.value = data.category;
        }

        document.getElementById('editModal').style.display = 'flex';

    } catch (err) {
        alert("Error fetching data");
        console.error(err);
    } finally {
        hideLoader();
    }
}

async function saveUpdate() {
    const getVal = (id) => document.getElementById(id)?.value;

    const id = getVal('editId');
    const date = getVal('editDate');
    const category = getVal('editCategory');
    const payee = getVal('editPayee');
    const paid_by = getVal('editPaidBy');
    const purpose = getVal('editPurpose');
    const amount = getVal('editAmount');

    if (!id || !date || !amount) {
        alert("Please fill required fields");
        return;
    }

    showLoader();
    try {
        const { error } = await window.db
            .from('expenses')
            .update({ date, category, payee, purpose, amount, paid_by })
            .eq('id', id);

        if (error) throw error;

        closeEditModal();
        loadInitialData();
        alert("Updated successfully!");

    } catch (err) {
        console.error("Update failed:", err);
        alert("Failed to update record.");
    } finally {
        hideLoader();
    }
}

function closeEditModal() {
    document.getElementById('editModal').style.display = 'none';
}

function deleteExpense() {
    const id = document.getElementById('editId').value;
    if(confirm("Are you sure you want to delete this record?")) {
        showLoader();
        window.db.from('expenses').delete().eq('id', id)
            .then(({ error }) => {
                hideLoader();
                if(error) alert("Error deleting");
                else {
                    closeEditModal();
                    loadInitialData();
                }
            });
    }
}

// =========================================
// 9. PDF DOWNLOAD (Enhanced)
// =========================================
function downloadPDF() {
    if (!currentFilteredData || currentFilteredData.length === 0) {
        alert("No data to download!");
        return;
    }

    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        const totalAmount = document.getElementById('totalAmount')?.innerText || '0';
        const fromDate = document.getElementById('fromDate')?.value || '-';
        const toDate = document.getElementById('toDate')?.value || '-';

        doc.setFontSize(18);
        doc.text("Expense Report", 14, 15);
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Date Range: ${fromDate} to ${toDate}`, 14, 22);
        
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.setFont("helvetica", "bold");
        doc.text(`Total: INR ${totalAmount}`, 14, 29);

        const tableData = currentFilteredData.map(item => [
            new Date(item.date).toLocaleDateString('en-GB'),
            item.category,
            item.paid_by || '-',
            item.payee,
            item.purpose || '-',
            Number(item.amount).toFixed(2),
            item.status || 'Unpaid'
        ]);

        doc.autoTable({
            head: [['Date', 'Category', 'Paid By', 'Payee', 'Purpose', 'Amount', 'Status']],
            body: tableData,
            startY: 35,
            theme: 'grid',
            headStyles: { fillColor: [79, 70, 229] },
            columnStyles: {
                5: { halign: 'right', fontStyle: 'bold' },
                6: { halign: 'center' }
            },
            styles: { fontSize: 9, cellPadding: 3 }
        });

        doc.save('Expense_Report.pdf');
    } catch (error) {
        console.error("PDF Generation Error:", error);
        alert("Failed to generate PDF");
    }
}

// =========================================
// 10. EVENT LISTENERS
// =========================================
function setupEventListeners() {
    const addListener = (id, event, fn) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener(event, fn);
    };

    addListener('fromDate', 'change', applyFilters);
    addListener('toDate', 'change', applyFilters);
    
    // Purpose search with debounce
    let timeout = null;
    const purposeEl = document.getElementById('purposeFilter');
    if (purposeEl) {
        purposeEl.addEventListener('input', () => {
            clearTimeout(timeout);
            timeout = setTimeout(() => applyFilters(), 500);
        });
    }
}

// =========================================
// 11. UTILITY FUNCTIONS
// =========================================
window.resetFilters = function() {
    // Clear all TomSelect filters
    if (catTom) catTom.clear();
    if (sourceTom) sourceTom.clear();
    if (statusTom) statusTom.clear();
    if (payeeTom) payeeTom.clear();
    
    // Clear other inputs
    const setVal = (id, val) => { 
        const el = document.getElementById(id); 
        if(el) el.value = val; 
    };
    
    setVal('purposeFilter', '');
    
    // Reset dates to current month (same as initial load)
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth();
    
    const firstDay = `${y}-${String(m + 1).padStart(2, '0')}-01`;
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    setVal('fromDate', firstDay);
    setVal('toDate', todayStr);
    
    applyFilters();
}

// Excel Upload (Enhanced)
window.handleFileUpload = async function (input) {
    const file = input.files[0];
    if (!file) return;

    showLoader();
    try {
        const { data: { user } } = await window.db.auth.getUser();
        const reader = new FileReader();
        
        reader.onload = async function (e) {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { raw: false, dateNF: 'yyyy-mm-dd' });

                const formattedData = jsonData.map(row => ({
                    date: row['Date'] || new Date().toISOString().split('T')[0],
                    category: row['Category'] || 'General',
                    paid_by: row['Paid By'] || row['Source'] || 'Cash',
                    payee: row['Payee'] || 'Unknown',
                    purpose: row['Purpose'] || '',
                    amount: parseFloat(row['Amount']) || 0,
                    status: row['Status'] || 'Unpaid',
                    user_id: user.id
                })).filter(d => d.amount > 0);

                if (formattedData.length > 0 && confirm(`Upload ${formattedData.length} items?`)) {
                    const { error } = await window.db.from('expenses').insert(formattedData);
                    if (error) throw error;
                    
                    alert("✅ Uploaded Successfully!");
                    input.value = '';
                    loadInitialData();
                }
            } catch (err) {
                console.error(err);
                alert("Invalid File Format");
            } finally {
                hideLoader();
            }
        };
        reader.readAsArrayBuffer(file);
    } catch (e) {
        hideLoader();
    }
}
/* =========================================
   FILE: assets/js/list.js
   DESCRIPTION: Reports Page Logic (Fixed & Safe Mode)
========================================= */

// গ্লোবাল ভেরিয়েবল
let payeeTomSelect;
let currentFilteredData = []; 

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
// 2. INITIAL SETUP
// =========================================
async function loadInitialData() {
    showLoader(); 
    try {
        if (!window.db) {
            console.error("Supabase client not found!");
            return;
        }

        const formatDate = (date) => date.toISOString().split('T')[0];
        const today = new Date();
        const fromInput = document.getElementById('fromDate');
        const toInput = document.getElementById('toDate');

        // ডিফল্ট তারিখ সেটআপ (যদি ইনপুট থাকে)
        if (fromInput && !fromInput.value) {
            const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            fromInput.value = formatDate(firstDayOfMonth);
        }
        if (toInput && !toInput.value) {
            const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            toInput.value = formatDate(lastDayOfMonth);
        }

        await loadFilterOptions(); 
        await applyFilters(); 

    } catch (error) {
        console.error("Init Error:", error);
    } finally {
        hideLoader(); 
    }
}

// =========================================
// 3. LOAD FILTER OPTIONS
// =========================================
async function loadFilterOptions() {
    try {
        const { data: { user } } = await window.db.auth.getUser();
        if (!user) return;
        
        const { data: expenses } = await window.db
            .from('expenses')
            .select('category, payee, paid_by') 
            .eq('user_id', user.id);
            
        if (expenses) {
            // 1. Category Filter
            const catSelect = document.getElementById('catFilter');
            const editCatSelect = document.getElementById('editCategory');
            const uniqueCats = [...new Set(expenses.map(item => item.category))].sort();

            if (catSelect) {
                catSelect.innerHTML = '<option value="">All Categories</option>';
                uniqueCats.forEach(cat => {
                    const opt = document.createElement('option');
                    opt.value = cat; opt.textContent = cat;
                    catSelect.appendChild(opt);
                });
            }

            if (editCatSelect) {
                editCatSelect.innerHTML = '';
                uniqueCats.forEach(cat => {
                    const editOpt = document.createElement('option');
                    editOpt.value = cat; editOpt.textContent = cat;
                    editCatSelect.appendChild(editOpt);
                });
            }

            // 2. Source (Paid By) Filter
            const sourceSelect = document.getElementById('sourceFilter');
            if (sourceSelect) {
                const uniqueSources = [...new Set(expenses.map(item => item.paid_by).filter(Boolean))].sort();
                sourceSelect.innerHTML = '<option value="">All Sources</option>';
                uniqueSources.forEach(src => {
                    const opt = document.createElement('option');
                    opt.value = src; opt.textContent = src;
                    sourceSelect.appendChild(opt);
                });
            }

            // 3. Payee Filter (TomSelect)
            if (document.getElementById('payeeFilter')) {
                const uniquePayees = [...new Set(expenses.map(item => item.payee))].sort();
                const payeeOptions = uniquePayees.map(p => ({ value: p, text: p }));

                if (!payeeTomSelect) {
                    payeeTomSelect = new TomSelect('#payeeFilter', {
                        options: payeeOptions,
                        plugins: ['remove_button'],
                        maxItems: null,
                        valueField: 'value',
                        labelField: 'text',
                        searchField: 'text',
                        placeholder: 'Select Payees...',
                        onChange: function() { applyFilters(); }
                    });
                } else {
                    payeeTomSelect.clearOptions();
                    payeeTomSelect.addOptions(payeeOptions);
                }
            }
        }
    } catch (err) { console.error(err); }
}

// =========================================
// 4. APPLY FILTERS (Safe Mode)
// =========================================
async function applyFilters() {
    const tableBody = document.getElementById('tableBody');
    if (!tableBody) return;

    tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px;">Updating...</td></tr>';
    
    try {
        const { data: { user } } = await window.db.auth.getUser();
        if (!user) return;

        // সেফলি ভ্যালু নেওয়া (যদি এলিমেন্ট না থাকে, তাহলে ফাঁকা স্ট্রিং ধরবে)
        const fromDate = document.getElementById('fromDate')?.value || '';
        const toDate = document.getElementById('toDate')?.value || '';
        const category = document.getElementById('catFilter')?.value || '';
        const source = document.getElementById('sourceFilter')?.value || ''; 
        const purposeSearch = document.getElementById('purposeFilter')?.value?.toLowerCase() || '';
        
        let selectedPayees = payeeTomSelect ? payeeTomSelect.getValue() : [];

        // Supabase Query
        let query = window.db
            .from('expenses')
            .select('*')
            .eq('user_id', user.id)
            .order('date', { ascending: false });

        if (fromDate) query = query.gte('date', fromDate);
        if (toDate) query = query.lte('date', toDate);
        if (category) query = query.eq('category', category);
        if (source) query = query.eq('paid_by', source);
        if (selectedPayees.length > 0) query = query.in('payee', selectedPayees);

        const { data: expenses, error } = await query;
        if (error) throw error;

        // Client side search for Purpose
        currentFilteredData = expenses.filter(item => {
            if (!purposeSearch) return true;
            return (item.purpose && item.purpose.toLowerCase().includes(purposeSearch));
        });

        renderTable(currentFilteredData);

    } catch (error) {
        console.error("Filter Error:", error);
        tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:red;">Error loading data</td></tr>';
    }
}

// =========================================
// 5. RENDER TABLE
// =========================================
function renderTable(data) {
    const tableBody = document.getElementById('tableBody');
    const totalEl = document.getElementById('totalAmount');
    
    if (!tableBody) return;

    tableBody.innerHTML = '';
    let total = 0;

    if (data.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:30px; color:#64748b;">No records found</td></tr>';
        if (totalEl) totalEl.innerText = '0';
        return;
    }

    data.forEach(item => {
        total += Number(item.amount);
        
        const dateObj = new Date(item.date);
        const dateStr = dateObj.toLocaleDateString('en-GB');

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${dateStr}</td>
            <td><span class="badge badge-cat">${item.category}</span></td>
            <td><span style="font-weight:600; color:#555;">${item.paid_by || '-'}</span></td>
            <td>${item.payee}</td>
            <td style="font-size: 0.9rem; color:#666;">${item.purpose || '-'}</td>
            <td style="text-align: right; font-weight: 600;">₹${Number(item.amount).toFixed(2)}</td>
            <td style="text-align: center;">
                <button onclick="openEditModal('${item.id}')" class="btn-icon edit"><i class="fa-solid fa-pen"></i></button>
            </td>
        `;
        tableBody.appendChild(row);
    });

    if (totalEl) totalEl.innerText = total.toLocaleString('en-IN', { minimumFractionDigits: 2 });
}

// =========================================
// 6. EDIT FUNCTIONALITY
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

        const catSelect = document.getElementById('editCategory');
        if (catSelect) {
            if (![...catSelect.options].some(o => o.value === data.category)) {
                const opt = document.createElement('option');
                opt.value = data.category;
                opt.textContent = data.category;
                catSelect.appendChild(opt);
            }
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
                    loadInitialData(); // Reload filter data
                }
            });
    }
}

// =========================================
// 7. PDF DOWNLOAD
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
            Number(item.amount).toFixed(2)                   
        ]);

        doc.autoTable({
            head: [['Date', 'Category', 'Paid By', 'Payee', 'Purpose', 'Amount']],
            body: tableData,
            startY: 35,
            theme: 'grid',
            headStyles: { fillColor: [79, 70, 229] },
            columnStyles: {
                5: { halign: 'right', fontStyle: 'bold' }
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
// 8. EVENT LISTENERS (Safe Mode)
// =========================================
function setupEventListeners() {
    const addListener = (id, event, fn) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener(event, fn);
    };

    addListener('fromDate', 'change', applyFilters);
    addListener('toDate', 'change', applyFilters);
    addListener('catFilter', 'change', applyFilters);
    addListener('sourceFilter', 'change', applyFilters);
    
    let timeout = null;
    const purposeEl = document.getElementById('purposeFilter');
    if (purposeEl) {
        purposeEl.addEventListener('input', () => {
            clearTimeout(timeout);
            timeout = setTimeout(() => applyFilters(), 500);
        });
    }
}

// Excel Upload
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

window.resetFilters = function() {
    loadInitialData();
    const setVal = (id, val) => { const el = document.getElementById(id); if(el) el.value = val; };
    
    setVal('catFilter', '');
    setVal('sourceFilter', '');
    setVal('purposeFilter', '');
    if (payeeTomSelect) payeeTomSelect.clear();
}
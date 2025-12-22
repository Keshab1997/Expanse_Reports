/* =========================================
   FILE: assets/js/list.js
   DESCRIPTION: Reports Page Logic (Updated)
========================================= */

// গ্লোবাল ভেরিয়েবল
let payeeTomSelect;
let currentFilteredData = []; // PDF এর জন্য ফিল্টার করা ডাটা এখানে জমা থাকবে

// পেজ লোড ইভেন্ট
document.addEventListener('DOMContentLoaded', () => {
    loadInitialData();
    setupEventListeners();
});

// =========================================
// 1. LOADER FUNCTIONS
// =========================================
function showLoader() {
    const loader = document.getElementById('globalLoader');
    if (loader) { loader.style.display = 'flex'; }
}

function hideLoader() {
    const loader = document.getElementById('globalLoader');
    if (loader) { loader.style.display = 'none'; }
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

        // তারিখ সেটআপ
        if (!fromInput.value) {
            const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            toInput.value = formatDate(lastDayOfMonth);
            
            const { data: oldestExpense } = await window.db
                .from('expenses')
                .select('date')
                .order('date', { ascending: true }) 
                .limit(1)
                .maybeSingle();
            
            if (oldestExpense && oldestExpense.date) {
                fromInput.value = oldestExpense.date;
            } else {
                const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
                fromInput.value = formatDate(firstDayOfMonth);
            }
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
        const userId = window.auth?.user?.id || (await window.db.auth.getUser()).data.user?.id;
        
        // Category Load
        const catSelect = document.getElementById('catFilter');
        const editCatSelect = document.getElementById('editCategory'); // এডিট মোডালের জন্য

        const { data: categories } = await window.db
            .from('expenses')
            .select('category')
            .eq('user_id', userId);
            
        if(categories) {
            const uniqueCats = [...new Set(categories.map(item => item.category))];
            uniqueCats.forEach(cat => {
                // Filter dropdown
                const opt = document.createElement('option');
                opt.value = cat; opt.textContent = cat;
                catSelect.appendChild(opt);

                // Edit Modal dropdown
                const editOpt = document.createElement('option');
                editOpt.value = cat; editOpt.textContent = cat;
                editCatSelect.appendChild(editOpt);
            });
        }

        // Payee Load for TomSelect
        const { data: payees } = await window.db.from('expenses').select('payee').eq('user_id', userId);
        let payeeOptions = [];
        if (payees) {
            const uniquePayees = [...new Set(payees.map(item => item.payee))];
            payeeOptions = uniquePayees.map(p => ({ value: p, text: p }));
        }

        if (document.getElementById('payeeFilter')) {
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
        }
    } catch (err) { console.error(err); }
}

// =========================================
// 4. APPLY FILTERS (Data Fetch logic)
// =========================================
async function applyFilters() {
    const tableBody = document.getElementById('tableBody');
    tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px;">Updating...</td></tr>';
    
    try {
        const userId = window.auth?.user?.id || (await window.db.auth.getUser()).data.user?.id;
        const fromDate = document.getElementById('fromDate').value;
        const toDate = document.getElementById('toDate').value;
        const category = document.getElementById('catFilter').value;
        const purposeSearch = document.getElementById('purposeFilter').value.toLowerCase();
        
        let selectedPayees = payeeTomSelect ? payeeTomSelect.getValue() : [];

        let query = window.db
            .from('expenses')
            .select('*')
            .eq('user_id', userId)
            .gte('date', fromDate)
            .lte('date', toDate)
            .order('date', { ascending: false });

        if (category) query = query.eq('category', category);
        if (selectedPayees.length > 0) query = query.in('payee', selectedPayees);

        const { data: expenses, error } = await query;
        if (error) throw error;

        // Client side text search
        currentFilteredData = expenses.filter(item => {
            if (!purposeSearch) return true;
            return (item.purpose && item.purpose.toLowerCase().includes(purposeSearch));
        });

        renderTable(currentFilteredData);

    } catch (error) {
        console.error("Filter Error:", error);
        tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:red;">Error loading data</td></tr>';
    }
}

// =========================================
// 5. RENDER TABLE
// =========================================
function renderTable(data) {
    const tableBody = document.getElementById('tableBody');
    const totalEl = document.getElementById('totalAmount');
    
    tableBody.innerHTML = '';
    let total = 0;

    if (data.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:30px; color:#64748b;">No records found</td></tr>';
        totalEl.innerText = '0';
        return;
    }

    data.forEach(item => {
        total += Number(item.amount);
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${item.date}</td>
            <td><span class="badge badge-cat">${item.category}</span></td>
            <td>${item.payee}</td>
            <td>${item.purpose || '-'}</td>
            <td style="text-align: right; font-weight: 600;">₹${Number(item.amount).toFixed(2)}</td>
            <td style="text-align: center;">
                <button onclick="openEditModal(${item.id})" class="btn-icon edit"><i class="fa-solid fa-pen"></i></button>
                <button onclick="deleteExpense(${item.id})" class="btn-icon delete"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        tableBody.appendChild(row);
    });

    totalEl.innerText = total.toLocaleString('en-IN');
}

// =========================================
// 6. EDIT FUNCTIONALITY (Fixed)
// =========================================
async function openEditModal(id) {
    showLoader();
    try {
        // ডাটাবেস থেকে স্পেসিফিক রেকর্ড আনা
        const { data, error } = await window.db
            .from('expenses')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !data) throw new Error("Record not found");

        // মোডাল ইনপুটে ডাটা বসানো
        document.getElementById('editId').value = data.id;
        document.getElementById('editDate').value = data.date;
        document.getElementById('editPayee').value = data.payee;
        document.getElementById('editPurpose').value = data.purpose || '';
        document.getElementById('editAmount').value = data.amount;
        
        // ক্যাটাগরি সেট করা (যদি ড্রপডাউনে না থাকে তবে যোগ করা হবে)
        const catSelect = document.getElementById('editCategory');
        if (![...catSelect.options].some(o => o.value === data.category)) {
            const opt = document.createElement('option');
            opt.value = data.category;
            opt.textContent = data.category;
            catSelect.appendChild(opt);
        }
        catSelect.value = data.category;

        // মোডাল দেখানো
        document.getElementById('editModal').style.display = 'flex';

    } catch (err) {
        alert("Error fetching data");
        console.error(err);
    } finally {
        hideLoader();
    }
}

async function saveUpdate() {
    const id = document.getElementById('editId').value;
    const date = document.getElementById('editDate').value;
    const category = document.getElementById('editCategory').value;
    const payee = document.getElementById('editPayee').value;
    const purpose = document.getElementById('editPurpose').value;
    const amount = document.getElementById('editAmount').value;

    if (!id || !date || !amount) {
        alert("Please fill required fields");
        return;
    }

    showLoader();
    try {
        const { error } = await window.db
            .from('expenses')
            .update({ date, category, payee, purpose, amount })
            .eq('id', id);

        if (error) throw error;

        closeEditModal();
        applyFilters(); // টেবিল রিফ্রেশ
        alert("Expense updated successfully!");

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

function deleteExpense(id) {
    if(confirm("Are you sure you want to delete this record?")) {
        showLoader();
        window.db.from('expenses').delete().eq('id', id)
            .then(({ error }) => {
                hideLoader();
                if(error) alert("Error deleting");
                else applyFilters();
            });
    }
}

// =========================================
// 7. PDF DOWNLOAD (Improved for Mobile/Expo)
// =========================================
function downloadPDF() {
    if (!currentFilteredData || currentFilteredData.length === 0) {
        alert("No data to download!");
        return;
    }

    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        // 1. Header Section
        const totalAmount = document.getElementById('totalAmount').innerText;
        const fromDate = document.getElementById('fromDate').value;
        const toDate = document.getElementById('toDate').value;

        doc.setFontSize(18);
        doc.text("Expense Report", 14, 15);
        
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Date Range: ${fromDate} to ${toDate}`, 14, 22);
        
        // Total Amount Highlight
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0); // Black
        doc.setFont("helvetica", "bold");
        doc.text(`Total Expense: INR ${totalAmount}`, 14, 29);

        // 2. Table Data Formatting
        // টেবিলের ডাটা ম্যাপ করা (Action কলাম বাদ দেওয়া)
        const tableData = currentFilteredData.map(item => [
            item.date,
            item.category,
            item.payee,
            item.purpose || '-',
            Number(item.amount).toFixed(2) // টাকার সিম্বল ছাড়া শুধু সংখ্যা
        ]);

        // 3. Generate Table
        doc.autoTable({
            head: [['Date', 'Category', 'Payee', 'Purpose', 'Amount']],
            body: tableData,
            startY: 35,
            theme: 'grid',
            headStyles: { fillColor: [37, 99, 235] }, // Blue Header
            columnStyles: {
                4: { halign: 'right', fontStyle: 'bold' } // Amount Right Align
            },
            styles: { fontSize: 9, cellPadding: 3 }
        });

        // 4. Save/Download Logic (Updated for Expo)
        const fileName = `Expenses_${fromDate}_to_${toDate}.pdf`;

        // চেক করা হচ্ছে অ্যাপটি Expo বা WebView তে চলছে কি না
        if (window.ReactNativeWebView) {
            // === মোবাইল অ্যাপের জন্য ===
            // PDF কে সরাসরি সেভ না করে Base64 স্ট্রিং এ কনভার্ট করা হচ্ছে
            const pdfBase64 = doc.output('datauristring');
            
            // Expo অ্যাপের কাছে মেসেজ পাঠানো হচ্ছে
            window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'DOWNLOAD_PDF',
                payload: pdfBase64,
                fileName: fileName
            }));
        } else {
            // === সাধারণ ওয়েব ব্রাউজারের জন্য ===
            doc.save(fileName);
        }

    } catch (err) {
        console.error("PDF Gen Error:", err);
        alert("Error generating PDF. Please try again.");
    }
}

// =========================================
// 8. EVENT LISTENERS
// =========================================
function setupEventListeners() {
    document.getElementById('fromDate').addEventListener('change', () => applyFilters());
    document.getElementById('toDate').addEventListener('change', () => applyFilters());
    document.getElementById('catFilter').addEventListener('change', () => applyFilters());
    
    let timeout = null;
    document.getElementById('purposeFilter').addEventListener('input', () => {
        clearTimeout(timeout);
        timeout = setTimeout(() => applyFilters(), 500);
    });
}

function resetFilters() {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

    document.getElementById('fromDate').value = firstDay;
    document.getElementById('toDate').value = lastDay;
    document.getElementById('catFilter').value = "";
    document.getElementById('purposeFilter').value = "";
    
    if (payeeTomSelect) payeeTomSelect.clear();
    applyFilters();
}
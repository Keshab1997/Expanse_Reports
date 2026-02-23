document.addEventListener('DOMContentLoaded', async () => {
    await loadTailorSuggestions();
    addNewTailorRow();
});

async function loadTailorSuggestions() {
    try {
        const { data: { user } } = await window.db.auth.getUser();
        
        const { data: expenses } = await window.db
            .from('tailor_expenses')
            .select('celebrity_name, item_name')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(200);

        if (expenses) {
            const celebs = [...new Set(expenses.map(i => i.celebrity_name).filter(Boolean))];
            const items = [...new Set(expenses.map(i => i.item_name).filter(Boolean))];

            document.getElementById('celebList').innerHTML = celebs.map(v => `<option value="${v}">`).join('');
            document.getElementById('itemList').innerHTML = items.map(v => `<option value="${v}">`).join('');
        }
    } catch (err) { 
        console.error("Suggestion Error:", err); 
    } finally {
        const loader = document.getElementById('globalLoader');
        if (loader) loader.style.display = 'none';
    }
}

function addNewTailorRow() {
    const tbody = document.getElementById('tailorExcelBody');
    const row = document.createElement('tr');
    const today = new Date().toISOString().split('T')[0];

    row.innerHTML = `
        <td data-label="Date">
            <input type="date" class="excel-input row-date" value="${today}">
        </td>
        <td data-label="Celebrity Name">
            <input type="text" class="excel-input row-celeb" list="celebList" placeholder="Type to search...">
        </td>
        <td data-label="Item Name">
            <input type="text" class="excel-input row-item" list="itemList" placeholder="Type to search...">
        </td>
        <td data-label="Amount">
            <input type="number" class="excel-input row-amount" placeholder="0.00" step="0.01" oninput="calculateLiveTotal()">
        </td>
        <td data-label="Action" style="text-align: center; vertical-align: middle;">
            <button onclick="this.closest('tr').remove(); calculateLiveTotal();" class="btn-del-row" title="Remove Row" aria-label="Remove row">
                <i class="fa-solid fa-trash-can"></i>
            </button>
        </td>
    `;
    tbody.appendChild(row);
}

async function saveAllTailorEntries() {
    console.log('💾 Starting save process...');
    const btn = document.getElementById('saveAllBtn');
    const rows = document.querySelectorAll('#tailorExcelBody tr');
    const dataToInsert = [];

    try {
        const { data: { user } } = await window.db.auth.getUser();
        console.log('👤 User ID:', user.id);
        
        rows.forEach(row => {
            const date = row.querySelector('.row-date').value;
            const celeb = row.querySelector('.row-celeb').value.trim();
            const item = row.querySelector('.row-item').value.trim();
            const amount = parseFloat(row.querySelector('.row-amount').value);

            console.log('📝 Row data:', { date, celeb, item, amount });

            if (celeb && !isNaN(amount) && amount > 0) {
                dataToInsert.push({
                    user_id: user.id,
                    date: date,
                    celebrity_name: celeb,
                    item_name: item,
                    amount: amount
                });
            }
        });

        console.log('📦 Data to insert:', dataToInsert);

        if (dataToInsert.length === 0) {
            console.log('⚠️ No valid data to insert');
            showToast("Please fill at least one complete row!", "error");
            return;
        }

        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving All...';

        const { data, error } = await window.db.from('tailor_expenses').insert(dataToInsert);
        console.log('✅ Insert response:', data);
        console.log('❌ Insert error:', error);
        
        if (error) throw error;

        showToast(`Successfully saved ${dataToInsert.length} entries!`, "success");
        
        document.getElementById('tailorExcelBody').innerHTML = '';
        addNewTailorRow();
        calculateLiveTotal();
        
        loadTailorSuggestions();

    } catch (err) {
        console.error('❌ Save error:', err);
        showToast("Error: " + err.message, "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Save All Entries';
    }
}

function showToast(message, type = "success") {
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toastMessage');
    const icon = toast.querySelector('i');
    
    if (type === "error") {
        icon.className = "fa-solid fa-circle-xmark";
        toast.style.background = "linear-gradient(135deg, #ef4444, #dc2626)";
    } else {
        icon.className = "fa-solid fa-circle-check";
        toast.style.background = "linear-gradient(135deg, #10b981, #059669)";
    }
    
    toastMsg.textContent = message;
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function calculateLiveTotal() {
    const amountInputs = document.querySelectorAll('.row-amount');
    let total = 0;
    
    amountInputs.forEach(input => {
        const val = parseFloat(input.value);
        if (!isNaN(val) && val > 0) {
            total += val;
        }
    });
    
    document.getElementById('liveEntryTotal').innerText = total.toLocaleString('en-IN', {minimumFractionDigits: 2});
}

window.addNewTailorRow = addNewTailorRow;
window.saveAllTailorEntries = saveAllTailorEntries;
window.calculateLiveTotal = calculateLiveTotal;

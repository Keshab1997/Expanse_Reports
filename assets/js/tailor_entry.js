document.addEventListener('DOMContentLoaded', async () => {
    await loadTailorSuggestions();
    const hasDraft = loadDraft();
    if (!hasDraft) {
        addNewTailorRow();
    }
    setupKeyboardNavigation();
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

function addNewTailorRow(shouldFocus = false, draftData = null) {
    const tbody = document.getElementById('tailorExcelBody');
    const row = document.createElement('tr');
    
    const dateVal = draftData ? draftData.date : new Date().toISOString().split('T')[0];
    const celebVal = draftData ? draftData.celeb : '';
    const itemVal = draftData ? draftData.item : '';
    const amountVal = draftData ? draftData.amount : '';

    row.innerHTML = `
        <td data-label="Date"><input type="date" class="excel-input row-date" value="${dateVal}"></td>
        <td data-label="Celebrity Name"><input type="text" class="excel-input row-celeb" list="celebList" placeholder="Type to search..." value="${celebVal}"></td>
        <td data-label="Item Name"><input type="text" class="excel-input row-item" list="itemList" placeholder="Type to search..." value="${itemVal}"></td>
        <td data-label="Amount"><input type="number" class="excel-input row-amount" placeholder="0.00" step="0.01" value="${amountVal}"></td>
        <td data-label="Action" style="text-align: center; vertical-align: middle;">
            <button onclick="removeTailorRow(this)" class="btn-del-row" title="Remove Row" aria-label="Remove row">
                <i class="fa-solid fa-trash-can"></i>
            </button>
        </td>
    `;
    tbody.appendChild(row);

    if (shouldFocus) {
        row.querySelector('.row-celeb').focus();
    }
    saveDraft();
}

function removeTailorRow(btn) {
    btn.closest('tr').remove();
    calculateLiveTotal();
    saveDraft();
    
    if (document.querySelectorAll('#tailorExcelBody tr').length === 0) {
        addNewTailorRow();
    }
}

document.getElementById('tailorExcelBody').addEventListener('input', (e) => {
    if (e.target.classList.contains('excel-input')) {
        calculateLiveTotal();
        saveDraft();
    }
});

function calculateLiveTotal() {
    const amountInputs = document.querySelectorAll('.row-amount');
    let total = 0;
    amountInputs.forEach(input => {
        const val = parseFloat(input.value);
        if (!isNaN(val) && val > 0) total += val;
    });
    document.getElementById('liveEntryTotal').innerText = total.toLocaleString('en-IN', {minimumFractionDigits: 2});
}

function saveDraft() {
    const rows = document.querySelectorAll('#tailorExcelBody tr');
    const draftData = [];
    rows.forEach(row => {
        draftData.push({
            date: row.querySelector('.row-date').value,
            celeb: row.querySelector('.row-celeb').value,
            item: row.querySelector('.row-item').value,
            amount: row.querySelector('.row-amount').value
        });
    });
    localStorage.setItem('tailor_entry_draft', JSON.stringify(draftData));
}

function loadDraft() {
    const draft = localStorage.getItem('tailor_entry_draft');
    if (draft) {
        const draftData = JSON.parse(draft);
        const hasData = draftData.some(d => d.celeb || d.item || d.amount);
        
        if (hasData) {
            const tbody = document.getElementById('tailorExcelBody');
            tbody.innerHTML = ''; 
            draftData.forEach(data => addNewTailorRow(false, data));
            calculateLiveTotal();
            return true;
        }
    }
    return false;
}

function setupKeyboardNavigation() {
    document.getElementById('tailorExcelBody').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            
            const currentInput = e.target;
            const row = currentInput.closest('tr');
            
            if (currentInput.classList.contains('row-date')) {
                row.querySelector('.row-celeb').focus();
            } else if (currentInput.classList.contains('row-celeb')) {
                row.querySelector('.row-item').focus();
            } else if (currentInput.classList.contains('row-item')) {
                row.querySelector('.row-amount').focus();
            } else if (currentInput.classList.contains('row-amount')) {
                addNewTailorRow(true);
            }
        }
    });
}

function resetTailorEntry() {
    if(confirm("Are you sure you want to clear all current entries?")) {
        localStorage.removeItem('tailor_entry_draft');
        document.getElementById('tailorExcelBody').innerHTML = '';
        addNewTailorRow();
        calculateLiveTotal();
        showToast("All entries cleared!", "success");
    }
}

async function saveAllTailorEntries() {
    const btn = document.getElementById('saveAllBtn');
    const rows = document.querySelectorAll('#tailorExcelBody tr');
    const dataToInsert = [];

    try {
        const { data: { user } } = await window.db.auth.getUser();
        
        rows.forEach(row => {
            const date = row.querySelector('.row-date').value;
            const celeb = row.querySelector('.row-celeb').value.trim();
            const item = row.querySelector('.row-item').value.trim();
            const amount = parseFloat(row.querySelector('.row-amount').value);

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

        if (dataToInsert.length === 0) {
            showToast("Please fill at least one complete row!", "error");
            return;
        }

        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving All...';

        const { error } = await window.db.from('tailor_expenses').insert(dataToInsert);
        if (error) throw error;

        showToast(`Successfully saved ${dataToInsert.length} entries!`, "success");
        
        localStorage.removeItem('tailor_entry_draft');
        document.getElementById('tailorExcelBody').innerHTML = '';
        addNewTailorRow();
        calculateLiveTotal();
        loadTailorSuggestions();

    } catch (err) {
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
    setTimeout(() => toast.classList.remove('show'), 3000);
}

window.addNewTailorRow = addNewTailorRow;
window.removeTailorRow = removeTailorRow;
window.saveAllTailorEntries = saveAllTailorEntries;
window.resetTailorEntry = resetTailorEntry;

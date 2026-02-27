let isSaving = false;

document.addEventListener('DOMContentLoaded', async () => {
    await loadTailorSuggestions();
    const hasDraft = loadDraft();
    if (!hasDraft) {
        addNewTailorRow();
    }
    setupKeyboardNavigation();
});

async function loadTailorSuggestions() {
    const normalize = (str) => {
        if (!str) return '';
        return str.trim().split(/\s+/).map(word => 
            word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join(' ');
    };
    
    try {
        const { data: { user } } = await window.db.auth.getUser();
        const { data: expenses } = await window.db
            .from('tailor_expenses')
            .select('celebrity_name, item_name')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(200);

        if (expenses) {
            const celebs = [...new Set(expenses.map(i => normalize(i.celebrity_name)).filter(Boolean))];
            const items = [...new Set(expenses.map(i => normalize(i.item_name)).filter(Boolean))];

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
        if (isSaving) {
            e.preventDefault();
            return;
        }

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
    if (isSaving) return;
    isSaving = true;

    const btn = document.getElementById('saveAllBtn');
    const rows = document.querySelectorAll('#tailorExcelBody tr');
    const dataToInsert = [];

    try {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Checking & Saving...';

        const { data: { user } } = await window.db.auth.getUser();
        
        const { data: existingData } = await window.db
            .from('tailor_expenses')
            .select('date, celebrity_name, item_name, amount')
            .eq('user_id', user.id);

        const existingSignatures = new Set(
            (existingData || []).map(d => `${d.date}_${d.celebrity_name.toLowerCase()}_${(d.item_name || '').toLowerCase()}_${d.amount}`)
        );

        const currentBatchSignatures = new Set();
        const currentTime = new Date().getTime();
        let index = 0;
        let duplicateCount = 0;

        rows.forEach(row => {
            const date = row.querySelector('.row-date').value;
            const celeb = row.querySelector('.row-celeb').value.trim();
            const item = row.querySelector('.row-item').value.trim();
            const amount = parseFloat(row.querySelector('.row-amount').value);

            if (celeb && !isNaN(amount) && amount > 0) {
                const normalize = (str) => {
                    if (!str) return '';
                    return str.trim().split(/\s+/).map(word => 
                        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
                    ).join(' ');
                };
                const normalizedCeleb = normalize(celeb);
                const normalizedItem = normalize(item);
                const signature = `${date}_${normalizedCeleb.toLowerCase()}_${normalizedItem.toLowerCase()}_${amount}`;

                if (existingSignatures.has(signature) || currentBatchSignatures.has(signature)) {
                    duplicateCount++;
                    // console.log("Duplicate skipped:", signature);
                } else {
                    currentBatchSignatures.add(signature);
                    
                    const exactTime = new Date(currentTime + index).toISOString();
                    dataToInsert.push({
                        user_id: user.id,
                        date: date,
                        celebrity_name: normalizedCeleb,
                        item_name: normalizedItem,
                        amount: amount,
                        created_at: exactTime
                    });
                    index++;
                }
            }
        });

        if (dataToInsert.length === 0) {
            if (duplicateCount > 0) {
                showToast(`${duplicateCount} Duplicate entries skipped!`, "error");
                localStorage.removeItem('tailor_entry_draft');
                document.getElementById('tailorExcelBody').innerHTML = '';
                addNewTailorRow();
                calculateLiveTotal();
            } else {
                showToast("Please fill at least one complete row!", "error");
            }
            isSaving = false;
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Save All Entries';
            return;
        }

        const { error } = await window.db.from('tailor_expenses').insert(dataToInsert);
        if (error) throw error;

        let msg = `Successfully saved ${dataToInsert.length} entries!`;
        if (duplicateCount > 0) {
            msg += ` (${duplicateCount} duplicates skipped)`;
        }
        showToast(msg, "success");
        
        localStorage.removeItem('tailor_entry_draft');
        document.getElementById('tailorExcelBody').innerHTML = '';
        addNewTailorRow();
        calculateLiveTotal();
        loadTailorSuggestions();

    } catch (err) {
        showToast("Error: " + err.message, "error");
    } finally {
        isSaving = false;
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

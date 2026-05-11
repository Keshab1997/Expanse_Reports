let recentExpenses = [];
let undoStack = [];
let redoStack = [];
const MAX_UNDO = 20;

function getSimilarity(s1, s2) {
    let longer = s1.toLowerCase();
    let shorter = s2.toLowerCase();
    if (s1.length < s2.length) {
        longer = s2.toLowerCase();
        shorter = s1.toLowerCase();
    }
    let longerLength = longer.length;
    if (longerLength === 0) return 1.0;
    return (longerLength - editDistance(longer, shorter)) / longerLength;
}

function editDistance(s1, s2) {
    let costs = [];
    for (let i = 0; i <= s1.length; i++) {
        let lastValue = i;
        for (let j = 0; j <= s2.length; j++) {
            if (i == 0) costs[j] = j;
            else {
                if (j > 0) {
                    let newValue = costs[j - 1];
                    if (s1.charAt(i - 1) != s2.charAt(j - 1))
                        newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
                    costs[j - 1] = lastValue;
                    lastValue = newValue;
                }
            }
        }
        if (i > 0) costs[s2.length] = lastValue;
    }
    return costs[s2.length];
}

function formatInput(el) {
    let val = el.value.trim();
    if (!val) return;
    
    const listId = el.getAttribute('list');
    if (!listId) {
        el.value = val.split(/\s+/).map(word => 
            word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join(' ');
        return;
    }

    const datalist = document.getElementById(listId);
    const options = Array.from(datalist.options).map(opt => opt.value);

    let bestMatch = null;
    let highestSimilarity = 0;

    options.forEach(option => {
        let similarity = getSimilarity(val, option);
        if (similarity > highestSimilarity) {
            highestSimilarity = similarity;
            bestMatch = option;
        }
    });

    if (highestSimilarity >= 0.8 && highestSimilarity < 1.0) {
        el.value = bestMatch;
        el.style.backgroundColor = "#d1fae5";
        setTimeout(() => el.style.backgroundColor = "", 800);
    } else {
        el.value = val.split(/\s+/).map(word => 
            word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join(' ');
    }
}

function checkConsistency(el) {
    const val = el.value;
    const listId = el.getAttribute('list');
    if (!listId) return;

    const datalist = document.getElementById(listId);
    const options = Array.from(datalist.options).map(opt => opt.value);

    if (val && !options.includes(val)) {
        const similar = options.find(opt => {
            const s1 = val.toLowerCase();
            const s2 = opt.toLowerCase();
            return s1 !== s2 && (s1.includes(s2.slice(0, -1)) || s2.includes(s1.slice(0, -1)));
        });
        
        if (similar) {
            el.style.borderColor = "#f59e0b";
            el.style.backgroundColor = "#fffbeb";
        } else {
            el.style.borderColor = "";
            el.style.backgroundColor = "";
        }
    } else {
        el.style.borderColor = "";
        el.style.backgroundColor = "";
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    await loadAllSuggestions();
    loadDraftEntries();
    saveStateToUndo(); // Initial state
    
    document.addEventListener('keydown', function(e) {
        // Enter key navigation
        if (e.key === 'Enter' && e.target.classList.contains('excel-input')) {
            e.preventDefault();
            const inputs = Array.from(document.querySelectorAll('.excel-input'));
            const index = inputs.indexOf(e.target);
            if (index > -1 && index < inputs.length - 1) {
                inputs[index + 1].focus();
            }
        }
        
        // Keyboard shortcuts (Ctrl/Cmd)
        if (e.ctrlKey || e.metaKey) {
            // Undo/Redo
            if (e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                undo();
            } else if (e.key === 'z' && e.shiftKey || e.key === 'y') {
                e.preventDefault();
                redo();
            }
            // Add new row
            else if (e.key === 'n') {
                e.preventDefault();
                addNewRow();
                showToast('➕ New row added', '#10b981');
            }
            // Quick save
            else if (e.key === 's') {
                e.preventDefault();
                saveAllEntries();
            }
            // Duplicate last row
            else if (e.key === 'd') {
                e.preventDefault();
                duplicateLastRow();
            }
            // Clear all
            else if (e.key === 'k') {
                e.preventDefault();
                clearAllRows();
            }
        }
        
        // Arrow key navigation (like Excel)
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && e.target.classList.contains('excel-input')) {
            navigateWithArrows(e);
        }
    });
});

async function loadAllSuggestions() {
    const cacheKey = 'global_suggestions';
    
    // ক্যাশ থেকে সাজেশন দেখানো (Instant Load)
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
        renderDatalists(JSON.parse(cached));
        hideLoader(); // ক্যাশ পেলেই লোডার বন্ধ
    }

    // ব্যাকগ্রাউন্ডে লেটেস্ট সাজেশন আপডেট করা
    try {
        const { data: { user } } = await window.db.auth.getUser();
        const { data: expenses } = await window.db
            .from('expenses')
            .select('category, paid_by, payee, purpose')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(300);

        if (expenses) {
            recentExpenses = expenses;
            localStorage.setItem(cacheKey, JSON.stringify(expenses));
            renderDatalists(expenses);
        }
    } catch (err) { 
        // Silent fail
    } finally { 
        hideLoader(); 
    }
}

function renderDatalists(expenses) {
    const normalize = (str) => {
        if (!str) return '';
        return str.trim().split(/\s+/).map(word => 
            word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join(' ');
    };
    
    const updateList = (id, key) => {
        const list = [...new Set(expenses.map(i => {
            const val = i[key];
            if (!val) return null;
            return normalize(val);
        }))].filter(Boolean);
        const dl = document.getElementById(id);
        if (dl) dl.innerHTML = list.map(v => `<option value="${v}">`).join('');
    };

    updateList('catList', 'category');
    updateList('sourceList', 'paid_by');
    updateList('payeeList', 'payee');
    updateList('purposeList', 'purpose');
}

function hideLoader() {
    const loader = document.getElementById('globalLoader');
    if (loader) loader.style.display = 'none';
}

// ১. নতুন রো যোগ করার ফাংশন
function addNewRow() {
    const tbody = document.getElementById('excelTableBody');
    const row = document.createElement('tr');
    const today = new Date().toISOString().split('T')[0];
    const rowNumber = tbody.children.length + 1;

    row.innerHTML = `
        <td class="row-number" data-label="#">${rowNumber}</td>
        <td data-label="Date"><input type="date" class="excel-input row-date" value="${today}" onchange="saveDraft(); checkTodayHighlight(this); saveStateToUndo();" data-today="${today}"></td>
        <td data-label="Category"><input type="text" class="excel-input row-category" list="catList" placeholder="Category..." onblur="formatInput(this); saveStateToUndo();" oninput="saveDraft()"></td>
        <td data-label="Paid By"><input type="text" class="excel-input row-source" list="sourceList" placeholder="Paid by..." onblur="formatInput(this); saveStateToUndo();" oninput="saveDraft()"></td>
        <td data-label="Payee"><input type="text" class="excel-input row-payee" list="payeeList" placeholder="Payee..." onblur="formatInput(this); saveStateToUndo();" oninput="saveDraft()"></td>
        <td data-label="Purpose"><input type="text" class="excel-input row-purpose" list="purposeList" placeholder="Purpose..." oninput="handleAutoFill(this); saveDraft();" onblur="formatInput(this); saveStateToUndo();"></td>
        <td data-label="Amount"><input type="number" class="excel-input row-amount" placeholder="0.00" oninput="updateTotal(); saveDraft(); formatAmountDisplay(this);" onblur="formatAmountDisplay(this); saveStateToUndo();"></td>
        <td data-label="Status">
            <select class="excel-input row-status" onchange="saveDraft(); saveStateToUndo();">
                <option value="Paid">Paid</option>
                <option value="Unpaid">Unpaid</option>
            </select>
        </td>
        <td data-label="Action" style="text-align: center; vertical-align: middle;">
            <button onclick="deleteRow(this);" class="btn-del-row" title="Remove Row">
                <i class="fa-solid fa-trash-can"></i>
            </button>
        </td>
    `;
    tbody.appendChild(row);
    checkTodayHighlight(row.querySelector('.row-date'));
    saveStateToUndo();
}

// ২. অটো-ফিল লজিক (স্পেসিফিক রো এর জন্য)
function handleAutoFill(input) {
    const purpose = input.value.trim();
    if (!purpose) return;

    const match = recentExpenses.find(item => item.purpose === purpose);
    if (match) {
        const row = input.closest('tr');
        row.querySelector('.row-category').value = match.category || '';
        row.querySelector('.row-source').value = match.paid_by || '';
        row.querySelector('.row-payee').value = match.payee || '';
        
        // ভিজ্যুয়াল ফিডব্যাক
        row.style.backgroundColor = "#f0f9ff";
        setTimeout(() => row.style.backgroundColor = "transparent", 1000);
    }
}

// ৩. সব রো একসাথে সেভ করা (batch insert - no row limit)
async function saveAllEntries() {
    const btn = document.getElementById('saveAllBtn');
    const rows = document.querySelectorAll('#excelTableBody tr');
    const dataToInsert = [];
    const invalidRows = [];
    const normalize = (str) => str ? str.trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ') : '';

    try {
        const { data: { user } } = await window.db.auth.getUser();
        
        rows.forEach((row, index) => {
            const amount = parseFloat(row.querySelector('.row-amount').value);
            const category = row.querySelector('.row-category').value.trim();
            const payee = row.querySelector('.row-payee').value.trim();
            
            // Validate amount
            if (isNaN(amount) || amount <= 0) {
                if (category || payee) {
                    invalidRows.push(index + 1);
                    row.style.backgroundColor = '#fee2e2';
                }
                return;
            }
            
            if (category && payee && amount > 0) {
                dataToInsert.push({
                    date: row.querySelector('.row-date').value,
                    category: normalize(category),
                    paid_by: normalize(row.querySelector('.row-source').value.trim()),
                    payee: normalize(payee),
                    purpose: normalize(row.querySelector('.row-purpose').value.trim()),
                    amount: amount,
                    status: row.querySelector('.row-status').value,
                    user_id: user.id
                });
                row.style.backgroundColor = '';
            }
        });

        if (invalidRows.length > 0) {
            const proceed = confirm(`⚠️ Warning: Row(s) ${invalidRows.join(', ')} have invalid amounts (zero or negative).\n\nThese rows will be skipped.\n\nDo you want to continue saving valid entries?`);
            if (!proceed) return;
        }

        if (dataToInsert.length === 0) {
            alert("❌ No valid entries to save!\n\nPlease ensure:\n• Category is filled\n• Payee is filled\n• Amount is greater than zero");
            return;
        }

        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

        if (!navigator.onLine) {
            dataToInsert.forEach(item => window.offlineManager.saveToOfflineQueue(item));
            alert(`📴 Offline: ${dataToInsert.length} entries saved locally. Will sync when online.`);
            document.getElementById('excelTableBody').innerHTML = '';
            clearDraft();
            addNewRow();
            return;
        }

        // Batch insert in chunks of 50 to avoid any server limits
        const CHUNK = 50;
        for (let i = 0; i < dataToInsert.length; i += CHUNK) {
            const chunk = dataToInsert.slice(i, i + CHUNK);
            const { error } = await window.db.from('expenses').insert(chunk);
            if (error) throw error;
        }

        alert(`✅ Successfully saved ${dataToInsert.length} entries!${invalidRows.length > 0 ? `\n\n⚠️ ${invalidRows.length} row(s) were skipped due to invalid amounts.` : ''}`);
        document.getElementById('excelTableBody').innerHTML = '';
        clearDraft();
        addNewRow();
        loadAllSuggestions();

    } catch (err) {
        alert("Error: " + err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Save All Entries';
    }
}

// ৪. Excel ফাইল import করে rows populate করা
function importFromExcel(input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const workbook = XLSX.read(e.target.result, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

        // Find header row (DATE, CATEGORY, etc.) — skip blank rows at top
        let headerIdx = -1;
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i].map(c => String(c).trim().toUpperCase());
            if (row.includes('DATE') && row.includes('AMOUNT')) {
                headerIdx = i;
                break;
            }
        }
        if (headerIdx === -1) { alert('Header row not found! Expected: DATE, CATEGORY, PAID BY, PAYEE, PURPOSE, AMOUNT, STATUS'); return; }

        const headers = rows[headerIdx].map(c => String(c).trim().toUpperCase());
        const colIdx = {
            date:     headers.indexOf('DATE'),
            category: headers.indexOf('CATEGORY'),
            paidBy:   headers.indexOf('PAID BY'),
            payee:    headers.indexOf('PAYEE'),
            purpose:  headers.indexOf('PURPOSE'),
            amount:   headers.indexOf('AMOUNT'),
            status:   headers.indexOf('STATUS')
        };

        const dataRows = rows.slice(headerIdx + 1).filter(r => r.some(c => c !== ''));
        if (dataRows.length === 0) { alert('No data rows found!'); return; }

        // Clear existing rows and populate from Excel
        document.getElementById('excelTableBody').innerHTML = '';
        dataRows.forEach((row, i) => {
            const tbody = document.getElementById('excelTableBody');
            const tr = document.createElement('tr');

            // Parse date — handle DD/MM/YYYY or Excel serial number
            let dateVal = '';
            const rawDate = row[colIdx.date];
            if (typeof rawDate === 'number') {
                // Excel serial date
                const d = new Date(Math.round((rawDate - 25569) * 86400 * 1000));
                dateVal = d.toISOString().split('T')[0];
            } else if (rawDate) {
                const parts = String(rawDate).split('/');
                if (parts.length === 3) {
                    // DD/MM/YYYY → YYYY-MM-DD
                    dateVal = `${parts[2].padStart(4,'0')}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
                } else {
                    dateVal = String(rawDate);
                }
            }

            const status = String(row[colIdx.status] || 'Paid').trim();
            const amount = parseFloat(row[colIdx.amount]) || '';

            tr.innerHTML = `
                <td class="row-number" data-label="#">${i + 1}</td>
                <td data-label="Date"><input type="date" class="excel-input row-date" value="${dateVal}" onchange="saveDraft(); checkTodayHighlight(this);" data-today="${new Date().toISOString().split('T')[0]}"></td>
                <td data-label="Category"><input type="text" class="excel-input row-category" list="catList" value="${row[colIdx.category] || ''}" onblur="formatInput(this)" oninput="saveDraft()"></td>
                <td data-label="Paid By"><input type="text" class="excel-input row-source" list="sourceList" value="${row[colIdx.paidBy] || ''}" onblur="formatInput(this)" oninput="saveDraft()"></td>
                <td data-label="Payee"><input type="text" class="excel-input row-payee" list="payeeList" value="${row[colIdx.payee] || ''}" onblur="formatInput(this)" oninput="saveDraft()"></td>
                <td data-label="Purpose"><input type="text" class="excel-input row-purpose" list="purposeList" value="${row[colIdx.purpose] || ''}" onblur="formatInput(this)" oninput="saveDraft()"></td>
                <td data-label="Amount"><input type="number" class="excel-input row-amount" value="${amount}" oninput="updateTotal(); saveDraft(); formatAmountDisplay(this);" onblur="formatAmountDisplay(this);"></td>
                <td data-label="Status">
                    <select class="excel-input row-status" onchange="saveDraft()">
                        <option value="Paid" ${status === 'Paid' ? 'selected' : ''}>Paid</option>
                        <option value="Unpaid" ${status === 'Unpaid' ? 'selected' : ''}>Unpaid</option>
                    </select>
                </td>
                <td data-label="Action" style="text-align:center;vertical-align:middle;">
                    <button onclick="deleteRow(this);" class="btn-del-row" title="Remove Row">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
            checkTodayHighlight(tr.querySelector('.row-date'));
        });

        updateTotal();
        alert(`✅ ${dataRows.length} rows imported from Excel! Review and click "Save All Entries".`);
        input.value = ''; // Reset file input
    };
    reader.readAsArrayBuffer(file);
}

// Total Amount Calculation
function updateTotal() {
    const amounts = document.querySelectorAll('.row-amount');
    let total = 0;
    amounts.forEach(input => {
        const val = parseFloat(input.value) || 0;
        total += val;
    });
    const formatted = formatIndianCurrency(total);
    document.getElementById('totalAmount').textContent = formatted;
}

// Draft Save/Load Functions
function saveDraft() {
    const rows = document.querySelectorAll('#excelTableBody tr');
    const draft = [];
    rows.forEach(row => {
        draft.push({
            date: row.querySelector('.row-date').value,
            category: row.querySelector('.row-category').value,
            source: row.querySelector('.row-source').value,
            payee: row.querySelector('.row-payee').value,
            purpose: row.querySelector('.row-purpose').value,
            amount: row.querySelector('.row-amount').value,
            status: row.querySelector('.row-status').value
        });
    });
    localStorage.setItem('entry_draft', JSON.stringify(draft));
}

function loadDraftEntries() {
    const draft = localStorage.getItem('entry_draft');
    if (draft) {
        const data = JSON.parse(draft);
        if (data.length > 0) {
            const today = new Date().toISOString().split('T')[0];
            data.forEach((item, i) => {
                const tbody = document.getElementById('excelTableBody');
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td class="row-number" data-label="#">${i + 1}</td>
                    <td data-label="Date"><input type="date" class="excel-input row-date" value="${item.date}" onchange="saveDraft(); checkTodayHighlight(this);" data-today="${today}"></td>
                    <td data-label="Category"><input type="text" class="excel-input row-category" list="catList" value="${item.category}" onblur="formatInput(this)" oninput="saveDraft()"></td>
                    <td data-label="Paid By"><input type="text" class="excel-input row-source" list="sourceList" value="${item.source}" onblur="formatInput(this)" oninput="saveDraft()"></td>
                    <td data-label="Payee"><input type="text" class="excel-input row-payee" list="payeeList" value="${item.payee}" onblur="formatInput(this)" oninput="saveDraft()"></td>
                    <td data-label="Purpose"><input type="text" class="excel-input row-purpose" list="purposeList" value="${item.purpose}" oninput="handleAutoFill(this); saveDraft();" onblur="formatInput(this)"></td>
                    <td data-label="Amount"><input type="number" class="excel-input row-amount" value="${item.amount}" oninput="updateTotal(); saveDraft(); formatAmountDisplay(this);" onblur="formatAmountDisplay(this);"></td>
                    <td data-label="Status">
                        <select class="excel-input row-status" onchange="saveDraft()">
                            <option value="Paid" ${item.status === 'Paid' ? 'selected' : ''}>Paid</option>
                            <option value="Unpaid" ${item.status === 'Unpaid' ? 'selected' : ''}>Unpaid</option>
                        </select>
                    </td>
                    <td data-label="Action" style="text-align:center;vertical-align:middle;">
                        <button onclick="deleteRow(this);" class="btn-del-row" title="Remove Row">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </td>
                `;
                tbody.appendChild(tr);
                checkTodayHighlight(tr.querySelector('.row-date'));
            });
            updateTotal();
        } else {
            addNewRow();
        }
    } else {
        addNewRow();
    }
}

function clearDraft() {
    localStorage.removeItem('entry_draft');
}

function clearAllRows() {
    if (confirm('Are you sure you want to clear all rows? This will delete all unsaved data.')) {
        saveStateToUndo();
        document.getElementById('excelTableBody').innerHTML = '';
        clearDraft();
        addNewRow();
        updateTotal();
    }
}

// Delete row with undo support
function deleteRow(btn) {
    saveStateToUndo();
    btn.closest('tr').remove();
    updateTotal();
    saveDraft();
    updateRowNumbers();
}

// Undo/Redo Functions
function saveStateToUndo() {
    const rows = document.querySelectorAll('#excelTableBody tr');
    const state = [];
    rows.forEach(row => {
        state.push({
            date: row.querySelector('.row-date')?.value || '',
            category: row.querySelector('.row-category')?.value || '',
            source: row.querySelector('.row-source')?.value || '',
            payee: row.querySelector('.row-payee')?.value || '',
            purpose: row.querySelector('.row-purpose')?.value || '',
            amount: row.querySelector('.row-amount')?.value || '',
            status: row.querySelector('.row-status')?.value || 'Paid'
        });
    });
    
    // Only save if state changed
    const lastState = undoStack[undoStack.length - 1];
    if (JSON.stringify(state) !== JSON.stringify(lastState)) {
        undoStack.push(state);
        if (undoStack.length > MAX_UNDO) undoStack.shift();
        redoStack = []; // Clear redo stack on new action
        updateUndoRedoButtons();
    }
}

function undo() {
    if (undoStack.length <= 1) {
        showToast('⚠️ Nothing to undo', '#f59e0b');
        return;
    }
    
    const currentState = undoStack.pop();
    redoStack.push(currentState);
    
    const previousState = undoStack[undoStack.length - 1];
    restoreState(previousState);
    updateUndoRedoButtons();
    showToast('↩️ Undo successful', '#3b82f6');
}

function redo() {
    if (redoStack.length === 0) {
        showToast('⚠️ Nothing to redo', '#f59e0b');
        return;
    }
    
    const state = redoStack.pop();
    undoStack.push(state);
    restoreState(state);
    updateUndoRedoButtons();
    showToast('↪️ Redo successful', '#3b82f6');
}

function restoreState(state) {
    const tbody = document.getElementById('excelTableBody');
    tbody.innerHTML = '';
    
    if (state.length === 0) {
        addNewRow();
    } else {
        const today = new Date().toISOString().split('T')[0];
        state.forEach((item, i) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="row-number" data-label="#">${i + 1}</td>
                <td data-label="Date"><input type="date" class="excel-input row-date" value="${item.date}" onchange="saveDraft(); checkTodayHighlight(this); saveStateToUndo();" data-today="${today}"></td>
                <td data-label="Category"><input type="text" class="excel-input row-category" list="catList" value="${item.category}" onblur="formatInput(this); saveStateToUndo();" oninput="saveDraft()"></td>
                <td data-label="Paid By"><input type="text" class="excel-input row-source" list="sourceList" value="${item.source}" onblur="formatInput(this); saveStateToUndo();" oninput="saveDraft()"></td>
                <td data-label="Payee"><input type="text" class="excel-input row-payee" list="payeeList" value="${item.payee}" onblur="formatInput(this); saveStateToUndo();" oninput="saveDraft()"></td>
                <td data-label="Purpose"><input type="text" class="excel-input row-purpose" list="purposeList" value="${item.purpose}" oninput="handleAutoFill(this); saveDraft();" onblur="formatInput(this); saveStateToUndo();"></td>
                <td data-label="Amount"><input type="number" class="excel-input row-amount" value="${item.amount}" oninput="updateTotal(); saveDraft(); formatAmountDisplay(this);" onblur="formatAmountDisplay(this); saveStateToUndo();"></td>
                <td data-label="Status">
                    <select class="excel-input row-status" onchange="saveDraft(); saveStateToUndo();">
                        <option value="Paid" ${item.status === 'Paid' ? 'selected' : ''}>Paid</option>
                        <option value="Unpaid" ${item.status === 'Unpaid' ? 'selected' : ''}>Unpaid</option>
                    </select>
                </td>
                <td data-label="Action" style="text-align:center;vertical-align:middle;">
                    <button onclick="deleteRow(this);" class="btn-del-row" title="Remove Row">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
            checkTodayHighlight(tr.querySelector('.row-date'));
        });
    }
    
    updateTotal();
    saveDraft();
}

function updateUndoRedoButtons() {
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');
    
    if (undoBtn) {
        undoBtn.disabled = undoStack.length <= 1;
        undoBtn.style.opacity = undoStack.length <= 1 ? '0.5' : '1';
    }
    if (redoBtn) {
        redoBtn.disabled = redoStack.length === 0;
        redoBtn.style.opacity = redoStack.length === 0 ? '0.5' : '1';
    }
}

function showToast(message, color = '#10b981') {
    const toast = document.getElementById('toast');
    if (toast) {
        toast.textContent = message;
        toast.style.backgroundColor = color;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 2000);
    }
}

// Duplicate last row
function duplicateLastRow() {
    const tbody = document.getElementById('excelTableBody');
    const rows = tbody.querySelectorAll('tr');
    
    if (rows.length === 0) {
        showToast('⚠️ No row to duplicate', '#f59e0b');
        return;
    }
    
    const lastRow = rows[rows.length - 1];
    const today = new Date().toISOString().split('T')[0];
    const rowNumber = rows.length + 1;
    
    const newRow = document.createElement('tr');
    newRow.innerHTML = `
        <td class="row-number" data-label="#">${rowNumber}</td>
        <td data-label="Date"><input type="date" class="excel-input row-date" value="${today}" onchange="saveDraft(); checkTodayHighlight(this); saveStateToUndo();" data-today="${today}"></td>
        <td data-label="Category"><input type="text" class="excel-input row-category" list="catList" value="${lastRow.querySelector('.row-category').value}" placeholder="Category..." onblur="formatInput(this); saveStateToUndo();" oninput="saveDraft()"></td>
        <td data-label="Paid By"><input type="text" class="excel-input row-source" list="sourceList" value="${lastRow.querySelector('.row-source').value}" placeholder="Paid by..." onblur="formatInput(this); saveStateToUndo();" oninput="saveDraft()"></td>
        <td data-label="Payee"><input type="text" class="excel-input row-payee" list="payeeList" value="${lastRow.querySelector('.row-payee').value}" placeholder="Payee..." onblur="formatInput(this); saveStateToUndo();" oninput="saveDraft()"></td>
        <td data-label="Purpose"><input type="text" class="excel-input row-purpose" list="purposeList" value="${lastRow.querySelector('.row-purpose').value}" placeholder="Purpose..." oninput="handleAutoFill(this); saveDraft();" onblur="formatInput(this); saveStateToUndo();"></td>
        <td data-label="Amount"><input type="number" class="excel-input row-amount" value="" placeholder="0.00" oninput="updateTotal(); saveDraft(); formatAmountDisplay(this);" onblur="formatAmountDisplay(this); saveStateToUndo();"></td>
        <td data-label="Status">
            <select class="excel-input row-status" onchange="saveDraft(); saveStateToUndo();">
                <option value="Paid" ${lastRow.querySelector('.row-status').value === 'Paid' ? 'selected' : ''}>Paid</option>
                <option value="Unpaid" ${lastRow.querySelector('.row-status').value === 'Unpaid' ? 'selected' : ''}>Unpaid</option>
            </select>
        </td>
        <td data-label="Action" style="text-align: center; vertical-align: middle;">
            <button onclick="deleteRow(this);" class="btn-del-row" title="Remove Row">
                <i class="fa-solid fa-trash-can"></i>
            </button>
        </td>
    `;
    
    tbody.appendChild(newRow);
    checkTodayHighlight(newRow.querySelector('.row-date'));
    saveStateToUndo();
    saveDraft();
    
    // Focus on amount field of new row
    newRow.querySelector('.row-amount').focus();
    showToast('📋 Row duplicated', '#10b981');
}

// Arrow key navigation (Excel-like)
function navigateWithArrows(e) {
    const currentInput = e.target;
    const currentRow = currentInput.closest('tr');
    const currentCell = currentInput.closest('td');
    const cellIndex = Array.from(currentRow.children).indexOf(currentCell);
    
    let targetRow, targetCell;
    
    switch(e.key) {
        case 'ArrowUp':
            e.preventDefault();
            targetRow = currentRow.previousElementSibling;
            if (targetRow) {
                targetCell = targetRow.children[cellIndex];
                const input = targetCell?.querySelector('.excel-input');
                if (input) input.focus();
            }
            break;
            
        case 'ArrowDown':
            e.preventDefault();
            targetRow = currentRow.nextElementSibling;
            if (targetRow) {
                targetCell = targetRow.children[cellIndex];
                const input = targetCell?.querySelector('.excel-input');
                if (input) input.focus();
            }
            break;
            
        case 'ArrowLeft':
            if (currentInput.selectionStart === 0) {
                e.preventDefault();
                const prevCell = currentCell.previousElementSibling;
                if (prevCell && !prevCell.classList.contains('row-number')) {
                    const input = prevCell.querySelector('.excel-input');
                    if (input) input.focus();
                }
            }
            break;
            
        case 'ArrowRight':
            if (currentInput.selectionStart === currentInput.value.length) {
                e.preventDefault();
                const nextCell = currentCell.nextElementSibling;
                if (nextCell) {
                    const input = nextCell.querySelector('.excel-input');
                    if (input) input.focus();
                }
            }
            break;
    }
}

// Bulk add rows with data fill
function bulkAddRows() {
    const count = parseInt(document.getElementById('bulkRowCount').value);
    
    if (!count || count < 1 || count > 100) {
        showToast('⚠️ Enter valid number (1-100)', '#f59e0b');
        return;
    }
    
    const tbody = document.getElementById('excelTableBody');
    const rows = tbody.querySelectorAll('tr');
    
    if (rows.length === 0) {
        showToast('⚠️ Add at least one row first', '#f59e0b');
        return;
    }
    
    const lastRow = rows[rows.length - 1];
    const today = new Date().toISOString().split('T')[0];
    
    // Get template data from last row
    const templateData = {
        category: lastRow.querySelector('.row-category').value,
        source: lastRow.querySelector('.row-source').value,
        payee: lastRow.querySelector('.row-payee').value,
        purpose: lastRow.querySelector('.row-purpose').value,
        status: lastRow.querySelector('.row-status').value
    };
    
    saveStateToUndo();
    
    for (let i = 0; i < count; i++) {
        const rowNumber = rows.length + i + 1;
        const newRow = document.createElement('tr');
        
        newRow.innerHTML = `
            <td class="row-number" data-label="#">${rowNumber}</td>
            <td data-label="Date"><input type="date" class="excel-input row-date" value="${today}" onchange="saveDraft(); checkTodayHighlight(this); saveStateToUndo();" data-today="${today}"></td>
            <td data-label="Category"><input type="text" class="excel-input row-category" list="catList" value="${templateData.category}" placeholder="Category..." onblur="formatInput(this); saveStateToUndo();" oninput="saveDraft()"></td>
            <td data-label="Paid By"><input type="text" class="excel-input row-source" list="sourceList" value="${templateData.source}" placeholder="Paid by..." onblur="formatInput(this); saveStateToUndo();" oninput="saveDraft()"></td>
            <td data-label="Payee"><input type="text" class="excel-input row-payee" list="payeeList" value="${templateData.payee}" placeholder="Payee..." onblur="formatInput(this); saveStateToUndo();" oninput="saveDraft()"></td>
            <td data-label="Purpose"><input type="text" class="excel-input row-purpose" list="purposeList" value="${templateData.purpose}" placeholder="Purpose..." oninput="handleAutoFill(this); saveDraft();" onblur="formatInput(this); saveStateToUndo();"></td>
            <td data-label="Amount"><input type="number" class="excel-input row-amount" value="" placeholder="0.00" oninput="updateTotal(); saveDraft(); formatAmountDisplay(this);" onblur="formatAmountDisplay(this); saveStateToUndo();"></td>
            <td data-label="Status">
                <select class="excel-input row-status" onchange="saveDraft(); saveStateToUndo();">
                    <option value="Paid" ${templateData.status === 'Paid' ? 'selected' : ''}>Paid</option>
                    <option value="Unpaid" ${templateData.status === 'Unpaid' ? 'selected' : ''}>Unpaid</option>
                </select>
            </td>
            <td data-label="Action" style="text-align: center; vertical-align: middle;">
                <button onclick="deleteRow(this);" class="btn-del-row" title="Remove Row">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </td>
        `;
        
        tbody.appendChild(newRow);
        checkTodayHighlight(newRow.querySelector('.row-date'));
    }
    
    saveDraft();
    updateTotal();
    document.getElementById('bulkRowCount').value = '';
    showToast(`✅ ${count} rows added with template data`, '#10b981');
}

// Update row numbers after delete
function updateRowNumbers() {
    const rows = document.querySelectorAll('#excelTableBody tr');
    rows.forEach((row, index) => {
        const rowNumCell = row.querySelector('.row-number');
        if (rowNumCell) rowNumCell.textContent = index + 1;
    });
}

// Check if date is today and highlight
function checkTodayHighlight(input) {
    const today = new Date().toISOString().split('T')[0];
    if (input.value === today) {
        input.classList.add('today-highlight');
    } else {
        input.classList.remove('today-highlight');
    }
}

// Format amount with comma (visual only)
function formatAmountDisplay(input) {
    const val = parseFloat(input.value);
    
    // Validate amount
    if (input.value && (isNaN(val) || val <= 0)) {
        // Invalid amount - show error
        input.style.borderColor = '#ef4444';
        input.style.backgroundColor = '#fee2e2';
        input.style.fontWeight = '600';
        input.style.color = '#dc2626';
        
        if (val < 0) {
            showToast('⚠️ Amount cannot be negative', '#ef4444');
        } else if (val === 0) {
            showToast('⚠️ Amount cannot be zero', '#f59e0b');
        }
    } else if (!isNaN(val) && val > 0) {
        // Valid amount - show success with comma formatting
        input.style.borderColor = '#10b981';
        input.style.backgroundColor = '#d1fae5';
        input.style.fontWeight = '600';
        input.style.color = '#059669';
        
        // Format with commas (Indian numbering system)
        const formatted = formatIndianCurrency(val);
        input.setAttribute('data-formatted', formatted);
        
        // Check for unusually high amount (over 100,000)
        if (val > 100000) {
            input.style.borderColor = '#f59e0b';
            input.style.backgroundColor = '#fef3c7';
            showToast('⚠️ Unusually high amount! Please verify', '#f59e0b');
        }
    } else {
        // Empty field - reset
        input.style.borderColor = '';
        input.style.backgroundColor = '';
        input.style.fontWeight = 'normal';
        input.style.color = 'inherit';
        input.removeAttribute('data-formatted');
    }
}

// Format number in Indian currency style (₹1,00,000.00)
function formatIndianCurrency(num) {
    const parts = num.toFixed(2).split('.');
    const integerPart = parts[0];
    const decimalPart = parts[1];
    
    // Indian numbering: last 3 digits, then groups of 2
    let lastThree = integerPart.substring(integerPart.length - 3);
    let otherNumbers = integerPart.substring(0, integerPart.length - 3);
    
    if (otherNumbers !== '') {
        lastThree = ',' + lastThree;
    }
    
    const formatted = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + lastThree;
    return '₹' + formatted + '.' + decimalPart;
}

// Make functions globally available
window.addNewRow = addNewRow;
window.handleAutoFill = handleAutoFill;
window.saveAllEntries = saveAllEntries;
window.formatInput = formatInput;
window.importFromExcel = importFromExcel;
window.updateTotal = updateTotal;
window.saveDraft = saveDraft;
window.loadDraftEntries = loadDraftEntries;
window.clearDraft = clearDraft;
window.clearAllRows = clearAllRows;
window.updateRowNumbers = updateRowNumbers;
window.checkTodayHighlight = checkTodayHighlight;
window.formatAmountDisplay = formatAmountDisplay;
window.deleteRow = deleteRow;
window.undo = undo;
window.redo = redo;
window.saveStateToUndo = saveStateToUndo;
window.duplicateLastRow = duplicateLastRow;
window.navigateWithArrows = navigateWithArrows;
window.bulkAddRows = bulkAddRows;
window.formatIndianCurrency = formatIndianCurrency;
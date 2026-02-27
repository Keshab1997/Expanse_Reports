let recentExpenses = [];

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
    addNewRow();
    
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && e.target.classList.contains('excel-input')) {
            e.preventDefault();
            const inputs = Array.from(document.querySelectorAll('.excel-input'));
            const index = inputs.indexOf(e.target);
            if (index > -1 && index < inputs.length - 1) {
                inputs[index + 1].focus();
            }
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

    row.innerHTML = `
        <td data-label="Date"><input type="date" class="excel-input row-date" value="${today}"></td>
        <td data-label="Category"><input type="text" class="excel-input row-category" list="catList" placeholder="Category..." onblur="formatInput(this)"></td>
        <td data-label="Paid By"><input type="text" class="excel-input row-source" list="sourceList" placeholder="Paid by..." onblur="formatInput(this)"></td>
        <td data-label="Payee"><input type="text" class="excel-input row-payee" list="payeeList" placeholder="Payee..." onblur="formatInput(this)"></td>
        <td data-label="Purpose"><input type="text" class="excel-input row-purpose" list="purposeList" placeholder="Purpose..." oninput="handleAutoFill(this)" onblur="formatInput(this)"></td>
        <td data-label="Amount"><input type="number" class="excel-input row-amount" placeholder="0.00"></td>
        <td data-label="Status">
            <select class="excel-input row-status">
                <option value="Paid">Paid</option>
                <option value="Unpaid">Unpaid</option>
            </select>
        </td>
        <td data-label="Action" style="text-align: center; vertical-align: middle;">
            <button onclick="this.closest('tr').remove()" class="btn-del-row" title="Remove Row">
                <i class="fa-solid fa-trash-can"></i>
            </button>
        </td>
    `;
    tbody.appendChild(row);
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

// ৩. সব রো একসাথে সেভ করা
async function saveAllEntries() {
    const btn = document.getElementById('saveAllBtn');
    const rows = document.querySelectorAll('#excelTableBody tr');
    const dataToInsert = [];

    try {
        const { data: { user } } = await window.db.auth.getUser();
        
        rows.forEach(row => {
            const amount = parseFloat(row.querySelector('.row-amount').value);
            const category = row.querySelector('.row-category').value.trim();
            const payee = row.querySelector('.row-payee').value.trim();

            if (category && payee && !isNaN(amount)) {
                const normalize = (str) => {
                    if (!str) return '';
                    return str.trim().split(/\s+/).map(word => 
                        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
                    ).join(' ');
                };
                
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
            }
        });

        if (dataToInsert.length === 0) {
            alert("Please fill at least one complete row!");
            return;
        }

        btn.disabled = true;
        btn.innerText = "Saving All...";

        // Check if online
        if (!navigator.onLine) {
            // Save to offline queue
            dataToInsert.forEach(item => window.offlineManager.saveToOfflineQueue(item));
            alert(`📴 Offline: ${dataToInsert.length} entries saved locally. Will sync when online.`);
            document.getElementById('excelTableBody').innerHTML = '';
            addNewRow();
            return;
        }

        const { error } = await window.db.from('expenses').insert(dataToInsert);
        if (error) throw error;

        alert(`✅ Successfully saved ${dataToInsert.length} entries!`);
        document.getElementById('excelTableBody').innerHTML = '';
        addNewRow();
        loadAllSuggestions();

    } catch (err) {
        alert("Error: " + err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Save All Entries';
    }
}
// Make functions globally available
window.addNewRow = addNewRow;
window.handleAutoFill = handleAutoFill;
window.saveAllEntries = saveAllEntries;
window.formatInput = formatInput;
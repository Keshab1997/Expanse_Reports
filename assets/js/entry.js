document.addEventListener('DOMContentLoaded', async () => {
    console.log("🚀 Entry Page Loaded");

    const dateInput = document.getElementById('date');
    if (dateInput) dateInput.valueAsDate = new Date();

    // সাজেশন লোড করা
    loadAllSuggestions();
});

async function loadAllSuggestions() {
    try {
        const { data: { user } } = await window.db.auth.getUser();
        if (!user) return;

        const { data: expenses } = await window.db
            .from('expenses')
            .select('category, paid_by, payee, purpose')
            .eq('user_id', user.id)
            .limit(500);

        if (expenses) {
            const updateList = (id, key) => {
                const list = [...new Set(expenses.map(i => i[key]))].filter(Boolean);
                const dl = document.getElementById(id);
                if (dl) dl.innerHTML = list.map(v => `<option value="${v}">`).join('');
            };

            updateList('catList', 'category');
            updateList('sourceList', 'paid_by');
            updateList('payeeList', 'payee');
            updateList('purposeList', 'purpose');
        }
    } catch (err) { console.error("Suggestion Error:", err); }
}

async function saveExcelEntry() {
    const btn = document.getElementById('saveBtn');
    
    // ডাটা সংগ্রহ
    const data = {
        date: document.getElementById('date').value,
        category: document.getElementById('category').value.trim(),
        paid_by: document.getElementById('fundSource').value.trim(),
        payee: document.getElementById('payee').value.trim(),
        purpose: document.getElementById('purpose').value.trim(),
        amount: parseFloat(document.getElementById('amount').value),
        status: document.getElementById('status').value
    };

    // ভ্যালিডেশন
    if (!data.category || !data.amount || !data.payee) {
        alert("Please fill Category, Payee and Amount!");
        return;
    }

    btn.disabled = true;
    btn.innerText = "Saving...";

    try {
        const { data: { user } } = await window.db.auth.getUser();
        const { error } = await window.db.from('expenses').insert([{
            ...data,
            user_id: user.id
        }]);

        if (error) throw error;

        // ক্লিয়ার ইনপুট
        ['category', 'payee', 'purpose', 'amount'].forEach(id => document.getElementById(id).value = '');
        alert("✅ Entry Saved!");
        loadAllSuggestions(); // সাজেশন আপডেট

    } catch (err) {
        alert("Error: " + err.message);
    } finally {
        btn.disabled = false;
        btn.innerText = "Add";
    }
}

// Make function globally available
window.saveExcelEntry = saveExcelEntry;
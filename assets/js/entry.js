document.addEventListener('DOMContentLoaded', async () => {
    console.log("🚀 Entry Page Loaded");

    // এলিমেন্টগুলো ধরা
    const form = document.getElementById('expenseForm');
    const catSelect = document.getElementById('category');
    const fundSelect = document.getElementById('fundSource'); // এইটা নিশ্চিত করো
    const submitBtn = document.querySelector('.btn-primary');
    const btnText = document.getElementById('btnText');
    const dateInput = document.getElementById('date');

    // ফর্ম এলিমেন্ট না পেলে এরর
    if (!form || !catSelect || !fundSelect || !submitBtn) {
        console.error("❌ Critical Error: HTML elements not found! Check IDs in HTML.");
        return;
    }

    // আজকের তারিখ সেট করা
    if (dateInput) dateInput.valueAsDate = new Date();

    // ক্যাটাগরি এবং সোর্স লোড করা
    await loadCategories(catSelect);
    await loadFundSources(fundSelect); 

    // ============================
    // ফর্ম সাবমিট (MAIN LOGIC)
    // ============================
    form.addEventListener('submit', async (e) => {
        e.preventDefault(); // পেজ রিলোড বন্ধ করা

        // বাটন ডিজেবল করা যাতে ডাবল ক্লিক না হয়
        const originalText = btnText.innerText;
        btnText.innerText = "Saving...";
        submitBtn.disabled = true;
        submitBtn.style.opacity = "0.7";

        // ১. ভ্যালুগুলো নেওয়া
        const date = dateInput.value;
        const category = catSelect.value;
        const paid_by = fundSelect.value; // <--- এই ভ্যালুটা আগে মিসিং ছিল বা যাচ্ছিল না
        const payee = document.getElementById('payee').value.trim();
        const purpose = document.getElementById('purpose').value.trim();
        const amount = parseFloat(document.getElementById('amount').value);

        // ভ্যালিডেশন
        if (!category) {
            alert("Please select a category!");
            resetBtn(originalText, submitBtn, btnText);
            return;
        }

        if (!paid_by) {
            alert("Please select 'Source of Fund' (Paid By)!");
            resetBtn(originalText, submitBtn, btnText);
            return;
        }

        try {
            // ইউজারের আইডি নেওয়া
            const { data: { user } } = await window.db.auth.getUser();
            if (!user) return window.location.href = 'index.html';

            // ২. সুপাবেসে ডাটা পাঠানো
            const { error } = await window.db
                .from('expenses')
                .insert([{
                    date: date,
                    category: category,
                    paid_by: paid_by, // <--- মেইন ফিক্স: এই লাইনটা থাকতেই হবে
                    payee: payee,
                    purpose: purpose,
                    amount: amount,
                    user_id: user.id
                }]);

            if (error) throw error;

            // সফল হলে
            showToast("✅ Expense Saved Successfully!");
            form.reset(); // ফর্ম খালি করা
            dateInput.valueAsDate = new Date(); // তারিখ আবার সেট করা
            
        } catch (err) {
            console.error("Save Error:", err);
            alert("❌ Error: " + err.message);
        } finally {
            resetBtn(originalText, submitBtn, btnText);
        }
    });
});

// ============================
// হেল্পার ফাংশনস
// ============================

// বাটন রিসেট
function resetBtn(text, btn, btnTxt) {
    btnTxt.innerText = text;
    btn.disabled = false;
    btn.style.opacity = "1";
}

// টোস্ট মেসেজ
function showToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.innerHTML = `<i class="fa-solid fa-check-circle"></i> ${message}`;
    toast.className = "toast show";
    setTimeout(() => { toast.className = toast.className.replace("show", ""); }, 3000);
}

// ক্যাটাগরি লোড
async function loadCategories(selectElement) {
    if (!window.db) return;
    selectElement.innerHTML = '<option value="" disabled selected>Loading...</option>';
    
    const { data: { user } } = await window.db.auth.getUser();
    if (!user) return;

    // ক্যাটাগরি টেবিল থেকে ডাটা আনা
    const { data: list } = await window.db.from('categories').select('name').order('name');
    
    // খরচের টেবিল থেকে ইউনিক ক্যাটাগরি আনা
    const { data: used } = await window.db.from('expenses').select('category').order('date', {ascending:false}).limit(100);

    let all = [];
    if (list) all.push(...list.map(c => c.name));
    if (used) all.push(...used.map(c => c.category));
    
    const unique = [...new Set(all)].filter(Boolean).sort();

    selectElement.innerHTML = '<option value="" disabled selected>Select Category</option>';
    unique.forEach(name => {
        const opt = document.createElement('option');
        opt.value = name; opt.innerText = name;
        selectElement.appendChild(opt);
    });
}

// ফান্ড সোর্স লোড (Anup Dada বা অন্য নামগুলো লোড হবে)
async function loadFundSources(selectElement) {
    if (!window.db) return;
    selectElement.innerHTML = '<option value="" disabled selected>Loading...</option>';

    const { data: { user } } = await window.db.auth.getUser();
    
    // fund_sources টেবিল থেকে নাম আনা
    const { data: list } = await window.db.from('fund_sources').select('name').order('name');
    
    // expenses টেবিল থেকে নাম আনা (যদি আগে ম্যানুয়ালি কিছু দিয়ে থাকো)
    const { data: used } = await window.db.from('expenses').select('paid_by').limit(100);

    let all = [];
    if (list) all.push(...list.map(i => i.name));
    if (used) all.push(...used.map(i => i.paid_by));

    const unique = [...new Set(all)].filter(Boolean).sort();

    selectElement.innerHTML = '<option value="" disabled selected>Select Source...</option>';
    unique.forEach(name => {
        const opt = document.createElement('option');
        opt.value = name; opt.innerText = name;
        selectElement.appendChild(opt);
    });
}

// ============================
// মোডাল হ্যান্ডলিং
// ============================

// ১. ক্যাটাগরি মোডাল
window.openModal = function() { document.getElementById('catModal').style.display = 'flex'; }
window.closeModal = function() { document.getElementById('catModal').style.display = 'none'; }

// ২. ফান্ড সোর্স মোডাল
window.openFundModal = function() { document.getElementById('fundModal').style.display = 'flex'; }
window.closeFundModal = function() { document.getElementById('fundModal').style.display = 'none'; }

// নতুন ফান্ড সোর্স সেভ (Anup Dada অ্যাড করার জন্য)
window.saveFundSource = async function() {
    const input = document.getElementById('newFundName');
    const name = input.value.trim();
    if(!name) return alert("Enter name");

    const { data: { user } } = await window.db.auth.getUser();

    // fund_sources টেবিলে সেভ
    const { error } = await window.db.from('fund_sources').insert([{ name, user_id: user.id }]);

    if(error) {
        alert("Error: " + error.message);
    } else {
        closeFundModal();
        input.value = '';
        showToast("Source Added!");
        // ড্রপডাউন রিফ্রেশ
        await loadFundSources(document.getElementById('fundSource'));
    }
}

// নতুন ক্যাটাগরি সেভ
window.saveCategory = async function() {
    const input = document.getElementById('newCatName');
    const name = input.value.trim();
    if(!name) return alert("Enter name");

    const { data: { user } } = await window.db.auth.getUser();
    const { error } = await window.db.from('categories').insert([{ name, user_id: user.id }]);

    if(error) {
        alert("Error: " + error.message);
    } else {
        closeModal();
        input.value = '';
        showToast("Category Added!");
        await loadCategories(document.getElementById('category'));
    }
}
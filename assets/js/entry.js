document.addEventListener('DOMContentLoaded', async () => {
    console.log("🚀 Page Loaded");

    const form = document.getElementById('expenseForm');
    const catSelect = document.getElementById('category');
    const submitBtn = document.querySelector('.btn-primary');
    const btnText = document.getElementById('btnText');
    const toast = document.getElementById('toast');
    const dateInput = document.getElementById('date');

    // ফর্ম এলিমেন্ট আছে কি না চেক করা
    if (!form || !catSelect || !submitBtn) {
        console.error("❌ Critical Error: HTML elements not found!");
        return;
    }

    // আজকের তারিখ সেট করা
    if (dateInput) dateInput.valueAsDate = new Date();

    // ক্যাটাগরি লোড ফাংশন কল
    await loadCategories(catSelect);

    // ============================
    // ফর্ম সাবমিট হ্যান্ডলার
    // ============================
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const originalText = btnText.innerText;
        btnText.innerText = "Saving...";
        submitBtn.disabled = true;
        submitBtn.style.opacity = "0.7";

        const date = dateInput.value;
        const category = catSelect.value;
        const payee = document.getElementById('payee').value.trim();
        const purpose = document.getElementById('purpose').value.trim();
        const amount = parseFloat(document.getElementById('amount').value);

        if (!category) {
            showToast("⚠️ Please select a category!", "error");
            resetBtn(originalText, submitBtn, btnText);
            return;
        }

        try {
            const { data: { user } } = await window.db.auth.getUser();
            if (!user) return window.location.href = 'index.html';

            const { error } = await window.db
                .from('expenses')
                .insert([{
                    date,
                    category,
                    payee,
                    purpose,
                    amount,
                    user_id: user.id
                }]);

            if (error) throw error;

            showToast("✅ Expense Added Successfully!");
            form.reset();
            dateInput.valueAsDate = new Date(); // আবার তারিখ সেট করা
            
        } catch (err) {
            console.error(err);
            showToast("❌ Error: " + err.message, "error");
        } finally {
            resetBtn(originalText, submitBtn, btnText);
        }
    });
});

// ============================
// হেল্পার ফাংশনসমূহ (Fixed)
// ============================

async function loadCategories(selectElement) {
    if (!window.db) return console.error("Database not connected!");

    selectElement.innerHTML = '<option value="" disabled selected>Loading...</option>';

    const { data: { user } } = await window.db.auth.getUser();
    if (!user) return;

    // ১. সেভ করা ক্যাটাগরি (categories টেবিল থেকে)
    const { data: savedCats } = await window.db
        .from('categories')
        .select('name')
        .order('name');

    // ২. ব্যবহৃত ক্যাটাগরি (expenses টেবিল থেকে) - লাস্ট ৫০০ এন্ট্রি
    const { data: usedCats } = await window.db
        .from('expenses')
        .select('category')
        .not('category', 'is', null)
        .order('date', { ascending: false })
        .limit(500);

    // ৩. ডাটা মার্জ করা
    let allCategories = [];

    if (savedCats) {
        allCategories.push(...savedCats.map(c => c.name));
    }
    if (usedCats) {
        allCategories.push(...usedCats.map(c => c.category));
    }

    // ইউনিক করা এবং সর্ট করা
    const uniqueCategories = [...new Set(allCategories)].filter(Boolean).sort();

    // ৪. ড্রপডাউনে অপশন যোগ করা
    selectElement.innerHTML = '<option value="" disabled selected>Select Category</option>';

    if (uniqueCategories.length > 0) {
        uniqueCategories.forEach(name => {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            selectElement.appendChild(opt);
        });
    } else {
        const opt = document.createElement('option');
        opt.disabled = true;
        opt.textContent = "No categories found";
        selectElement.appendChild(opt);
    }
}

function resetBtn(text, btn, btnTxt) {
    btnTxt.innerText = text;
    btn.disabled = false;
    btn.style.opacity = "1";
}

function showToast(message, type = "success") {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.innerText = message;
    toast.className = "toast show";
    if (type === "error") toast.classList.add("error");
    setTimeout(() => {
        toast.className = toast.className.replace("show", "");
        toast.classList.remove("error");
    }, 3000);
}

// ============================
// মোডাল এবং ক্যাটাগরি সেভ
// ============================
window.openModal = function () {
    document.getElementById('catModal').style.display = 'flex';
    document.getElementById('newCatName').focus();
}

window.closeModal = function () {
    document.getElementById('catModal').style.display = 'none';
}

window.saveCategory = async function () {
    const nameInput = document.getElementById('newCatName');
    const name = nameInput.value.trim();
    if (!name) return alert("Enter category name");

    const { data: { user } } = await window.db.auth.getUser();

    // নতুন ক্যাটাগরি 'categories' টেবিলে সেভ হবে
    const { error } = await window.db.from('categories').insert([{ name, user_id: user.id }]);

    if (error) {
        // যদি ডুপ্লিকেট এরর দেয়
        if (error.code === '23505') alert("Category already exists!");
        else alert("Error: " + error.message);
    } else {
        closeModal();
        nameInput.value = "";
        showToast("Category Created!");
        // পেজ রিফ্রেশ না করে ড্রপডাউন আপডেট করা
        const catSelect = document.getElementById('category');
        await loadCategories(catSelect);
    }
}

// ============================
// এক্সেল আপলোড ফাংশন
// ============================
window.handleFileUpload = async function (input) {
    const file = input.files[0];
    if (!file) return;

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
                payee: row['Payee'] || 'Unknown',
                purpose: row['Purpose'] || '',
                amount: parseFloat(row['Amount']) || 0,
                user_id: user.id
            })).filter(d => d.amount > 0);

            if (formattedData.length > 0 && confirm(`Upload ${formattedData.length} items?`)) {
                const { error } = await window.db.from('expenses').insert(formattedData);
                if (error) alert("Failed: " + error.message);
                else {
                    alert("✅ Uploaded!");
                    input.value = '';
                    // এক্সেল আপলোডের পর নতুন ক্যাটাগরিগুলো ড্রপডাউনে দেখাতে রিলোড করা হচ্ছে
                    const catSelect = document.getElementById('category');
                    await loadCategories(catSelect);
                }
            }
        } catch (err) {
            console.error(err);
            alert("Invalid File");
        }
    };
    reader.readAsArrayBuffer(file);
}
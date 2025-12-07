// assets/js/entry.js

document.addEventListener('DOMContentLoaded', async () => {
    console.log("🚀 Page Loaded");

    // ১. গ্লোবাল ভেরিয়েবলগুলো এখানে ডিক্লেয়ার করা হলো (Safe Mode)
    const form = document.getElementById('expenseForm');
    const catSelect = document.getElementById('category');
    const submitBtn = document.querySelector('.btn-primary');
    const btnText = document.getElementById('btnText');
    const toast = document.getElementById('toast');
    const dateInput = document.getElementById('date');

    // ২. এলিমেন্টগুলো ঠিকমতো আছে কিনা চেক করা
    if (!form || !catSelect || !submitBtn) {
        console.error("❌ Critical Error: Required HTML elements not found!");
        return;
    }

    // ৩. আজকের ডেট সেট করা
    if(dateInput) dateInput.valueAsDate = new Date();

    // ৪. ক্যাটাগরি লোড করা
    await loadCategories(catSelect);

    // ============================
    // ৫. ফর্ম সাবমিট হ্যান্ডলার
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
            // ইউজার চেক
            const { data: { user } } = await window.db.auth.getUser();
            if(!user) return window.location.href = 'index.html';

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
            dateInput.valueAsDate = new Date();
            
        } catch (err) {
            console.error(err);
            showToast("❌ Error: " + err.message, "error");
        } finally {
            resetBtn(originalText, submitBtn, btnText);
        }
    });
});

// ============================
// ৬. হেল্পার ফাংশনসমূহ
// ============================

async function loadCategories(selectElement) {
    if(!window.db) {
        console.error("Database not connected! Check config.js");
        return;
    }

    selectElement.innerHTML = '<option value="" disabled selected>Loading...</option>';
    
    const { data: { user } } = await window.db.auth.getUser();
    if (!user) {
        console.log("User not logged in");
        return;
    }

    const { data, error } = await window.db
        .from('categories')
        .select('name')
        .order('name', { ascending: true });

    selectElement.innerHTML = '<option value="" disabled selected>Select Category</option>';
    
    if (data && data.length > 0) {
        const uniqueCategories = [...new Set(data.map(item => item.name))];
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
    if(!toast) return;
    
    toast.innerText = message;
    toast.className = "toast show";
    if (type === "error") toast.classList.add("error");
    setTimeout(() => { 
        toast.className = toast.className.replace("show", ""); 
        toast.classList.remove("error");
    }, 3000);
}

// ============================
// ৭. এক্সেল এবং মোডাল (গ্লোবাল ফাংশন)
// ============================
window.openModal = function() { 
    document.getElementById('catModal').style.display = 'flex'; 
    document.getElementById('newCatName').focus();
}

window.closeModal = function() { 
    document.getElementById('catModal').style.display = 'none'; 
}

window.saveCategory = async function() {
    const nameInput = document.getElementById('newCatName');
    const name = nameInput.value.trim();
    if (!name) return alert("Enter name");

    const { data: { user } } = await window.db.auth.getUser();

    const { error } = await window.db.from('categories').insert([{ name, user_id: user.id }]);

    if (error) alert("Error: " + error.message);
    else {
        closeModal();
        nameInput.value = "";
        // পেজ রিফ্রেশ করে লিস্ট আপডেট করা
        location.reload(); 
    }
}

window.handleFileUpload = async function(input) {
    const file = input.files[0];
    if (!file) return;

    const { data: { user } } = await window.db.auth.getUser();

    const reader = new FileReader();
    reader.onload = async function(e) {
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

            if(formattedData.length > 0 && confirm(`Upload ${formattedData.length} items?`)) {
                const { error } = await window.db.from('expenses').insert(formattedData);
                if(error) alert("Failed: " + error.message);
                else {
                    alert("✅ Uploaded!");
                    input.value = '';
                }
            }
        } catch (err) {
            console.error(err);
            alert("Invalid File");
        }
    };
    reader.readAsArrayBuffer(file);
}
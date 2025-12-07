// assets/js/entry.js

const form = document.getElementById('expenseForm');
const catSelect = document.getElementById('category');
const toast = document.getElementById('toast');
const submitBtn = document.querySelector('.btn-primary');
const btnText = document.getElementById('btnText');

// ১. পেজ লোড এবং ক্যাটাগরি লোড
window.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('date').valueAsDate = new Date();
    await loadCategories();
});

// ২. ক্যাটাগরি লোড (ডুপ্লিকেট রিমুভ করে)
async function loadCategories() {
    catSelect.innerHTML = '<option value="" disabled selected>Loading...</option>';
    
    const { data: { user } } = await window.db.auth.getUser();
    if (!user) return window.location.href = 'login.html';

    const { data, error } = await window.db
        .from('categories')
        .select('name') // শুধু নাম আনব
        .order('name', { ascending: true });

    catSelect.innerHTML = '<option value="" disabled selected>Select Category</option>';
    
    if (data && data.length > 0) {
        // জাভাস্ক্রিপ্ট দিয়ে ডুপ্লিকেট নাম রিমুভ করা (Set ব্যবহার করে)
        const uniqueCategories = [...new Set(data.map(item => item.name))];

        uniqueCategories.forEach(name => {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            catSelect.appendChild(opt);
        });
    } else {
        const opt = document.createElement('option');
        opt.disabled = true;
        opt.textContent = "No categories found";
        catSelect.appendChild(opt);
    }
}

// ৩. মেইন ডাটা সেভ ফাংশন
form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const originalText = btnText.innerText;
    btnText.innerText = "Saving...";
    submitBtn.disabled = true;
    submitBtn.style.opacity = "0.7";

    const date = document.getElementById('date').value;
    const category = document.getElementById('category').value;
    const payee = document.getElementById('payee').value.trim();
    const purpose = document.getElementById('purpose').value.trim();
    const amount = parseFloat(document.getElementById('amount').value);

    if (!category) {
        showToast("⚠️ Please select a category!", "error");
        resetBtn(originalText);
        return;
    }

    try {
        const { data: { user } } = await window.db.auth.getUser();

        // ডাটাবেসে পাঠানো
        const { error } = await window.db
            .from('expenses')
            .insert([{ 
                date, 
                category, // এই কলামটি এখন SQL দিয়ে তৈরি করা হয়েছে
                payee, 
                purpose, 
                amount,
                user_id: user.id 
            }]);

        if (error) throw error;

        showToast("✅ Expense Added Successfully!");
        form.reset();
        document.getElementById('date').valueAsDate = new Date();
        loadCategories(); // ক্যাটাগরি সিলেকশন আবার লোড
        
    } catch (err) {
        console.error(err);
        showToast("❌ Error: " + err.message, "error");
    } finally {
        resetBtn(originalText);
    }
});

function resetBtn(text) {
    btnText.innerText = text;
    submitBtn.disabled = false;
    submitBtn.style.opacity = "1";
}

function showToast(message, type = "success") {
    toast.innerText = message;
    toast.className = "toast show";
    if (type === "error") toast.classList.add("error");
    setTimeout(() => { toast.className = toast.className.replace("show", ""); }, 3000);
}

// --- মোডাল এবং নতুন ক্যাটাগরি লজিক ---

function openModal() { 
    document.getElementById('catModal').style.display = 'flex'; 
    document.getElementById('newCatName').focus();
}

function closeModal() { 
    document.getElementById('catModal').style.display = 'none'; 
}

window.onclick = function(event) {
    if (event.target == document.getElementById('catModal')) closeModal();
}

// ৪. নতুন ক্যাটাগরি সেভ (ডুপ্লিকেট চেক সহ)
async function saveCategory() {
    const nameInput = document.getElementById('newCatName');
    const name = nameInput.value.trim();
    
    if (!name) return alert("Enter category name");

    const { data: { user } } = await window.db.auth.getUser();

    // আগে চেক করি এই নাম ডাটাবেসে আছে কিনা
    const { data: existing } = await window.db
        .from('categories')
        .select('name')
        .eq('name', name)
        .eq('user_id', user.id);

    if (existing && existing.length > 0) {
        alert("⚠️ This category already exists!");
        return;
    }

    // যদি না থাকে, তবে সেভ করো
    const { error } = await window.db
        .from('categories')
        .insert([{ name, user_id: user.id }]);

    if (error) {
        // SQL Constraint Error হ্যান্ডেল করা
        if(error.code === '23505') {
            alert("⚠️ Category already exists!");
        } else {
            alert("Error: " + error.message);
        }
    } else {
        closeModal();
        nameInput.value = "";
        showToast("✅ Category Created!");
        loadCategories(); // সাথে সাথে লিস্টে দেখাবে
    }
}
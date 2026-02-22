document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('tDate').value = new Date().toISOString().split('T')[0];
    loadTailorData();

    document.getElementById('tailorForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveTailorEntry();
    });
});

async function loadTailorData() {
    const tbody = document.getElementById('tailorTableBody');
    const totalEl = document.getElementById('tailorTotal');
    
    try {
        const { data: { user } } = await window.db.auth.getUser();
        const { data, error } = await window.db
            .from('tailor_expenses')
            .select('*')
            .eq('user_id', user.id)
            .order('date', { ascending: false });

        if (error) throw error;

        let total = 0;
        tbody.innerHTML = '';

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No records found</td></tr>';
            totalEl.innerText = '0';
            return;
        }

        data.forEach(item => {
            total += Number(item.amount);
            const dateStr = new Date(item.date).toLocaleDateString('en-GB');
            
            tbody.innerHTML += `
                <tr>
                    <td>${dateStr}</td>
                    <td style="font-weight: 600; color: #4f46e5;">${item.celebrity_name}</td>
                    <td>${item.item_name}</td>
                    <td style="text-align: right; font-weight: bold;">₹${Number(item.amount).toLocaleString('en-IN')}</td>
                    <td style="text-align: center;">
                        <button onclick="deleteTailorEntry('${item.id}')" style="background: #fee2e2; color: #ef4444; border: none; padding: 5px 10px; border-radius: 5px; cursor: pointer;" aria-label="Delete entry">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        });

        totalEl.innerText = total.toLocaleString('en-IN');

    } catch (err) {
        console.error("Error loading tailor data:", err);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: #ef4444;">Error loading data</td></tr>';
    }
}

async function saveTailorEntry() {
    const btn = document.getElementById('saveTailorBtn');
    btn.innerText = "Saving...";
    btn.disabled = true;

    try {
        const { data: { user } } = await window.db.auth.getUser();
        
        const entryData = {
            user_id: user.id,
            date: document.getElementById('tDate').value,
            celebrity_name: document.getElementById('tCelebrity').value.trim(),
            item_name: document.getElementById('tItem').value.trim(),
            amount: parseFloat(document.getElementById('tAmount').value)
        };

        const { error } = await window.db.from('tailor_expenses').insert([entryData]);
        if (error) throw error;

        document.getElementById('tCelebrity').value = '';
        document.getElementById('tItem').value = '';
        document.getElementById('tAmount').value = '';
        
        loadTailorData();
        alert("Entry Saved Successfully!");

    } catch (err) {
        alert("Error: " + err.message);
    } finally {
        btn.innerText = "Save Entry";
        btn.disabled = false;
    }
}

async function deleteTailorEntry(id) {
    if (confirm("Are you sure you want to delete this entry?")) {
        try {
            const { error } = await window.db.from('tailor_expenses').delete().eq('id', id);
            if (error) throw error;
            loadTailorData();
        } catch (err) {
            alert("Error deleting: " + err.message);
        }
    }
}

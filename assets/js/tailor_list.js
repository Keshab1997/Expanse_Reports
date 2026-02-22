let allTailorData = [];
let currentFilteredData = [];
let celebTom, itemTom;

document.addEventListener('DOMContentLoaded', async () => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    
    document.getElementById('tFromDate').value = firstDay.toISOString().split('T')[0];
    document.getElementById('tToDate').value = today.toISOString().split('T')[0];

    await loadTailorData();
    setupEventListeners();
});

async function loadTailorData() {
    const loader = document.getElementById('globalLoader');
    if (loader) loader.style.display = 'flex';

    try {
        const { data: { user } } = await window.db.auth.getUser();
        const { data, error } = await window.db
            .from('tailor_expenses')
            .select('*')
            .eq('user_id', user.id)
            .order('date', { ascending: false });

        if (error) throw error;

        allTailorData = data || [];
        initTomSelects();
        applyTailorFilters();

    } catch (err) {
        console.error("Error loading tailor data:", err);
        document.getElementById('tailorTableBody').innerHTML = '<tr><td colspan="5" style="text-align:center; color: #ef4444; padding: 30px;">Failed to load data</td></tr>';
    } finally {
        if (loader) loader.style.display = 'none';
    }
}

function initTomSelects() {
    const settings = { 
        plugins: ['remove_button'], 
        maxItems: null, 
        onChange: function() { applyTailorFilters(); }
    };

    const celebs = [...new Set(allTailorData.map(i => i.celebrity_name).filter(Boolean))];
    if (celebTom) celebTom.destroy();
    celebTom = new TomSelect('#celebFilter', { ...settings, options: celebs.map(v => ({value: v, text: v})), placeholder: 'Select Celebrities...' });

    const items = [...new Set(allTailorData.map(i => i.item_name).filter(Boolean))];
    if (itemTom) itemTom.destroy();
    itemTom = new TomSelect('#itemFilter', { ...settings, options: items.map(v => ({value: v, text: v})), placeholder: 'Select Items...' });
}

function applyTailorFilters() {
    const fromDate = document.getElementById('tFromDate').value;
    const toDate = document.getElementById('tToDate').value;
    const selectedCelebs = celebTom ? celebTom.getValue() : [];
    const selectedItems = itemTom ? itemTom.getValue() : [];

    currentFilteredData = allTailorData.filter(item => {
        let match = true;
        
        if (fromDate && item.date < fromDate) match = false;
        if (toDate && item.date > toDate) match = false;
        if (selectedCelebs.length > 0 && !selectedCelebs.includes(item.celebrity_name)) match = false;
        if (selectedItems.length > 0 && !selectedItems.includes(item.item_name)) match = false;

        return match;
    });

    renderTailorTable(currentFilteredData);
}

function renderTailorTable(data) {
    const tbody = document.getElementById('tailorTableBody');
    const totalEl = document.getElementById('tailorTotal');
    
    let total = 0;
    tbody.innerHTML = '';

    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 30px; color: #64748b;">No records found for selected filters</td></tr>';
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
                <td style="text-align: right; font-weight: bold;">₹${Number(item.amount).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                <td style="text-align: center;">
                    <button onclick="deleteTailorEntry('${item.id}')" style="background: #fee2e2; color: #ef4444; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer;" aria-label="Delete entry" title="Delete Entry">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </td>
            </tr>
        `;
    });

    totalEl.innerText = total.toLocaleString('en-IN', {minimumFractionDigits: 2});
}

function downloadTailorPDF() {
    if (currentFilteredData.length === 0) {
        alert("No data to download!");
        return;
    }

    const pdfBtn = document.querySelector('.btn-pdf');
    const originalHTML = pdfBtn.innerHTML;
    
    try {
        pdfBtn.disabled = true;
        pdfBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating...';
        
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');
        const today = new Date().toLocaleDateString('en-GB');

        doc.setFillColor(217, 119, 6);
        doc.rect(0, 0, 210, 25, 'F'); 
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.text("TAILOR EXPENSE REPORT", 14, 16);

        doc.setTextColor(80, 80, 80);
        doc.setFontSize(10);
        const fromDate = document.getElementById('tFromDate').value || '-';
        const toDate = document.getElementById('tToDate').value || '-';
        doc.text(`Period: ${fromDate} to ${toDate}`, 14, 33);

        let grandTotal = currentFilteredData.reduce((sum, item) => sum + Number(item.amount), 0);

        const tableData = currentFilteredData.map(item => [
            new Date(item.date).toLocaleDateString('en-GB'),
            item.celebrity_name,
            item.item_name,
            Number(item.amount).toFixed(2)
        ]);

        doc.autoTable({
            head: [['Date', 'Celebrity Name', 'Item Name', 'Amount (INR)']],
            body: tableData,
            startY: 40,
            theme: 'grid',
            headStyles: { fillColor: [245, 158, 11], textColor: [255, 255, 255], fontSize: 10 },
            columnStyles: {
                3: { halign: 'right', fontStyle: 'bold' }
            },
            styles: { fontSize: 9, cellPadding: 3 }
        });

        const finalY = doc.lastAutoTable.finalY + 10;
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(0, 0, 0);
        doc.text(`GRAND TOTAL: INR ${grandTotal.toLocaleString('en-IN', {minimumFractionDigits: 2})}`, 14, finalY);

        doc.save(`Tailor_Report_${today}.pdf`);
        
        alert('✅ PDF downloaded successfully!');

    } catch (error) {
        console.error("PDF Error:", error);
        alert("Failed to generate PDF");
    } finally {
        pdfBtn.disabled = false;
        pdfBtn.innerHTML = originalHTML;
    }
}

async function deleteTailorEntry(id) {
    if (confirm("Are you sure you want to delete this entry?")) {
        const loader = document.getElementById('globalLoader');
        if (loader) loader.style.display = 'flex';

        try {
            const { error } = await window.db.from('tailor_expenses').delete().eq('id', id);
            if (error) throw error;
            
            showToast("Entry deleted successfully!", "success");
            await loadTailorData();
        } catch (err) {
            showToast("Error deleting: " + err.message, "error");
        } finally {
            if (loader) loader.style.display = 'none';
        }
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
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function resetTailorFilters() {
    if (celebTom) celebTom.clear();
    if (itemTom) itemTom.clear();
    
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    document.getElementById('tFromDate').value = firstDay.toISOString().split('T')[0];
    document.getElementById('tToDate').value = today.toISOString().split('T')[0];
    
    applyTailorFilters();
}

function setupEventListeners() {
    document.getElementById('tFromDate').addEventListener('change', applyTailorFilters);
    document.getElementById('tToDate').addEventListener('change', applyTailorFilters);
}

window.resetTailorFilters = resetTailorFilters;
window.downloadTailorPDF = downloadTailorPDF;
window.deleteTailorEntry = deleteTailorEntry;

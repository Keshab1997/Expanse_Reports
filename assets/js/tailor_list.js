let allTailorData = [];
let currentFilteredData = [];
let celebTom, itemTom;

document.addEventListener('DOMContentLoaded', async () => {
    await loadTailorData();
    setupEventListeners();
});

async function loadTailorData() {
    console.log('🔄 Loading tailor data...');
    const loader = document.getElementById('globalLoader');
    if (loader) loader.style.display = 'flex';

    try {
        const { data: { user } } = await window.db.auth.getUser();
        console.log('👤 User ID:', user.id);
        
        const { data, error } = await window.db
            .from('tailor_expenses')
            .select('*')
            .eq('user_id', user.id)
            .order('date', { ascending: false });

        console.log('📊 Raw data from DB:', data);
        console.log('❌ Error:', error);

        if (error) throw error;

        allTailorData = data || [];
        console.log('✅ Total records loaded:', allTailorData.length);
        
        if (allTailorData.length === 0) {
            const { data: allData } = await window.db.from('tailor_expenses').select('*').limit(1);
            if (allData && allData.length > 0) {
                document.getElementById('fixUserIdBtn').style.display = 'block';
            }
        }
        
        if (allTailorData.length > 0) {
            const oldestDate = allTailorData[allTailorData.length - 1].date;
            const today = new Date().toISOString().split('T')[0];
            console.log('📅 Date range:', oldestDate, 'to', today);
            
            if (!document.getElementById('tFromDate').value) {
                document.getElementById('tFromDate').value = oldestDate;
                document.getElementById('tToDate').value = today;
            }
        }

        initTomSelects();
        applyTailorFilters();

    } catch (err) {
        console.error("❌ Error loading tailor data:", err);
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

    console.log('🔍 Applying filters:');
    console.log('  From Date:', fromDate);
    console.log('  To Date:', toDate);
    console.log('  Selected Celebs:', selectedCelebs);
    console.log('  Selected Items:', selectedItems);
    console.log('  Total data before filter:', allTailorData.length);

    currentFilteredData = allTailorData.filter(item => {
        let match = true;
        if (fromDate && item.date < fromDate) match = false;
        if (toDate && item.date > toDate) match = false;
        if (selectedCelebs.length > 0 && !selectedCelebs.includes(item.celebrity_name)) match = false;
        if (selectedItems.length > 0 && !selectedItems.includes(item.item_name)) match = false;
        return match;
    });

    console.log('✅ Filtered data count:', currentFilteredData.length);
    renderTailorTable(currentFilteredData);
}

function renderTailorTable(data) {
    console.log('🎨 Rendering table with', data.length, 'records');
    const tbody = document.getElementById('tailorTableBody');
    const totalEl = document.getElementById('tailorTotal');
    
    let total = 0;
    tbody.innerHTML = '';

    if (data.length === 0) {
        console.log('⚠️ No records to display');
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 30px; color: #64748b;">No records found</td></tr>';
        totalEl.innerText = '0';
        return;
    }

    data.forEach(item => {
        total += Number(item.amount);
        const dateStr = new Date(item.date).toLocaleDateString('en-GB');
        const displayItem = item.item_name ? item.item_name : '<span style="color:#94a3b8; font-style:italic;">Double click to add</span>';
        
        tbody.innerHTML += `
            <tr>
                <td>${dateStr}</td>
                <td class="editable-cell" ondblclick="makeEditable(this)" onblur="saveTailorInline(this, '${item.id}', 'celebrity_name')" style="font-weight: 600; color: #4f46e5;">${item.celebrity_name}</td>
                <td class="editable-cell" ondblclick="makeEditable(this)" onblur="saveTailorInline(this, '${item.id}', 'item_name')">${displayItem}</td>
                <td class="editable-cell" ondblclick="makeEditable(this)" onblur="saveTailorInline(this, '${item.id}', 'amount')" style="text-align: right; font-weight: bold;">₹${Number(item.amount).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                <td style="text-align: center;">
                    <button onclick="deleteTailorEntry('${item.id}')" style="background: #fee2e2; color: #ef4444; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer;" title="Delete Entry">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </td>
            </tr>
        `;
    });

    totalEl.innerText = total.toLocaleString('en-IN', {minimumFractionDigits: 2});
}

function makeEditable(el) {
    if (el.innerText.includes('Double click')) el.innerText = '';
    el.contentEditable = "true";
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
}

async function saveTailorInline(el, id, field) {
    el.contentEditable = "false";
    let newValue = el.innerText.trim();
    
    if (field === 'amount') {
        newValue = parseFloat(newValue.replace(/[^\d.-]/g, ''));
        if (isNaN(newValue) || newValue <= 0) {
            showToast("Invalid amount", "error");
            applyTailorFilters();
            return;
        }
    }

    try {
        const { error } = await window.db.from('tailor_expenses').update({ [field]: newValue }).eq('id', id);
        if (error) throw error;
        
        const itemIndex = allTailorData.findIndex(item => item.id === id);
        if (itemIndex !== -1) allTailorData[itemIndex][field] = newValue;
        
        showToast("Updated successfully!", "success");
        initTomSelects();
        applyTailorFilters();
    } catch (err) {
        showToast("Update failed", "error");
        applyTailorFilters();
    }
}

function downloadTailorPDF() {
    if (currentFilteredData.length === 0) {
        showToast("No data to download!", "error");
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
            item.item_name || '-',
            Number(item.amount).toFixed(2)
        ]);

        doc.autoTable({
            head: [['Date', 'Celebrity Name', 'Item Name', 'Amount (INR)']],
            body: tableData,
            startY: 40,
            theme: 'grid',
            headStyles: { fillColor: [245, 158, 11], textColor: [255, 255, 255], fontSize: 10 },
            columnStyles: { 3: { halign: 'right', fontStyle: 'bold' } },
            styles: { fontSize: 9, cellPadding: 3 }
        });

        const finalY = doc.lastAutoTable.finalY + 10;
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(0, 0, 0);
        doc.text(`GRAND TOTAL: INR ${grandTotal.toLocaleString('en-IN', {minimumFractionDigits: 2})}`, 14, finalY);

        doc.save(`Tailor_Report_${today}.pdf`);
        showToast("PDF downloaded!", "success");

    } catch (error) {
        showToast("PDF generation failed", "error");
    } finally {
        pdfBtn.disabled = false;
        pdfBtn.innerHTML = originalHTML;
    }
}

async function deleteTailorEntry(id) {
    if (confirm("Delete this entry?")) {
        const loader = document.getElementById('globalLoader');
        if (loader) loader.style.display = 'flex';

        try {
            const { error } = await window.db.from('tailor_expenses').delete().eq('id', id);
            if (error) throw error;
            showToast("Entry deleted!", "success");
            await loadTailorData();
        } catch (err) {
            showToast("Delete failed", "error");
        } finally {
            if (loader) loader.style.display = 'none';
        }
    }
}

function resetTailorFilters() {
    if (celebTom) celebTom.clear();
    if (itemTom) itemTom.clear();
    
    if (allTailorData.length > 0) {
        document.getElementById('tFromDate').value = allTailorData[allTailorData.length - 1].date;
    }
    document.getElementById('tToDate').value = new Date().toISOString().split('T')[0];
    applyTailorFilters();
}

function setupEventListeners() {
    document.getElementById('tFromDate').addEventListener('change', applyTailorFilters);
    document.getElementById('tToDate').addEventListener('change', applyTailorFilters);
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

window.resetTailorFilters = resetTailorFilters;
window.downloadTailorPDF = downloadTailorPDF;
window.deleteTailorEntry = deleteTailorEntry;
window.makeEditable = makeEditable;
window.saveTailorInline = saveTailorInline;
window.fixAllUserIds = fixAllUserIds;

async function fixAllUserIds() {
    const loader = document.getElementById('globalLoader');
    if (loader) loader.style.display = 'flex';
    
    try {
        const { data: { user } } = await window.db.auth.getUser();
        const { error } = await window.db.from('tailor_expenses')
            .update({ user_id: user.id })
            .neq('user_id', user.id);
        
        if (error) throw error;
        showToast('All user IDs fixed!', 'success');
        setTimeout(() => location.reload(), 1500);
    } catch (err) {
        showToast('Fix failed: ' + err.message, 'error');
    } finally {
        if (loader) loader.style.display = 'none';
    }
}

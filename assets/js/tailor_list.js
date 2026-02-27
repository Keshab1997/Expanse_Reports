let allTailorData = [];
let currentFilteredData = [];
let celebTom, itemTom;

document.addEventListener('DOMContentLoaded', async () => {
    await loadTailorData();
    setupEventListeners();
});

async function loadTailorData() {
    // console.log('🔄 Loading tailor data...');
    const loader = document.getElementById('globalLoader');
    if (loader) loader.style.display = 'flex';

    try {
        const { data: { user } } = await window.db.auth.getUser();
        // console.log('👤 User ID:', user.id);
        
        const { data, error } = await window.db
            .from('tailor_expenses')
            .select('*')
            .eq('user_id', user.id)
            .order('date', { ascending: false })
            .order('created_at', { ascending: true });

        // console.log('📊 Raw data from DB:', data);
        // console.log('❌ Error:', error);

        if (error) throw error;

        allTailorData = data || [];
        // console.log('✅ Total records loaded:', allTailorData.length);
        
        if (allTailorData.length > 0) {
            const oldestDate = allTailorData[allTailorData.length - 1].date;
            const today = new Date().toISOString().split('T')[0];
            // console.log('📅 Date range:', oldestDate, 'to', today);
            
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

    // console.log('🔍 Applying filters:');
    // console.log('  From Date:', fromDate);
    // console.log('  To Date:', toDate);
    // console.log('  Selected Celebs:', selectedCelebs);
    // console.log('  Selected Items:', selectedItems);
    // console.log('  Total data before filter:', allTailorData.length);

    currentFilteredData = allTailorData.filter(item => {
        let match = true;
        if (fromDate && item.date < fromDate) match = false;
        if (toDate && item.date > toDate) match = false;
        if (selectedCelebs.length > 0 && !selectedCelebs.includes(item.celebrity_name)) match = false;
        if (selectedItems.length > 0 && !selectedItems.includes(item.item_name)) match = false;
        return match;
    });

    // console.log('✅ Filtered data count:', currentFilteredData.length);
    renderTailorTable(currentFilteredData);
}

function renderTailorTable(data) {
    // console.log('🎨 Rendering table with', data.length, 'records');
    const tbody = document.getElementById('tailorTableBody');
    const totalEl = document.getElementById('tailorTotal');
    
    let grandTotal = 0;
    let htmlContent = '';

    if (data.length === 0) {
        // console.log('⚠️ No records to display');
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 30px; color: #64748b;">No records found</td></tr>';
        totalEl.innerText = '0';
        return;
    }

    const groupedData = {};
    data.forEach(item => {
        if (!groupedData[item.date]) {
            groupedData[item.date] = { items: [], subtotal: 0 };
        }
        groupedData[item.date].items.push(item);
        groupedData[item.date].subtotal += Number(item.amount);
        grandTotal += Number(item.amount);
    });

    const sortedDates = Object.keys(groupedData).sort((a, b) => new Date(b) - new Date(a));

    sortedDates.forEach(date => {
        const dateStr = new Date(date).toLocaleDateString('en-GB');
        const group = groupedData[date];

        htmlContent += `
            <tr style="background: #eef2ff; border-top: 2px solid #c7d2fe; border-bottom: 1px solid #c7d2fe;">
                <td style="text-align: center;"><input type="checkbox" disabled style="opacity: 0.3;"></td>
                <td colspan="3" style="font-weight: 700; color: #4f46e5; font-size: 1rem; padding: 12px 15px;">
                    <i class="fa-regular fa-calendar-days"></i> ${dateStr}
                </td>
                <td style="text-align: right; font-weight: 700; color: #4f46e5; padding: 12px 15px;">
                    ₹${group.subtotal.toLocaleString('en-IN', {minimumFractionDigits: 2})}
                </td>
                <td></td>
            </tr>
        `;

        group.items.forEach(item => {
            const displayItem = item.item_name ? item.item_name : '<span style="color:#94a3b8; font-style:italic; font-size:0.85rem;">Double click to add</span>';
            
            htmlContent += `
                <tr style="background: #ffffff; transition: all 0.2s;">
                    <td style="text-align: center;"><input type="checkbox" class="row-checkbox" data-id="${item.id}" onchange="updateDeleteButton()"></td>
                    <td style="color: #cbd5e1; text-align: center; font-size: 1.2rem;">
                        <i class="fa-solid fa-turn-up fa-rotate-90"></i>
                    </td>
                    <td class="editable-cell" ondblclick="makeEditable(this)" onblur="saveTailorInline(this, '${item.id}', 'celebrity_name')" style="font-weight: 600; color: #334155;">
                        ${item.celebrity_name}
                    </td>
                    <td class="editable-cell" ondblclick="makeEditable(this)" onblur="saveTailorInline(this, '${item.id}', 'item_name')">
                        ${displayItem}
                    </td>
                    <td class="editable-cell" ondblclick="makeEditable(this)" onblur="saveTailorInline(this, '${item.id}', 'amount')" style="text-align: right; font-weight: 600; color: #1e293b;">
                        ₹${Number(item.amount).toLocaleString('en-IN', {minimumFractionDigits: 2})}
                    </td>
                    <td style="text-align: center;">
                        <button onclick="deleteTailorEntry('${item.id}')" style="background: #fee2e2; color: #ef4444; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer;" title="Delete Entry">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </td>
                </tr>
            `;
        });
    });

    tbody.innerHTML = htmlContent;
    totalEl.innerText = grandTotal.toLocaleString('en-IN', {minimumFractionDigits: 2});
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

function makeEditableDate(el) {
    const currentDate = el.innerText.split('/').reverse().join('-');
    el.innerHTML = `<input type="date" value="${currentDate}" style="border: 2px solid #4f46e5; padding: 4px; border-radius: 4px;" onblur="this.parentElement.innerText = new Date(this.value).toLocaleDateString('en-GB'); this.parentElement.blur();">`;
    el.querySelector('input').focus();
}

async function saveTailorInline(el, id, field) {
    el.contentEditable = "false";
    let newValue = el.innerText.trim();
    
    if (field === 'date') {
        const dateParts = newValue.split('/');
        if (dateParts.length === 3) {
            newValue = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
        }
    }
    
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
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        const groupedData = {};
        let grandTotal = 0;

        currentFilteredData.forEach(item => {
            const celeb = item.celebrity_name || 'Unknown';
            const amt = Number(item.amount) || 0;
            
            if (!groupedData[celeb]) {
                groupedData[celeb] = { total: 0, items: [] };
            }
            groupedData[celeb].total += amt;
            groupedData[celeb].items.push(item);
            grandTotal += amt;
        });

        doc.setFillColor(217, 119, 6);
        doc.rect(0, 0, pageWidth, 28, 'F'); 
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(18);
        doc.setFont("helvetica", "bold");
        doc.text("TAILOR EXPENSE REPORT", 14, 18);

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        const fromDate = document.getElementById('tFromDate').value || '-';
        const toDate = document.getElementById('tToDate').value || '-';
        doc.text(`Statement Period: ${fromDate} to ${toDate}`, 14, 25);
        doc.text(`Generated: ${today}`, pageWidth - 14, 25, { align: 'right' });

        let currentY = 35;

        doc.setTextColor(0, 0, 0);
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("EXECUTIVE SUMMARY", 14, currentY);
        currentY += 5;

        const summaryRows = Object.keys(groupedData).map(celeb => [
            celeb, 
            `INR ${groupedData[celeb].total.toLocaleString('en-IN', {minimumFractionDigits: 2})}`
        ]);

        doc.autoTable({
            head: [['Celebrity Name', 'Total Amount']],
            body: summaryRows,
            startY: currentY,
            theme: 'grid',
            headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontSize: 10 },
            styles: { fontSize: 9, cellPadding: 3 },
            columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
            margin: { left: 14, right: 14 }
        });

        currentY = doc.lastAutoTable.finalY + 15;

        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(217, 119, 6);
        doc.text("DETAILED BREAKDOWN", 14, currentY);
        currentY += 8;

        Object.keys(groupedData).forEach(celeb => {
            if (currentY > pageHeight - 40) {
                doc.addPage();
                currentY = 20;
            }

            doc.setFontSize(11);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(0, 0, 0);
            doc.setFillColor(243, 244, 246);
            doc.rect(14, currentY - 5, pageWidth - 28, 8, 'F');
            doc.text(`Celebrity: ${celeb}`, 16, currentY);
            currentY += 5;

            const tableData = groupedData[celeb].items.map(item => [
                new Date(item.date).toLocaleDateString('en-GB'),
                item.item_name || '-',
                Number(item.amount).toFixed(2)
            ]);

            tableData.push([
                { content: 'SUBTOTAL', colSpan: 2, styles: { halign: 'right', fontStyle: 'bold', fillColor: [254, 243, 199] } },
                { content: groupedData[celeb].total.toFixed(2), styles: { halign: 'right', fontStyle: 'bold', fillColor: [254, 243, 199] } }
            ]);

            doc.autoTable({
                head: [['Date', 'Item Name', 'Amount (INR)']],
                body: tableData,
                startY: currentY,
                theme: 'grid',
                headStyles: { fillColor: [245, 158, 11], textColor: [255, 255, 255], fontSize: 9 },
                styles: { fontSize: 9, cellPadding: 2 },
                columnStyles: { 
                    0: { cellWidth: 25 },
                    2: { halign: 'right' } 
                },
                margin: { left: 14, right: 14 }
            });

            currentY = doc.lastAutoTable.finalY + 10;
        });

        if (currentY > pageHeight - 50) {
            doc.addPage();
            currentY = 20;
        }
        
        doc.setFillColor(217, 119, 6);
        doc.rect(14, currentY, pageWidth - 28, 12, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text(`GRAND TOTAL: INR ${grandTotal.toLocaleString('en-IN', {minimumFractionDigits: 2})}`, pageWidth / 2, currentY + 8, { align: 'center' });

        currentY += 35;

        if (currentY > pageHeight - 30) {
            doc.addPage();
            currentY = 30;
        }

        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.5);
        doc.line(pageWidth - 60, currentY, pageWidth - 14, currentY); 
        
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(16);
        doc.setFont("times", "italic");
        doc.text("Keshab Sarkar", pageWidth - 37, currentY - 3, { align: 'center' }); 
        
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text("Authorized Signature", pageWidth - 37, currentY + 5, { align: 'center' });

        const pageCount = doc.internal.getNumberOfPages();
        for(let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(`Page ${i} of ${pageCount} | ExpensePro Manager`, pageWidth / 2, pageHeight - 10, { align: 'center' });
        }

        doc.save(`Tailor_Report_${today}.pdf`);

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

let filterTimeout;

function setupEventListeners() {
    const handleFilter = () => {
        clearTimeout(filterTimeout);
        filterTimeout = setTimeout(() => {
            applyTailorFilters();
        }, 300);
    };

    document.getElementById('tFromDate').addEventListener('input', handleFilter);
    document.getElementById('tToDate').addEventListener('input', handleFilter);
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
window.downloadDateWisePDF = downloadDateWisePDF;
window.deleteTailorEntry = deleteTailorEntry;
window.makeEditable = makeEditable;
window.makeEditableDate = makeEditableDate;
window.saveTailorInline = saveTailorInline;
window.fixAllUserIds = fixAllUserIds;
window.toggleSelectAll = toggleSelectAll;
window.updateDeleteButton = updateDeleteButton;
window.deleteSelectedEntries = deleteSelectedEntries;

function downloadDateWisePDF() {
    if (currentFilteredData.length === 0) {
        showToast("No data to download!", "error");
        return;
    }

    const pdfBtn = event.target;
    const originalHTML = pdfBtn.innerHTML;
    
    try {
        pdfBtn.disabled = true;
        pdfBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating...';
        
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');
        const today = new Date().toLocaleDateString('en-GB');
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        const groupedByDate = {};
        let grandTotal = 0;

        currentFilteredData.forEach(item => {
            if (!groupedByDate[item.date]) {
                groupedByDate[item.date] = { total: 0, items: [] };
            }
            groupedByDate[item.date].total += Number(item.amount);
            groupedByDate[item.date].items.push(item);
            grandTotal += Number(item.amount);
        });

        const sortedDates = Object.keys(groupedByDate).sort((a, b) => new Date(b) - new Date(a));

        doc.setFillColor(79, 70, 229);
        doc.rect(0, 0, pageWidth, 28, 'F'); 
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(18);
        doc.setFont("helvetica", "bold");
        doc.text("TAILOR EXPENSE REPORT (DATE-WISE)", 14, 18);

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        const fromDate = document.getElementById('tFromDate').value || '-';
        const toDate = document.getElementById('tToDate').value || '-';
        doc.text(`Statement Period: ${fromDate} to ${toDate}`, 14, 25);
        doc.text(`Generated: ${today}`, pageWidth - 14, 25, { align: 'right' });

        let currentY = 35;

        const tableBody = [];

        sortedDates.forEach(date => {
            const dateStr = new Date(date).toLocaleDateString('en-GB');
            const group = groupedByDate[date];

            tableBody.push([
                { content: `Date: ${dateStr}`, colSpan: 2, styles: { fillColor: [238, 242, 255], textColor: [79, 70, 229], fontStyle: 'bold' } },
                { content: `INR ${group.total.toLocaleString('en-IN', {minimumFractionDigits: 2})}`, styles: { fillColor: [238, 242, 255], textColor: [79, 70, 229], fontStyle: 'bold', halign: 'right' } }
            ]);

            group.items.forEach(item => {
                tableBody.push([
                    item.celebrity_name,
                    item.item_name || '-',
                    Number(item.amount).toFixed(2)
                ]);
            });
        });

        doc.autoTable({
            head: [['Celebrity Name', 'Item Name', 'Amount (INR)']],
            body: tableBody,
            startY: currentY,
            theme: 'grid',
            headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontSize: 10 },
            styles: { fontSize: 9, cellPadding: 3 },
            columnStyles: { 
                0: { fontStyle: 'bold', textColor: [51, 65, 85] },
                2: { halign: 'right', fontStyle: 'bold' } 
            },
            margin: { left: 14, right: 14 }
        });

        currentY = doc.lastAutoTable.finalY + 10;

        if (currentY > pageHeight - 50) {
            doc.addPage();
            currentY = 20;
        }
        
        doc.setFillColor(79, 70, 229);
        doc.rect(14, currentY, pageWidth - 28, 12, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text(`GRAND TOTAL: INR ${grandTotal.toLocaleString('en-IN', {minimumFractionDigits: 2})}`, pageWidth / 2, currentY + 8, { align: 'center' });

        currentY += 35;

        if (currentY > pageHeight - 30) {
            doc.addPage();
            currentY = 30;
        }

        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.5);
        doc.line(pageWidth - 60, currentY, pageWidth - 14, currentY); 
        
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(16);
        doc.setFont("times", "italic");
        doc.text("Keshab Sarkar", pageWidth - 37, currentY - 3, { align: 'center' }); 
        
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text("Authorized Signature", pageWidth - 37, currentY + 5, { align: 'center' });

        const pageCount = doc.internal.getNumberOfPages();
        for(let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(`Page ${i} of ${pageCount} | ExpensePro Manager`, pageWidth / 2, pageHeight - 10, { align: 'center' });
        }

        doc.save(`Tailor_Report_DateWise_${today}.pdf`);

    } catch (error) {
        showToast("PDF generation failed", "error");
    } finally {
        pdfBtn.disabled = false;
        pdfBtn.innerHTML = originalHTML;
    }
}

function toggleSelectAll() {
    const selectAll = document.getElementById('selectAll');
    const checkboxes = document.querySelectorAll('.row-checkbox');
    checkboxes.forEach(cb => cb.checked = selectAll.checked);
    updateDeleteButton();
}

function updateDeleteButton() {
    const checkboxes = document.querySelectorAll('.row-checkbox:checked');
    const deleteBtn = document.getElementById('deleteSelectedBtn');
    const countSpan = document.getElementById('selectedCount');
    
    if (checkboxes.length > 0) {
        deleteBtn.style.display = 'block';
        countSpan.textContent = checkboxes.length;
    } else {
        deleteBtn.style.display = 'none';
        document.getElementById('selectAll').checked = false;
    }
}

async function deleteSelectedEntries() {
    const checkboxes = document.querySelectorAll('.row-checkbox:checked');
    const ids = Array.from(checkboxes).map(cb => cb.dataset.id);
    
    if (ids.length === 0) return;
    
    if (!confirm(`Delete ${ids.length} selected entries?`)) return;
    
    const loader = document.getElementById('globalLoader');
    if (loader) loader.style.display = 'flex';

    try {
        const { error } = await window.db.from('tailor_expenses').delete().in('id', ids);
        if (error) throw error;
        showToast(`${ids.length} entries deleted!`, "success");
        await loadTailorData();
    } catch (err) {
        showToast("Delete failed", "error");
    } finally {
        if (loader) loader.style.display = 'none';
    }
}

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

function downloadTailorExcel() {
    if (!currentFilteredData || currentFilteredData.length === 0) {
        showToast("No data to download!", "error");
        return;
    }

    try {
        const excelData = currentFilteredData.map(item => ({
            'Date': item.date,
            'Celebrity Name': item.celebrity_name,
            'Item Name': item.item_name || '-',
            'Amount (INR)': Number(item.amount).toFixed(2)
        }));

        const worksheet = XLSX.utils.json_to_sheet(excelData);
        
        const wscols = [
            {wch: 15}, {wch: 25}, {wch: 30}, {wch: 15}
        ];
        worksheet['!cols'] = wscols;

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Tailor Expenses");
        
        const today = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
        XLSX.writeFile(workbook, `Tailor_Report_${today}.xlsx`);
        
        showToast("Excel downloaded successfully!", "success");

    } catch (error) {
        console.error("Excel Error:", error);
        showToast("Failed to generate Excel file", "error");
    }
}

window.downloadTailorExcel = downloadTailorExcel;

document.addEventListener('DOMContentLoaded', () => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    document.getElementById('sumFromDate').value = firstDay.toISOString().split('T')[0];
    document.getElementById('sumToDate').value = today.toISOString().split('T')[0];
});

let currentSummary = null;

async function getGroupedData() {
    const fromDate = document.getElementById('sumFromDate').value;
    const toDate = document.getElementById('sumToDate').value;

    if (!fromDate || !toDate) {
        alert("Please select both dates");
        return null;
    }

    const { data: { user } } = await window.db.auth.getUser();
    const { data: expenses, error } = await window.db
        .from('expenses')
        .select('amount, category, paid_by, payee, purpose')
        .eq('user_id', user.id)
        .gte('date', fromDate)
        .lte('date', toDate);

    if (error) throw error;

    return expenses.reduce((acc, item) => {
        const amt = parseFloat(item.amount) || 0;
        acc.Category[item.category] = (acc.Category[item.category] || 0) + amt;
        acc.Source[item.paid_by || 'Unknown'] = (acc.Source[item.paid_by || 'Unknown'] || 0) + amt;
        acc.Payee[item.payee] = (acc.Payee[item.payee] || 0) + amt;
        acc.Purpose[item.purpose || 'General'] = (acc.Purpose[item.purpose || 'General'] || 0) + amt;
        acc.grandTotal += amt;
        return acc;
    }, { Category: {}, Source: {}, Payee: {}, Purpose: {}, grandTotal: 0 });
}

async function fetchAndShowSummary() {
    const display = document.getElementById('summaryDisplay');
    const loader = document.getElementById('globalLoader');
    loader.style.display = 'flex';

    try {
        currentSummary = await getGroupedData();
        if (!currentSummary) return;
        
        if (currentSummary.grandTotal === 0) {
            display.innerHTML = "<p style='text-align:center; width:100%;'>No data found for this period.</p>";
            return;
        }

        renderSummaryUI();
    } catch (err) {
        alert("Error: " + err.message);
    } finally {
        loader.style.display = 'none';
    }
}

function renderSummaryUI() {
    const display = document.getElementById('summaryDisplay');
    let html = `<div class="grand-total-banner">Grand Total: ₹<span id="liveGrandTotal">${currentSummary.grandTotal.toLocaleString('en-IN')}</span></div>`;

    const groups = ['Category', 'Source', 'Payee', 'Purpose'];
    groups.forEach(group => {
        html += `
            <div class="summary-card" data-group="${group}">
                <div class="card-header-flex">
                    <h3>Group by ${group}</h3>
                    <button class="btn-print-small" onclick="printVisibleGroup('${group}')" title="Download this group PDF">
                        <i class="fa-solid fa-file-pdf"></i>
                    </button>
                </div>
                <table class="summary-table">
                    ${Object.entries(currentSummary[group]).map(([name, total]) => `
                        <tr class="summary-row">
                            <td width="30">
                                <input type="checkbox" checked class="row-checkbox" 
                                    data-group="${group}" data-name="${name}" data-amount="${total}"
                                    onchange="updateLiveTotal()">
                            </td>
                            <td class="item-name">${name}</td>
                            <td class="amount">₹${total.toLocaleString('en-IN')}</td>
                        </tr>
                    `).join('')}
                </table>
            </div>
        `;
    });

    display.innerHTML = html;
}

function updateLiveTotal() {
    let newTotal = 0;
    const checkedItems = document.querySelectorAll('.summary-card[data-group="Category"] .row-checkbox:checked');
    
    checkedItems.forEach(cb => {
        newTotal += parseFloat(cb.getAttribute('data-amount'));
    });

    document.getElementById('liveGrandTotal').innerText = newTotal.toLocaleString('en-IN');
    
    document.querySelectorAll('.summary-row').forEach(row => {
        const cb = row.querySelector('.row-checkbox');
        if(!cb.checked) row.classList.add('excluded-row');
        else row.classList.remove('excluded-row');
    });
}

function printVisibleGroup(groupName) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    const card = document.querySelector(`.summary-card[data-group="${groupName}"]`);
    const checkedRows = card.querySelectorAll('.row-checkbox:checked');
    
    if(checkedRows.length === 0) {
        alert("No items selected in this group!");
        return;
    }

    let tableData = [];
    let groupTotal = 0;

    checkedRows.forEach(cb => {
        const name = cb.getAttribute('data-name');
        const amt = parseFloat(cb.getAttribute('data-amount'));
        tableData.push([name, `INR ${amt.toLocaleString('en-IN', {minimumFractionDigits: 2})}`]);
        groupTotal += amt;
    });

    doc.setFillColor(79, 70, 229);
    doc.rect(0, 0, 210, 20, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.text(`Filtered Summary: ${groupName}`, 14, 13);

    doc.autoTable({
        head: [[groupName, 'Amount']],
        body: tableData,
        startY: 30,
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229] }
    });

    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.text(`Total: INR ${groupTotal.toLocaleString('en-IN', {minimumFractionDigits: 2})}`, 14, doc.lastAutoTable.finalY + 10);
    doc.save(`Filtered_${groupName}.pdf`);
}

async function generateGroupedPDF() {
    const loader = document.getElementById('globalLoader');
    loader.style.display = 'flex';

    try {
        const summary = await getGroupedData();
        if (!summary) return;

        if (summary.grandTotal === 0) {
            alert("No data found for this range");
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const fromDate = document.getElementById('sumFromDate').value;
        const toDate = document.getElementById('sumToDate').value;

        doc.setFillColor(79, 70, 229);
        doc.rect(0, 0, pageWidth, 25, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(18);
        doc.text("GROUPED FINANCIAL SUMMARY", 14, 17);
        
        doc.setFontSize(10);
        doc.text(`Period: ${fromDate} to ${toDate}`, pageWidth - 14, 17, { align: 'right' });

        let currentY = 35;

        const createSummaryTable = (title, dataObj, headLabel) => {
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(12);
            doc.setFont("helvetica", "bold");
            doc.text(title, 14, currentY);
            currentY += 5;

            const tableRows = Object.entries(dataObj).map(([key, val]) => [key, val.toLocaleString('en-IN', { minimumFractionDigits: 2 })]);
            
            doc.autoTable({
                head: [[headLabel, 'Total Amount (INR)']],
                body: tableRows,
                startY: currentY,
                theme: 'striped',
                headStyles: { fillColor: [100, 116, 139] },
                styles: { fontSize: 9 },
                margin: { left: 14, right: 14 }
            });
            currentY = doc.lastAutoTable.finalY + 12;
        };

        createSummaryTable("Summary by Category", summary.Category, "Category");
        createSummaryTable("Summary by Paid By (Source)", summary.Source, "Paid By");
        createSummaryTable("Summary by Payee", summary.Payee, "Payee Name");
        
        if (currentY > 220) { doc.addPage(); currentY = 20; }
        createSummaryTable("Summary by Purpose", summary.Purpose, "Purpose");

        doc.setFillColor(248, 250, 252);
        doc.rect(14, currentY, pageWidth - 28, 15, 'F');
        doc.setTextColor(79, 70, 229);
        doc.setFontSize(14);
        doc.text(`GRAND TOTAL: INR ${summary.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, pageWidth / 2, currentY + 10, { align: 'center' });

        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text("Generated by ExpensePro Manager | Author: Keshab Sarkar", pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });

        doc.save(`Summary_${fromDate}_to_${toDate}.pdf`);

    } catch (err) {
        console.error(err);
        alert("Error generating summary: " + err.message);
    } finally {
        loader.style.display = 'none';
    }
}

// ১. পেজ লোড এবং ইনিশিয়াল সেটআপ (Updated for Lifetime Range)
document.addEventListener('DOMContentLoaded', loadInitialData);

async function loadInitialData() {
    showLoader(); // লোডার শুরু

    
    try {
        const formatDate = (date) => date.toISOString().split('T')[0];
        const today = new Date();
        
        // যদি ইনপুটে আগে থেকে তারিখ না থাকে, তবেই আমরা সেট করব
        if (!document.getElementById('fromDate').value) {
                        
            // ১. শেষের তারিখ: বর্তমান মাসের শেষ দিন বের করা (Last Day of Current Month)
            const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            document.getElementById('toDate').value = formatDate(lastDayOfMonth);
            
            // ২. শুরুর তারিখ: ডাটাবেস থেকে সবচেয়ে পুরনো খরচের তারিখ বের করা
            const { data: oldestExpense, error } = await window.db
                .from('expenses')
                .select('date')
                .order('date', { ascending: true }) // সবচেয়ে পুরনো তারিখ আগে আসবে
                .limit(1)
                .maybeSingle();
            
            if (oldestExpense && oldestExpense.date) {
                // যদি ডাটা থাকে, তাহলে সেই তারিখ বসবে
                document.getElementById('fromDate').value = oldestExpense.date;
            } else {
                // যদি একদমই কোনো ডাটা না থাকে, তাহলে বর্তমান মাসের ১ তারিখ
                const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
                document.getElementById('fromDate').value = formatDate(firstDayOfMonth);
            }
        }

        
        // --- SPEED OPTIMIZATION ---
        // ফিল্টার এবং টেবিল ডাটা একসাথে লোড হবে
        await Promise.all([
            loadFilterOptions(), 
            applyFilters(true) 
        ]);

        
    } catch (error) {
        console.error("Init Error:", error);
        alert("Something went wrong loading data.");
    } finally {
        hideLoader(); // দুটি কাজ শেষ হওয়ার পর লোডার বন্ধ হবে
    }
}

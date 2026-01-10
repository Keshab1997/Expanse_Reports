// assets/js/footer.js

function injectFooter() {
    const currentYear = new Date().getFullYear();
    const footerHTML = `
        <footer class="global-footer">
            <div class="footer-container">
                <div class="footer-info">
                    <p>&copy; ${currentYear} <span class="highlight-name">Keshab Sarkar</span>. All Rights Reserved.</p>
                </div>
                <div class="footer-tagline">
                    <span>Designed & Developed with <i class="fa-solid fa-heart"></i> by Keshab Sarkar</span>
                </div>
            </div>
        </footer>
    `;

    // মেইন কন্টেন্ট এরিয়ার শেষে ফুটার যোগ করা
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
        mainContent.insertAdjacentHTML('beforeend', footerHTML);
    }
}

// পেজ লোড হলে ফুটার চালু হবে
document.addEventListener('DOMContentLoaded', injectFooter);
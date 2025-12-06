// assets/js/config.js

// আপনার Supabase এর তথ্য এখানে বসান
const PROJECT_URL = 'https://oijvwcjxmwcacgpjvwuf.supabase.co';
const API_KEY = 'sb_publishable_MPIeJaoU3nsi-3OWAPsbMw_Eicp1OXr';

// আমরা client তৈরি করে ব্রাউজারের উইন্ডোতে সেভ করে রাখলাম
// যাতে সব ফাইল থেকে এটা পাওয়া যায়
window.db = window.supabase.createClient(PROJECT_URL, API_KEY);

console.log("✅ Supabase Connected Successfully!");
// Supabase Configuration
const PROJECT_URL = 'https://oijvwcjxmwcacgpjvwuf.supabase.co';
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9panZ3Y2p4bXdjYWNncGp2d3VmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUwMzQ5ODcsImV4cCI6MjA4MDYxMDk4N30.bZ2FIwoxGTc8AmcCVm1x4KroJVbscVQ5qGjIvT7C-co';

// Supabase Client Initialize
window.db = window.supabase.createClient(PROJECT_URL, API_KEY);

// console.log("✅ Supabase Connected Successfully!");

// ==================== SUPABASE CLIENT (SINGLETON) ====================
const SUPABASE_URL = 'https://mkgfaiphqrhgpteyljkg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1rZ2ZhaXBocXJoZ3B0ZXlsamtnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0NTM3MDAsImV4cCI6MjA5MTAyOTcwMH0.qgNczEBz614aAZvd1mTMF_oI3Ss7vzxdVQhahb4nvbI';

let supabaseInstance = null;

function getSupabase() {
    if (!supabaseInstance) {
        supabaseInstance = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('%c✅ Supabase client initialized successfully', 'color: lime; font-weight: bold');
    }
    return supabaseInstance;
}

window.getSupabase = getSupabase;

// ==================== COMMON HELPER FUNCTIONS ====================
function generateBookingId() {
    return 'KAG' + Date.now() + Math.floor(Math.random() * 1000);
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-KE');
}

function calculateDays(checkIn, checkOut) {
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const diffTime = Math.abs(end - start);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
}

window.generateBookingId = generateBookingId;
window.formatDate = formatDate;
window.calculateDays = calculateDays;
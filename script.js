// ==================== SUPABASE CONFIGURATION ====================
const SUPABASE_URL = 'https://mkgfaiphqrhgpteyljkg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1rZ2ZhaXBocXJoZ3B0ZXlsamtnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0NTM3MDAsImV4cCI6MjA5MTAyOTcwMH0.qgNczEBz614aAZvd1mTMF_oI3Ss7vzxdVQhahb4nvbI';

// Initialize Supabase client
let supabaseClient = null;
try {
    const { createClient } = supabase;
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('✅ Supabase connected to KAG project');
} catch (err) {
    console.error('❌ Supabase connection failed:', err);
}

// ==================== GLOBAL DATA ====================
let roomData = [];
let items = [];
let bookings = []; // For admin display
let roomRates = {};
let itemAssignments = [];

// ==================== HELPER FUNCTIONS ====================
function generateBookingId() {
    return 'KAG' + Date.now().toString().slice(-6);
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-KE');
}

function calculateDays(checkIn, checkOut) {
    if (!checkIn || !checkOut) return 1;
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const diffTime = Math.abs(end - start);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
}

// ==================== SUPABASE FETCH FUNCTIONS ====================
async function fetchRoomsFromSupabase() {
    if (!supabaseClient) return [];
    try {
        const { data, error } = await supabaseClient.from('rooms').select('*').order('display_order', { ascending: true });
        if (error) throw error;
        console.log(`✅ Loaded ${data?.length || 0} rooms from Supabase`);
        return data || [];
    } catch (err) {
        console.error('❌ Failed to fetch rooms:', err);
        return [];
    }
}

async function fetchItemsFromSupabase() {
    if (!supabaseClient) return [];
    try {
        const { data, error } = await supabaseClient.from('items').select('*');
        if (error) throw error;
        console.log(`✅ Loaded ${data?.length || 0} items from Supabase`);
        return data || [];
    } catch (err) {
        console.error('❌ Failed to fetch items:', err);
        return [];
    }
}

async function fetchBookingsFromSupabase() {
    if (!supabaseClient) return [];
    try {
       // CHANGE TO:
const { data, error } = await supabaseClient
    .from('bookings')
    .select('*')
    .order('created_at', { ascending: false });
        if (error) throw error;
        console.log(`✅ Loaded ${data?.length || 0} bookings from Supabase`);
        return data || [];
    } catch (err) {
        console.error('❌ Failed to fetch bookings:', err);
        return [];
    }
}

// ==================== UI LOADING FUNCTIONS ====================
async function loadRoomsGrid() {
    const container = document.getElementById('roomsGrid');
    if (!container) return;
    
    roomData = await fetchRoomsFromSupabase();
    if (roomData.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:var(--text-secondary);">Loading rooms...</p>';
        return;
    }
    
    container.innerHTML = '';
    roomData.forEach(room => {
        const rate = roomRates[room.room_id] || room.price;
        const card = document.createElement('div');
        card.className = 'room-card';
        card.setAttribute('data-room', room.room_id);
        card.innerHTML = `
            <i class="fas ${room.icon || 'fa-bed'}"></i>
            <h3>${room.name}</h3>
            <p class="room-price">KES ${rate.toLocaleString()}<small>/night</small></p>
        `;
        card.onclick = () => {
            document.querySelectorAll('.room-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            const roomSelect = document.getElementById('roomType');
            if (roomSelect) roomSelect.value = room.room_id;
            calculateTotal();
        };
        container.appendChild(card);
    });
}

async function loadRoomOptions() {
    const select = document.getElementById('roomType');
    if (!select) return;
    
    if (roomData.length === 0) roomData = await fetchRoomsFromSupabase();
    
    select.innerHTML = '<option value="">-- Select Room --</option>';
    roomData.forEach(room => {
        const rate = roomRates[room.room_id] || room.price;
        const option = document.createElement('option');
        option.value = room.room_id;
        option.textContent = `${room.name} - KES ${rate.toLocaleString()}/night`;
        select.appendChild(option);
    });
}

async function loadItemsCheckbox() {
    const container = document.getElementById('itemsCheckbox');
    if (!container) return;
    
    items = await fetchItemsFromSupabase();
    if (items.length === 0) {
        container.innerHTML = '<small>No items available</small>';
        return;
    }
    
    container.innerHTML = '';
    items.forEach(item => {
        const label = document.createElement('label');
        const isBlanket = item.item_name?.toLowerCase().includes('blanket');
        label.innerHTML = `
            <input type="checkbox" class="requested-item" value="${item.item_id}" data-price="${item.price_per_day || 0}">
            ${item.item_name} ${item.price_per_day ? `(KES ${item.price_per_day}/night)` : ''}
        `;
        container.appendChild(label);
        
        // Show extra blanket input if blanket selected
        if (isBlanket) {
            const checkbox = label.querySelector('input');
            checkbox.addEventListener('change', (e) => {
                const extraGroup = document.getElementById('extraBlanketGroup');
                if (extraGroup) extraGroup.style.display = e.target.checked ? 'block' : 'none';
                calculateTotal();
            });
        }
    });
    
    // Add change listeners to all checkboxes
    container.querySelectorAll('.requested-item').forEach(cb => {
        if (!cb.dataset.hasListener) {
            cb.addEventListener('change', calculateTotal);
            cb.dataset.hasListener = 'true';
        }
    });
}

function calculateTotal() {
    const roomType = document.getElementById('roomType')?.value;
    const checkIn = document.getElementById('checkIn')?.value;
    const checkOut = document.getElementById('checkOut')?.value;
    
    if (!roomType || !checkIn || !checkOut) return;
    
    const days = calculateDays(checkIn, checkOut);
    const room = roomData.find(r => r.room_id === roomType);
    const rate = room?.price || 0;
    let total = days * rate;
    
    // Add items cost
    const selectedItems = document.querySelectorAll('.requested-item:checked');
    selectedItems.forEach(item => {
        const price = parseInt(item.dataset.price) || 0;
        total += price * days;
    });
    
    // Add extra blankets cost
    const extraBlankets = parseInt(document.getElementById('extraBlankets')?.value) || 0;
    if (extraBlankets > 0) {
        total += extraBlankets * 10 * days;
    }
    
    // Update UI
    const roomRateDisplay = document.getElementById('roomRate');
    const totalDaysDisplay = document.getElementById('totalDays');
    const totalAmountDisplay = document.getElementById('totalAmount');
    const priceSummary = document.getElementById('priceSummary');
    const ratePerDisplay = document.getElementById('ratePer');
    const extraBlanketRow = document.getElementById('extraBlanketRow');
    
    if (roomRateDisplay) roomRateDisplay.innerHTML = `KES ${rate.toLocaleString()}`;
    if (totalDaysDisplay) totalDaysDisplay.innerText = days;
    if (totalAmountDisplay) totalAmountDisplay.innerHTML = `KES ${total.toLocaleString()}`;
    if (priceSummary) priceSummary.style.display = 'block';
    if (ratePerDisplay) ratePerDisplay.innerText = `per ${days} night${days > 1 ? 's' : ''}`;
    
    if (extraBlanketRow) {
        if (extraBlankets > 0) {
            extraBlanketRow.style.display = 'block';
            document.getElementById('extraBlanketCount').innerText = extraBlankets;
            document.getElementById('extraBlanketCost').innerHTML = `KES ${(extraBlankets * 10 * days).toLocaleString()}`;
        } else {
            extraBlanketRow.style.display = 'none';
        }
    }
}

// ==================== BOOKING SUBMISSION ====================
async function handleBookingSubmit(e) {
    e.preventDefault();
    
    const roomType = document.getElementById('roomType')?.value;
    const checkIn = document.getElementById('checkIn')?.value;
    const checkOut = document.getElementById('checkOut')?.value;
    const guests = parseInt(document.getElementById('guests')?.value) || 1;
    const guestName = document.getElementById('guestName')?.value;
    const phone = document.getElementById('phone')?.value;
    const email = document.getElementById('email')?.value || null;
    const transactionId = document.getElementById('transactionId')?.value || 'WALKIN-' + Date.now();
    
    if (!roomType || !checkIn || !checkOut || !guestName || !phone || !transactionId) {
        alert('Please fill in all required fields!');
        return;
    }
    
    const days = calculateDays(checkIn, checkOut);
    const room = roomData.find(r => r.room_id === roomType);
    const rate = room?.price || 0;
    let totalAmount = days * rate;
    
    // Calculate items cost
    const selectedItems = document.querySelectorAll('.requested-item:checked');
    const requestedItems = [];
    selectedItems.forEach(cb => {
        const item = items.find(i => i.item_id === cb.value);
        const price = parseInt(cb.dataset.price) || 0;
        if (item) {
            requestedItems.push(item.item_id);
            totalAmount += price * days;
        }
    });
    
    // Extra blankets
    const extraBlankets = parseInt(document.getElementById('extraBlankets')?.value) || 0;
    if (extraBlankets > 0) totalAmount += extraBlankets * 10 * days;
    
    const bookingId = generateBookingId();
    const guestIdNum = Math.floor(Math.random() * 100000);
    
    const submitBtn = document.querySelector('.btn-submit');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    }
    
    try {
        if (!supabaseClient) throw new Error('Database not connected');
        
        // 1. Insert guest
        const { data: guestData, error: guestError } = await supabaseClient
            .from('guests')
            .insert([{
                guest_id: guestIdNum,
                name: guestName,
                phone: phone,
                email: email,
                room_id: roomType,
                check_in: checkIn,
                check_out: checkOut,
                nights: days,
                guests_count: guests,
                booking_id: bookingId
            }])
            .select();
        
        if (guestError) throw new Error(`Guest save failed: ${guestError.message}`);
        
        // 2. Insert booking
       const { error: bookingError } = await supabaseClient
    .from('bookings')
    .insert([{
        booking_id: bookingId,
        guest_id: guestIdNum,
        room_id: roomType,
        check_in: checkIn,
        check_out: checkOut,
        nights: days,
        guests_count: guests,
        total_amount: totalAmount,
        transaction_id: transactionId,
        extra_blankets: extraBlankets,
        guest_name: guestName,      // ← ADD THIS
        guest_phone: phone,          // ← ADD THIS
        status: 'pending',
        created_at: new Date().toISOString()
    }]);
        
        if (bookingError) throw new Error(`Booking save failed: ${bookingError.message}`);
        
        // 3. Insert booking items if any
        if (requestedItems.length > 0) {
            for (const itemId of requestedItems) {
                await supabaseClient.from('booking_items').insert([{
                    booking_id: bookingId,
                    item_id: itemId,
                    status: 'assigned',
                    assigned_at: new Date().toISOString()
                }]);
            }
        }
        
        alert(`✅ Booking Successful!\n\nBooking ID: ${bookingId}\nRoom: ${room?.name}\nNights: ${days}\nTotal: KES ${totalAmount.toLocaleString()}\n\nPlease save this ID for check-in.`);
        
        // Reset form
        document.getElementById('bookingForm')?.reset();
        document.querySelectorAll('.room-card').forEach(c => c.classList.remove('selected'));
        const priceSummary = document.getElementById('priceSummary');
        const extraGroup = document.getElementById('extraBlanketGroup');
        if (priceSummary) priceSummary.style.display = 'none';
        if (extraGroup) extraGroup.style.display = 'none';
        
    } catch (error) {
        console.error('Booking error:', error);
        alert(`❌ Booking failed: ${error.message}\n\nPlease try again.`);
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-check-circle"></i> Complete Booking';
        }
    }
}

// ==================== TYPING ANIMATION ====================
function typeWriter(element, text, speed = 100) {
    if (!element) return;
    let i = 0;
    element.innerHTML = '';
    function type() {
        if (i < text.length) {
            element.innerHTML += text.charAt(i);
            i++;
            setTimeout(type, speed);
        }
    }
    type();
}

function initTypingAnimations() {
    const typingElement = document.getElementById('typingText');
    const canteenElement = document.getElementById('canteenText');
    
    if (typingElement) {
       // TO:
const phrases = [
    "Welcome to Katoloni Prayer Center",
    "Find rest and peace",
    "Comfortable accommodations",
    "Book your stay today"
];
        let phraseIndex = 0;
        
        function typeNext() {
            typeWriter(typingElement, phrases[phraseIndex], 80);
            setTimeout(() => {
                phraseIndex = (phraseIndex + 1) % phrases.length;
                typeNext();
            }, 4000);
        }
        typeNext();
    }
    
    if (canteenElement) {
        setTimeout(() => {
            typeWriter(canteenElement, '🍽️ Canteen Available on-site 🍽️', 60);
        }, 2000);
    }
}

// ==================== DARK MODE ====================
function initDarkMode() {
    const themeToggle = document.getElementById('themeToggle');
    if (!themeToggle) return;
    
    const savedTheme = localStorage.getItem('kag_theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark');
        themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
    }
    
    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark');
        const isDark = document.body.classList.contains('dark');
        localStorage.setItem('kag_theme', isDark ? 'dark' : 'light');
        themeToggle.innerHTML = isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    });
}

// ==================== MOBILE SIDEBAR ====================
function initMobileSidebar() {
    const hamburger = document.getElementById('hamburger');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    const closeSidebarBtn = document.getElementById('closeSidebar');
    
    if (!hamburger || !sidebar || !overlay) return;
    
    const openSidebar = () => {
        sidebar.classList.add('active');
        overlay.classList.add('active');
    };
    
    const closeSidebar = () => {
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
    };
    
    hamburger.addEventListener('click', openSidebar);
    closeSidebarBtn?.addEventListener('click', closeSidebar);
    overlay.addEventListener('click', closeSidebar);
    
    // Scroll links
    document.getElementById('scrollToRooms')?.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('roomsSection')?.scrollIntoView({ behavior: 'smooth' });
        closeSidebar();
    });
    
    document.getElementById('scrollToBooking')?.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('bookingSection')?.scrollIntoView({ behavior: 'smooth' });
        closeSidebar();
    });
    
    document.getElementById('heroBookBtn')?.addEventListener('click', () => {
        document.getElementById('bookingSection')?.scrollIntoView({ behavior: 'smooth' });
    });
}

// ==================== DATE PICKERS ====================
function initDatePickers() {
    const checkIn = document.getElementById('checkIn');
    const checkOut = document.getElementById('checkOut');
    
    if (!checkIn || !checkOut) return;
    
    const today = new Date().toISOString().split('T')[0];
    checkIn.min = today;
    checkOut.min = today;
    
    checkIn.addEventListener('change', () => {
        checkOut.min = checkIn.value;
        if (checkOut.value && checkOut.value <= checkIn.value) {
            const nextDay = new Date(checkIn.value);
            nextDay.setDate(nextDay.getDate() + 1);
            checkOut.value = nextDay.toISOString().split('T')[0];
        }
        calculateTotal();
    });
    
    checkOut.addEventListener('change', calculateTotal);
}

// ==================== ADMIN FUNCTIONS ====================
async function updateAdminStats() {
    const bookingsData = await fetchBookingsFromSupabase();
    bookings = bookingsData;
    
    const totalBookings = bookings.length;
    const today = new Date().toISOString().split('T')[0];
    const todayCheckins = bookings.filter(b => b.check_in === today && b.status === 'confirmed').length;
    const totalEarnings = bookings.filter(b => b.status === 'checked-out').reduce((sum, b) => sum + (b.total_amount || 0), 0);
    const checkedIn = bookings.filter(b => b.status === 'checked-in').length;
    const occupancyRate = checkedIn > 0 ? Math.min(100, (checkedIn / 5) * 100) : 0;
    
    document.getElementById('totalBookings').innerText = totalBookings;
    document.getElementById('todayCheckins').innerText = todayCheckins;
    document.getElementById('totalEarnings').innerHTML = `KES ${totalEarnings.toLocaleString()}`;
    document.getElementById('occupancyRate').innerText = `${Math.round(occupancyRate)}%`;
}

async function loadBookingsTable(filter = 'all') {
    const tbody = document.getElementById('bookingsTableBody');
    if (!tbody) return;
    
    if (bookings.length === 0) bookings = await fetchBookingsFromSupabase();
    
    let filtered = bookings;
    if (filter !== 'all') {
        filtered = bookings.filter(b => b.status === filter);
    }
    
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:2rem;">No bookings found</td></tr>';
        return;
    }
    
    tbody.innerHTML = '';
    filtered.forEach(b => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${b.booking_id}</td>
           <td>${b.guest_name || 'Unknown'}<br><small>${b.guest_phone || 'N/A'}</small></td>
            <td>${roomData.find(r => r.room_id === b.room_id)?.name || b.room_id}</td>
            <td>${formatDate(b.check_in)}</td>
            <td>${formatDate(b.check_out)}</td>
            <td>KES ${(b.total_amount || 0).toLocaleString()}</td>
            <td><span class="status-badge status-${b.status}">${b.status}</span></td>
            <td class="action-buttons">
                ${b.status === 'pending' ? `<button class="action-btn" onclick="updateBookingStatus('${b.booking_id}', 'confirmed')" title="Confirm">✅</button>` : ''}
                ${b.status === 'confirmed' ? `<button class="action-btn" onclick="updateBookingStatus('${b.booking_id}', 'checked-in')" title="Check-in">🚪</button>` : ''}
                ${b.status === 'checked-in' ? `<button class="action-btn" onclick="updateBookingStatus('${b.booking_id}', 'checked-out')" title="Check-out">🚪❌</button>` : ''}
                ${b.status !== 'checked-out' && b.status !== 'cancelled' ? `<button class="action-btn" onclick="updateBookingStatus('${b.booking_id}', 'cancelled')" title="Cancel">❌</button>` : ''}
            </td>
        `;
    });
}

async function updateBookingStatus(bookingId, status) {
    if (!supabaseClient) return alert('Database not connected');
    
    try {
        const { error } = await supabaseClient
            .from('bookings')
            .update({ status: status })
            .eq('booking_id', bookingId);
        
        if (error) throw error;
        
        alert(`Booking ${bookingId} updated to: ${status}`);
        await loadBookingsTable();
        await updateAdminStats();
    } catch (err) {
        alert('Failed to update status: ' + err.message);
    }
}

async function loadRoomRatesEditor() {
    const container = document.getElementById('roomsEditGrid');
    if (!container) return;
    
    if (roomData.length === 0) roomData = await fetchRoomsFromSupabase();
    
    container.innerHTML = '';
    roomData.forEach(room => {
        container.innerHTML += `
            <div class="room-rate-edit">
                <label>${room.name}</label>
                <input type="number" id="rate_${room.room_id}" value="${room.price}" class="rate-input">
                <small>KES per night</small>
            </div>
        `;
    });
}

async function saveRoomRates() {
    if (!supabaseClient) return alert('Database not connected');
    
    try {
        for (const room of roomData) {
            const newRate = parseInt(document.getElementById(`rate_${room.room_id}`)?.value);
            if (newRate && !isNaN(newRate) && newRate !== room.price) {
                const { error } = await supabaseClient
                    .from('rooms')
                    .update({ price: newRate })
                    .eq('room_id', room.room_id);
                
                if (error) console.error('Failed to update', room.room_id, error);
            }
        }
        alert('✅ Room rates updated!');
        await loadRoomsGrid();
    } catch (err) {
        alert('Failed to save rates: ' + err.message);
    }
}

// ==================== ADMIN LOGIN ====================
function initAdminLogin() {
    const loginOverlay = document.getElementById('loginOverlay');
    const dashboardContent = document.getElementById('dashboardContent');
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    
    if (!loginOverlay || !dashboardContent) return;
    
    if (sessionStorage.getItem('kag_admin_logged_in') === 'true') {
        loginOverlay.style.display = 'none';
        dashboardContent.style.display = 'block';
        loadAdminData();
    }
    
    loginBtn?.addEventListener('click', () => {
        const password = document.getElementById('adminPassword')?.value;
        if (password === 'admin254') {
            sessionStorage.setItem('kag_admin_logged_in', 'true');
            loginOverlay.style.display = 'none';
            dashboardContent.style.display = 'block';
            loadAdminData();
        } else {
            alert('❌ Wrong password! Use: admin254');
        }
    });
    
    logoutBtn?.addEventListener('click', () => {
        sessionStorage.removeItem('kag_admin_logged_in');
        location.reload();
    });
}

async function loadAdminData() {
    await updateAdminStats();
    await loadBookingsTable();
    await loadRoomRatesEditor();
    
    // Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(`${btn.dataset.tab}Tab`)?.classList.add('active');
        });
    });
    
    // Filters
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            loadBookingsTable(btn.dataset.filter);
        });
    });
    
    document.getElementById('saveRoomRates')?.addEventListener('click', saveRoomRates);
}

// ==================== INITIALIZATION ====================
function init() {
    console.log('🚀 KAG Guest House initializing...');
    
    // Common features
    initDarkMode();
    initMobileSidebar();
    initTypingAnimations();
    
    // Guest page features
    if (document.getElementById('roomsGrid')) {
        loadRoomsGrid();
        loadRoomOptions();
        loadItemsCheckbox();
        initDatePickers();
        
        const bookingForm = document.getElementById('bookingForm');
        if (bookingForm) bookingForm.addEventListener('submit', handleBookingSubmit);
        
        const extraBlankets = document.getElementById('extraBlankets');
        if (extraBlankets) {
            extraBlankets.addEventListener('change', calculateTotal);
            extraBlankets.addEventListener('input', calculateTotal);
        }
    }
    
    // Admin page features
    if (document.getElementById('loginOverlay')) {
        initAdminLogin();
    }
    
    console.log('✅ KAG Guest House ready!');
}

// Start
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Make functions available globally for HTML onclick
window.updateBookingStatus = updateBookingStatus;
// Initialize Data
let bookings = JSON.parse(localStorage.getItem('kag_bookings')) || [];
let roomRates = JSON.parse(localStorage.getItem('kag_roomRates')) || {
    'pastor': 1500,
    'normal_single': 1000,
    'normal_hall': 500,
    'others': 800
};

let items = [
    { id: 'blanket', name: 'Blanket', cost: 1500 },
    { id: 'pillow', name: 'Pillow', cost: 800 },
    { id: 'bedsheet', name: 'Bedsheet', cost: 1000 },
    { id: 'towel', name: 'Towel', cost: 500 },
    { id: 'mattress', name: 'Mattress', cost: 3000 }
];

let itemAssignments = JSON.parse(localStorage.getItem('kag_itemAssignments')) || [];

// Room Display Names
const roomNames = {
    'pastor': 'Pastor Room',
    'normal_single': 'Normal Single Room',
    'normal_hall': 'Normal Hall (Dormitory)',
    'others': 'Others'
};

// Save to localStorage
function saveData() {
    localStorage.setItem('kag_bookings', JSON.stringify(bookings));
    localStorage.setItem('kag_roomRates', JSON.stringify(roomRates));
    localStorage.setItem('kag_itemAssignments', JSON.stringify(itemAssignments));
}

// Generate Booking ID
function generateBookingId() {
    return 'KAG' + Date.now() + Math.floor(Math.random() * 1000);
}

// Format Date
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-KE');
}

// Calculate Days between dates
function calculateDays(checkIn, checkOut) {
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
}

// Load Rooms Grid (Guest Page)
function loadRoomsGrid() {
    const roomsGrid = document.getElementById('roomsGrid');
    if (!roomsGrid) return;
    
    roomsGrid.innerHTML = '';
    for (const [key, rate] of Object.entries(roomRates)) {
        const roomCard = document.createElement('div');
        roomCard.className = 'room-card';
        roomCard.setAttribute('data-room', key);
        roomCard.innerHTML = `
            <i class="fas fa-bed"></i>
            <h3>${roomNames[key]}</h3>
            <p class="room-price">KES ${rate.toLocaleString()}<small>/day</small></p>
            <small>${key === 'pastor' ? 'For pastoral use only' : key === 'normal_hall' ? 'Shared dormitory' : 'Private room'}</small>
        `;
        roomCard.onclick = () => {
            document.querySelectorAll('.room-card').forEach(c => c.classList.remove('selected'));
            roomCard.classList.add('selected');
            document.getElementById('roomType').value = key;
            calculateTotal();
        };
        roomsGrid.appendChild(roomCard);
    }
}

// Load Room Options in Select
function loadRoomOptions() {
    const roomSelect = document.getElementById('roomType');
    if (!roomSelect) return;
    
    roomSelect.innerHTML = '<option value="">-- Select Room --</option>';
    for (const [key, rate] of Object.entries(roomRates)) {
        roomSelect.innerHTML += `<option value="${key}">${roomNames[key]} - KES ${rate.toLocaleString()}/day</option>`;
    }
}

// Load Items Checkbox
function loadItemsCheckbox() {
    const itemsContainer = document.getElementById('itemsCheckbox');
    if (!itemsContainer) return;
    
    itemsContainer.innerHTML = '';
    items.forEach(item => {
        itemsContainer.innerHTML += `
            <label>
                <input type="checkbox" value="${item.id}" class="requested-item">
                ${item.name} (KES ${item.cost.toLocaleString()} if lost)
            </label>
        `;
    });
}

// Calculate Total Price
function calculateTotal() {
    const roomType = document.getElementById('roomType')?.value;
    const checkIn = document.getElementById('checkIn')?.value;
    const checkOut = document.getElementById('checkOut')?.value;
    
    if (!roomType || !checkIn || !checkOut) return;
    
    const days = calculateDays(checkIn, checkOut);
    const rate = roomRates[roomType];
    const total = days * rate;
    
    document.getElementById('roomRate').innerHTML = `KES ${rate.toLocaleString()}`;
    document.getElementById('totalDays').innerText = days;
    document.getElementById('totalNights').innerText = days;
    document.getElementById('totalAmount').innerHTML = `KES ${total.toLocaleString()}`;
}

// Handle Booking Submission
function handleBookingSubmit(e) {
    e.preventDefault();
    
    const roomType = document.getElementById('roomType')?.value;
    const checkIn = document.getElementById('checkIn')?.value;
    const checkOut = document.getElementById('checkOut')?.value;
    const guests = document.getElementById('guests')?.value;
    const guestName = document.getElementById('guestName')?.value;
    const phone = document.getElementById('phone')?.value;
    const email = document.getElementById('email')?.value;
    const transactionId = document.getElementById('transactionId')?.value;
    
    if (!roomType || !checkIn || !checkOut || !guestName || !phone || !transactionId) {
        alert('Please fill in all required fields!');
        return;
    }
    
    const days = calculateDays(checkIn, checkOut);
    const totalAmount = days * roomRates[roomType];
    
    // Get requested items
    const requestedItems = [];
    document.querySelectorAll('.requested-item:checked').forEach(cb => {
        const item = items.find(i => i.id === cb.value);
        if (item) requestedItems.push(item);
    });
    
    const newBooking = {
        id: generateBookingId(),
        roomType,
        roomName: roomNames[roomType],
        guestName,
        phone,
        email: email || 'Not provided',
        checkIn,
        checkOut,
        guests: parseInt(guests),
        totalAmount,
        transactionId,
        requestedItems,
        status: 'pending',
        createdAt: new Date().toISOString(),
        itemsAssigned: false
    };
    
    bookings.push(newBooking);
    saveData();
    
    alert(`✅ Booking Successful!\n\nBooking ID: ${newBooking.id}\nRoom: ${newBooking.roomName}\nTotal: KES ${totalAmount.toLocaleString()}\n\nPlease show this ID at check-in.`);
    
    document.getElementById('bookingForm')?.reset();
    document.querySelectorAll('.room-card').forEach(c => c.classList.remove('selected'));
}

// ============ ADMIN FUNCTIONS ============

// Update Admin Dashboard Stats
function updateAdminStats() {
    const totalBookings = bookings.length;
    const today = new Date().toISOString().split('T')[0];
    const todayCheckins = bookings.filter(b => b.checkIn === today && b.status === 'confirmed').length;
    const totalEarnings = bookings.filter(b => b.status === 'checked-out').reduce((sum, b) => sum + b.totalAmount, 0);
    const occupancyRate = bookings.filter(b => b.status === 'checked-in').length > 0 ? 
        Math.min(100, (bookings.filter(b => b.status === 'checked-in').length / 4) * 100) : 0;
    
    document.getElementById('totalBookings').innerText = totalBookings;
    document.getElementById('todayCheckins').innerText = todayCheckins;
    document.getElementById('totalEarnings').innerHTML = `KES ${totalEarnings.toLocaleString()}`;
    document.getElementById('occupancyRate').innerText = `${Math.round(occupancyRate)}%`;
}

// Load Bookings Table
function loadBookingsTable(filter = 'all') {
    const tbody = document.getElementById('bookingsTableBody');
    if (!tbody) return;
    
    let filteredBookings = bookings;
    if (filter !== 'all') {
        filteredBookings = bookings.filter(b => b.status === filter);
    }
    
    if (filteredBookings.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center;">No bookings found</td></tr>';
        return;
    }
    
    tbody.innerHTML = '';
    filteredBookings.forEach(booking => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${booking.id}</td>
            <td>${booking.guestName}<br><small>${booking.phone}</small></td>
            <td>${booking.roomName}</td>
            <td>${formatDate(booking.checkIn)}</td>
            <td>${formatDate(booking.checkOut)}</td>
            <td>KES ${booking.totalAmount.toLocaleString()}</td>
            <td><span class="status-badge status-${booking.status}">${booking.status}</span></td>
            <td class="action-buttons">
                ${booking.status === 'pending' ? '<button class="action-btn" onclick="confirmBooking(\'' + booking.id + '\')" title="Confirm">✅</button>' : ''}
                ${booking.status === 'confirmed' ? '<button class="action-btn" onclick="checkInGuest(\'' + booking.id + '\')" title="Check-in">🚪</button>' : ''}
                ${booking.status === 'checked-in' ? '<button class="action-btn" onclick="checkOutGuest(\'' + booking.id + '\')" title="Check-out">🚪❌</button>' : ''}
                ${booking.status !== 'checked-out' && booking.status !== 'cancelled' ? '<button class="action-btn" onclick="cancelBooking(\'' + booking.id + '\')" title="Cancel">❌</button>' : ''}
            </td>
        `;
    });
}

// Confirm Booking
function confirmBooking(id) {
    const booking = bookings.find(b => b.id === id);
    if (booking) {
        booking.status = 'confirmed';
        saveData();
        loadBookingsTable();
        updateAdminStats();
        alert(`Booking ${id} confirmed!`);
    }
}

// Check-in Guest
function checkInGuest(id) {
    const booking = bookings.find(b => b.id === id);
    if (booking) {
        booking.status = 'checked-in';
        saveData();
        loadBookingsTable();
        updateAdminStats();
        loadItemTracking();
        alert(`${booking.guestName} has checked in!`);
    }
}

// Check-out Guest
function checkOutGuest(id) {
    const booking = bookings.find(b => b.id === id);
    if (booking && confirm(`Check out ${booking.guestName}?`)) {
        booking.status = 'checked-out';
        saveData();
        loadBookingsTable();
        updateAdminStats();
        loadReports();
        alert(`${booking.guestName} checked out successfully!`);
    }
}

// Cancel Booking
function cancelBooking(id) {
    if (confirm('Cancel this booking?')) {
        const booking = bookings.find(b => b.id === id);
        if (booking) {
            booking.status = 'cancelled';
            saveData();
            loadBookingsTable();
            updateAdminStats();
            alert('Booking cancelled!');
        }
    }
}

// Load Room Rates Editor
function loadRoomRatesEditor() {
    const container = document.getElementById('roomsEditGrid');
    if (!container) return;
    
    container.innerHTML = '';
    for (const [key, rate] of Object.entries(roomRates)) {
        container.innerHTML += `
            <div class="room-rate-edit">
                <label>${roomNames[key]}</label>
                <input type="number" id="rate_${key}" value="${rate}" class="rate-input">
                <small>KES per day</small>
            </div>
        `;
    }
}

// Save Room Rates
function saveRoomRates() {
    for (const [key] of Object.entries(roomRates)) {
        const newRate = parseInt(document.getElementById(`rate_${key}`)?.value);
        if (newRate && !isNaN(newRate)) {
            roomRates[key] = newRate;
        }
    }
    saveData();
    alert('Room rates updated successfully!');
    if (typeof loadRoomsGrid === 'function') loadRoomsGrid();
}

// Load Item Tracking
function loadItemTracking() {
    const container = document.getElementById('itemTrackingContainer');
    if (!container) return;
    
    const checkedInGuests = bookings.filter(b => b.status === 'checked-in');
    
    if (checkedInGuests.length === 0) {
        container.innerHTML = '<p>No guests currently checked in.</p>';
        return;
    }
    
    container.innerHTML = '';
    checkedInGuests.forEach(guest => {
        const guestAssignments = itemAssignments.filter(a => a.bookingId === guest.id);
        
        const guestDiv = document.createElement('div');
        guestDiv.className = 'guest-items-card';
        guestDiv.innerHTML = `
            <h4>${guest.guestName} (${guest.roomName})</h4>
            <div class="items-list" id="items-${guest.id}">
                ${items.map(item => {
                    const assigned = guestAssignments.find(a => a.itemId === item.id);
                    return `
                        <div class="item-row">
                            <span>${item.name} (KES ${item.cost.toLocaleString()})</span>
                            <select onchange="updateItemStatus('${guest.id}', '${item.id}', this.value)">
                                <option value="not_assigned" ${!assigned ? 'selected' : ''}>Not Assigned</option>
                                <option value="assigned" ${assigned?.status === 'assigned' ? 'selected' : ''}>Assigned</option>
                                <option value="returned" ${assigned?.status === 'returned' ? 'selected' : ''}>Returned</option>
                                <option value="lost" ${assigned?.status === 'lost' ? 'selected' : ''}>Lost (Charge KES ${item.cost})</option>
                            </select>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
        container.appendChild(guestDiv);
    });
}

// Update Item Status
function updateItemStatus(bookingId, itemId, status) {
    const item = items.find(i => i.id === itemId);
    const existingIndex = itemAssignments.findIndex(a => a.bookingId === bookingId && a.itemId === itemId);
    
    if (status === 'not_assigned') {
        if (existingIndex !== -1) itemAssignments.splice(existingIndex, 1);
    } else {
        const assignment = {
            bookingId,
            itemId,
            itemName: item.name,
            status,
            cost: status === 'lost' ? item.cost : 0
        };
        
        if (existingIndex !== -1) {
            itemAssignments[existingIndex] = assignment;
        } else {
            itemAssignments.push(assignment);
        }
    }
    
    saveData();
    loadLostItemsList();
    loadReports();
    alert(`Item status updated!`);
}

// Load Lost Items List
function loadLostItemsList() {
    const container = document.getElementById('lostItemsList');
    if (!container) return;
    
    const lostItems = itemAssignments.filter(a => a.status === 'lost');
    const totalLostCharges = lostItems.reduce((sum, item) => sum + item.cost, 0);
    
    if (lostItems.length === 0) {
        container.innerHTML = '<p>No lost items reported.</p>';
        return;
    }
    
    container.innerHTML = `
        <table class="lost-items-table">
            <thead>
                <tr><th>Guest</th><th>Item</th><th>Charge (KES)</th></tr>
            </thead>
            <tbody>
                ${lostItems.map(item => {
                    const booking = bookings.find(b => b.id === item.bookingId);
                    return `
                        <tr>
                            <td>${booking?.guestName || 'Unknown'}</td>
                            <td>${item.itemName}</td>
                            <td>KES ${item.cost.toLocaleString()}</td>
                        </tr>
                    `;
                }).join('')}
                <tr class="total-row"><td colspan="2"><strong>Total Lost Items Charges</strong></td><td><strong>KES ${totalLostCharges.toLocaleString()}</strong></td></tr>
            </tbody>
        </table>
    `;
}

// Load Reports
function loadReports() {
    const today = new Date().toISOString().split('T')[0];
    const todayEarnings = bookings.filter(b => b.checkOut === today && b.status === 'checked-out').reduce((sum, b) => sum + b.totalAmount, 0);
    
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekEarnings = bookings.filter(b => new Date(b.checkOut) >= weekAgo && b.status === 'checked-out').reduce((sum, b) => sum + b.totalAmount, 0);
    
    const monthAgo = new Date();
    monthAgo.setDate(monthAgo.getDate() - 30);
    const monthEarnings = bookings.filter(b => new Date(b.checkOut) >= monthAgo && b.status === 'checked-out').reduce((sum, b) => sum + b.totalAmount, 0);
    
    const lostItemsTotal = itemAssignments.filter(a => a.status === 'lost').reduce((sum, a) => sum + a.cost, 0);
    
    document.getElementById('todayEarnings').innerHTML = `KES ${todayEarnings.toLocaleString()}`;
    document.getElementById('weekEarnings').innerHTML = `KES ${weekEarnings.toLocaleString()}`;
    document.getElementById('monthEarnings').innerHTML = `KES ${monthEarnings.toLocaleString()}`;
    document.getElementById('lostItemsTotal').innerHTML = `KES ${lostItemsTotal.toLocaleString()}`;
    
    const currentGuests = bookings.filter(b => b.status === 'checked-in');
    const guestsContainer = document.getElementById('currentGuestsList');
    if (guestsContainer) {
        if (currentGuests.length === 0) {
            guestsContainer.innerHTML = '<p>No guests currently checked in.</p>';
        } else {
            guestsContainer.innerHTML = currentGuests.map(guest => `
                <div class="guest-card">
                    <strong>${guest.guestName}</strong><br>
                    Room: ${guest.roomName}<br>
                    Check-in: ${formatDate(guest.checkIn)}<br>
                    Phone: ${guest.phone}
                </div>
            `).join('');
        }
    }
}

// ============ INITIALIZATION ============

// Dark Mode Toggle
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

// Admin Login
function initAdminLogin() {
    const loginOverlay = document.getElementById('loginOverlay');
    const dashboardContent = document.getElementById('dashboardContent');
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    
    if (!loginOverlay || !dashboardContent) return;
    
    const isLoggedIn = sessionStorage.getItem('kag_admin_logged_in');
    if (isLoggedIn === 'true') {
        loginOverlay.style.display = 'none';
        dashboardContent.style.display = 'block';
        loadAdminData();
    }
    
    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            const password = document.getElementById('adminPassword')?.value;
            if (password === 'admin254') {
                sessionStorage.setItem('kag_admin_logged_in', 'true');
                loginOverlay.style.display = 'none';
                dashboardContent.style.display = 'block';
                loadAdminData();
            } else {
                alert('Wrong password! Use: admin254');
            }
        });
    }
    
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            sessionStorage.removeItem('kag_admin_logged_in');
            location.reload();
        });
    }
}

function loadAdminData() {
    updateAdminStats();
    loadBookingsTable();
    loadRoomRatesEditor();
    loadItemTracking();
    loadLostItemsList();
    loadReports();
    
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(`${btn.dataset.tab}Tab`).classList.add('active');
            if (btn.dataset.tab === 'items') loadItemTracking();
            if (btn.dataset.tab === 'reports') loadReports();
        });
    });
    
    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            loadBookingsTable(btn.dataset.filter);
        });
    });
    
    const saveRatesBtn = document.getElementById('saveRoomRates');
    if (saveRatesBtn) saveRatesBtn.addEventListener('click', saveRoomRates);
}

// Mobile Sidebar
function initMobileSidebar() {
    const hamburger = document.getElementById('hamburger');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    const closeSidebar = document.getElementById('closeSidebar');
    
    if (!hamburger || !sidebar || !overlay) return;
    
    hamburger.addEventListener('click', () => {
        sidebar.classList.add('active');
        overlay.classList.add('active');
    });
    
    const closeSidebarFunc = () => {
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
    };
    
    if (closeSidebar) closeSidebar.addEventListener('click', closeSidebarFunc);
    overlay.addEventListener('click', closeSidebarFunc);
    
    const scrollToRooms = document.getElementById('scrollToRooms');
    const scrollToBooking = document.getElementById('scrollToBooking');
    const heroBookBtn = document.getElementById('heroBookBtn');
    
    if (scrollToRooms) {
        scrollToRooms.addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('roomsSection')?.scrollIntoView({ behavior: 'smooth' });
            closeSidebarFunc();
        });
    }
    
    if (scrollToBooking) {
        scrollToBooking.addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('bookingSection')?.scrollIntoView({ behavior: 'smooth' });
            closeSidebarFunc();
        });
    }
    
    if (heroBookBtn) {
        heroBookBtn.addEventListener('click', () => {
            document.getElementById('bookingSection')?.scrollIntoView({ behavior: 'smooth' });
        });
    }
}

// Page-specific initialization
if (document.getElementById('roomsGrid')) {
    // Guest page
    loadRoomsGrid();
    loadRoomOptions();
    loadItemsCheckbox();
    
    const checkIn = document.getElementById('checkIn');
    const checkOut = document.getElementById('checkOut');
    const roomType = document.getElementById('roomType');
    
    if (checkIn) checkIn.addEventListener('change', calculateTotal);
    if (checkOut) checkOut.addEventListener('change', calculateTotal);
    if (roomType) roomType.addEventListener('change', calculateTotal);
    
    const bookingForm = document.getElementById('bookingForm');
    if (bookingForm) bookingForm.addEventListener('submit', handleBookingSubmit);
}

// Initialize all
initDarkMode();
initAdminLogin();
initMobileSidebar();

// Set minimum date for date inputs
const today = new Date().toISOString().split('T')[0];
document.querySelectorAll('input[type="date"]').forEach(input => {
    if (!input.value) input.min = today;
});
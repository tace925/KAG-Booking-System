// ============ SUPABASE CONFIGURATION ============
const SUPABASE_URL = 'https://mkgfaiphqrhgpteyljkg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1rZ2ZhaXBocXJoZ3B0ZXlsamtnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0NTM3MDAsImV4cCI6MjA5MTAyOTcwMH0.qgNczEBz614aAZvd1mTMF_oI3Ss7vzxdVQhahb4nvbI';

// Initialize Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============ GLOBAL VARIABLES ============
let roomData = [];
let items = [];
let bookings = [];
let roomRates = {};
let itemAssignments = [];

// ============ FETCH DATA FROM SUPABASE ============
async function fetchRooms() {
    const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .order('display_order');
    
    if (error) {
        console.error('Error fetching rooms:', error);
        return [];
    }
    
    roomData = data.map(room => ({
        id: room.room_id,
        name: room.name,
        price: room.price,
        icon: room.icon
    }));
    
    // Update roomRates
    roomData.forEach(room => {
        roomRates[room.id] = room.price;
    });
    
    return roomData;
}

async function fetchItems() {
    const { data, error } = await supabase
        .from('items')
        .select('*');
    
    if (error) {
        console.error('Error fetching items:', error);
        return [];
    }
    
    items = data.map(item => ({
        id: item.item_id,
        name: item.name,
        cost: item.replacement_cost,
        free: item.is_free_item,
        freeNote: item.is_free_item ? '1 free included' : undefined
    }));
    
    return items;
}

async function fetchBookings() {
    const { data, error } = await supabase
        .from('bookings')
        .select('*, guests(*)');
    
    if (error) {
        console.error('Error fetching bookings:', error);
        return [];
    }
    
    bookings = data.map(booking => ({
        id: booking.booking_id,
        roomType: booking.room_id,
        roomName: roomData.find(r => r.id === booking.room_id)?.name || 'Unknown',
        guestName: booking.guests?.name || 'Unknown',
        phone: booking.guests?.phone || '',
        email: booking.guests?.email || 'Not provided',
        checkIn: booking.check_in,
        checkOut: booking.check_out,
        guests: booking.guests_count,
        totalAmount: booking.total_amount,
        transactionId: booking.transaction_id,
        extraBlankets: booking.extra_blankets || 0,
        nights: booking.nights,
        status: booking.status,
        createdAt: booking.created_at
    }));
    
    return bookings;
}

async function fetchItemAssignments() {
    const { data, error } = await supabase
        .from('booking_items')
        .select('*');
    
    if (error) {
        console.error('Error fetching item assignments:', error);
        return [];
    }
    
    itemAssignments = data.map(assignment => ({
        bookingId: assignment.booking_id,
        itemId: assignment.item_id,
        itemName: items.find(i => i.id === assignment.item_id)?.name || '',
        status: assignment.status,
        cost: assignment.status === 'lost' ? (items.find(i => i.id === assignment.item_id)?.cost || 0) : 0
    }));
    
    return itemAssignments;
}

// ============ SAVE DATA TO SUPABASE ============
async function createGuest(guestData) {
    const { data, error } = await supabase
        .from('guests')
        .insert([{
            name: guestData.name,
            phone: guestData.phone,
            email: guestData.email
        }])
        .select()
        .single();
    
    if (error) throw error;
    return data;
}

async function createBooking(bookingData, guestId) {
    const { data, error } = await supabase
        .from('bookings')
        .insert([{
            booking_id: bookingData.booking_id,
            guest_id: guestId,
            room_id: bookingData.room_id,
            check_in: bookingData.check_in,
            check_out: bookingData.check_out,
            nights: bookingData.nights,
            guests_count: bookingData.guests_count,
            extra_blankets: bookingData.extra_blankets,
            total_amount: bookingData.total_amount,
            transaction_id: bookingData.transaction_id,
            status: 'pending'
        }])
        .select()
        .single();
    
    if (error) throw error;
    return data;
}

async function createBookingItems(bookingId, requestedItems) {
    for (const item of requestedItems) {
        const { error } = await supabase
            .from('booking_items')
            .insert([{
                booking_id: bookingId,
                item_id: item.id,
                status: 'assigned'
            }]);
        
        if (error) console.error('Error creating booking item:', error);
    }
}

async function updateBookingStatus(bookingId, status) {
    const { error } = await supabase
        .from('bookings')
        .update({ status: status })
        .eq('booking_id', bookingId);
    
    if (error) throw error;
}

async function updateItemStatus(bookingId, itemId, status) {
    // Check if assignment exists
    const { data: existing } = await supabase
        .from('booking_items')
        .select('*')
        .eq('booking_id', bookingId)
        .eq('item_id', itemId)
        .single();
    
    if (existing) {
        const { error } = await supabase
            .from('booking_items')
            .update({ 
                status: status,
                returned_at: status === 'returned' ? new Date().toISOString() : null
            })
            .eq('booking_id', bookingId)
            .eq('item_id', itemId);
        
        if (error) throw error;
    } else if (status !== 'not_assigned') {
        const { error } = await supabase
            .from('booking_items')
            .insert([{
                booking_id: bookingId,
                item_id: itemId,
                status: status
            }]);
        
        if (error) throw error;
    }
}

async function updateRoomRate(roomId, newRate) {
    const { error } = await supabase
        .from('rooms')
        .update({ price: newRate })
        .eq('room_id', roomId);
    
    if (error) throw error;
    roomRates[roomId] = newRate;
}

// ============ HELPER FUNCTIONS (same as before) ============
function generateBookingId() {
    return 'KAG' + Date.now() + Math.floor(Math.random() * 1000);
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-KE');
}

function calculateDays(checkIn, checkOut) {
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 1;
}

// ============ LOAD ROOMS GRID (Guest Page) ============
async function loadRoomsGrid() {
    const roomsGrid = document.getElementById('roomsGrid');
    if (!roomsGrid) return;
    
    await fetchRooms();
    
    roomsGrid.innerHTML = '';
    roomData.forEach(room => {
        const rate = roomRates[room.id] || room.price;
        const roomCard = document.createElement('div');
        roomCard.className = 'room-card';
        roomCard.setAttribute('data-room', room.id);
        roomCard.innerHTML = `
            <i class="fas ${room.icon}"></i>
            <h3>${room.name}</h3>
            <p class="room-price">KES ${rate.toLocaleString()}<small>/night</small></p>
        `;
        roomCard.onclick = () => {
            document.querySelectorAll('.room-card').forEach(c => c.classList.remove('selected'));
            roomCard.classList.add('selected');
            document.getElementById('roomType').value = room.id;
            calculateTotal();
        };
        roomsGrid.appendChild(roomCard);
    });
}

async function loadRoomOptions() {
    const roomSelect = document.getElementById('roomType');
    if (!roomSelect) return;
    
    await fetchRooms();
    
    roomSelect.innerHTML = '<option value="">-- Select Room --</option>';
    roomData.forEach(room => {
        const rate = roomRates[room.id] || room.price;
        roomSelect.innerHTML += `<option value="${room.id}">${room.name} - KES ${rate.toLocaleString()}/night</option>`;
    });
}

async function loadItemsCheckbox() {
    const itemsContainer = document.getElementById('itemsCheckbox');
    if (!itemsContainer) return;
    
    await fetchItems();
    
    itemsContainer.innerHTML = '';
    items.forEach(item => {
        let labelText = `${item.name} (KES ${item.cost.toLocaleString()} if lost/damaged)`;
        if (item.free) {
            labelText += ` - ${item.freeNote}`;
        }
        itemsContainer.innerHTML += `
            <label>
                <input type="checkbox" value="${item.id}" class="requested-item" data-item-name="${item.name}">
                ${labelText}
            </label>
        `;
    });
    
    document.querySelectorAll('.requested-item').forEach(cb => {
        cb.addEventListener('change', () => {
            const blanketChecked = document.querySelector('.requested-item[value="blanket"]')?.checked;
            const extraBlanketGroup = document.getElementById('extraBlanketGroup');
            if (extraBlanketGroup) {
                extraBlanketGroup.style.display = blanketChecked ? 'block' : 'none';
                if (!blanketChecked) {
                    document.getElementById('extraBlankets').value = 0;
                }
            }
            calculateTotal();
        });
    });
}

function calculateTotal() {
    const roomType = document.getElementById('roomType')?.value;
    const checkIn = document.getElementById('checkIn')?.value;
    const checkOut = document.getElementById('checkOut')?.value;
    
    if (!roomType || !checkIn || !checkOut) return;
    
    const days = calculateDays(checkIn, checkOut);
    const rate = roomRates[roomType] || 500;
    let total = days * rate;
    
    const blanketChecked = document.querySelector('.requested-item[value="blanket"]')?.checked;
    let extraBlankets = 0;
    let extraBlanketCost = 0;
    
    if (blanketChecked) {
        extraBlankets = parseInt(document.getElementById('extraBlankets')?.value) || 0;
        extraBlanketCost = extraBlankets * 10 * days;
        total += extraBlanketCost;
        
        const extraBlanketRow = document.getElementById('extraBlanketRow');
        if (extraBlanketRow) {
            extraBlanketRow.style.display = 'block';
            document.getElementById('extraBlanketCount').innerText = extraBlankets;
            document.getElementById('extraBlanketCost').innerHTML = `KES ${extraBlanketCost.toLocaleString()}`;
        }
    } else {
        const extraBlanketRow = document.getElementById('extraBlanketRow');
        if (extraBlanketRow) extraBlanketRow.style.display = 'none';
    }
    
    document.getElementById('roomRate').innerHTML = `KES ${rate.toLocaleString()}`;
    document.getElementById('totalDays').innerText = days;
    document.getElementById('totalAmount').innerHTML = `KES ${total.toLocaleString()}`;
}

async function handleBookingSubmit(e) {
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
    const rate = roomRates[roomType] || 500;
    let totalAmount = days * rate;
    
    const requestedItems = [];
    document.querySelectorAll('.requested-item:checked').forEach(cb => {
        const item = items.find(i => i.id === cb.value);
        if (item) {
            requestedItems.push({
                id: item.id,
                name: item.name,
                cost: item.cost
            });
        }
    });
    
    let extraBlankets = 0;
    const blanketChecked = document.querySelector('.requested-item[value="blanket"]')?.checked;
    if (blanketChecked) {
        extraBlankets = parseInt(document.getElementById('extraBlankets')?.value) || 0;
        totalAmount += extraBlankets * 10 * days;
    }
    
    const bookingId = generateBookingId();
    
    try {
        // 1. Create guest
        const guest = await createGuest({
            name: guestName,
            phone: phone,
            email: email || null
        });
        
        // 2. Create booking
        await createBooking({
            booking_id: bookingId,
            room_id: roomType,
            check_in: checkIn,
            check_out: checkOut,
            nights: days,
            guests_count: parseInt(guests),
            extra_blankets: extraBlankets,
            total_amount: totalAmount,
            transaction_id: transactionId
        }, guest.id);
        
        // 3. Create booking items
        await createBookingItems(bookingId, requestedItems);
        
        alert(`✅ Booking Successful!\n\nBooking ID: ${bookingId}\nRoom: ${roomData.find(r => r.id === roomType)?.name}\nNights: ${days}\nTotal: KES ${totalAmount.toLocaleString()}\n\nPlease show this ID at check-in.`);
        
        document.getElementById('bookingForm')?.reset();
        document.querySelectorAll('.room-card').forEach(c => c.classList.remove('selected'));
        document.getElementById('extraBlanketGroup').style.display = 'none';
        
    } catch (error) {
        console.error('Booking error:', error);
        alert('❌ Booking failed. Please try again.');
    }
}

// ============ ADMIN FUNCTIONS ============
async function updateAdminStats() {
    await fetchBookings();
    
    const totalBookings = bookings.length;
    const today = new Date().toISOString().split('T')[0];
    const todayCheckins = bookings.filter(b => b.checkIn === today && b.status === 'confirmed').length;
    const totalEarnings = bookings.filter(b => b.status === 'checked-out').reduce((sum, b) => sum + b.totalAmount, 0);
    const occupancyRate = bookings.filter(b => b.status === 'checked-in').length > 0 ? 
        Math.min(100, (bookings.filter(b => b.status === 'checked-in').length / 5) * 100) : 0;
    
    document.getElementById('totalBookings').innerText = totalBookings;
    document.getElementById('todayCheckins').innerText = todayCheckins;
    document.getElementById('totalEarnings').innerHTML = `KES ${totalEarnings.toLocaleString()}`;
    document.getElementById('occupancyRate').innerText = `${Math.round(occupancyRate)}%`;
}

async function loadBookingsTable(filter = 'all') {
    const tbody = document.getElementById('bookingsTableBody');
    if (!tbody) return;
    
    await fetchBookings();
    
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

async function confirmBooking(id) {
    await updateBookingStatus(id, 'confirmed');
    await loadBookingsTable();
    await updateAdminStats();
    alert(`Booking ${id} confirmed!`);
}

async function checkInGuest(id) {
    await updateBookingStatus(id, 'checked-in');
    await loadBookingsTable();
    await updateAdminStats();
    await loadItemTracking();
    alert(`Guest checked in!`);
}

async function checkOutGuest(id) {
    const booking = bookings.find(b => b.id === id);
    if (booking && confirm(`Check out ${booking.guestName}?`)) {
        await updateBookingStatus(id, 'checked-out');
        await loadBookingsTable();
        await updateAdminStats();
        await loadReports();
        alert(`${booking.guestName} checked out successfully!`);
    }
}

async function cancelBooking(id) {
    if (confirm('Cancel this booking?')) {
        await updateBookingStatus(id, 'cancelled');
        await loadBookingsTable();
        await updateAdminStats();
        alert('Booking cancelled!');
    }
}

async function loadRoomRatesEditor() {
    const container = document.getElementById('roomsEditGrid');
    if (!container) return;
    
    await fetchRooms();
    
    container.innerHTML = '';
    roomData.forEach(room => {
        const currentRate = roomRates[room.id] || room.price;
        container.innerHTML += `
            <div class="room-rate-edit">
                <label>${room.name}</label>
                <input type="number" id="rate_${room.id}" value="${currentRate}" class="rate-input">
                <small>KES per night</small>
            </div>
        `;
    });
}

async function saveRoomRates() {
    for (const room of roomData) {
        const newRate = parseInt(document.getElementById(`rate_${room.id}`)?.value);
        if (newRate && !isNaN(newRate) && newRate !== roomRates[room.id]) {
            await updateRoomRate(room.id, newRate);
        }
    }
    alert('Room rates updated successfully!');
    await loadRoomsGrid();
}

async function loadItemTracking() {
    const container = document.getElementById('itemTrackingContainer');
    if (!container) return;
    
    await fetchBookings();
    await fetchItems();
    await fetchItemAssignments();
    
    const checkedInGuests = bookings.filter(b => b.status === 'checked-in');
    
    if (checkedInGuests.length === 0) {
        container.innerHTML = '<p>No guests currently checked in.</p>';
        return;
    }
    
    container.innerHTML = '';
    for (const guest of checkedInGuests) {
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
                            <span>${item.name} (KES ${item.cost.toLocaleString()} if lost)</span>
                            <select onchange="updateItemStatusUI('${guest.id}', '${item.id}', this.value)">
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
    }
}

async function updateItemStatusUI(bookingId, itemId, status) {
    await updateItemStatus(bookingId, itemId, status);
    await loadLostItemsList();
    await loadReports();
    alert(`Item status updated!`);
}

async function loadLostItemsList() {
    const container = document.getElementById('lostItemsList');
    if (!container) return;
    
    await fetchItemAssignments();
    await fetchBookings();
    
    const lostItems = itemAssignments.filter(a => a.status === 'lost');
    const totalLostCharges = lostItems.reduce((sum, item) => sum + (item.cost || 0), 0);
    
    if (lostItems.length === 0) {
        container.innerHTML = '<p>No lost/damaged items reported.</p>';
        return;
    }
    
    container.innerHTML = `
        <table class="lost-items-table" style="width:100%; border-collapse: collapse;">
            <thead>
                <tr><th style="padding: 0.5rem; text-align: left;">Guest</th><th style="padding: 0.5rem; text-align: left;">Item</th><th style="padding: 0.5rem; text-align: left;">Charge (KES)</th></tr>
            </thead>
            <tbody>
                ${lostItems.map(item => {
                    const booking = bookings.find(b => b.id === item.bookingId);
                    return `
                        <tr>
                            <td style="padding: 0.5rem;">${booking?.guestName || 'Unknown'}</td>
                            <td style="padding: 0.5rem;">${item.itemName}</td>
                            <td style="padding: 0.5rem;">KES ${(item.cost || 0).toLocaleString()}</td>
                        </tr>
                    `;
                }).join('')}
                <tr style="font-weight: bold; border-top: 2px solid var(--border-color);">
                    <td style="padding: 0.5rem;" colspan="2">Total Lost Items Charges</td>
                    <td style="padding: 0.5rem;">KES ${totalLostCharges.toLocaleString()}</td>
                </tr>
            </tbody>
        </table>
    `;
}

async function loadReports() {
    await fetchBookings();
    await fetchItemAssignments();
    
    const today = new Date().toISOString().split('T')[0];
    const todayEarnings = bookings.filter(b => b.checkOut === today && b.status === 'checked-out').reduce((sum, b) => sum + b.totalAmount, 0);
    
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekEarnings = bookings.filter(b => new Date(b.checkOut) >= weekAgo && b.status === 'checked-out').reduce((sum, b) => sum + b.totalAmount, 0);
    
    const monthAgo = new Date();
    monthAgo.setDate(monthAgo.getDate() - 30);
    const monthEarnings = bookings.filter(b => new Date(b.checkOut) >= monthAgo && b.status === 'checked-out').reduce((sum, b) => sum + b.totalAmount, 0);
    
    const lostItemsTotal = itemAssignments.filter(a => a.status === 'lost').reduce((sum, a) => sum + (a.cost || 0), 0);
    
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
function typeWriter(element, text, speed, callback) {
    let i = 0;
    element.innerHTML = '';
    function type() {
        if (i < text.length) {
            element.innerHTML += text.charAt(i);
            i++;
            setTimeout(type, speed);
        } else if (callback) {
            callback();
        }
    }
    type();
}

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

async function initAdminLogin() {
    const loginOverlay = document.getElementById('loginOverlay');
    const dashboardContent = document.getElementById('dashboardContent');
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    
    if (!loginOverlay || !dashboardContent) return;
    
    const isLoggedIn = sessionStorage.getItem('kag_admin_logged_in');
    if (isLoggedIn === 'true') {
        loginOverlay.style.display = 'none';
        dashboardContent.style.display = 'block';
        await loadAdminData();
    }
    
    if (loginBtn) {
        loginBtn.addEventListener('click', async () => {
            const password = document.getElementById('adminPassword')?.value;
            const { data } = await supabase
                .from('settings')
                .select('setting_value')
                .eq('setting_key', 'admin_password_hash')
                .single();
            
            const correctPassword = data?.setting_value || 'admin254';
            
            if (password === correctPassword) {
                sessionStorage.setItem('kag_admin_logged_in', 'true');
                loginOverlay.style.display = 'none';
                dashboardContent.style.display = 'block';
                await loadAdminData();
            } else {
                alert('Wrong password!');
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

async function loadAdminData() {
    await updateAdminStats();
    await loadBookingsTable();
    await loadRoomRatesEditor();
    await loadItemTracking();
    await loadLostItemsList();
    await loadReports();
    
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

function initTypingAnimations() {
    const typingElement = document.getElementById('typingText');
    const canteenElement = document.getElementById('canteenText');
    
    if (typingElement) {
        typeWriter(typingElement, 'Welcome to KAG Guest House', 100);
    }
    
    if (canteenElement) {
        setTimeout(() => {
            typeWriter(canteenElement, '🍽️ Canteen Available on-site 🍽️', 80);
        }, 2000);
    }
}

function initExtraBlanketListener() {
    const extraBlanketsInput = document.getElementById('extraBlankets');
    if (extraBlanketsInput) {
        extraBlanketsInput.addEventListener('change', calculateTotal);
        extraBlanketsInput.addEventListener('input', calculateTotal);
    }
}

// ============ PAGE INITIALIZATION ============
if (document.getElementById('roomsGrid')) {
    // Guest page
    (async () => {
        await loadRoomsGrid();
        await loadRoomOptions();
        await loadItemsCheckbox();
    })();
    
    const checkIn = document.getElementById('checkIn');
    const checkOut = document.getElementById('checkOut');
    const roomType = document.getElementById('roomType');
    
    if (checkIn) checkIn.addEventListener('change', calculateTotal);
    if (checkOut) checkOut.addEventListener('change', calculateTotal);
    if (roomType) roomType.addEventListener('change', calculateTotal);
    
    const bookingForm = document.getElementById('bookingForm');
    if (bookingForm) bookingForm.addEventListener('submit', handleBookingSubmit);
    
    initExtraBlanketListener();
    initTypingAnimations();
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
// ==================== GUEST SCRIPT ====================
const supabase = getSupabase();

// Default data...
const DEFAULT_ROOMS = [ /* same as you have */ ];
const DEFAULT_ITEMS = [ /* same as you have */ ];

let roomData = [];
let items = [];
let roomRates = {};

// Helper functions (typeWriter, calculateDays, etc.) - already good

// FETCH FUNCTIONS - already good

// UI FUNCTIONS
async function loadRoomsGrid() { /* your current code is good */ }
async function loadRoomOptions() { /* good */ }
async function loadItemsCheckbox() { /* good */ }

function calculateTotal() {
    // Your current calculateTotal is mostly good, but add this at the end:
    const priceSummary = document.getElementById('priceSummary');
    if (priceSummary) priceSummary.style.display = 'block';
}

// ==================== FULL BOOKING SUBMIT ====================
async function handleBookingSubmit(e) {
    e.preventDefault();

    const roomType = document.getElementById('roomType').value;
    const checkIn = document.getElementById('checkIn').value;
    const checkOut = document.getElementById('checkOut').value;
    const guestName = document.getElementById('guestName').value;
    const phone = document.getElementById('phone').value;
    const transactionId = document.getElementById('transactionId').value;

    if (!roomType || !checkIn || !checkOut || !guestName || !phone || !transactionId) {
        alert("Please fill all required fields!");
        return;
    }

    const days = calculateDays(checkIn, checkOut);
    const rate = roomRates[roomType] || 500;
    let totalAmount = days * rate;

    // Extra blankets logic...
    const blanketChecked = document.querySelector('.requested-item[value="blanket"]')?.checked;
    let extraBlankets = 0;
    if (blanketChecked) {
        extraBlankets = parseInt(document.getElementById('extraBlankets').value) || 0;
        totalAmount += extraBlankets * 10 * days;
    }

    const bookingId = generateBookingId();

    try {
        const submitBtn = document.querySelector('.btn-submit');
        submitBtn.disabled = true;
        submitBtn.innerHTML = 'Processing...';

        // Create Guest
        const { data: guest, error: guestError } = await supabase
            .from('guests')
            .insert([{ name: guestName, phone, email: document.getElementById('email').value || null }])
            .select()
            .single();

        if (guestError) throw guestError;

        // Create Booking
        const { error: bookingError } = await supabase
            .from('bookings')
            .insert([{
                booking_id: bookingId,
                guest_id: guest.id,
                room_id: roomType,
                check_in: checkIn,
                check_out: checkOut,
                nights: days,
                guests_count: parseInt(document.getElementById('guests').value),
                extra_blankets: extraBlankets,
                total_amount: totalAmount,
                transaction_id: transactionId,
                status: 'pending'
            }]);

        if (bookingError) throw bookingError;

        alert(`✅ Booking Successful!\n\nBooking ID: ${bookingId}\nTotal: KES ${totalAmount}\n\nSave this ID!`);
        document.getElementById('bookingForm').reset();

    } catch (error) {
        console.error(error);
        alert("❌ Booking failed. Please try again.");
    } finally {
        const submitBtn = document.querySelector('.btn-submit');
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-check-circle"></i> Complete Booking';
    }
}

// Initialization - your current code is mostly fine

initGuestPage();
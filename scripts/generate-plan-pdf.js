const { jsPDF } = require('jspdf');
const fs = require('fs');
const path = require('path');

const doc = new jsPDF({
  orientation: 'portrait',
  unit: 'mm',
  format: 'a4',
});

const pageWidth = doc.internal.pageSize.getWidth();
const pageHeight = doc.internal.pageSize.getHeight();
let y = 15;

function addHeader() {
  doc.setFillColor(138, 66, 40); // #8A4228 Burnt Orange
  doc.rect(0, 0, pageWidth, 12, 'F');
  doc.setTextColor(255, 252, 247);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('THOOGUDEEPA DONNE BIRYANI MANE • INITIAL ARCHITECTURE & SCREEN STRUCTURE PLAN', 10, 8);
  doc.setTextColor(40, 40, 40);
  y = 20;
}

function checkPage(needed = 20) {
  if (y + needed > pageHeight - 15) {
    doc.addPage();
    addHeader();
  }
}

function sectionTitle(text) {
  checkPage(15);
  doc.setFillColor(243, 223, 204); // #F3DFCC Soft Peach Beige
  doc.roundedRect(10, y, pageWidth - 20, 8, 2, 2, 'F');
  doc.setTextColor(138, 66, 40);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text(text, 14, y + 5.5);
  y += 12;
  doc.setTextColor(50, 50, 50);
}

function screenItem(num, name, details) {
  checkPage(16 + details.length * 4.2);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(138, 66, 40);
  doc.text(num + ': ' + name, 12, y);
  y += 4.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.2);
  doc.setTextColor(60, 60, 60);
  for (const line of details) {
    const wrapped = doc.splitTextToSize('• ' + line, pageWidth - 28);
    for (const textLine of wrapped) {
      doc.text(textLine, 16, y);
      y += 3.8;
    }
  }
  y += 3;
}

// COVER / TITLE
addHeader();
doc.setFont('helvetica', 'bold');
doc.setFontSize(15);
doc.setTextColor(138, 66, 40);
doc.text('THOOGUDEEPA DONNE BIRYANI MANE', 10, y + 4);
y += 9;
doc.setFontSize(10.5);
doc.setTextColor(208, 138, 82);
doc.text('MASTER INITIAL SPECIFICATION & SCREEN STRUCTURE BLUEPRINT', 10, y);
y += 5.5;
doc.setFontSize(8);
doc.setTextColor(100, 100, 100);
doc.text('Architecture: Strictly 16 Dining Seats (Zero Tables) • 5 Interconnected Portals • Sub-15ms WebSocket Spine', 10, y);
y += 8;

// SECTION 1: CUSTOMER PORTAL
sectionTitle('1. CUSTOMER QR PORTAL (8 Frictionless Mobile Screens)');
screenItem('Screen 1', 'Welcome & Seat Landing (/seat/[seatId])', [
  'Header: Official brand title, logo badge, and theme switcher (Burnt Orange vs Royal Emerald).',
  'Seat Badge: Dedicated seat pill indicator (SEAT 01 to SEAT 16) with pulsing live indicator.',
  'Guest Input: Centered optional customer name input.',
  'Primary CTA: Full-width [Explore Menu ->] button initiating active dining session.'
]);

screenItem('Screen 2', 'Interactive Food Catalog (/seat/[seatId]/menu)', [
  'Header: Seat & customer name chip with 1-tap [Call Waiter] shortcut and theme toggle.',
  'Controls: Search bar with instant filter and Pure Veg toggle switch.',
  'Promotions: Horizontal swipeable promotional banner carousel (COMBO399, DONNE50).',
  'Menu Grid: 21 authentic items organized into 3 categories with prices, veg/non-veg tags, and descriptions.',
  'Cart Bar: Sticky floating bottom bar showing live item count, subtotal, and [View Cart ->].'
]);

screenItem('Screen 3', 'Review Cart & Recommended Pairings (/seat/[seatId]/cart)', [
  'Order Review: Itemized list with thumbnail imagery, unit prices, quantity steppers, and delete button.',
  'Upselling: Horizontal "Recommended Pairings" slider to add complementary sides/soups.',
  'Math Engine: Real-time item subtotal, 5% GST computation, and grand total.',
  'Order Dispatch: [Place Order ->] button with debounce protection to prevent accidental duplicate tickets.'
]);

screenItem('Screen 4', 'Live Order Tracking & Stepper (/seat/[seatId]/tracking)', [
  'Real-Time Stepper: Visual progress timeline: Placed -> Preparing -> Ready -> Served.',
  'Active Items: Live list of cooking items updating via WebSocket without page refreshes.',
  'Add Items: [+] Add more dishes button returning seamlessly to menu catalog.',
  'Mutual Payment Lock: [Pay via Waiter] vs [Self Pay (UPI)] - selecting one disables the other.'
]);

screenItem('Screen 5', 'Pay via Waiter Settlement (/seat/[seatId]/settle-waiter)', [
  'Promos: Coupon code entry box with instant percentage/flat deduction calculation.',
  'Bill Summary: Total payable amount with GST breakdown and discount line.',
  'Mode Selector: Cash at Seat vs UPI on Waiter Handset selector.',
  'Notification: Broadcasts settlement request directly to assigned waiter phone (Suhas / Shiva).',
  'Feedback: 5-Star interactive customer rating selector with [Your Bill ->] navigation.'
]);

screenItem('Screen 6', 'Self Pay via Direct UPI QR (/seat/[seatId]/settle-self)', [
  'Dynamic UPI QR: Dynamic QR code pre-encoded with exact bill total and restaurant UPI VPA.',
  '1-Tap Intent: Quick-launch buttons for Google Pay, PhonePe, and Paytm on customer mobile.',
  'Confirmation: Real-time polling and WebSocket listener confirming payment verification.',
  'Invoice Link: [Your Bill ->] button providing instant tax invoice.'
]);

screenItem('Screen 7', 'Digital Tax Invoice Receipt (/seat/[seatId]/bill)', [
  'Receipt Header: Restaurant branding, GSTIN, invoice number, seat number, date and time.',
  'Itemized Table: Full breakdown of ordered dishes, quantities, rates, and totals.',
  'Tax Breakdown: Subtotal, CGST (2.5%), SGST (2.5%), and Grand Total.',
  'PDF Export: Integrated [Download Bill (PDF)] button generating branded PDF offline via jsPDF.',
  'Footer: Traditional Kannada & English welcome note: Thank you, visit again!'
]);

screenItem('Screen 8', 'Quick Service Requests (/seat/[seatId]/help)', [
  '4 Touch Action Cards: Water, Clean Seat, Extra Plates, and Call Waiter Directly.',
  'Special Note: Optional text area for special requests or table notes.',
  'Dispatch: [Send Request to Waiter] button emitting alert to assigned waiter room.',
  'Live Tracker: Real-time request status indicator: Sent -> Waiter Notified -> Resolved.'
]);

// SECTION 2: KITCHEN DISPLAY SYSTEM
sectionTitle('2. KITCHEN DISPLAY SYSTEM - KDS (2 High-Contrast Steam-Resistant Screens)');
screenItem('Screen 1', 'KDS Security Login Gateway (/kitchen)', [
  'Interface: High-contrast dark terminal designed for commercial kitchen lighting.',
  'Tactile Numpad: 4-digit PIN gateway (PIN: 3333).',
  'Audio Arming: Login action unlocks browser Web Audio Context for audible order chimes.'
]);

screenItem('Screen 2', '3-Column Production Ticket Board (/kitchen/kds)', [
  'Column 1 (Received Orders): Incoming tickets showing Placed Time, Seat badge, dishes, and [Mark Cooking ->].',
  'Column 2 (Items Cooking): Active cooking orders with individual item checkboxes, cancel item option, and [Mark Ready ->].',
  'Column 3 (Items Ready): Completed dishes awaiting waiter pickup with pickup chimes.',
  '86 Sold-Out Drawer: Slide-over inventory drawer allowing chef to instantly 86/sold-out any dish across all customer menus.'
]);

// SECTION 3: WAITER MOBILE (SUHAS)
sectionTitle('3. WAITER MOBILITY - SUHAS (Zone A: Seats 1 to 8) (5 Handheld Screens)');
screenItem('Screen 1', 'Waiter Handheld Login (/waiter/suhas)', [
  '4-Digit PIN gate (PIN: 1111) with device screen wake-lock to prevent screen sleep during service.'
]);

screenItem('Screen 2', 'Zone A Floor Grid (/waiter/suhas/floor)', [
  'Seats 1 to 8 live grid with color badges: Vacant (+ Take Order), Dining, Food Ready, Service Call, Bill Requested.',
  'Auditory & Haptic alerts: Vibrates and pings exclusively for Seats 1 to 8.'
]);

screenItem('Screen 3', 'Seat Detail & Order Action (/waiter/suhas/seat/[id])', [
  'Seat inspection view showing customer name, elapsed dining time, and item preparation statuses.',
  'Service call resolution banner with 1-tap [Resolve Water] button.',
  'Direct action controls: [+ Add Items] and [Settle Bill].'
]);

screenItem('Screen 4', 'Fast Order Punching (/waiter/suhas/seat/[id]/order)', [
  'Handheld touch menu for fast punching of extra dishes on the floor.',
  'Quantity counter [- qty +] and instant [Place Order ->] button updating KDS in real time.'
]);

screenItem('Screen 5', 'Cash Collection & Vacate Seat (/waiter/suhas/seat/[id]/settle)', [
  'Final bill review, payment mode selector (Cash / UPI), and cash change calculator.',
  'Payment confirmation toggle: Confirm Payment Received.',
  'Table Reset: [Vacate Seat] button immediately resetting seat status to Vacant across the system.'
]);

// SECTION 4: WAITER TABLET (SHIVA)
sectionTitle('4. WAITER TABLET - SHIVA (Zone B: Seats 9 to 16) (3 Unified Screens)');
screenItem('Screen 1', 'Tablet Login Gateway (/waiter/shiva)', [
  'Tablet PIN gate (PIN: 2222) with landscape layout.'
]);

screenItem('Screen 2', 'Zone B Landscape Floor Grid (/waiter/shiva/floor)', [
  '4x2 Landscape grid of Seats 9 to 16 with large touch cards and status indicators.',
  'Emergency Break Toggle: [View All 16 Seats] allowing Shiva to cover Suhas during breaks.'
]);

screenItem('Screen 3', 'Unified Master-Detail Workspace (/waiter/shiva/seat/[id])', [
  'Left Fixed Panel: Seat overview, active item tickets, service request alerts.',
  'Right Dynamic Panel: Seamlessly switches between Single-Column Touch Menu and Settle Payment/Vacate Seat.'
]);

// SECTION 5: MANAGER COCKPIT
sectionTitle('5. MANAGER EXECUTIVE COCKPIT (9 Comprehensive Screens)');
screenItem('Screen 1', 'Executive PIN Gateway (/manager)', [
  'Manager authentication screen (PIN: 9999) with official Thoogudeepa brand badge.'
]);

screenItem('Screen 2', 'Live Floor Cockpit (/manager/floor)', [
  '16-Seat floor map partitioned into Zone A (S1-S8) and Zone B (S9-S16).',
  'Right-Side Selected Seat Drawer: Full ordered items inspection, subtotal, GST math, [Collect Payment] and [Vacate Seat].'
]);

screenItem('Screen 3', 'Live Kitchen KDS Stream (/manager/kitchen)', [
  'Real-time mirror of kitchen queue, preparation times, delayed order warnings, and 86 item inventory switcher.'
]);

screenItem('Screen 4', 'Parcel & Takeaway Operations Desk (/manager/parcel)', [
  'Counter takeaway order puncher with customer name and phone, Rs 15 container charges, and instant KOT generation.'
]);

screenItem('Screen 5', 'Menu Catalog & Pricing Engine (/manager/menu)', [
  'Complete dish catalog with price editor, Veg/Non-Veg toggle, availability switch, and Pair-With recommendation tags.'
]);

screenItem('Screen 6', '16 QR Standee Suite (/manager/qrs)', [
  'Generates and renders high-resolution printable acrylic QR standees with authentic restaurant branding for Seats 1 to 16.'
]);

screenItem('Screen 7', 'Shift Audit & Cash Reconciliation (/manager/shift)', [
  'End-of-day register closing: Reconciles cash collected vs handed over by Suhas, Shiva, and Parcel desk with deficit/surplus math.'
]);

screenItem('Screen 8', 'Master Sales & Daily Tax Reports (/manager/reports)', [
  'Detailed tax accounting: Gross food revenue, net revenue, 5% GST breakdown, payment split (Cash vs UPI), and Excel export.'
]);

screenItem('Screen 9', 'Promotions & Offers Engine (/manager/promos)', [
  'Coupon code management (COMBO399, DONNE50), usage limits, and customer menu promotional carousel banners.'
]);

// FOOTER ON ALL PAGES
const totalPages = doc.internal.getNumberOfPages();
for (let i = 1; i <= totalPages; i++) {
  doc.setPage(i);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(140, 140, 140);
  doc.text('Thoogudeepa Donne Biryani Mane • Confidential Master Planning Document • Page ' + i + ' of ' + totalPages, 10, pageHeight - 6);
}

// SAVE TO PUBLIC AND ARTIFACT DIRECTORY
const publicPath = path.join('C:\\Users\\HP\\.gemini\\antigravity\\scratch\\thoogudeepa-kds\\public', 'THOOGUDEEPA_INITIAL_PLANNING_STRUCTURE.pdf');
const artifactPath = path.join('C:\\Users\\HP\\.gemini\\antigravity\\brain\\efc6063b-ce9a-42e7-b0c2-d0e74856adde', 'THOOGUDEEPA_INITIAL_PLANNING_STRUCTURE.pdf');

const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
fs.writeFileSync(publicPath, pdfBuffer);
fs.writeFileSync(artifactPath, pdfBuffer);

console.log('PDF_GENERATED_SUCCESSFULLY');
console.log('Public: ' + publicPath);
console.log('Artifact: ' + artifactPath);
console.log('Total Pages: ' + totalPages);

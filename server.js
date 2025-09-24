require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// ✅ Serve frontend files from /public if it exists
const publicPath = path.join(__dirname, 'public');
if (fs.existsSync(publicPath)) {
    app.use(express.static(publicPath));
}

// Configuration
const config = {
    port: PORT,
    timezone: process.env.TIMEZONE || 'Asia/Kathmandu',
    minStartHour: parseInt(process.env.MIN_START_HOUR) || 13,
    maxEndHour: parseInt(process.env.MAX_END_HOUR) || 21,
    hostName: process.env.HOST_NAME || 'Host',
    hostEmail: process.env.HOST_EMAIL || 'host@example.com',
    hostPhone: process.env.HOST_PHONE || '',
    personalMeetingId: process.env.PERSONAL_MEETING_ID || '123456789',
    personalMeetingPassword: process.env.PERSONAL_MEETING_PASSWORD || 'meeting123',
    emailUser: process.env.EMAIL_USER,
    emailPass: process.env.EMAIL_PASS,
    emailService: process.env.EMAIL_SERVICE || '' // 👈 empty by default
};

// Storage for bookings
let bookings = [];
const BOOKINGS_FILE = 'bookings.json';

// Load existing bookings
function loadBookings() {
    try {
        if (fs.existsSync(BOOKINGS_FILE)) {
            const data = fs.readFileSync(BOOKINGS_FILE, 'utf8');
            bookings = JSON.parse(data);
            console.log(`📊 Loaded ${bookings.length} existing bookings`);
        }
    } catch (err) {
        console.log('Starting with fresh bookings file');
    }
}
loadBookings();

// Save bookings
function saveBookings() {
    try {
        fs.writeFileSync(BOOKINGS_FILE, JSON.stringify(bookings, null, 2));
    } catch (err) {
        console.error('Error saving bookings:', err);
    }
}

// Email transporter
let emailTransporter = null;
if (config.emailUser && config.emailPass && config.emailService) {
    emailTransporter = nodemailer.createTransport({
        service: config.emailService, // 👈 e.g. "SendGrid"
        auth: {
            user: config.emailUser,
            pass: config.emailPass
        }
    });

    emailTransporter.verify((error, success) => {
        if (error) {
            console.error('❌ Email configuration error:', error.message);
            emailTransporter = null;
        } else {
            console.log('✅ Email server is ready to send messages');
        }
    });
} else {
    console.warn('⚠️ Email disabled (missing credentials or service)');
}

// ------------------------------------------------------
// Your API routes (health, book-meeting, bookings, etc.)
// [Keep everything else as in your original code]
// ------------------------------------------------------

// ✅ Serve frontend (fallback for SPA or if index.html missing)
app.get('*', (req, res) => {
    if (fs.existsSync(path.join(publicPath, 'index.html'))) {
        res.sendFile(path.join(publicPath, 'index.html'));
    } else {
        res.json({ message: "API is running. No frontend files found." });
    }
});

// Start server
app.listen(PORT, () => {
    console.log('\n🚀 ============================================');
    console.log('🚀 PROFESSIONAL MEETING BOOKING SYSTEM');
    console.log('🚀 ============================================');
    console.log(`📡 Server running on: http://localhost:${PORT}`);
    console.log(`👤 Host: ${config.hostName}`);
    console.log(`📧 Email: ${config.hostEmail}`);
    console.log(`🌐 Timezone: ${config.timezone}`);
    console.log(`🕐 Hours: ${config.minStartHour}:00 - ${config.maxEndHour}:00`);
    console.log(`📊 Bookings: ${bookings.length}`);
    console.log(`📧 Email Notifications: ${emailTransporter ? '✅ Enabled' : '❌ Disabled'}`);
    console.log('💡 System ready for bookings!');
    console.log('============================================\n');
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n💾 Saving bookings before shutdown...');
    saveBookings();
    console.log('👋 Server shutting down gracefully');
    process.exit(0);
});

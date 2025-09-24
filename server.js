require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors());
app.use(express.json());

// ✅ Serve static files from public
app.use(express.static(path.join(__dirname, 'public')));

// Configuration
const config = {
    port: PORT,
    timezone: process.env.TIMEZONE || 'Asia/Kathmandu',
    minStartHour: parseInt(process.env.MIN_START_HOUR) || 14,
    maxEndHour: parseInt(process.env.MAX_END_HOUR) || 20,
    hostName: process.env.HOST_NAME || 'Sandesh kadel',
    hostEmail: process.env.HOST_EMAIL || 'techcraftershub.offial@gmail.com',
    hostPhone: process.env.HOST_PHONE || '',
    personalMeetingId: process.env.PERSONAL_MEETING_ID || '123456789',
    personalMeetingPassword: process.env.PERSONAL_MEETING_PASSWORD || 'meeting123',
    emailUser: process.env.EMAIL_USER,
    emailPass: process.env.EMAIL_PASS,
    emailService: process.env.EMAIL_SERVICE || 'gmail'
};

if (!config.emailUser || !config.emailPass) {
    console.warn('⚠️ Email credentials not configured. Email notifications will be disabled.');
}

// Storage for bookings
let bookings = [];
const BOOKINGS_FILE = 'bookings.json';

function loadBookings() {
    try {
        if (fs.existsSync(BOOKINGS_FILE)) {
            bookings = JSON.parse(fs.readFileSync(BOOKINGS_FILE, 'utf8'));
            console.log(`📊 Loaded ${bookings.length} existing bookings`);
        }
    } catch {
        console.log('Starting with fresh bookings file');
    }
}
function saveBookings() {
    try {
        fs.writeFileSync(BOOKINGS_FILE, JSON.stringify(bookings, null, 2));
    } catch (err) {
        console.error('Error saving bookings:', err);
    }
}
loadBookings();

// Email transporter
let emailTransporter = null;
if (config.emailUser && config.emailPass) {
    emailTransporter = nodemailer.createTransport({
        service: config.emailService,
        auth: { user: config.emailUser, pass: config.emailPass }
    });
    emailTransporter.verify(err => {
        if (err) {
            console.error('❌ Email configuration error:', err.message);
            emailTransporter = null;
        } else {
            console.log('✅ Email server is ready to send messages');
        }
    });
}

// Generate meeting data
function generateMeetingData(meetingDetails) {
    const meetingId = Math.floor(100000000 + Math.random() * 900000000).toString();
    const joinUrl = `https://zoom.us/j/${config.personalMeetingId}?pwd=${config.personalMeetingPassword}`;
    return {
        id: meetingId,
        join_url: joinUrl,
        password: config.personalMeetingPassword,
        topic: meetingDetails.topic,
        start_time: new Date(`${meetingDetails.date}T${meetingDetails.time}:00+05:45`).toISOString(),
        duration: meetingDetails.duration,
        created_at: new Date().toISOString()
    };
}

// Routes
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'Meeting Booking System is running',
        system: {
            mode: 'Personal Meeting Room',
            host: config.hostName,
            timezone: config.timezone,
            operatingHours: `${config.minStartHour}:00 - ${config.maxEndHour}:00`,
            emailEnabled: !!emailTransporter,
            totalBookings: bookings.length
        }
    });
});

// ✅ Serve frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log('🚀 ============================================');
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
    console.log('============================================');
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n💾 Saving bookings before shutdown...');
    saveBookings();
    console.log('👋 Server shutting down gracefully');
    process.exit(0);
});

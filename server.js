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
app.use(express.static('public'));

// Configuration
const config = {
    port: process.env.PORT || 3000,
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
    emailService: process.env.EMAIL_SERVICE || 'gmail'
};

// Validate required configuration
if (!config.emailUser || !config.emailPass) {
    console.warn('⚠️  Email credentials not configured. Email notifications will be disabled.');
}

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

// Save bookings to file
function saveBookings() {
    try {
        fs.writeFileSync(BOOKINGS_FILE, JSON.stringify(bookings, null, 2));
    } catch (err) {
        console.error('Error saving bookings:', err);
    }
}

// Initialize bookings
loadBookings();

// Email transporter
let emailTransporter = null;
if (config.emailUser && config.emailPass) {
    emailTransporter = nodemailer.createTransport({
        service: config.emailService,
        auth: {
            user: config.emailUser,
            pass: config.emailPass
        }
    });
    
    // Verify email connection
    emailTransporter.verify(function(error, success) {
        if (error) {
            console.error('❌ Email configuration error:', error);
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

// ... (rest of your functions unchanged) ...

// Start server (FIXED: listen on all interfaces for Render)
app.listen(PORT, '0.0.0.0', () => {
    console.log('\n🚀 ============================================');
    console.log('🚀 PROFESSIONAL MEETING BOOKING SYSTEM');
    console.log('🚀 ============================================');
    console.log(`📡 Server running on port: ${PORT}`);
    console.log(`👤 Host: ${config.hostName}`);
    console.log(`📧 Email: ${config.hostEmail}`);
    console.log(`🌐 Timezone: ${config.timezone}`);
    console.log(`🕐 Hours: ${config.minStartHour}:00 - ${config.maxEndHour}:00`);
    console.log(`📊 Bookings: ${bookings.length}`);
    console.log(`📧 Email Notifications: ${emailTransporter ? '✅ Enabled' : '❌ Disabled'}`);
    console.log('💡 System ready for bookings!');
    console.log('============================================\n');
});

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n💾 Saving bookings before shutdown...');
    saveBookings();
    console.log('👋 Server shutting down gracefully');
    process.exit(0);
});

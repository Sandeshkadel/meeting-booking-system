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
    minStartHour: parseInt(process.env.MIN_START_HOUR) || 16,
    maxEndHour: parseInt(process.env.MAX_END_HOUR) || 20,
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

// Send booking confirmation email
async function sendBookingEmail(bookingDetails) {
    if (!emailTransporter) {
        console.log('📧 Email disabled - no transporter configured');
        return false;
    }

    try {
        const mailOptions = {
            from: `"${config.hostName}" <${config.emailUser}>`,
            to: bookingDetails.email,
            subject: `Meeting Confirmation - ${bookingDetails.date} at ${bookingDetails.time}`,
            html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #6c00ff, #00f0ff); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .meeting-info { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #6c00ff; }
        .join-button { background: #6c00ff; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 10px 0; }
        .details { background: #e8f4ff; padding: 15px; border-radius: 5px; margin: 15px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Meeting Confirmed! 🎉</h1>
        <p>Your meeting with ${config.hostName} has been scheduled</p>
    </div>
    
    <div class="content">
        <div class="meeting-info">
            <h2>Meeting Details</h2>
            <p><strong>With:</strong> ${config.hostName}</p>
            <p><strong>Date:</strong> ${bookingDetails.date}</p>
            <p><strong>Time:</strong> ${bookingDetails.time} (${config.timezone})</p>
            <p><strong>Duration:</strong> ${bookingDetails.duration} minutes</p>
            <p><strong>Purpose:</strong> ${bookingDetails.purpose}</p>
        </div>

        <div class="details">
            <h3>🔗 Join Meeting</h3>
            <a href="${bookingDetails.joinUrl}" class="join-button">Join Zoom Meeting</a>
            <p><strong>Meeting ID:</strong> ${config.personalMeetingId}</p>
            <p><strong>Password:</strong> ${bookingDetails.password}</p>
            <p><strong>Meeting Link:</strong><br>${bookingDetails.joinUrl}</p>
        </div>

        <div class="details">
            <h3>📋 Instructions</h3>
            <ul>
                <li>Join 5-10 minutes before the scheduled time</li>
                <li>Test your audio and video beforehand</li>
                <li>Use the password above to enter the meeting</li>
                <li>Have a stable internet connection</li>
            </ul>
        </div>

        <div class="footer">
            <p>This meeting was scheduled through ${config.hostName}'s booking system</p>
            <p>Contact: ${config.hostEmail} ${config.hostPhone ? '| ' + config.hostPhone : ''}</p>
        </div>
    </div>
</body>
</html>
            `
        };

        await emailTransporter.sendMail(mailOptions);
        console.log('✅ Confirmation email sent to:', bookingDetails.email);
        return true;
    } catch (error) {
        console.error('❌ Email sending failed:', error);
        return false;
    }
}

// Send admin notification email
async function sendAdminNotification(bookingDetails) {
    if (!emailTransporter) return false;

    try {
        const mailOptions = {
            from: `"Booking System" <${config.emailUser}>`,
            to: config.hostEmail,
            subject: `New Meeting Booking - ${bookingDetails.name}`,
            html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #ff6b00; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 10px 10px; }
        .booking-info { background: white; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #ff6b00; }
    </style>
</head>
<body>
    <div class="header">
        <h1>New Meeting Booking 📅</h1>
    </div>
    
    <div class="content">
        <div class="booking-info">
            <h2>Client Details</h2>
            <p><strong>Name:</strong> ${bookingDetails.name}</p>
            <p><strong>Email:</strong> ${bookingDetails.email}</p>
            <p><strong>Phone:</strong> ${bookingDetails.phone || 'Not provided'}</p>
        </div>

        <div class="booking-info">
            <h2>Meeting Details</h2>
            <p><strong>Date:</strong> ${bookingDetails.date}</p>
            <p><strong>Time:</strong> ${bookingDetails.time} (${config.timezone})</p>
            <p><strong>Duration:</strong> ${bookingDetails.duration} minutes</p>
            <p><strong>Purpose:</strong> ${bookingDetails.purpose}</p>
        </div>

        <div class="booking-info">
            <h2>Meeting Link</h2>
            <p><strong>Your Personal Meeting Room:</strong></p>
            <p>https://zoom.us/j/${config.personalMeetingId}</p>
            <p><strong>Password:</strong> ${config.personalMeetingPassword}</p>
        </div>

        <p><em>This booking has been added to your system automatically.</em></p>
    </div>
</body>
</html>
            `
        };

        await emailTransporter.sendMail(mailOptions);
        console.log('✅ Admin notification sent to:', config.hostEmail);
        return true;
    } catch (error) {
        console.error('❌ Admin email failed:', error);
        return false;
    }
}

// Validate meeting time
function validateMeetingTime(dateString, timeString) {
    const date = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (date < today) {
        return { valid: false, reason: 'Cannot book meetings in the past' };
    }
    
    if (date.getDay() === 6) {
        return { valid: false, reason: 'Saturdays are not available for meetings' };
    }
    
    const timeParts = timeString.split(':');
    if (timeParts.length !== 2) {
        return { valid: false, reason: 'Invalid time format. Use HH:MM' };
    }
    
    const hours = parseInt(timeParts[0]);
    const minutes = parseInt(timeParts[1]);
    
    if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        return { valid: false, reason: 'Invalid time format' };
    }
    
    if (hours < config.minStartHour) {
        return { valid: false, reason: `Meetings can only be scheduled after ${config.minStartHour}:00 ${config.timezone}` };
    }
    
    if (hours >= config.maxEndHour) {
        return { valid: false, reason: `Meetings must be scheduled before ${config.maxEndHour}:00 ${config.timezone}` };
    }
    
    return { valid: true };
}

// Check for double booking
function isSlotAvailable(dateString, timeString, duration) {
    const proposedStart = new Date(`${dateString}T${timeString}:00+05:45`);
    const proposedEnd = new Date(proposedStart.getTime() + duration * 60000);
    
    return !bookings.some(booking => {
        if (booking.status === 'cancelled') return false;
        const bookingStart = new Date(`${booking.date}T${booking.time}:00+05:45`);
        const bookingEnd = new Date(bookingStart.getTime() + booking.duration * 60000);
        return (proposedStart < bookingEnd && proposedEnd > bookingStart);
    });
}

// API Routes

// Health check
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

// Get available time slots
app.get('/api/available-slots/:date', (req, res) => {
    const { date } = req.params;
    
    if (!date || isNaN(new Date(date).getTime())) {
        return res.status(400).json({ 
            success: false,
            message: 'Invalid date format. Use YYYY-MM-DD' 
        });
    }
    
    const slots = [];
    for (let hour = config.minStartHour; hour < config.maxEndHour; hour++) {
        for (let minute = 0; minute < 60; minute += 30) {
            const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
            if (isSlotAvailable(date, time, 30)) {
                slots.push(time);
            }
        }
    }
    
    res.json({ 
        success: true,
        date: date,
        availableSlots: slots,
        count: slots.length
    });
});

// Book a meeting
app.post('/api/book-meeting', async (req, res) => {
    try {
        console.log('📥 Received booking request');
        
        const { name, email, phone, date, time, duration, purpose } = req.body;
        
        // Validate required fields
        if (!name || !email || !date || !time || !duration || !purpose) {
            return res.status(400).json({ 
                success: false,
                message: 'All fields are required' 
            });
        }
        
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ 
                success: false,
                message: 'Please enter a valid email address' 
            });
        }
        
        // Validate meeting time
        const timeValidation = validateMeetingTime(date, time);
        if (!timeValidation.valid) {
            return res.status(400).json({ 
                success: false,
                message: timeValidation.reason 
            });
        }
        
        // Validate duration
        const durationNum = parseInt(duration);
        if (isNaN(durationNum) || ![30, 60, 90].includes(durationNum)) {
            return res.status(400).json({ 
                success: false,
                message: 'Duration must be 30, 60, or 90 minutes' 
            });
        }
        
        // Check for double booking
        if (!isSlotAvailable(date, time, durationNum)) {
            return res.status(400).json({ 
                success: false,
                message: 'This time slot is already booked. Please choose another time.' 
            });
        }
        
        // Generate meeting data
        const meetingData = generateMeetingData({
            topic: purpose,
            date: date,
            time: time,
            duration: durationNum
        });
        
        // Create booking record
        const booking = {
            id: meetingData.id,
            name: name.trim(),
            email: email.toLowerCase().trim(),
            phone: phone ? phone.trim() : '',
            date: date,
            time: time,
            duration: durationNum,
            purpose: purpose.trim(),
            zoomMeetingId: config.personalMeetingId,
            joinUrl: meetingData.join_url,
            password: meetingData.password,
            createdAt: new Date().toISOString(),
            status: 'scheduled',
            timezone: config.timezone
        };
        
        // Add to bookings and save
        bookings.push(booking);
        saveBookings();
        
        console.log('✅ Meeting booked successfully for:', email);
        
        // Send emails
        let clientEmailSent = false;
        let adminEmailSent = false;
        
        if (emailTransporter) {
            clientEmailSent = await sendBookingEmail({
                name: name,
                email: email,
                date: date,
                time: time,
                duration: duration,
                purpose: purpose,
                joinUrl: meetingData.join_url,
                password: meetingData.password
            });
            
            adminEmailSent = await sendAdminNotification({
                name: name,
                email: email,
                phone: phone,
                date: date,
                time: time,
                duration: duration,
                purpose: purpose
            });
        }
        
        // Return success response
        res.json({
            success: true,
            message: 'Meeting scheduled successfully!' + 
                     (clientEmailSent ? ' Confirmation email sent.' : ' Please save the meeting details below.'),
            meeting: {
                id: booking.id,
                topic: purpose,
                date: date,
                time: time,
                duration: duration,
                timezone: config.timezone
            },
            joinUrl: meetingData.join_url,
            password: meetingData.password,
            emails: {
                client: clientEmailSent,
                admin: adminEmailSent
            },
            instructions: [
                'Save this meeting link and password',
                'Join 5-10 minutes before the scheduled time',
                clientEmailSent ? 'Check your email for confirmation' : 'You will receive email confirmation shortly'
            ]
        });
        
    } catch (error) {
        console.error('❌ Error booking meeting:', error);
        res.status(500).json({ 
            success: false,
            message: 'Internal server error: ' + error.message 
        });
    }
});

// Get all bookings
app.get('/api/bookings', (req, res) => {
    res.json({
        success: true,
        bookings: bookings,
        count: bookings.length,
        activeCount: bookings.filter(b => b.status !== 'cancelled').length
    });
});

// Serve the frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
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

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n💾 Saving bookings before shutdown...');
    saveBookings();
    console.log('👋 Server shutting down gracefully');
    process.exit(0);
});

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const authRoutes = require('./routes/authRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
}));
app.use(express.json());

// Serve static files for uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/penilaian', require('./routes/penilaianRoutes'));
app.use('/api/bimbingan', require('./routes/bimbinganRoutes'));
app.use('/api/chat', require('./routes/chatRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));

// Health Check
app.get('/', (req, res) => {
    res.send({ message: 'Skripsi Backend is running!' });
});

// Create HTTP server and attach Socket.io
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Allow all origins for development
        methods: ["GET", "POST"]
    }
});

// Initialize Socket.io logic
require('./socket')(io);

server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

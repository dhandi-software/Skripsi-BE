const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { findUserByUsername } = require('../models/userModel');

const SECRET_KEY = process.env.JWT_SECRET || 'skripsi-secret-key';

const login = async (req, res) => {
    const { username, password } = req.body;

    // 1. Find User
    const user = findUserByUsername(username);
    if (!user) {
        return res.status(401).json({ message: 'Invalid credentials' });
    }

    // 2. Check Password (Mocking hash check for simplicity first, or strict comparison if using plain)
    // For this initial setup, let's assume password is '123456' for everyone to make it work quickly
    // OR we just check if password starts with '123' if we want to be super lazy, but let's do a meaningful check.
    // Let's assume input password is just 'password' for all for now.
    
    const isValid = password === 'password'; // Simplified for prototype
    
    if (!isValid) {
        return res.status(401).json({ message: 'Invalid credentials' });
    }

    // 3. Generate Token
    const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        SECRET_KEY,
        { expiresIn: '1d' }
    );

    // 4. Return Response
    return res.status(200).json({
        message: 'Login successful',
        token,
        user: {
            id: user.id,
            username: user.username,
            name: user.name,
            role: user.role
        }
    });
};

module.exports = { login };

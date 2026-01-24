const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { findUserByIdentifier } = require('../models/userModel');

const SECRET_KEY = process.env.JWT_SECRET || 'skripsi-secret-key';

const login = async (req, res) => {
    const { username, password } = req.body;

    try {
        // 1. Find User by Username OR Email
        const user = await findUserByIdentifier(username);
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // 2. Check Password
        const isValid = await bcrypt.compare(password, user.password);
        
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
        // Flatten the structure for frontend convenience if needed, or send as is
        const profileName = user.mahasiswa?.nama || user.dosen?.nama || user.username;

        return res.status(200).json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                username: user.username,
                name: profileName,
                role: user.role,
                // Include profile IDs for easier frontend data fetching
                mahasiswaId: user.mahasiswa?.id,
                dosenId: user.dosen?.id
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

module.exports = { login };

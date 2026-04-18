const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
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
            { expiresIn: '30d' }
        );

        // Set HttpOnly Cookie
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
        });

        // 4. Return Response
        const profileName = user.mahasiswa?.nama || user.dosen?.nama || user.username;

        return res.status(200).json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                username: user.username,
                name: profileName,
                role: user.role,
                mahasiswaId: user.mahasiswa?.id,
                dosenId: user.dosen?.id,
                jabatan: user.dosen?.jabatan
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

const logout = (req, res) => {
    res.clearCookie('token');
    return res.status(200).json({ message: 'Logged out successfully' });
};

const changePassword = async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    const userId = req.user.id;

    try {
        const user = await prisma.user.findUnique({
            where: { id: userId }
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const isValid = await bcrypt.compare(oldPassword, user.password);
        if (!isValid) {
            return res.status(400).json({ message: 'Password lama tidak sesuai' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await prisma.user.update({
            where: { id: userId },
            data: { password: hashedPassword }
        });

        return res.status(200).json({ message: 'Password berhasil diperbarui' });
    } catch (error) {
        console.error('Change password error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

module.exports = { login, logout, changePassword };

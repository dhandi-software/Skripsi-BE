const jwt = require('jsonwebtoken');

const SECRET_KEY = process.env.JWT_SECRET || 'skripsi-secret-key';

const authenticateToken = (req, res, next) => {
    let token = req.cookies?.token;
    
    // Fallback for non-browser clients or previous implementation
    if (!token) {
        const authHeader = req.headers['authorization'];
        token = authHeader && authHeader.split(' ')[1];
    }

    if (!token) return res.sendStatus(401);

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

const authorizeRole = (roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.map(r => r.toUpperCase()).includes(req.user.role.toUpperCase())) {
            return res.status(403).json({ error: "Access denied." });
        }
        next();
    };
};

module.exports = { authenticateToken, authorizeRole };

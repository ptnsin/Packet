const jwt = require('jsonwebtoken');

exports.verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(403).json({ message: "No token provided" });

    jwt.verify(token, process.env.JWT_SECRET || 'secret', (err, decoded) => {
        if (err) return res.status(401).json({ message: "Unauthorized" });
        req.user = decoded; 
        next();
    });
};

exports.isAdmin = (req, res, next) => {
    // ตรวจสอบ 'role' ตามโครงสร้าง User Summary 
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: "Require Admin Role (Role)!" });
    }
    next();
};
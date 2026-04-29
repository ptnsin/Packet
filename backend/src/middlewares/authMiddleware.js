const jwt = require('jsonwebtoken');

exports.verifyToken = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(403).json({ message: "No token provided" });

    jwt.verify(token.split(' ')[1], process.env.JWT_SECRET || 'secret', (err, decoded) => {
        if (err) return res.status(401).json({ message: "Unauthorized" });
        req.user = decoded; // เก็บข้อมูล user ไว้ใน request
        next();
    });
};

// เช็คว่าเป็น Admin หรือไม่ (สำหรับฟังก์ชัน Start/Stop Sniffing)
exports.isAdmin = (req, res, next) => {
    if (req.user.roule !== 'admin') {
        return res.status(403).json({ message: "Require Admin Roule!" });
    }
    next();
};
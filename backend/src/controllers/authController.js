const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

exports.login = async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await prisma.user.findUnique({ where: { username } });
        if (!user) return res.status(404).json({ message: "ไม่พบผู้ใช้งาน" });

        const isMatch = (password === user.password);
        if (!isMatch) return res.status(400).json({ message: "รหัสผ่านไม่ถูกต้อง" });

        const token = jwt.sign(
            { id: user.id, role: user.role }, 
            process.env.JWT_SECRET || 'secret', 
            { expiresIn: '1d' }
        );

        res.json({ token, role: user.role });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
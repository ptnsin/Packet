const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs'); // ✅ เพิ่ม require bcryptjs

exports.login = async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await prisma.user.findUnique({ where: { username } });
        if (!user) return res.status(404).json({ message: "ไม่พบผู้ใช้งาน" });

        // ✅ แก้: ใช้ bcrypt.compare แทนการเทียบ plain text
        const isMatch = await bcrypt.compare(password, user.password);
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

// Register (Admin สร้าง user ใหม่ได้)
exports.register = async (req, res) => {
    const { username, password, role } = req.body;
    try {
        // ตรวจสอบว่ามี username ซ้ำไหม
        const existing = await prisma.user.findUnique({ where: { username } });
        if (existing) return res.status(400).json({ message: "มีชื่อผู้ใช้นี้แล้ว" });

        // Hash password ก่อนบันทึก
        const hashed = await bcrypt.hash(password, 10);

        const user = await prisma.user.create({
            data: {
                username,
                password: hashed,
                role: role || 'user'
            }
        });

        res.status(201).json({
            message: "สร้างผู้ใช้สำเร็จ",
            user: { id: user.id, username: user.username, role: user.role }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
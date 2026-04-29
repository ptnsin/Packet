const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

exports.login = async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await prisma.user.findUnique({ where: { username } });
        if (!user) return res.status(404).json({ message: "ไม่พบผู้ใช้งาน" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: "รหัสผ่านไม่ถูกต้อง" });

        // สร้าง Token โดยเก็บ 'roule' ไว้ข้างในตามที่คุณตั้งชื่อไว้
        const token = jwt.sign(
            { id: user.id, roule: user.roule }, 
            process.env.JWT_SECRET || 'your_secret_key', 
            { expiresIn: '1d' }
        );

        res.json({ token, roule: user.roule });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
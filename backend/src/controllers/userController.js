const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');

// Admin: ดูรายชื่อ User ทั้งหมด
exports.getUsers = async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                username: true,
                role: true,
                createdAt: true
                // ไม่ select password เพื่อความปลอดภัย
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Admin: ลบ User
exports.deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        // ป้องกัน Admin ลบตัวเอง
        if (parseInt(id) === req.user.id) {
            return res.status(400).json({ message: "ไม่สามารถลบบัญชีตัวเองได้" });
        }

        const user = await prisma.user.findUnique({ where: { id: parseInt(id) } });
        if (!user) return res.status(404).json({ message: "ไม่พบผู้ใช้งาน" });

        await prisma.user.delete({ where: { id: parseInt(id) } });
        res.json({ message: `ลบผู้ใช้ ${user.username} สำเร็จ` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.getHistory = async (req, res) => {
    try {
        const packets = await prisma.packet.findMany({
            take: 100,
            orderBy: { timestamp: 'desc' }
        });
        res.json(packets);
    } catch (err) {
        res.status(500).json({ error: "ดึงข้อมูลล้มเหลว" });
    }
};
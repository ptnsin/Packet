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
        res.status(500).json({ error: err.message });
    }
};

exports.getStats = async (req, res) => {
    try {
        const total = await prisma.packet.count();
        const encrypted = await prisma.packet.count({ where: { isEncrypted: true } });
        res.json({
            total,
            encrypted,
            plain: total - encrypted
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.clearHistory = async (req, res) => {
    try {
        await prisma.packet.deleteMany();
        res.json({ message: "History cleared by Admin" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const PDFDocument = require('pdfkit');

// GET /api/packets/history?page=1&limit=100&protocol=tls&encrypted=true&src=192.168
exports.getHistory = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 100;
        const skip = (page - 1) * limit;

        // ✅ Advanced Search/Filter
        const where = {};
        if (req.query.protocol) where.protocol = { contains: req.query.protocol };
        if (req.query.encrypted !== undefined && req.query.encrypted !== '')
            where.isEncrypted = req.query.encrypted === 'true';
        if (req.query.src) where.sourceIp = { contains: req.query.src };
        if (req.query.dst) where.destIp = { contains: req.query.dst };
        if (req.query.startDate || req.query.endDate) {
            where.timestamp = {};
            if (req.query.startDate) where.timestamp.gte = new Date(req.query.startDate);
            if (req.query.endDate) where.timestamp.lte = new Date(req.query.endDate);
        }

        const [packets, total] = await Promise.all([
            prisma.packet.findMany({ take: limit, skip, orderBy: { timestamp: 'desc' }, where }),
            prisma.packet.count({ where })
        ]);

        res.json({
            data: packets,
            pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getStats = async (req, res) => {
    try {
        const total = await prisma.packet.count();
        const encrypted = await prisma.packet.count({ where: { isEncrypted: true } });
        res.json({ total, encrypted, plain: total - encrypted });
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

// ✅ Export Data — GET /api/packets/export?format=csv หรือ format=json
exports.exportData = async (req, res) => {
    try {
        const format = req.query.format || 'json';
        const packets = await prisma.packet.findMany({ orderBy: { timestamp: 'desc' } });

        if (format === 'csv') {
            const header = 'id,timestamp,sourceIp,destIp,length,protocol,isEncrypted\n';
            const rows = packets.map(p =>
                `${p.id},${p.timestamp.toISOString()},${p.sourceIp},${p.destIp},${p.length},${p.protocol},${p.isEncrypted}`
            ).join('\n');
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=packets.csv');
            return res.send(header + rows);
        }

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename=packets.json');
        res.json(packets);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ✅ PDF Report — GET /api/packets/report
exports.exportPDF = async (req, res) => {
    try {
        const packets = await prisma.packet.findMany({
            take: 100,
            orderBy: { timestamp: 'desc' }
        });
        const total = await prisma.packet.count();
        const encrypted = await prisma.packet.count({ where: { isEncrypted: true } });

        const doc = new PDFDocument({ margin: 40 });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=packet_report.pdf');
        doc.pipe(res);

        // Header
        doc.fontSize(18).text('Packet Dashboard — Report', { align: 'center' });
        doc.fontSize(10).text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
        doc.moveDown();

        // Summary
        doc.fontSize(13).text('Summary');
        doc.fontSize(10).text(`Total Packets: ${total}`);
        doc.text(`Encrypted: ${encrypted}`);
        doc.text(`Plain: ${total - encrypted}`);
        doc.moveDown();

        // Table header
        doc.fontSize(13).text('Recent 100 Packets');
        doc.moveDown(0.5);
        doc.fontSize(8);

        const cols = { id: 30, time: 110, src: 100, dst: 100, proto: 130, enc: 50 };
        const startX = 40;
        let y = doc.y;

        // Column headers
        doc.text('ID', startX, y);
        doc.text('Timestamp', startX + cols.id, y);
        doc.text('Source IP', startX + cols.id + cols.time, y);
        doc.text('Dest IP', startX + cols.id + cols.time + cols.src, y);
        doc.text('Protocol', startX + cols.id + cols.time + cols.src + cols.dst, y);
        doc.text('Enc', startX + cols.id + cols.time + cols.src + cols.dst + cols.proto, y);
        doc.moveDown(0.5);
        doc.moveTo(startX, doc.y).lineTo(555, doc.y).stroke();
        doc.moveDown(0.3);

        // Rows
        packets.forEach(p => {
            if (doc.y > 720) doc.addPage();
            y = doc.y;
            doc.text(String(p.id), startX, y, { width: cols.id });
            doc.text(p.timestamp.toISOString().slice(0, 19).replace('T', ' '), startX + cols.id, y, { width: cols.time });
            doc.text(p.sourceIp, startX + cols.id + cols.time, y, { width: cols.src });
            doc.text(p.destIp, startX + cols.id + cols.time + cols.src, y, { width: cols.dst });
            doc.text(p.protocol.slice(0, 20), startX + cols.id + cols.time + cols.src + cols.dst, y, { width: cols.proto });
            doc.text(p.isEncrypted ? 'Yes' : 'No', startX + cols.id + cols.time + cols.src + cols.dst + cols.proto, y, { width: cols.enc });
            doc.moveDown(0.4);
        });

        doc.end();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
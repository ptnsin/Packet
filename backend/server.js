const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { spawn } = require('child_process');
const cors = require('cors');
require('dotenv').config();

const authController = require('./src/controllers/authController');
const packetRoutes = require('./src/routes/packetRoutes');
const userRoutes = require('./src/routes/userRoutes');
const { verifyToken } = require('./src/middlewares/authMiddleware');

const app = express();
app.use(cors());
app.use(express.json());

// API Routes
app.post('/api/login', authController.login);
app.post('/api/register', authController.register);
app.use('/api/packets', verifyToken, packetRoutes);
app.use('/api/users', verifyToken, userRoutes);

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const PORT = process.env.PORT || 5000;
const INTERFACE = process.env.INTERFACE_ID || '1';

// ✅ Security Alerts — โปรโตคอลอันตราย
const UNSAFE_PROTOCOLS = ['http', 'ftp', 'telnet', 'tftp'];
const checkUnsafe = (protocol) =>
    UNSAFE_PROTOCOLS.some(p => protocol.toLowerCase().includes(p));

const startSniffing = () => {
    const tshark = spawn('tshark', [
        '-i', INTERFACE, '-l', '-T', 'ek',
        '-e', 'ip.src', '-e', 'ip.dst', '-e', 'frame.len', '-e', 'frame.protocols'
    ]);

    tshark.stdout.on('data', (data) => {
        const lines = data.toString().split('\n');
        lines.forEach(async (line) => {
            if (!line.trim() || line.startsWith('{"index"')) return;
            try {
                const raw = JSON.parse(line).layers;

                // ✅ ใช้ชื่อ field ตรงกับ Prisma schema และ frontend
                const packetData = {
                    sourceIp:    raw['ip_src']?.[0] || 'N/A',
                    destIp:      raw['ip_dst']?.[0] || 'N/A',
                    length:      parseInt(raw['frame_len']?.[0] || 0),
                    protocol:    raw['frame_protocols']?.[0] || '',
                    isEncrypted: raw['frame_protocols']?.[0]?.includes('tls') || false,
                };

                // บันทึกลง DB แล้วใช้ record ที่ได้กลับมา (มี id + timestamp จริง)
                const saved = await prisma.packet.create({ data: packetData });

                // ✅ emit ด้วย record จาก DB — frontend ได้ field ครบ รวม timestamp ที่ถูกต้อง
                io.emit('packet-received', saved);

                // ✅ Security Alert — ส่ง socket พร้อม severity
                if (checkUnsafe(packetData.protocol)) {
                    io.emit('security-alert', {
                        message: `Detected Unsafe Protocol: ${packetData.protocol}`,
                        src: packetData.sourceIp,
                        dst: packetData.destIp,
                        protocol: packetData.protocol,
                        severity: 'high',
                        time: new Date().toISOString()
                    });
                }
            } catch (err) {}
        });
    });

    tshark.stderr.on('data', (err) => {
        console.error('tshark error:', err.toString());
    });

    tshark.on('close', (code) => {
        console.warn(`tshark exited with code: ${code}. Restarting in 3s...`);
        setTimeout(startSniffing, 3000);
    });

    console.log(`📡 Sniffing started on Interface: ${INTERFACE}`);
};

startSniffing();
server.listen(PORT, () => console.log(`Backend Engine running on http://localhost:${PORT}`));

module.exports = { prisma };
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
                const packetData = {
                    src: raw['ip_src']?.[0] || 'N/A',
                    dst: raw['ip_dst']?.[0] || 'N/A',
                    size: parseInt(raw['frame_len']?.[0] || 0),
                    protocols: raw['frame_protocols']?.[0] || '',
                    isEncrypted: raw['frame_protocols']?.[0]?.includes('tls') || false,
                    time: new Date().toLocaleTimeString()
                };

                // บันทึกลง DB
                await prisma.packet.create({
                    data: {
                        sourceIp: packetData.src,
                        destIp: packetData.dst,
                        length: packetData.size,
                        protocol: packetData.protocols,
                        isEncrypted: packetData.isEncrypted
                    }
                });

                // ส่งข้อมูล Real-time
                io.emit('packet-received', packetData);

                // ✅ Security Alert — ส่ง socket พร้อม severity
                if (checkUnsafe(packetData.protocols)) {
                    io.emit('security-alert', {
                        message: `Detected Unsafe Protocol: ${packetData.protocols}`,
                        src: packetData.src,
                        dst: packetData.dst,
                        protocol: packetData.protocols,
                        severity: 'high',
                        time: packetData.time
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
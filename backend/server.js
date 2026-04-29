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
const { verifyToken } = require('./src/middlewares/authMiddleware');

const app = express();
app.use(cors());
app.use(express.json());

// API Routes
app.post('/api/login', authController.login);
app.use('/api/packets', verifyToken, packetRoutes);

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const PORT = process.env.PORT || 5000;
const INTERFACE = process.env.INTERFACE_ID || '1';

// ฟังก์ชันตรวจจับโปรโตคอลอันตราย (Security Alerts)
const checkUnsafe = (protocol) => {
    const unsafe = ['http', 'ftp', 'telnet', 'tftp'];
    return unsafe.some(p => protocol.toLowerCase().includes(p));
};

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

                // บันทึกลง DB (Packet History Storage)
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

                // ถ้าเจอโปรโตคอลอันตราย ให้ส่ง Alert (Security Alerts)
                if (checkUnsafe(packetData.protocols)) {
                    io.emit('security-alert', {
                        message: `Detected Unsafe Protocol: ${packetData.protocols}`,
                        src: packetData.src,
                        time: packetData.time
                    });
                }
            } catch (err) {}
        });
    });

    console.log(`📡 Sniffing started on Interface: ${INTERFACE}`);
};

startSniffing();
server.listen(PORT, () => console.log(`Backend Engine running on http://localhost:${PORT}`));
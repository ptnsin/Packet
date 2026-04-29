const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { spawn } = require('child_process');
const cors = require('cors'); // เพิ่ม CORS
require('dotenv').config();

// นำเข้า Routes และ Middleware
const authController = require('./src/controllers/authController');
const packetRoutes = require('./src/routes/packetRoutes');
const { verifyToken } = require('./src/middlewares/authMiddleware');

const app = express();
app.use(cors()); // อนุญาตให้ Frontend ข้ามโดเมนมาดึงข้อมูลได้
app.use(express.json()); // สำคัญมาก! เพื่อให้ Login รับ username/password ได้

// --- API Routes ---
app.post('/api/login', authController.login);
app.use('/api/packets', verifyToken, packetRoutes); // ต้อง Login ก่อนถึงจะดู History ได้

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

const PORT = process.env.PORT || 5000;
const INTERFACE = process.env.INTERFACE_ID || '1';

// --- Logic TShark (โค้ดเดิมของคุณที่ทำงานได้ดีอยู่แล้ว) ---
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

                io.emit('packet-received', packetData);
            } catch (err) {}
        });
    });

    console.log(`📡 Sniffing started on Interface: ${INTERFACE}`);
};

startSniffing();
server.listen(PORT, () => {
    console.log(`Backend Engine running on http://localhost:${PORT}`);
});
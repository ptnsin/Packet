const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { spawn } = require('child_process');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" } // อนุญาตให้ Frontend (Vite) เชื่อมต่อได้
});

const PORT = process.env.PORT || 5000;
const INTERFACE = process.env.INTERFACE_ID || '1';

// --- ฟังก์ชันดักจับ Packet ด้วย TShark ---
const startSniffing = () => {
    // -i: interface, -l: live, -T ek: output json format
    const tshark = spawn('tshark', [
        '-i', INTERFACE,
        '-l',
        '-T', 'ek',
        '-e', 'ip.src',
        '-e', 'ip.dst',
        '-e', 'frame.len',
        '-e', 'frame.protocols',
        '-e', 'tcp.srcport',
        '-e', 'tcp.dstport'
    ]);

    tshark.stdout.on('data', (data) => {
        const lines = data.toString().split('\n');
        lines.forEach(line => {
            // กรองเอาเฉพาะบรรทัดที่เป็นข้อมูล Packet จริงๆ (JSON)
            if (!line.trim() || line.startsWith('{"index"')) return;
            
            try {
                const raw = JSON.parse(line).layers;
                
                // จัด Format ข้อมูลให้เพื่อนคนที่ 2 (Frontend) ใช้ง่ายๆ
                const packetData = {
                    src: raw['ip_src']?.[0] || 'N/A',
                    dst: raw['ip_dst']?.[0] || 'N/A',
                    size: parseInt(raw['frame_len']?.[0] || 0),
                    protocols: raw['frame_protocols']?.[0] || '',
                    // ตรวจสอบการเข้ารหัส (TLS/SSL)
                    isEncrypted: raw['frame_protocols']?.[0]?.includes('tls') || 
                                 raw['frame_protocols']?.[0]?.includes('ssl') || false,
                    time: new Date().toLocaleTimeString()
                };

                // ส่งข้อมูลออกไปให้ทุกคนที่เชื่อมต่อ Socket อยู่
                io.emit('packet-received', packetData);
                
            } catch (err) {
                // ข้ามบรรทัดที่ JSON ไม่สมบูรณ์
            }
        });
    });

    tshark.stderr.on('data', (data) => {
        console.error(`TShark Error: ${data}`);
    });

    console.log(`📡 Sniffing started on Interface: ${INTERFACE}`);
};

// เริ่มรัน Engine
startSniffing();

server.listen(PORT, () => {
    console.log(`Backend Engine running on http://localhost:${PORT}`);
});
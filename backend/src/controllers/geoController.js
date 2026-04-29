const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ✅ Geolocation Mapping — GET /api/geo/map
// ใช้ ip-api.com (free, ไม่ต้อง API key สำหรับ non-commercial)
exports.getGeoMap = async (req, res) => {
    try {
        // ดึง IP ที่ไม่ซ้ำกัน 20 อันล่าสุด
        const packets = await prisma.packet.findMany({
            select: { sourceIp: true },
            distinct: ['sourceIp'],
            take: 20,
            orderBy: { timestamp: 'desc' }
        });

        const ips = packets
            .map(p => p.sourceIp)
            .filter(ip => ip !== 'N/A' && !ip.startsWith('192.168') && !ip.startsWith('10.') && !ip.startsWith('127.'));

        if (ips.length === 0) {
            return res.json({ locations: [] });
        }

        // Batch lookup จาก ip-api.com (รองรับ batch สูงสุด 100 IPs)
        const response = await fetch('http://ip-api.com/batch?fields=status,query,country,city,lat,lon,isp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(ips.map(ip => ({ query: ip })))
        });

        const geoData = await response.json();

        const locations = geoData
            .filter(d => d.status === 'success')
            .map(d => ({
                ip: d.query,
                country: d.country,
                city: d.city,
                lat: d.lat,
                lon: d.lon,
                isp: d.isp
            }));

        res.json({ locations });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
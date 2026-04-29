const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
    await prisma.user.updateMany({ where: {}, data: {} }); // clear ไม่ได้ ต้อง update ทีละ user

    await prisma.user.update({
        where: { username: 'path' },
        data: { password: await bcrypt.hash('path1', 10) }
    });

    await prisma.user.update({
        where: { username: 'tartar' },
        data: { password: await bcrypt.hash('tartar1', 10) }
    });

    console.log('✅ Passwords hashed!');
}

main().finally(() => prisma.$disconnect());
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
    await prisma.user.upsert({
        where: { username: 'path' },
        update: { password: await bcrypt.hash('path1', 10) },
        create: { username: 'path', password: await bcrypt.hash('path1', 10), role: 'admin' }
    });

    await prisma.user.upsert({
        where: { username: 'tartar' },
        update: { password: await bcrypt.hash('tartar1', 10) },
        create: { username: 'tartar', password: await bcrypt.hash('tartar1', 10), role: 'user' }
    });

    console.log('✅ Passwords hashed!');
}

main().finally(() => prisma.$disconnect());
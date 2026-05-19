const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const users = await prisma.user.findMany({
        include: {
            mahasiswa: true,
            dosen: true,
            staf: true
        }
    });

    const passwords = ['password123', 'password', 'admin123', 'admin', '123456', '12345678', 'dhandi123', 'dhandi'];
    
    for (const user of users) {
        console.log(`Checking user: ${user.username} (Role: ${user.role}, Email: ${user.email})`);
        let matched = false;
        for (const p of passwords) {
            const isMatch = await bcrypt.compare(p, user.password);
            if (isMatch) {
                console.log(`  => Password matched: '${p}'`);
                matched = true;
                break;
            }
        }
        if (!matched) {
            console.log(`  => NO MATCH FOUND for hash: ${user.password}`);
        }
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());

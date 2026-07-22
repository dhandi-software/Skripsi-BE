const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function generateRandomPhone() {
    const prefixes = ['0812', '0813', '0852', '0853', '0821', '0822', '0896', '0897', '0819', '0878'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const body = Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
    return prefix + body;
}

async function main() {
    console.log("Updating kontakPembimbing in TempatKP...");
    const tempatKPs = await prisma.tempatKP.findMany();
    
    for (const tkp of tempatKPs) {
        await prisma.tempatKP.update({
            where: { id: tkp.id },
            data: { kontakPembimbing: generateRandomPhone() }
        });
    }
    
    console.log(`Updated ${tempatKPs.length} records.`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());

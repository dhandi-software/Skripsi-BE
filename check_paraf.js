const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    const l = await prisma.logbook.findMany();
    console.log('Total Logbooks:', l.length);
    console.log('Logbooks with pembimbingParaf:', l.filter(x => x.pembimbingParaf).length);
    console.log('Logbooks with mahasiswaParaf:', l.filter(x => x.mahasiswaParaf).length);
}
main().finally(() => prisma.$disconnect());

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    await prisma.logbook.updateMany({
        data: {
            mahasiswaParaf: null,
            pembimbingParaf: null
        }
    });
    console.log("Cleared signatures");
}
main().finally(() => prisma.$disconnect());

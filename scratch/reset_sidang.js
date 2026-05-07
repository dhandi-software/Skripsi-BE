const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function resetSidang() {
    console.log("Starting Database Reset for Management Sidang...");
    
    try {
        // 1. Delete all Penilaian records
        const deletedPenilaian = await prisma.penilaian.deleteMany({});
        console.log(`Deleted ${deletedPenilaian.count} Penilaian records.`);

        // 2. Delete all Sidang records
        const deletedSidang = await prisma.sidang.deleteMany({});
        console.log(`Deleted ${deletedSidang.count} Sidang records.`);

        console.log("Database reset complete.");
    } catch (error) {
        console.error("Reset Error:", error);
    } finally {
        await prisma.$disconnect();
    }
}

resetSidang();

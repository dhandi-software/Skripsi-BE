const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testAdvisorApproval() {
    console.log("Testing Advisor Approval Logic...");
    
    // 1. Find a student and advisor to use for mock
    const student = await prisma.mahasiswa.findFirst();
    const advisor = await prisma.dosen.findFirst();
    
    if (!student || !advisor) {
        console.error("Please seed the database with at least one student and one advisor.");
        return;
    }

    // 2. Create a Sidang record WITH a schedule (simulating Staff scheduling)
    const sidangWithSchedule = await prisma.sidang.create({
        data: {
            mahasiswaId: student.id,
            dosenId: advisor.id,
            judul: "Test Sidang Jump",
            tanggalSidang: new Date(),
            waktuSidang: "10:00",
            lokasi: "Lab 1",
            status: 'MENUNGGU_PERSETUJUAN_PEMBIMBING',
            pembimbingApproved: false
        }
    });
    console.log("Created Sidang with schedule:", sidangWithSchedule.id);

    // 3. Simulate Advisor Approval (This is the logic we just added to the controller)
    const approve = async (id) => {
        const cur = await prisma.sidang.findUnique({ where: { id } });
        const isScheduled = cur.tanggalSidang && cur.waktuSidang && cur.lokasi;
        return await prisma.sidang.update({
            where: { id },
            data: {
                pembimbingApproved: true,
                prodiApproved: isScheduled ? true : cur.prodiApproved,
                status: isScheduled ? 'TERJADWAL' : 'MENUNGGU_PENJADWALAN_PRODI'
            }
        });
    };

    const updatedWithSchedule = await approve(sidangWithSchedule.id);
    console.log("Status after approval (with schedule):", updatedWithSchedule.status);
    console.log("Prodi Approved:", updatedWithSchedule.prodiApproved);

    // 4. Create a Sidang record WITHOUT a schedule
    const sidangNoSchedule = await prisma.sidang.create({
        data: {
            mahasiswaId: student.id,
            dosenId: advisor.id,
            judul: "Test Sidang No Jump",
            status: 'MENUNGGU_PERSETUJUAN_PEMBIMBING',
            pembimbingApproved: false
        }
    });
    console.log("Created Sidang WITHOUT schedule:", sidangNoSchedule.id);

    const updatedNoSchedule = await approve(sidangNoSchedule.id);
    console.log("Status after approval (no schedule):", updatedNoSchedule.status);

    // Cleanup
    await prisma.sidang.deleteMany({
        where: { id: { in: [sidangWithSchedule.id, sidangNoSchedule.id] } }
    });
    console.log("Cleanup done.");
    
    await prisma.$disconnect();
}

testAdvisorApproval().catch(e => {
    console.error(e);
    process.exit(1);
});

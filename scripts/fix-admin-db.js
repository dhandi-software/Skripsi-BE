const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Starting DB migration to completely separate Admin from Staff...");
    
    // Hash for 'password123'
    const passwordHash = await bcrypt.hash('password123', 10);
    
    // Find if admin user exists
    let adminUser = await prisma.user.findUnique({
        where: { username: 'adminunivpancasila' }
    });
    
    if (adminUser) {
        console.log(`Found existing admin user (ID: ${adminUser.id}). Updating role, email and password...`);
        adminUser = await prisma.user.update({
            where: { id: adminUser.id },
            data: {
                role: 'admin',
                email: 'adminunivpancasila@univ.ac.id',
                password: passwordHash
            }
        });
    } else {
        console.log("Admin user not found. Creating new admin user...");
        adminUser = await prisma.user.create({
            data: {
                username: 'adminunivpancasila',
                email: 'adminunivpancasila@univ.ac.id',
                password: passwordHash,
                role: 'admin'
            }
        });
    }
    
    // Delete the Staf profile associated with the Admin user
    const deletedStaf = await prisma.staf.deleteMany({
        where: { userId: adminUser.id }
    });
    
    console.log(`Deleted ${deletedStaf.count} associated Staf profile(s) from Admin user to keep them completely separate.`);
    console.log("Migration finished successfully!");
}

main().catch(console.error).finally(() => prisma.$disconnect());

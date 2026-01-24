const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  try {
    const users = await prisma.user.findMany();
    console.log('------------------------------------------------');
    console.log('CONNECTED TO DB URL:', process.env.DATABASE_URL); // Check what URL it sees
    console.log('TOTAL USERS FOUND:', users.length);
    console.log('USERNAMES:', users.map(u => `${u.id}: ${u.username} (${u.role})`).join(', '));
    console.log('------------------------------------------------');

    // Test password for 'mahasiswa'
    const mhs = users.find(u => u.username === 'mahasiswa');
    if (mhs) {
        const isMatch = await bcrypt.compare('password', mhs.password);
        console.log(`Password check for 'mahasiswa' with 'password': ${isMatch ? 'MATCH (Valid)' : 'FAIL (Invalid)'}`);
    } else {
        console.log("User 'mahasiswa' NOT FOUND.");
    }

  } catch (e) {
    console.error('Error:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();

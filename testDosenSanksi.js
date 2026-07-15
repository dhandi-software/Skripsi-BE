const sanksiController = require('./src/controllers/sanksiController');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const req = {
    user: {
        id: 43, // Assume regular dosen user id
        role: 'DOSEN'
    }
};

const res = {
    json: function(data) {
        console.log('Result length:', data.length);
        console.log('Result:', JSON.stringify(data, null, 2).slice(0, 500));
    },
    status: function(code) {
        console.log('Status code:', code);
        return {
            json: (err) => console.log('Error:', err)
        };
    }
};

sanksiController.getAllSanksi(req, res).catch(console.error).finally(() => prisma.$disconnect());

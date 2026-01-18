// Mock Data for 4 Actors
const users = [
    {
        id: 1,
        username: 'kaprodi',
        name: 'Dr. Kaprodi, S.Kom, M.Kom',
        password: '$2b$10$YourHashedPasswordHere', // In real app, this is hashed. For now we will check plain or mock hash
        role: 'kaprodi',
        email: 'kaprodi@univ.ac.id'
    },
    {
        id: 2,
        username: 'dospem',
        name: 'Ir. Dosen Pembimbing, M.T',
        password: '$2b$10$YourHashedPasswordHere',
        role: 'dosen_pembimbing',
        email: 'dospem@univ.ac.id'
    },
    {
        id: 3,
        username: 'staf',
        name: 'Staf Administrasi',
        password: '$2b$10$YourHashedPasswordHere',
        role: 'staf_univ',
        email: 'staf@univ.ac.id'
    },
    {
        id: 4,
        username: 'mahasiswa',
        name: 'Mahasiswa Berprestasi',
        password: '$2b$10$YourHashedPasswordHere',
        role: 'mahasiswa',
        email: 'mahasiswa@student.univ.ac.id'
    }
];

// Helper to simulate DB find
const findUserByUsername = (username) => {
    return users.find(u => u.username === username);
};

module.exports = {
    users,
    findUserByUsername
};

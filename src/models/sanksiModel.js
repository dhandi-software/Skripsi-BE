const BaseModel = require('./BaseModel');

class SanksiModel extends BaseModel {
    constructor() {
        super('sanksiAdministrasi');
    }

    async findByMahasiswaNim(nim) {
        return await this.findMany({
            where: { mahasiswaNim: nim },
            include: { dosen: true, mahasiswa: true },
            orderBy: { createdAt: 'desc' }
        });
    }

    async findAllWithRelations() {
        return await this.findMany({
            include: { mahasiswa: true, dosen: true },
            orderBy: { createdAt: 'desc' }
        });
    }

    async findExistingByMahasiswa(mahasiswaNim) {
        return await this.findFirst({
            where: { mahasiswaNim }
        });
    }
}

module.exports = new SanksiModel();

const BaseModel = require('./BaseModel');

class BimbinganModel extends BaseModel {
    constructor() {
        super('bimbingan');
    }

    /**
     * Get all bimbingan records for a specific mahasiswa
     */
    async findByMahasiswa(nim) {
        return await this.findMany({
            where: { mahasiswaNim: nim },
            orderBy: { tanggal: 'desc' },
            include: { dosen: true }
        });
    }

    /**
     * Get all bimbingan records for a specific dosen
     */
    async findByDosen(nidn) {
        return await this.findMany({
            where: { dosenNidn: nidn },
            orderBy: { tanggal: 'desc' },
            include: { mahasiswa: true }
        });
    }
}

module.exports = new BimbinganModel();

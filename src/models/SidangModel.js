const BaseModel = require('./BaseModel');

class SidangModel extends BaseModel {
    constructor() {
        super('sidang');
    }

    /**
     * Get sidang for a mahasiswa
     */
    async findByMahasiswa(nim) {
        return await this.findFirst({
            where: { mahasiswaNim: nim },
            include: { dosen: true }
        });
    }
}

module.exports = new SidangModel();

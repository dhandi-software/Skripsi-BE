const BaseModel = require('./BaseModel');

class AcaraModel extends BaseModel {
    constructor() {
        super('acara');
    }

    /**
     * Get all Acara assigned by a Dosen
     */
    async findByDosen(nidn) {
        return await this.findMany({
            where: { dosenNidn: nidn },
            orderBy: { createdAt: 'desc' }
        });
    }
}

module.exports = new AcaraModel();

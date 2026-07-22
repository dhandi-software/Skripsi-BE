const BaseModel = require('./BaseModel');

class DosenModel extends BaseModel {
    constructor() {
        super('dosen');
    }

    /**
     * Find Dosen by NIDN
     */
    async findByNidn(nidn) {
        return await this.findUnique({
            where: { nidn },
            include: { user: true }
        });
    }
}

module.exports = new DosenModel();

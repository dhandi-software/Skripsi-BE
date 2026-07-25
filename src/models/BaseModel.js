const prisma = require('../prisma');

/**
 * Base Model for Prisma queries
 * Encapsulates common CRUD operations to be used across all specific models.
 */
class BaseModel {
    constructor(modelName) {
        if (!prisma[modelName]) {
            throw new Error(`Prisma model '${modelName}' is not defined.`);
        }
        this.model = prisma[modelName];
    }

    /**
     * Find many records
     */
    async findMany(args) {
        return await this.model.findMany(args);
    }

    /**
     * Find a single unique record
     */
    async findUnique(args) {
        return await this.model.findUnique(args);
    }

    /**
     * Find the first record that matches the criteria
     */
    async findFirst(args) {
        return await this.model.findFirst(args);
    }

    /**
     * Create a new record
     */
    async create(args) {
        return await this.model.create(args);
    }

    /**
     * Update an existing record
     */
    async update(args) {
        return await this.model.update(args);
    }

    /**
     * Delete a record
     */
    async delete(args) {
        return await this.model.delete(args);
    }

    /**
     * Count records matching criteria
     */
    async count(args) {
        return await this.model.count(args);
    }

    /**
     * Create multiple records
     */
    async createMany(args) {
        return await this.model.createMany(args);
    }
}

module.exports = BaseModel;

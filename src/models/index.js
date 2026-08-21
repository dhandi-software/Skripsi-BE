const UserModel = require('./userModel');
const MahasiswaModel = require('./MahasiswaModel');
const MessageModel = require('./MessageModel');
const BimbinganModel = require('./BimbinganModel');
const DosenModel = require('./DosenModel');
const AcaraModel = require('./AcaraModel');
const SidangModel = require('./SidangModel');
const PengajuanJudulModel = require('./PengajuanJudulModel');
const BimbinganAnnotationModel = require('./BimbinganAnnotationModel');

// Re-export all models here so they can be easily imported into controllers
// e.g., const { UserModel, MahasiswaModel, MessageModel } = require('../models');

module.exports = {
    UserModel,
    MahasiswaModel,
    MessageModel,
    BimbinganModel,
    DosenModel,
    AcaraModel,
    SidangModel,
    PengajuanJudulModel,
    BimbinganAnnotationModel
};

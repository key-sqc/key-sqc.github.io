const mongoose = require('mongoose');

const MONGODB_CONFIG = {
    url: 'mongodb://localhost:27017/checkin_app',
    options: {
        serverSelectionTimeoutMS: 5000,
        family: 4
    }
};

mongoose.connect(MONGODB_CONFIG.url, MONGODB_CONFIG.options)
    .then(() => console.log('✅ MongoDB 已成功连接'))
    .catch(err => console.error('❌ MongoDB 连接失败：', err));

module.exports = mongoose;

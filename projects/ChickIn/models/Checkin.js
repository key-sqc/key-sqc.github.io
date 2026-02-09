const mongoose = require('../mongoose.js');

const CheckinSchema = new mongoose.Schema({
    username: { type: String, required: true },
    content: { type: String, required: true },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    isSupplement: { type: Boolean, default: false },
    targetDate: { type: String, default: null, match: /^\d{4}-\d{2}-\d{2}$/ }
}, {
    timestamps: true,
    collection: 'checkins'
});

const Checkin = mongoose.model('Checkin', CheckinSchema);
module.exports = Checkin;

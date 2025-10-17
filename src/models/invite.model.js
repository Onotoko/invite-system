const mongoose = require('mongoose');

const inviteSchema = new mongoose.Schema({
    code: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    maxUses: {
        type: Number,
        default: 1,
        min: 1
    },
    currentUses: {
        type: Number,
        default: 0
    },
    referrerEmail: {
        type: String,
        required: true,
        lowercase: true,
        trim: true
    },
    usedBy: [{
        email: {
            type: String,
            lowercase: true,
            trim: true
        },
        usedAt: {
            type: Date,
            default: Date.now
        },
        ipAddress: String
    }],
    isActive: {
        type: Boolean,
        default: true
    },
    expiresAt: {
        type: Date,
        default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    }
}, {
    timestamps: true
});

// Compound indexes
inviteSchema.index({ code: 1, isActive: 1 });
inviteSchema.index({ referrerEmail: 1 });
inviteSchema.index({ 'usedBy.email': 1 });

module.exports = mongoose.model('Invite', inviteSchema);
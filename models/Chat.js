const mongoose = require("mongoose");

const chatSchema = new mongoose.Schema({
    chatId: {
        type: String,
        required: true
    },

    username: {
        type: String,
        default: "Unknown"
    },

    firstName: {
        type: String
    },

    message: {
        type: String,
        required: true
    },

    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("Chat", chatSchema);
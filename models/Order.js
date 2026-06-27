const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({

    channelMessageId: Number, 

    telegramId: Number,

    customerName: String,

  items: [
    {
        productName: String,
        quantity: Number,
        price: Number
    }
],

    phone: String,

    address: String,

    paymentMethod: String,

    totalAmount: Number,

    status: {

        type: String,

        default: "Pending"

    }

}, {

    timestamps: true

});

module.exports =
    mongoose.model(
        "Order",
        orderSchema
    );

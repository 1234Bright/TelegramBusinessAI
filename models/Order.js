const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({


customerId: {
    type: String,
    required: true
},

customerName: {
    type: String,
    required: true
},

productName: {
    type: String,
    required: true
},

quantity: {
    type: Number,
    required: true
},

phone: {
    type: String,
    default: ""
},

location: {
    type: String,
    default: ""
},

status: {
    type: String,
    default: "Pending"
},

createdAt: {
    type: Date,
    default: Date.now
}


});

module.exports = mongoose.model("Order", orderSchema);

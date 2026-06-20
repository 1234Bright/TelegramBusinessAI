require("dotenv").config();

const TelegramBot = require("node-telegram-bot-api");
const mongoose = require("mongoose");
const Chat = require("./models/Chat");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const Product = require("./models/Product");
const Order = require("./models/Order");
const orderStates = {};

// Gemini AI Setup
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash"
});

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
.then(() => {
    console.log("MongoDB Connected Successfully");
})
.catch((error) => {
    console.log(error);
});


async function createProducts(){

    const count = await Product.countDocuments();

    if(count === 0){

        await Product.insertMany([

            {
                name:"Black Nike Shoe",
                description:"Comfortable running shoe",
                price:250,
                stock:5
            },

            {
                name:"Smart Watch",
                description:"Digital smartwatch",
                price:450,
                stock:10
            },

            {
                name:"Bluetooth Speaker",
                description:"Portable speaker",
                price:300,
                stock:8
            }

        ]);

        console.log("Products Added");

    }

}


mongoose.connection.once(
    "open",
    createProducts
);

// Telegram Bot Setup
const token = process.env.TELEGRAM_BOT_TOKEN;

const bot = new TelegramBot(token, {
    polling: {
        interval: 3000,
        autoStart: true,
        params: {
            timeout: 10
        }
    }
});
console.log("Bot is running...");

// DEBUG
bot.on("polling_error", (error) => {
    console.log("POLLING ERROR:");
    console.log(error);
});

bot.getMe()
.then((info) => {
    console.log("BOT INFO:");
    console.log(info);
})
.catch((err) => {
    console.log("BOT ERROR:");
    console.log(err);
});






// Start Command
bot.onText(/\/start/, (msg) => {

    console.log("START FROM:", msg.chat.id);

    const userId = msg.chat.id.toString();

    // ADMIN
    if(userId === process.env.ADMIN_ID){

        return bot.sendMessage(
            msg.chat.id,
            `Admin Panel

/products
/addproduct
/updateproduct
/deleteproduct
/orders
/testadmin`
        );

    }





    
    // CUSTOMER
bot.sendMessage(
    msg.chat.id,
    `👋 Welcome to Bright Electronics.

I can help you:

• Find products
• Check prices
• Answer questions
• Place orders

Just send me a message and I'll assist you.`
);
});






// Products Command
bot.onText(/\/products/, async (msg) => {

    if(msg.chat.id.toString() !== process.env.ADMIN_ID){
        return;
    }

    const products = await Product.find();

    let list = "Available Products:\n\n";


    products.forEach((product, index)=>{

        list += `${index + 1}. ${product.name}
Price: GHS ${product.price}
Stock: ${product.stock}

`;

    });


    bot.sendMessage(
        msg.chat.id,
        list
    );

});


// Add Product Command
bot.onText(/\/addproduct/, async (msg) => {


    if(msg.chat.id.toString() !== process.env.ADMIN_ID){

        return bot.sendMessage(
            msg.chat.id,
            "You are not authorized."
        );

    }


    bot.sendMessage(
        msg.chat.id,
        "Send product details like this:\n\nName, Description, Price, Stock\n\nExample:\n\niPhone 15, New Apple phone, 5000, 3"
    );

const handler = async (reply) => {


        const data = reply.text.split(",");




        const product = new Product({

            name: data[0].trim(),

            description: data[1].trim(),

            price: Number(data[2]),

            stock: Number(data[3])

        });


        await product.save();


        bot.sendMessage(
            msg.chat.id,
            "Product added successfully ✅"
        );


  bot.removeListener("message", handler);
};

bot.on("message", handler);


});



// Delete Product Command
bot.onText(/\/deleteproduct (.+)/, async (msg, match) => {

    if(msg.chat.id.toString() !== process.env.ADMIN_ID){

        return bot.sendMessage(
            msg.chat.id,
            "You are not authorized."
        );

    }

    const productName = match[1];

    const deletedProduct = await Product.findOneAndDelete({
        name: productName
    });

    if(!deletedProduct){

        return bot.sendMessage(
            msg.chat.id,
            "Product not found."
        );

    }

    bot.sendMessage(
        msg.chat.id,
        "Product deleted successfully ✅"
    );

});





// Update Product Command
bot.onText(/\/updateproduct/, async (msg) => {

    if(msg.chat.id.toString() !== process.env.ADMIN_ID){

        return bot.sendMessage(
            msg.chat.id,
            "You are not authorized."
        );

    }

    bot.sendMessage(
        msg.chat.id,
        "Send:\n\nProduct Name, New Price, New Stock\n\nExample:\nSmart Watch, 500, 15"
    );

   const handler = async (reply) => {

        const data = reply.text.split(",");

        const productName = data[0].trim();
        const newPrice = Number(data[1]);
        const newStock = Number(data[2]);

        const product = await Product.findOne({
            name: productName
        });

        if(!product){

            return bot.sendMessage(
                msg.chat.id,
                "Product not found."
            );

        }

        product.price = newPrice;
        product.stock = newStock;

        await product.save();

        bot.sendMessage(
            msg.chat.id,
            "Product updated successfully ✅"
        );

    bot.removeListener("message", handler);
};

bot.on("message", handler);
});




// Test Admin Notification

bot.onText(/\/testadmin/, async (msg) => {

    const userId = msg.chat.id.toString();

    if (userId !== process.env.ADMIN_ID) {
        return;
    }

    try {

        await bot.sendMessage(
            process.env.ADMIN_ID,
            "🔔 Test notification received successfully!"
        );

        console.log("Admin notification sent");

    } catch (error) {

        console.log("Notification Error:");
        console.log(error);

    }

});





// View Orders
bot.onText(/\/orders/, async (msg) => {

    if(msg.chat.id.toString() !== process.env.ADMIN_ID){
        return;
    }

    const orders = await Order.find();

    if(orders.length === 0){

        return bot.sendMessage(
            msg.chat.id,
            "No orders found."
        );

    }

    let message = "📦 Orders\n\n";

    orders.forEach((order, index) => {

        message += `${index + 1}.
Customer: ${order.customerName}
Product: ${order.productName}
Quantity: ${order.quantity}
Status: ${order.status}

`;

    });

    bot.sendMessage(
        msg.chat.id,
        message
    );

});






// // Help Command
// bot.onText(/\/help/, (msg) => {

//     bot.sendMessage(
//         msg.chat.id,
//         `Ask me about our products and services.`
//     );
// });






// AI Chat Messages
bot.on("message", async (msg) => {

    const text = msg.text;

    // Ignore non-text messages
    if (!text) {
        return;
    }

    const userId = msg.chat.id.toString();

    console.log("MESSAGE RECEIVED:", text);

    // Ignore admin messages
    if (userId === process.env.ADMIN_ID) {
        return;
    }

    // Ignore start command
    if (text === "/start") {
        return;
    }

    try {

        // Detect buying intent
        if (
            text.toLowerCase().includes("buy") ||
            text.toLowerCase().includes("order") ||
            text.toLowerCase().includes("purchase")
        ) {

            const products = await Product.find();

            const product = products.find(p =>
                text.toLowerCase().includes(
                    p.name.toLowerCase()
                )
            );

            if (product) {

                orderStates[userId] = {
                    step: "quantity",
                    productName: product.name
                };

                return bot.sendMessage(
                    msg.chat.id,
                    `Great! How many units of ${product.name} would you like to buy?`
                );

            }

        }

        // Save Customer Message
        await Chat.create({
            chatId: msg.chat.id.toString(),
            username: msg.from.username || "Unknown",
            firstName: msg.from.first_name || "",
            message: text
        });

        console.log("Message Saved To MongoDB");

        // Load Products
        const products = await Product.find();

        let productInfo = products.map(product => {

            return `
Name: ${product.name}
Description: ${product.description}
Price: GHS ${product.price}
Stock: ${product.stock}
`;

        }).join("\n");

        // Gemini AI
        const result = await model.generateContent(`

You are Bright Electronics AI Sales Assistant.

Your job is to help customers find products and encourage sales.

Products:

${productInfo}

Customer Message:

${text}

Rules:

- Reply like a friendly human sales representative
- Keep responses short
- Mention product prices when relevant
- Recommend suitable products
- Encourage customers to place orders
- If a product is unavailable, say so
- Do not invent products
- Be professional and helpful

`);

        const response = result.response.text();

        await bot.sendMessage(
            msg.chat.id,
            response
        );

    } catch (error) {

        console.log("========== GEMINI ERROR ==========");
        console.log(error);
        console.log("==================================");

        try {

            await bot.sendMessage(
                msg.chat.id,
                "Sorry, I am having trouble responding right now."
            );

        } catch (sendError) {

            console.log("TELEGRAM SEND ERROR:");
            console.log(sendError);

        }

    }

});


        // Save Customer Message
        await Chat.create({
            chatId: msg.chat.id.toString(),
            username: msg.from.username || "Unknown",
            firstName: msg.from.first_name || "",
            message: text
        });

        console.log("Message Saved To MongoDB");

        // Gemini AI Response
const products = await Product.find();


let productInfo = products.map(product => {

    return `
Name: ${product.name}
Description: ${product.description}
Price: GHS ${product.price}
Stock: ${product.stock}
`;

}).join("\n");


const result = await model.generateContent(`

You are Bright Electronics AI Sales Assistant.

Your job is to help customers find products and encourage sales.

Products:

${productInfo}

Customer Message:

${text}

Rules:

- Reply like a friendly human sales representative
- Keep responses short
- Mention product prices when relevant
- Recommend suitable products
- Encourage customers to place orders
- If a product is unavailable, say so
- Do not invent products
- Be professional and helpful

`);

        const response = result.response.text();

        await bot.sendMessage(
            msg.chat.id,
            response
        );

    } catch (error) {

    console.log("========== GEMINI ERROR ==========");
    console.log(error);
    console.log("==================================");

    try {

        await bot.sendMessage(
            msg.chat.id,
            "Sorry, I am having trouble responding right now."
        );

    } catch(e) {

        console.log("Telegram Send Error:");
        console.log(e);

    }

}
});


const express = require("express");

const app = express();

app.get("/", (req, res) => {
    res.send("Telegram Business AI is running");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
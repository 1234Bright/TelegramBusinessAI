require("dotenv").config();

const TelegramBot = require("node-telegram-bot-api");
const mongoose = require("mongoose");
const Chat = require("./models/Chat");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const Product = require("./models/Product");
const Order = require("./models/Order");
const orderStates = {};
const express = require("express");
const stringSimilarity = require("string-similarity");

const app = express();

app.get("/", (req, res) => {
    res.send("Telegram Business AI is running");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});



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

bot.on("channel_post", (msg) => {

    console.log("CHANNEL POST RECEIVED");

    console.log(msg.chat);

});

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

    if (msg.chat.id.toString() !== process.env.ADMIN_ID) {
        return;
    }

    try {

        const products =
    await Product.find({
        stock: { $gt: 0 }
    });

        if (products.length === 0) {
            return bot.sendMessage(
                msg.chat.id,
                "No products found."
            );
        }

        let list = "Available Products:\n\n";

        products.forEach((product, index) => {

            list += `${index + 1}. ${product.name}
Price: GHS ${product.price}
Stock: ${product.stock}

`;

        });

        await bot.sendMessage(
            msg.chat.id,
            list
        );

    } catch (error) {

        console.log("PRODUCTS ERROR:");
        console.log(error);

        bot.sendMessage(
            msg.chat.id,
            "Failed to load products."
        );

    }

});



// Add Product Command
bot.onText(/\/addproduct/, async (msg) => {

    if (msg.chat.id.toString() !== process.env.ADMIN_ID) {

        return bot.sendMessage(
            msg.chat.id,
            "You are not authorized."
        );

    }

    await bot.sendMessage(
        msg.chat.id,
        "Send product details like this:\n\nName, Description, Price, Stock\n\nExample:\n\niPhone 15, New Apple phone, 5000, 3"
    );

    const handler = async (reply) => {

        try {

            if (reply.chat.id !== msg.chat.id) {
                return;
            }

            if (!reply.text) {
                return;
            }

            const data = reply.text.split(",");

         if (data.length !== 4) {

    bot.removeListener("message", handler);

    return bot.sendMessage(
        msg.chat.id,
        "Invalid format.\n\nUse:\nName, Description, Price, Stock"
    );

}

            const name = data[0].trim();
            const description = data[1].trim();
            const price = Number(data[2].trim());
            const stock = Number(data[3].trim());

          if (
    !name ||
    !description ||
    isNaN(price) ||
    isNaN(stock)
) {

    bot.removeListener("message", handler);

    return bot.sendMessage(
        msg.chat.id,
        "Invalid values provided."
    );

}

            const existingProduct = await Product.findOne({
                name
            });

         if (existingProduct) {

    bot.removeListener("message", handler);

    return bot.sendMessage(
        msg.chat.id,
        "Product already exists."
    );

}

            const product = new Product({
                name,
                description,
                price,
                stock
            });

            await product.save();

            await bot.sendMessage(
                msg.chat.id,
                "Product added successfully ✅"
            );

            bot.removeListener("message", handler);

        } catch (error) {

            console.log("ADD PRODUCT ERROR:");
            console.log(error);

            bot.sendMessage(
                msg.chat.id,
                "Failed to add product."
            );

        }

    };

bot.once("message", handler);

});
//////first part



//deleteproduct
bot.onText(/\/deleteproduct/, async (msg) => {

    if(msg.chat.id.toString() !== process.env.ADMIN_ID){
        return bot.sendMessage(
            msg.chat.id,
            "You are not authorized."
        );
    }

    bot.sendMessage(
        msg.chat.id,
        "Send the product name to delete."
    );

    const handler = async(reply) => {

        if(reply.chat.id !== msg.chat.id) return;

        const productName = reply.text.trim();

        const deletedProduct =
            await Product.findOneAndDelete({
                name: productName
            });

        if(!deletedProduct){

            return bot.sendMessage(
                msg.chat.id,
                "Product not found."
            );

        }

        await bot.sendMessage(
            msg.chat.id,
            "Product deleted successfully ✅"
        );

        bot.removeListener(
            "message",
            handler
        );

    };

bot.once("message", handler);

});



// Update Product Command
bot.onText(/\/updateproduct/, async (msg) => {

    if (msg.chat.id.toString() !== process.env.ADMIN_ID) {

        return bot.sendMessage(
            msg.chat.id,
            "You are not authorized."
        );

    }

    await bot.sendMessage(
        msg.chat.id,
        "Send:\n\nProduct Name, New Price, New Stock\n\nExample:\nSmart Watch, 500, 15"
    );

    const handler = async (reply) => {

        try {

            if (reply.chat.id !== msg.chat.id) {
                return;
            }

            if (!reply.text) {
                return;
            }

            const data = reply.text.split(",");

         if (data.length !== 3) {

    bot.removeListener("message", handler);

    return bot.sendMessage(
        msg.chat.id,
        "Invalid format.\n\nUse:\nProduct Name, New Price, New Stock"
    );

}

            const productName = data[0].trim();
            const newPrice = Number(data[1].trim());
            const newStock = Number(data[2].trim());

       if (
    !productName ||
    isNaN(newPrice) ||
    isNaN(newStock)
) {

    bot.removeListener("message", handler);

    return bot.sendMessage(
        msg.chat.id,
        "Invalid values provided."
    );

}

            const product = await Product.findOne({
                name: productName
            });

         if (!product) {

    bot.removeListener("message", handler);

    return bot.sendMessage(
        msg.chat.id,
        "Product not found."
    );

}

            product.price = newPrice;
            product.stock = newStock;

            await product.save();

            await bot.sendMessage(
                msg.chat.id,
                "Product updated successfully ✅"
            );

            bot.removeListener("message", handler);

        } catch (error) {

            console.log("UPDATE PRODUCT ERROR:");
            console.log(error);

            bot.sendMessage(
                msg.chat.id,
                "Failed to update product."
            );

        }

    };

    bot.on("message", handler);

});


// 1st part





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





bot.onText(/\/orders/, async (msg) => {

    if (msg.chat.id.toString() !== process.env.ADMIN_ID) {
        return;
    }

    try {

        const orders = await Order.find();

        if (orders.length === 0) {

            return bot.sendMessage(
                msg.chat.id,
                "No orders found."
            );

        }

        let message = "📦 Orders\n\n";

        orders.forEach((order, index) => {

            message += `${index + 1}.
Customer: ${order.customerName}
Items:

${order.items.map(item =>

`${item.productName}
Qty: ${item.quantity}`

).join("\n")}
Quantity: ${order.quantity}
Status: ${order.status}

`;

        });

        await bot.sendMessage(
            msg.chat.id,
            message
        );

    } catch (error) {

        console.log("ORDERS ERROR:");
        console.log(error);

        bot.sendMessage(
            msg.chat.id,
            "Failed to load orders."
        );

    }

});







// AI Chat Messages
bot.on("message", async (msg) => {

   const text = msg.text || "";

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


const lowerText = text.toLowerCase();

if (
    lowerText === "cancel" ||
    lowerText === "stop" ||
    lowerText === "exit" ||
    lowerText === "i dont want to buy" ||
    lowerText === "i don't want to buy"
) {

    delete orderStates[userId];

    return bot.sendMessage(
        msg.chat.id,
        "❌ Order cancelled successfully."
    );

}


// =========================
// ORDER START DETECTION
// =========================

const products = await Product.find({
    stock: { $gt: 0 }
});

const matchedProducts = [];

for (const product of products) {

    const productName =
        product.name.toLowerCase();

    if (
        lowerText.includes(productName)
    ) {

        matchedProducts.push(product);
        continue;

    }

    const similarity =
        stringSimilarity.compareTwoStrings(
            lowerText,
            productName
        );

    if (similarity >= 0.45) {

        matchedProducts.push(product);

    }

}




console.log(
    "MATCHED PRODUCTS:",
    matchedProducts.map(
        p => p.name
    )
);


const wantsToBuy =

    lowerText.includes("buy") ||
    lowerText.includes("order") ||
    lowerText.includes("purchase") ||
    lowerText.includes("take") ||
    lowerText.includes("get") ||
    lowerText.includes("want") ||
    lowerText.includes("need") ||
    lowerText.includes("interested") ||
    lowerText.includes("looking for") ||
    lowerText.includes("i need") ||
    lowerText.includes("i want") ||
    lowerText.includes("i will buy") ||
    lowerText.includes("i want to order") ||
    lowerText.includes("place an order");


// =========================
// START NEW ORDER
// =========================

if (
    !orderStates[userId] &&
    matchedProducts.length === 0 &&
    wantsToBuy
) {

    return bot.sendMessage(
        msg.chat.id,

        `❌ Product not found.

Please check the spelling or type:

products

to see available products.`
    );

}

if (
    !orderStates[userId] &&
    matchedProducts.length > 0 &&
    wantsToBuy
) {

    orderStates[userId] = {
        step: "cartQuantity",
        cart: [],
        selectedProduct: matchedProducts[0].name
    };

    return bot.sendMessage(
        msg.chat.id,

        `🛒 Great choice!

${matchedProducts[0].name}

Price: GHS ${matchedProducts[0].price}

How many units would you like to buy?`
    );

}

/////here 

if (orderStates[userId]) {

    const state =
        orderStates[userId];

    const command =
        text.toLowerCase().trim();

    // VIEW CART ANYTIME

    if (command === "cart") {

        const cartTotal =
            state.cart.reduce(
                (sum, item) =>
                    sum + (item.price * item.quantity),
                0
            );

        return bot.sendMessage(
            msg.chat.id,

`🛒 Current Cart

${state.cart.map((item,index)=>

`${index + 1}. ${item.productName}
Qty: ${item.quantity}
Price: GHS ${item.price}`

).join("\n\n")}

💰 Cart Total:
GHS ${cartTotal}`
        );

    }

    // CANCEL CHECKOUT ONLY

    if (
        command === "cancel checkout"
    ) {

        if (
            state.step === "customerName" ||
            state.step === "phone" ||
            state.step === "address" ||
            state.step === "payment"
        ) {

            state.step = "cartMenu";

            return bot.sendMessage(
                msg.chat.id,

`❌ Checkout cancelled.

Your cart is still active.

Reply:

cart
add
remove
change
checkout
cancel`
            );

        }

    }

    const allProducts = await Product.find();

    const askedProduct = allProducts.find(product => {

        const name = product.name.toLowerCase();

        return text.toLowerCase().includes(name);

    });

const isDescriptionQuestion =

    text.toLowerCase().includes("about") ||
    text.toLowerCase().includes("describe") ||
    text.toLowerCase().includes("description") ||
    text.toLowerCase().includes("look like") ||
    text.toLowerCase().includes("looks like") ||
    text.toLowerCase().includes("what is") ||
    text.toLowerCase().includes("how does") ||
    text.toLowerCase().includes("show me") ||
    text.toLowerCase().includes("tell me");


if (askedProduct && isDescriptionQuestion) {

    let reminder = "";

    if (state.step === "cartQuantity") {
        reminder = "\n\n🛒 Please enter the quantity.";
    }

    else if (state.step === "selectProduct") {
        reminder = "\n\n🛒 Please enter the product name.";
    }

    else if (state.step === "removeProduct") {
        reminder = "\n\n🛒 Please enter the product you want to remove.";
    }

    else if (state.step === "changeQuantity") {
        reminder = "\n\n🛒 Please enter the product you want to change.";
    }

    else if (state.step === "newQuantity") {
        reminder = "\n\n🛒 Please enter the new quantity.";
    }

    else if (state.step === "customerName") {
        reminder = "\n\n🛒 Please enter your full name.";
    }

    else if (state.step === "phone") {
        reminder = "\n\n🛒 Please enter your phone number.";
    }

    else if (state.step === "address") {
        reminder = "\n\n🛒 Please enter your address.";
    }

    else if (state.step === "payment") {
        reminder = "\n\n🛒 Please choose payment method.";
    }

    return bot.sendMessage(
        msg.chat.id,

`📦 ${askedProduct.name}

Description:
${askedProduct.description}

Price:
GHS ${askedProduct.price}

Available:
${askedProduct.stock}${reminder}`
    );

}



    // STEP 1 - QUANTITY

if (state.step === "cartQuantity") {

    // Customer typed text instead of quantity
    if (isNaN(Number(text))) {

        state.step = "selectProduct";

        return bot.sendMessage(
            msg.chat.id,
            "Please tell me the product name again."
        );

    }

    const quantity =
        Number(text);

    if (
        quantity <= 0
    ) {

        return bot.sendMessage(
            msg.chat.id,
            "Please enter a valid quantity."
        );

    }

    const product =
        await Product.findOne({
            name:
                state.selectedProduct
        });

if (product.stock === 0) {

    state.step = "cartMenu";

    const cartTotal =
        state.cart.reduce(
            (sum,item)=>
            sum + (item.price * item.quantity),
            0
        );

    return bot.sendMessage(
        msg.chat.id,
`❌ ${product.name} is out of stock.

Current Cart:

${state.cart.map((item,index)=>

`${index+1}. ${item.productName}
Qty: ${item.quantity}
Price: GHS ${item.price}`

).join("\n\n")}

💰 Cart Total:
GHS ${cartTotal}

Reply:

add
remove
change
checkout
cancel`
    );

}

if (quantity > product.stock) {

    return bot.sendMessage(
        msg.chat.id,
        `❌ Only ${product.stock} ${product.name} available.

Please enter a quantity between 1 and ${product.stock}.`
    );

}

   const existingItem =
    state.cart.find(
        item =>
            item.productName.toLowerCase()
            ===
            product.name.toLowerCase()
    );

if (existingItem) {

    const newQuantity =
        existingItem.quantity + quantity;

    if (newQuantity > product.stock) {

    state.step = "cartMenu";

    const cartTotal =
        state.cart.reduce(
            (sum,item)=>
            sum + (item.price * item.quantity),
            0
        );

    return bot.sendMessage(
        msg.chat.id,
`❌ You already have ${existingItem.quantity} ${product.name} in your cart.

Only ${product.stock} available in stock.

${
    product.stock - existingItem.quantity <= 0

    ? "This product has reached the maximum available stock."

    : `You can add at most ${
        product.stock - existingItem.quantity
      } more.`
}
Current Cart:

${state.cart.map((item,index)=>

`${index+1}. ${item.productName}
Qty: ${item.quantity}
Price: GHS ${item.price}`

).join("\n\n")}

💰 Cart Total:
GHS ${cartTotal}

Reply:

add
remove
change
checkout
cancel`
    );

}

    existingItem.quantity =
        newQuantity;

} else {

    state.cart.push({

        productName:
            product.name,

        quantity,

        price:
            product.price

    });

}

const cartTotal =
    state.cart.reduce(
        (sum,item)=>
        sum + (item.price * item.quantity),
        0
    );


    state.step =
        "cartMenu";

    return bot.sendMessage(
        msg.chat.id,
`✅ Added To Cart

Current Cart:

${state.cart.map((item,index)=>

`${index+1}. ${item.productName}
Qty: ${item.quantity}
Price: GHS ${item.price}`

).join("\n\n")}

💰 Cart Total:
GHS ${cartTotal}

Reply:

add
remove
change
checkout
cancel`
    );

}


if (state.step === "cartMenu") {

    const answer =
        text.toLowerCase();

    if (answer === "add") {

        state.step =
            "selectProduct";

        return bot.sendMessage(
            msg.chat.id,
            "Which product would you like to add?"
        );

    }

    if (answer === "remove") {

        state.step =
            "removeProduct";

        return bot.sendMessage(
            msg.chat.id,
            "Enter product name to remove."
        );

    }

    if (answer === "change") {

        state.step =
            "changeQuantity";

        return bot.sendMessage(
            msg.chat.id,
            "Enter product name to change quantity."
        );

    }

  if (answer === "checkout") {

    state.step =
        "customerName";

    return bot.sendMessage(
        msg.chat.id,

`Please enter your full name.

Reply:
cart
cancel checkout`
    );

}


}

//2nd part





if (
    command === "checkout" ||
    command === "check out"
) {

    state.step = "customerName";

    return bot.sendMessage(
        msg.chat.id,
        "Please enter your full name."
    );

}

if (command === "cancel") {

    delete orderStates[userId];

    return bot.sendMessage(
        msg.chat.id,
        "❌ Order cancelled successfully."
    );

}

if (command === "remove") {

    state.step = "removeProduct";

    return bot.sendMessage(
        msg.chat.id,
        "Enter product name to remove."
    );

}

if (command === "change") {

    state.step = "changeQuantity";

    return bot.sendMessage(
        msg.chat.id,
        "Enter product name to change quantity."
    );

}






if (state.step === "selectProduct") {

   const products =
    await Product.find({
        stock: { $gt: 0 }
    });

    const userText =
        text.toLowerCase().trim();

const descriptionKeywords = [
    "description",
    "describe",
    "tell me about",
    "about",
    "look like",
    "looks like",
    "what is"
];

const askedDescription =
    descriptionKeywords.some(keyword =>
        userText.includes(keyword)
    );

if (askedDescription) {

    const productForDescription =
        products.find(p =>
            userText.includes(
                p.name.toLowerCase()
            )
        );

    if (productForDescription) {

        return bot.sendMessage(
            msg.chat.id,

`📦 ${productForDescription.name}

Description:
${productForDescription.description}

Price:
GHS ${productForDescription.price}

Stock:
${productForDescription.stock}

You are still shopping.

Please enter the product you want to add.`
        );

    }

}



 const product =
    products.find(p => {

        const productName =
            p.name.toLowerCase();

        return (
            userText.includes(productName) ||
            productName.includes(userText)
        );

    });



    if (!product) {

        return bot.sendMessage(
            msg.chat.id,
            `Product not found.

Available products:

${products.map(p => p.name).join("\n")}`
        );

    }

    state.selectedProduct =
        product.name;

    state.step =
        "cartQuantity";

    return bot.sendMessage(
        msg.chat.id,
        `How many ${product.name} would you like?`
    );

}





if (state.step === "removeProduct") {

    const itemExists =
        state.cart.some(

            item =>

            item.productName.toLowerCase()

            ===

            text.toLowerCase()

        );

    if (!itemExists) {

        return bot.sendMessage(
            msg.chat.id,

`❌ That product is not in your cart.

Current Cart:

${state.cart.map(item =>

`${item.productName}
Qty: ${item.quantity}`

).join("\n")}`
        );

    }

    state.cart =
        state.cart.filter(
            item =>
            item.productName.toLowerCase()
            !==
            text.toLowerCase()
        );

    // CART EMPTY CHECK

    if (state.cart.length === 0) {

        state.step = "cartMenu";

       return bot.sendMessage(
    msg.chat.id,
`🛒 Your cart is now empty.

Reply:

add
cancel`
);

    }

    state.step = "cartMenu";


const cartTotal =
    state.cart.reduce(
        (sum,item)=>
        sum + (item.price * item.quantity),
        0
    );


 return bot.sendMessage(
    msg.chat.id,
`✅ Product removed.

Current Cart:

${state.cart.map((item,index)=>

`${index+1}. ${item.productName}
Qty: ${item.quantity}
Price: GHS ${item.price}`

).join("\n\n")}

💰 Cart Total:
GHS ${cartTotal}

Reply:

add
remove
change
checkout
cancel`
);

}




if (state.step === "changeQuantity") {

    const item = state.cart.find(

        p =>

        p.productName.toLowerCase()

        ===

        text.toLowerCase()

    );

    if (!item) {

        return bot.sendMessage(
            msg.chat.id,

`❌ That product is not in your cart.

Current Cart:

${state.cart.map(item =>

`${item.productName}
Qty: ${item.quantity}`

).join("\n")}`
        );

    }

    state.productToEdit = item.productName;

    state.step = "newQuantity";

    return bot.sendMessage(
        msg.chat.id,
        `Enter new quantity for ${item.productName}.`
    );

}


if (state.step === "newQuantity") {

    const qty = Number(text);

if (isNaN(qty) || qty <= 0) {

    return bot.sendMessage(
        msg.chat.id,
        "Please enter a valid quantity."
    );

}

    const item =
        state.cart.find(

            p =>

            p.productName
            .toLowerCase()

            ===

            state.productToEdit
            .toLowerCase()

        );

if (!item) {

    state.step = "cartMenu";

    return bot.sendMessage(
        msg.chat.id,
        "❌ Product not found in cart."
    );

}



    if (item) {

        item.quantity =
            qty;

    }

const cartTotal =
    state.cart.reduce(
        (sum,item)=>
        sum + (item.price * item.quantity),
        0
    );



    state.step =
        "cartMenu";

   return bot.sendMessage(
    msg.chat.id,
`✅ Quantity updated.

Current Cart:

${state.cart.map((item,index)=>

`${index+1}. ${item.productName}
Qty: ${item.quantity}
Price: GHS ${item.price}`

).join("\n\n")}

💰 Cart Total:
GHS ${cartTotal}

Reply:

add
remove
change
checkout
cancel`
);

}



if (
    state.step === "customerName" ||
    state.step === "phone" ||
    state.step === "address" ||
    state.step === "payment"
) {

   if (
    command === "cancel checkout" ||
    command === "cancle checkout" ||
    command === "cancel check out" ||
    command === "cancel"
) {

        state.step = "cartMenu";

        return bot.sendMessage(
            msg.chat.id,
            `❌ Checkout cancelled.

Your cart is still active.

Reply:

cart
add
remove
change
checkout
cancel`
        );

    }

  if (
    command === "cart" ||
    command === "my cart" ||
    command === "show cart"
) {

        const cartTotal =
            state.cart.reduce(
                (sum,item)=>
                sum + (item.price * item.quantity),
                0
            );

        return bot.sendMessage(
            msg.chat.id,

`🛒 Current Cart

${state.cart.map((item,index)=>

`${index + 1}. ${item.productName}
Qty: ${item.quantity}
Price: GHS ${item.price}`

).join("\n\n")}

💰 Cart Total:
GHS ${cartTotal}`
        );

    }

}



//mistake here 

    // STEP 2 - NAME
if (state.step === "customerName") {

    const allProducts = await Product.find();

    const tryingToShop =
        allProducts.some(product =>
            text.toLowerCase().includes(
                product.name.toLowerCase()
            )
        );

    if (tryingToShop) {

        return bot.sendMessage(
            msg.chat.id,

`🛒 You are currently checking out.

Please enter your full name.

Reply:
cart
cancel checkout`
        );

    }

    state.customerName = text;
    state.step = "phone";

    return bot.sendMessage(
        msg.chat.id,

`Enter your phone number.

Reply:
cart
cancel checkout`
    );

}

    

// STEP 3 - PHONE
if (state.step === "phone") {

const allProducts = await Product.find();

const tryingToShop =
    allProducts.some(product =>
        text.toLowerCase().includes(
            product.name.toLowerCase()
        )
    );

if (tryingToShop) {

    return bot.sendMessage(
        msg.chat.id,

`🛒 You are currently checking out.

Please enter your phone number.

Reply:
cart
cancel checkout`
    );

}


    const phoneRegex = /^[0-9+\-\s]{7,15}$/;

    if (!phoneRegex.test(text.trim())) {

        return bot.sendMessage(
            msg.chat.id,

`❌ Please enter a valid phone number.

Example:
0551234567

Reply:
cart
cancel checkout`
        );

    }

    state.phone = text.trim();
    state.step = "address";

    return bot.sendMessage(
        msg.chat.id,

`Enter your delivery address.

Reply:
cart
cancel checkout`
    );

}

    // STEP 4 - ADDRESS

if (state.step === "address") {

    const allProducts = await Product.find();

    const tryingToShop =
        allProducts.some(product =>
            text.toLowerCase().includes(
                product.name.toLowerCase()
            )
        );

    if (tryingToShop) {

        return bot.sendMessage(
            msg.chat.id,

`🛒 You are currently checking out.

Please enter your delivery address.

Reply:
cart
cancel checkout`
        );

    }

    state.address = text;
    state.step = "payment";

    return bot.sendMessage(
        msg.chat.id,

`Choose payment method:

1. MoMo
2. Cash On Delivery

Reply:
cart
cancel checkout`
    );

}

    // STEP 5 - PAYMENT

    if (state.step === "payment") {
const allProducts = await Product.find();

const tryingToShop =
    allProducts.some(product =>
        text.toLowerCase().includes(
            product.name.toLowerCase()
        )
    );

if (tryingToShop) {

    return bot.sendMessage(
        msg.chat.id,

`🛒 You are currently checking out.

Please choose a payment method.

Reply:
cart
cancel checkout`
    );

}


        state.paymentMethod = text;

   for (const item of state.cart) {

    const product =
        await Product.findOne({
            name: item.productName
        });

    if (!product) {

        delete orderStates[userId];

        return bot.sendMessage(
            msg.chat.id,
            `${item.productName} no longer exists.`
        );

    }

   if (product.stock < item.quantity) {

    state.step = "changeQuantity";

    state.productToEdit =
        item.productName;

    return bot.sendMessage(
        msg.chat.id,
        `❌ Only ${product.stock} ${item.productName} remaining.

Enter a new quantity for ${item.productName}.`
    );

}


}

       
const totalAmount =
    state.cart.reduce(

        (total,item)=>

        total +

        (
            item.price *
            item.quantity
        ),

        0

    );



        const order =
            await Order.create({

                telegramId: msg.chat.id,

                customerName:
                    state.customerName,

             items:
    state.cart,

                phone:
                    state.phone,

                address:
                    state.address,

                paymentMethod:
                    state.paymentMethod,

                totalAmount,

                status:
                    "Pending"

            });


for (const item of state.cart) {

    const product = await Product.findOne({
        name: item.productName
    });

    if (!product) continue;

    product.stock =
        Math.max(
            0,
            product.stock - item.quantity
        );

    await product.save();


if (product.stock === 0) {

    await bot.sendMessage(
        process.env.CHANNEL_ID,

        `⚠️ OUT OF STOCK ALERT

Product:
${product.name}

Current Stock:
0

Please restock this item.`
    );

}


}



        await bot.sendMessage(
            msg.chat.id,
            `✅ Order Created Successfully

Order ID:
${order._id}

Items:

${state.cart.map(item =>

`${item.productName}
Qty: ${item.quantity}`

).join("\n")}

Total:
GHS ${totalAmount}

Payment Method:
${state.paymentMethod}`
        );

        // MOMO PAYMENT

        if (
            state.paymentMethod
                .toLowerCase()
                .includes("momo")
        ) {

            await bot.sendMessage(
                msg.chat.id,
                `📱 Send payment to:

Number:
${process.env.MOMO_NUMBER}

Name:
${process.env.MOMO_NAME}

Amount:
GHS ${totalAmount}

After payment send your transaction ID to our support team.`
            );

        }

  const orderMessage = `🚨 NEW ORDER RECEIVED

👤 Customer:
${state.customerName}

📞 Phone:
${state.phone}

📍 Address:
${state.address}

📦 Items:

${state.cart.map(item =>

`${item.productName}
Qty: ${item.quantity}`

).join("\n")}

💰 Total:
GHS ${totalAmount}

💳 Payment:
${state.paymentMethod}

🆔 Order ID:
${order._id}`;


// SEND TO CHANNEL

const channelMessage =
    await bot.sendMessage(
        process.env.CHANNEL_ID,
        orderMessage,
        {
            reply_markup:{
                inline_keyboard:[
                    [
                        {
                            text:"✅ Approve",
                            callback_data:`approve|${order._id}`
                        }
                    ],
                    [
                        {
                            text:"❌ Reject",
                            callback_data:`reject|${order._id}`
                        }
                    ],
                    [
                        {
                            text:"🚚 Delivered",
                            callback_data:`delivered|${order._id}`
                        }
                    ]
                ]
            }
        }
    );

order.channelMessageId =
    channelMessage.message_id;

await order.save();

// SEND TO YOUR TELEGRAM DM

await bot.sendMessage(
    process.env.ADMIN_ID,
    orderMessage
);





     delete orderStates[userId];

return;
    
    
    }

}
    //3rd part


        // Save Customer Message
        await Chat.create({
            chatId: msg.chat.id.toString(),
            username: msg.from.username || "Unknown",
            firstName: msg.from.first_name || "",
            message: text
        });

        console.log("Message Saved To MongoDB");

        // Load Products
      const aiProducts = await Product.find();



let productInfo = aiProducts.map(product => {

    return `
Name: ${product.name}
Price: GHS ${product.price}
Available Quantity: ${product.stock}
Description: ${product.description}
`;

}).join("\n");




const customerText =
    text.toLowerCase().trim();


// SHOW PRODUCTS WITHOUT GEMINI

if (

    customerText.includes("what do u sell") ||

    customerText.includes("what do you sell") ||

    customerText.includes("what do you have") ||

    customerText.includes("show me products") ||

    customerText.includes("show me what you sell") ||

    customerText.includes("available products") ||

    customerText.includes("available items") ||

    customerText === "products" ||

    customerText === "show products" ||

    customerText.includes("what product do u have") ||

customerText.includes("what products do you have") ||

customerText.includes("what do u have") ||

customerText.includes("what do you have")
    

) {

    return bot.sendMessage(
        msg.chat.id,

        `📦 Available Products

${aiProducts
.filter(product => product.stock > 0)
.map(product =>

`${product.name}
Price: GHS ${product.price}
Stock: ${product.stock}`

).join("\n\n")}`

    );

}


// START SHOPPING WITHOUT GEMINI

const buyingProduct =
    aiProducts.find(product => {

        const name =
            product.name.toLowerCase();

        return (

            customerText.includes("buy") &&
            customerText.includes(name)

        ) ||

        (

            customerText.includes("order") &&
            customerText.includes(name)

        ) ||

        (

            customerText.includes("want") &&
            customerText.includes(name)

        ) ||

        (

            customerText === name

        );

    });


console.log("================================");
console.log("CUSTOMER MESSAGE:");
console.log(customerText);

console.log("\nAVAILABLE PRODUCTS:");

aiProducts.forEach(product => {
    console.log(
        "-",
        product.name.toLowerCase()
    );
});

console.log("\nMATCH RESULT:");

if (buyingProduct) {

    console.log(
        "FOUND:",
        buyingProduct.name
    );

} else {

    console.log(
        "NOT FOUND - Customer may have misspelled the product name."
    );

    console.log(
        "Please check spelling."
    );

}

console.log("================================");


console.log(
    "CUSTOMER:",
    customerText
);

console.log(
    "MATCHED PRODUCT:",
    buyingProduct
        ? buyingProduct.name
        : "NONE"
);

console.log(
    "CURRENT SELECTED PRODUCT:",
    orderStates[userId]?.selectedProduct
);



if (buyingProduct) {

if (buyingProduct.stock <= 0) {

    return bot.sendMessage(
        msg.chat.id,

        `❌ ${buyingProduct.name} is currently out of stock.

Please choose another product.`
    );

}


    if (!orderStates[userId]) {

        orderStates[userId] = {

            cart: []

        };

    }

    orderStates[userId].selectedProduct =
        buyingProduct.name;

    orderStates[userId].step =
        "cartQuantity";

    return bot.sendMessage(
        msg.chat.id,

        `🛒 Great choice!

${buyingProduct.name}

Price: GHS ${buyingProduct.price}

Available:
${buyingProduct.stock}

How many units would you like to buy?`
    );

}







const productQuestion =
    aiProducts.find(product => {

        const name =
            product.name.toLowerCase();

        return (

            customerText.includes(name)

        );

    });

if (

    productQuestion &&

    (

        customerText.includes("tell me about") ||

        customerText.includes("about") ||

        customerText.includes("describe") ||

        customerText.includes("description") ||

        customerText.includes("look like") ||

        customerText.includes("looks like") ||

        customerText.includes("what is")

    )

) {

    return bot.sendMessage(
        msg.chat.id,

`📦 ${productQuestion.name}

Description:
${productQuestion.description}

Price:
GHS ${productQuestion.price}

Available:
${productQuestion.stock}`
    );

}




if (
    orderStates[userId]?.pendingProduct &&
    (
        customerText === "yes" ||
        customerText === "yes proceed" ||
        customerText === "proceed" ||
        customerText === "continue" ||
        customerText === "okay"
    )
) {

    const product =
        await Product.findOne({
            name:
                orderStates[userId]
                    .pendingProduct
        });

    orderStates[userId].selectedProduct =
        product.name;

    orderStates[userId].step =
        "cartQuantity";

    delete orderStates[userId]
        .pendingProduct;

    return bot.sendMessage(
        msg.chat.id,

        `🛒 Great choice!

${product.name}

Price: GHS ${product.price}

Available:
${product.stock}

How many units would you like to buy?`
    );

}


// GEMINI DISABLED OR QUOTA EXHAUSTED

if (!process.env.GEMINI_API_KEY) {

    return bot.sendMessage(
        msg.chat.id,
        "Shopping assistant mode active."
    );

}



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
- Never invent products
- Never change product names
- Use product names exactly as listed
- Never create variations of products
- Mention prices only when relevant
- If customer wants to buy, guide them toward ordering
- If product does not exist, say it is unavailable
- Be professional and helpful
- Always mention available quantity when listing products

`);







  const response = result.response.text();

if (
    response.toLowerCase().includes("would you like to proceed")
) {

    const matchedProduct =
        aiProducts.find(product =>
            response
                .toLowerCase()
                .includes(
                    product.name.toLowerCase()
                )
        );

    if (matchedProduct) {

        if (!orderStates[userId]) {

            orderStates[userId] = {
                cart: []
            };

        }

        orderStates[userId].pendingProduct =
            matchedProduct.name;

    }

}

await bot.sendMessage(
    msg.chat.id,
    response
);

if (orderStates[userId]) {

    const state = orderStates[userId];


    let reminder = "";

    if (state.step === "cartQuantity") {

        reminder =
            `🛒 You still have an active cart.

Please enter the quantity.`;

    }

    else if (state.step === "selectProduct") {

        reminder =
            `🛒 You still have an active cart.

Please enter the product name.`;

    }

    else if (state.step === "removeProduct") {

        reminder =
            `🛒 You still have an active cart.

Please enter the product you want to remove.`;

    }

    else if (state.step === "changeQuantity") {

        reminder =
            `🛒 You still have an active cart.

Please enter the product you want to change.`;

    }

    else if (state.step === "newQuantity") {

        reminder =
            `🛒 You still have an active cart.

Please enter the new quantity.`;

    }

    else if (state.step === "cartMenu") {

        reminder =
`🛒 Your cart is still active.

Reply:

add
remove
change
checkout
cancel`;

    }

    else if (state.step === "customerName") {

        reminder =
            `🛒 Please enter your full name to continue checkout.`;

    }

    else if (state.step === "phone") {

        reminder =
            `🛒 Please enter your phone number to continue checkout.`;

    }

    else if (state.step === "address") {

        reminder =
            `🛒 Please enter your delivery address to continue checkout.`;

    }

    else if (state.step === "payment") {

        reminder =
            `🛒 Please choose your payment method to continue checkout.`;

    }

    if (reminder) {

        await bot.sendMessage(
            msg.chat.id,
            reminder
        );

    }
}


//4th part

    } catch (error) {

        console.log("========== GEMINI ERROR ==========");
        console.log(error);
        console.log("==================================");

        try {

if (
    error.status === 429 ||
    error.status === 503
) {

    const products =
        await Product.find({
            stock: { $gt: 0 }
        });

    const availableProducts =
        products
            .map(p =>

`${p.name}
Price: GHS ${p.price}
Stock: ${p.stock}`

            )
            .join("\n\n");

    return bot.sendMessage(
        msg.chat.id,

`⚠️ AI assistant is temporarily unavailable.

I can still help you shop.

Available Products:

${availableProducts}
You can:

• ask for products
• buy products
• add to cart
• remove items
• checkout orders`
    );

}

return bot.sendMessage(
    msg.chat.id,
    "Sorry, I am having trouble responding right now."
);

        } catch (sendError) {

            console.log("TELEGRAM SEND ERROR:");
            console.log(sendError);

        }

    }

});



bot.on("callback_query", async (query) => {

    try {

        const data = query.data;

        const orderId = data.split("|")[1];

        let newStatus = "";

        if (data.startsWith("approve|")) {
            newStatus = "Approved";
        }

        if (data.startsWith("reject|")) {
            newStatus = "Rejected";
        }

        if (data.startsWith("delivered|")) {
            newStatus = "Delivered";
        }

const order = await Order.findById(orderId);

if (!order) {

    return bot.answerCallbackQuery(
        query.id,
        {
            text: "Order not found"
        }
    );

}

if (order.status === "Rejected") {

    return bot.answerCallbackQuery(
        query.id,
        {
            text: "Order already rejected"
        }
    );

}

if (order.status === "Delivered") {

    return bot.answerCallbackQuery(
        query.id,
        {
            text: "Order already delivered"
        }
    );

}

if (
    order.status === "Approved" &&
    newStatus !== "Delivered"
) {

    return bot.answerCallbackQuery(
        query.id,
        {
            text: "Approved orders can only be marked delivered"
        }
    );

}

order.status = newStatus;

await order.save();

        // CUSTOMER NOTIFICATION

        if (newStatus === "Approved") {

            await bot.sendMessage(
                order.telegramId,
                `✅ Your order has been APPROVED.

Items:

${order.items.map(item =>

`${item.productName}
Qty: ${item.quantity}`

).join("\n")}

We will contact you shortly regarding delivery.`
            );

        }

        if (newStatus === "Rejected") {

            await bot.sendMessage(
                order.telegramId,
                `❌ Unfortunately your order has been REJECTED.

Order ID: ${order._id}

Please contact support for assistance.`
            );

        }

        if (newStatus === "Delivered") {

            await bot.sendMessage(
                order.telegramId,
                `🚚 Your order has been DELIVERED.

Items:

${order.items.map(item =>

`${item.productName}
Qty: ${item.quantity}`

).join("\n")}

Thank you for shopping with Bright Electronics ❤️`
            );

        }

        // UPDATE CHANNEL MESSAGE

        const updatedMessage = `🚨 NEW ORDER RECEIVED

👤 Customer:
${order.customerName}

📞 Phone:
${order.phone}

📍 Address:
${order.address}

📦 Items:

${order.items.map(item =>

`${item.productName}
Qty: ${item.quantity}`

).join("\n")}


💰 Total:
GHS ${order.totalAmount}

💳 Payment:
${order.paymentMethod}

🆔 Order ID:
${order._id}

📌 STATUS:
${newStatus}`;

        await bot.editMessageText(
            updatedMessage,
            {
                chat_id: process.env.CHANNEL_ID,
                message_id: order.channelMessageId,
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: "✅ Approve",
                                callback_data:
                                    `approve|${order._id}`
                            }
                        ],
                        [
                            {
                                text: "❌ Reject",
                                callback_data:
                                    `reject|${order._id}`
                            }
                        ],
                        [
                            {
                                text: "🚚 Delivered",
                                callback_data:
                                    `delivered|${order._id}`
                            }
                        ]
                    ]
                }
            }
        );

        await bot.answerCallbackQuery(
            query.id,
            {
                text: `Order ${newStatus}`
            }
        );

    } catch (error) {

        console.log("CALLBACK ERROR:");
        console.log(error);

    }

});
require("dotenv").config();

const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(
    process.env.GEMINI_API_KEY
);
const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash"
});
async function test() {

    try {

        const result = await model.generateContent(
            "Hello, reply with one short sentence"
        );

        console.log(
            result.response.text()
        );

    } catch(error){

        console.log("GEMINI FAILED");
        console.log(error);

    }

}

test();
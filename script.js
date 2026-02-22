const API_KEY = "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";

async function sendMessage() {
    const input = document.getElementById("userInput");
    const chatBox = document.getElementById("chatBox");
    const userText = input.value;

    if (!userText) return;

    addMessage(userText, "user");
    input.value = "";

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + API_KEY
        },
        body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: "You are a helpful AI assistant." },
                { role: "user", content: userText }
            ]
        })
    });

    const data = await response.json();
    const botReply = data.choices[0].message.content;

    addMessage(botReply, "bot");
}

function addMessage(text, sender) {
    const chatBox = document.getElementById("chatBox");
    const message = document.createElement("div");
    message.classList.add("message", sender);
    message.innerText = text;
    chatBox.appendChild(message);
    chatBox.scrollTop = chatBox.scrollHeight;
}

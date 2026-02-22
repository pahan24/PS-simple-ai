async function sendMessage() {
    const input = document.getElementById("userInput");
    const userText = input.value.trim();

    if (!userText) return;

    addMessage(userText, "user");
    input.value = "";

    const sendBtn = document.querySelector("button");
    sendBtn.disabled = true;
    const loadingMsg = addMessage("Thinking...", "bot loading");

    try {
        const response = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: userText })
        });

        const data = await response.json();

        loadingMsg.remove();

        if (!response.ok) {
            addMessage("Sorry, something went wrong. Please try again.", "bot");
            return;
        }

        addMessage(data.reply, "bot");
    } catch (error) {
        loadingMsg.remove();
        addMessage("Could not reach the server. Please try again later.", "bot");
    } finally {
        sendBtn.disabled = false;
        input.focus();
    }
}

function addMessage(text, className) {
    const chatBox = document.getElementById("chatBox");
    const message = document.createElement("div");
    message.className = "message " + className;
    message.innerText = text;
    chatBox.appendChild(message);
    chatBox.scrollTop = chatBox.scrollHeight;
    return message;
}

document.getElementById("userInput").addEventListener("keydown", function (e) {
    if (e.key === "Enter") sendMessage();
});

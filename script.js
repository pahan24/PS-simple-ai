// Session management
let sessionId = localStorage.getItem("chat_session_id");
if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem("chat_session_id", sessionId);
}

let dbReady = false;
let pendingAttachments = []; // { file, type: 'image'|'document', dataUrl? }
let isProcessing = false;

// DOM references
const chatBox = document.getElementById("chatBox");
const welcomeScreen = document.getElementById("welcomeScreen");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const imageInput = document.getElementById("imageInput");
const docInput = document.getElementById("docInput");
const imageBtn = document.getElementById("imageBtn");
const docBtn = document.getElementById("docBtn");
const attachmentPreview = document.getElementById("attachmentPreview");
const newChatBtn = document.getElementById("newChatBtn");
const clearAllBtn = document.getElementById("clearAllBtn");
const sidebarToggle = document.getElementById("sidebarToggle");
const sidebar = document.getElementById("sidebar");

// Initialize database
async function initDatabase() {
    try {
        const response = await fetch("/api/db-migrate", { method: "POST" });
        if (response.ok) {
            dbReady = true;
        }
    } catch (e) {
        console.error("Database migration failed:", e);
    }
}

// Load chat history
async function loadHistory() {
    try {
        const response = await fetch("/api/history?session_id=" + encodeURIComponent(sessionId));
        if (!response.ok) return;

        const data = await response.json();

        // Clear all messages but keep welcome screen reference
        var rows = chatBox.querySelectorAll(".message-row");
        rows.forEach(function(r) { r.remove(); });

        if (data.messages && data.messages.length > 0) {
            hideWelcomeScreen();
            data.messages.forEach(function(msg) {
                var attachments = [];
                if (msg.attachments) {
                    try {
                        attachments = JSON.parse(msg.attachments);
                    } catch (e) { /* ignore */ }
                }
                appendMessage(msg.role === "user" ? "user" : "bot", msg.content, attachments);
            });
            scrollToBottom();
        } else {
            showWelcomeScreen();
        }
    } catch (e) {
        console.error("Failed to load history:", e);
    }
}

// Welcome screen
function showWelcomeScreen() {
    if (welcomeScreen) welcomeScreen.style.display = "flex";
}

function hideWelcomeScreen() {
    if (welcomeScreen) welcomeScreen.style.display = "none";
}

// Scroll to bottom
function scrollToBottom() {
    chatBox.scrollTop = chatBox.scrollHeight;
}

// Format message text with basic markdown support
function formatText(text) {
    if (!text) return "";
    var escaped = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    // Code blocks
    escaped = escaped.replace(/```(\w*)\n?([\s\S]*?)```/g, function(m, lang, code) {
        return '<pre><code>' + code.trim() + '</code></pre>';
    });

    // Inline code
    escaped = escaped.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Bold
    escaped = escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Italic
    escaped = escaped.replace(/\*(.+?)\*/g, '<em>$1</em>');

    // Line breaks into paragraphs
    var paragraphs = escaped.split(/\n\n+/);
    if (paragraphs.length > 1) {
        escaped = paragraphs.map(function(p) {
            if (p.indexOf('<pre>') !== -1) return p;
            return '<p>' + p.replace(/\n/g, '<br>') + '</p>';
        }).join('');
    } else {
        escaped = escaped.replace(/\n/g, '<br>');
    }

    return escaped;
}

// Append a message to the chat
function appendMessage(role, text, attachments) {
    var row = document.createElement("div");
    row.className = "message-row " + (role === "user" ? "user-row" : "bot-row");

    var content = document.createElement("div");
    content.className = "message-content";

    var avatar = document.createElement("div");
    avatar.className = "avatar";
    avatar.textContent = role === "user" ? "Y" : "P";

    var msgText = document.createElement("div");
    msgText.className = "message-text";

    // Show attachments if any
    if (attachments && attachments.length > 0) {
        var attachDiv = document.createElement("div");
        attachDiv.className = "message-attachments";
        attachments.forEach(function(att) {
            if (att.type === "image" && att.dataUrl) {
                var img = document.createElement("img");
                img.className = "message-attachment-img";
                img.src = att.dataUrl;
                img.alt = att.name || "Image";
                img.addEventListener("click", function() {
                    openImageModal(att.dataUrl);
                });
                attachDiv.appendChild(img);
            } else if (att.type === "document") {
                var docEl = document.createElement("div");
                docEl.className = "message-attachment-doc";
                docEl.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg><span>' + escapeHtml(att.name || "Document") + '</span>';
                attachDiv.appendChild(docEl);
            }
        });
        msgText.appendChild(attachDiv);
    }

    var textSpan = document.createElement("div");
    if (role === "bot") {
        textSpan.innerHTML = formatText(text);
    } else {
        textSpan.textContent = text;
    }
    msgText.appendChild(textSpan);

    content.appendChild(avatar);
    content.appendChild(msgText);
    row.appendChild(content);
    chatBox.appendChild(row);

    return row;
}

// Append typing indicator
function appendTypingIndicator() {
    var row = document.createElement("div");
    row.className = "message-row bot-row";
    row.id = "typingRow";

    var content = document.createElement("div");
    content.className = "message-content";

    var avatar = document.createElement("div");
    avatar.className = "avatar";
    avatar.textContent = "P";

    var msgText = document.createElement("div");
    msgText.className = "message-text";

    var indicator = document.createElement("div");
    indicator.className = "typing-indicator";
    indicator.innerHTML = "<span></span><span></span><span></span>";

    msgText.appendChild(indicator);
    content.appendChild(avatar);
    content.appendChild(msgText);
    row.appendChild(content);
    chatBox.appendChild(row);
    scrollToBottom();

    return row;
}

function escapeHtml(text) {
    var div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

// Image modal
function openImageModal(src) {
    var modal = document.createElement("div");
    modal.className = "image-modal";
    var img = document.createElement("img");
    img.src = src;
    modal.appendChild(img);
    modal.addEventListener("click", function() {
        modal.remove();
    });
    document.body.appendChild(modal);
}

// Attachment handling
imageBtn.addEventListener("click", function() {
    imageInput.click();
});

docBtn.addEventListener("click", function() {
    docInput.click();
});

imageInput.addEventListener("change", function(e) {
    var files = Array.from(e.target.files);
    files.forEach(function(file) {
        if (file.size > 10 * 1024 * 1024) {
            alert("Image " + file.name + " is too large (max 10MB).");
            return;
        }
        var reader = new FileReader();
        reader.onload = function(ev) {
            pendingAttachments.push({
                file: file,
                type: "image",
                name: file.name,
                dataUrl: ev.target.result
            });
            updateAttachmentPreview();
            updateSendButton();
        };
        reader.readAsDataURL(file);
    });
    imageInput.value = "";
});

docInput.addEventListener("change", function(e) {
    var files = Array.from(e.target.files);
    files.forEach(function(file) {
        if (file.size > 10 * 1024 * 1024) {
            alert("Document " + file.name + " is too large (max 10MB).");
            return;
        }
        var reader = new FileReader();
        reader.onload = function(ev) {
            pendingAttachments.push({
                file: file,
                type: "document",
                name: file.name,
                dataUrl: ev.target.result,
                textContent: null
            });
            // Try to extract text from text-based files
            if (file.type.indexOf("text") !== -1 || file.name.match(/\.(txt|csv|json|xml|md|rtf)$/i)) {
                var textReader = new FileReader();
                textReader.onload = function(tev) {
                    var idx = pendingAttachments.findIndex(function(a) { return a.name === file.name && a.type === "document"; });
                    if (idx !== -1) {
                        pendingAttachments[idx].textContent = tev.target.result;
                    }
                };
                textReader.readAsText(file);
            }
            updateAttachmentPreview();
            updateSendButton();
        };
        reader.readAsDataURL(file);
    });
    docInput.value = "";
});

function updateAttachmentPreview() {
    if (pendingAttachments.length === 0) {
        attachmentPreview.style.display = "none";
        attachmentPreview.innerHTML = "";
        return;
    }

    attachmentPreview.style.display = "flex";
    attachmentPreview.innerHTML = "";

    pendingAttachments.forEach(function(att, index) {
        var chip = document.createElement("div");
        chip.className = "attachment-chip";

        if (att.type === "image") {
            var img = document.createElement("img");
            img.src = att.dataUrl;
            chip.appendChild(img);
        }

        var nameSpan = document.createElement("span");
        nameSpan.className = "chip-name";
        nameSpan.textContent = att.name;
        chip.appendChild(nameSpan);

        var removeBtn = document.createElement("button");
        removeBtn.className = "chip-remove";
        removeBtn.innerHTML = "&times;";
        removeBtn.addEventListener("click", function() {
            pendingAttachments.splice(index, 1);
            updateAttachmentPreview();
            updateSendButton();
        });
        chip.appendChild(removeBtn);

        attachmentPreview.appendChild(chip);
    });
}

// Send message
async function sendMessage() {
    var userText = userInput.value.trim();
    var attachments = pendingAttachments.slice();

    if (!userText && attachments.length === 0) return;
    if (isProcessing) return;

    isProcessing = true;
    hideWelcomeScreen();

    // Build attachment info for display
    var displayAttachments = attachments.map(function(att) {
        return { type: att.type, name: att.name, dataUrl: att.dataUrl };
    });

    // Show user message
    appendMessage("user", userText, displayAttachments);
    scrollToBottom();

    // Clear input
    userInput.value = "";
    userInput.style.height = "auto";
    pendingAttachments = [];
    updateAttachmentPreview();
    updateSendButton();

    // Show typing indicator
    var typingRow = appendTypingIndicator();

    try {
        // Build the message payload
        var payload = {
            message: userText,
            session_id: sessionId,
            attachments: []
        };

        // Process attachments
        attachments.forEach(function(att) {
            var attData = {
                type: att.type,
                name: att.name,
                dataUrl: att.dataUrl
            };
            if (att.textContent) {
                attData.textContent = att.textContent;
            }
            payload.attachments.push(attData);
        });

        var response = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        typingRow.remove();

        var data = await response.json();

        if (!response.ok) {
            appendMessage("bot", "Sorry, something went wrong. Please try again.", []);
        } else {
            appendMessage("bot", data.reply, []);
        }
    } catch (error) {
        typingRow.remove();
        appendMessage("bot", "Could not reach the server. Please try again later.", []);
    } finally {
        isProcessing = false;
        updateSendButton();
        scrollToBottom();
        userInput.focus();
    }
}

// Auto-resize textarea
userInput.addEventListener("input", function() {
    this.style.height = "auto";
    this.style.height = Math.min(this.scrollHeight, 200) + "px";
    updateSendButton();
});

function updateSendButton() {
    var hasText = userInput.value.trim().length > 0;
    var hasAttachments = pendingAttachments.length > 0;
    sendBtn.disabled = (!hasText && !hasAttachments) || isProcessing;
}

// Enter to send, Shift+Enter for newline
userInput.addEventListener("keydown", function(e) {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

sendBtn.addEventListener("click", sendMessage);

// New chat
newChatBtn.addEventListener("click", function() {
    sessionId = crypto.randomUUID();
    localStorage.setItem("chat_session_id", sessionId);
    var rows = chatBox.querySelectorAll(".message-row");
    rows.forEach(function(r) { r.remove(); });
    showWelcomeScreen();
    pendingAttachments = [];
    updateAttachmentPreview();
    userInput.value = "";
    userInput.style.height = "auto";
    updateSendButton();
});

// Clear all chats
clearAllBtn.addEventListener("click", async function() {
    if (!confirm("Are you sure you want to clear all chat history?")) return;

    try {
        await fetch("/api/history?session_id=" + encodeURIComponent(sessionId), {
            method: "DELETE"
        });
    } catch (e) {
        console.error("Failed to clear history:", e);
    }

    sessionId = crypto.randomUUID();
    localStorage.setItem("chat_session_id", sessionId);
    var rows = chatBox.querySelectorAll(".message-row");
    rows.forEach(function(r) { r.remove(); });
    showWelcomeScreen();
});

// Sidebar toggle
sidebarToggle.addEventListener("click", function() {
    sidebar.classList.toggle("hidden");
    if (window.innerWidth <= 768) {
        sidebar.classList.toggle("visible");
    }
});

// Drag and drop support
var mainArea = document.querySelector(".main-area");

mainArea.addEventListener("dragover", function(e) {
    e.preventDefault();
    e.stopPropagation();
});

mainArea.addEventListener("drop", function(e) {
    e.preventDefault();
    e.stopPropagation();

    var files = Array.from(e.dataTransfer.files);
    files.forEach(function(file) {
        if (file.size > 10 * 1024 * 1024) {
            alert(file.name + " is too large (max 10MB).");
            return;
        }

        var reader = new FileReader();
        reader.onload = function(ev) {
            var isImage = file.type.startsWith("image/");
            var att = {
                file: file,
                type: isImage ? "image" : "document",
                name: file.name,
                dataUrl: ev.target.result
            };

            if (!isImage && (file.type.indexOf("text") !== -1 || file.name.match(/\.(txt|csv|json|xml|md|rtf)$/i))) {
                var textReader = new FileReader();
                textReader.onload = function(tev) {
                    att.textContent = tev.target.result;
                };
                textReader.readAsText(file);
            }

            pendingAttachments.push(att);
            updateAttachmentPreview();
            updateSendButton();
        };
        reader.readAsDataURL(file);
    });
});

// Initialize
initDatabase().then(function() {
    loadHistory();
});

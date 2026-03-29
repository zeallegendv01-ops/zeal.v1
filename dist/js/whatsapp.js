// ══════════════════ WHATSAPP WIDGET ══════════════════

let isOpen = false;

// Initialize
document.addEventListener('DOMContentLoaded', function() {
  setupButtons();
  setupForms();
});

// ══ BUTTON HANDLERS ══
function setupButtons() {
  const toggleBtn = document.getElementById('whatsappToggle');
  const closeBtn = document.getElementById('whatsappClose');

  if (toggleBtn) {
    toggleBtn.addEventListener('click', toggleWidget);
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', closeWidget);
  }
}

function toggleWidget() {
  // Check if user is authenticated
  const authToken = localStorage.getItem('authToken');
  const currentUser = localStorage.getItem('currentUser');

  if (!authToken || !currentUser) {
    // User not authenticated - open main auth modal
    openModal('authModal');
    switchAuthTab('register', document.querySelector('.auth-tab:nth-child(2)'));
    return;
  }

  // User is authenticated - toggle chat widget
  const widget = document.getElementById('whatsappWidget');
  isOpen = !isOpen;

  if (isOpen) {
    widget.classList.remove('hidden');
    document.getElementById('whatsappToggle').style.display = 'none';
  } else {
    widget.classList.add('hidden');
    document.getElementById('whatsappToggle').style.display = 'flex';
  }
}

function closeWidget() {
  isOpen = false;
  const widget = document.getElementById('whatsappWidget');
  widget.classList.add('hidden');
  document.getElementById('whatsappToggle').style.display = 'flex';
}

// ══ FORM HANDLERS ══
function setupForms() {
  // Chat send button
  const chatSend = document.getElementById('chatSend');
  if (chatSend) {
    chatSend.addEventListener('click', sendMessage);
  }

  // Enter key in chat
  const chatInput = document.getElementById('chatInput');
  if (chatInput) {
    chatInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') sendMessage();
    });
  }
}

// ══ SHOW/HIDE FORMS ══
function showChat() {
  document.getElementById('chatArea').classList.remove('hidden');
}

// ══ CHAT MESSAGES ══
function sendMessage() {
  const input = document.getElementById('chatInput');
  const message = input.value.trim();

  if (!message) return;

  // Get current user from localStorage
  const userStr = localStorage.getItem('currentUser');
  const authToken = localStorage.getItem('authToken');

  if (!userStr || !authToken) {
    addMessage('Error: Please sign in again.', 'bot');
    return;
  }

  const user = JSON.parse(userStr);

  // Add user message to UI
  addMessage(message, 'user');

  // Clear input
  input.value = '';

  // Send message to backend API
  fetch('/api/whatsapp/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({
      message: message,
      phone: user.phone,
      userId: user._id || user.id
    })
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        // Show response from backend
        addMessage(data.reply || 'Message sent! Our team will respond shortly. 👍', 'bot');
      } else {
        addMessage('Error: ' + (data.message || 'Failed to send message. Please check your phone number.'), 'bot');
      }
    })
    .catch(err => {
      console.error('Message send error:', err);
      addMessage('Connection error. Please try again.', 'bot');
    });
}

function addMessage(text, sender) {
  const messagesDiv = document.getElementById('chatMessages');
  const msgDiv = document.createElement('div');
  msgDiv.className = `wa-msg ${sender}`;
  const p = document.createElement('p');
  p.textContent = escapeHtml(text);
  msgDiv.appendChild(p);
  messagesDiv.appendChild(msgDiv);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// ══ UTILITIES ══
function showError(errorDiv, message) {
  errorDiv.textContent = message;
  errorDiv.classList.remove('hidden');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

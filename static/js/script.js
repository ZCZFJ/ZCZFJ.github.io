// --- Marked & Highlight.js Config ---
marked.setOptions({
    highlight: function(code, lang) {
const language = hljs.getLanguage(lang) ? lang : 'plaintext';
const escapeHtml = (unsafe) => {
    return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
    };
    
if (language === 'plaintext' && lang && lang !== 'plaintext' && lang !== 'mermaid') {
    const escapedCode = escapeHtml(code);
    return `<code class="hljs language-${language}">${escapedCode}</code>`;
}
try {
    return hljs.highlight(code, { language, ignoreIllegals: true }).value;
} catch (e) {
    console.error("Highlight.js error:", e, "Language:", lang, "Code snippet:", code.substring(0, 100));
    const escapedCode = escapeHtml(code);
    return `<code class="hljs language-plaintext">${escapedCode}</code>`;
}
    },
    langPrefix: 'hljs language-',
    gfm: true,
    breaks: true,
});
    
// --- Global State ---
let currentSessionId = null;
let isStreaming = false;
let isSidebarAnimating = false;
let notificationTimeoutId = null;
let existingChats = [];
    
// --- DOM Elements ---
const sidebar = document.getElementById('sidebar');
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const closeSidebarBtn = document.getElementById('closeSidebarBtn');
const newChatBtn = document.getElementById('newChatBtn');
const chatListContainer = document.getElementById('chatList');
const chatMessagesContainer = document.getElementById('chatMessages');
const initialMessage = document.getElementById('initialMessage');
const chatForm = document.getElementById('chatForm');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const mainContent = document.getElementById('mainContent');
const notificationContainer = document.getElementById('notificationContainer');
const notificationBubble = document.getElementById('notificationBubble');
const confirmModal = document.getElementById('confirmModal');
const inputCapsule = document.getElementById('inputCapsule');
    
// --- Sidebar Control ---
const openSidebar = () => {
    if (isSidebarAnimating || sidebar.classList.contains('sidebar-visible')) return;
    if (window.innerWidth >= 768) return;
    isSidebarAnimating = true;
    sidebar.classList.add('sidebar-visible');
    mobileMenuBtn.classList.add('btn-hidden');
    sidebar.addEventListener('transitionend', () => { isSidebarAnimating = false; }, { once: true });
    setTimeout(() => { isSidebarAnimating = false; }, 500);
 };
const closeSidebar = () => {
    if (isSidebarAnimating || !sidebar.classList.contains('sidebar-visible')) return;
    if (window.innerWidth >= 768) return;
    isSidebarAnimating = true;
    sidebar.classList.remove('sidebar-visible');
    mobileMenuBtn.classList.remove('btn-hidden');
    sidebar.addEventListener('transitionend', () => { isSidebarAnimating = false; }, { once: true });
    setTimeout(() => { isSidebarAnimating = false; }, 500);
};
const toggleSidebar = () => {
    if (window.innerWidth < 768) {
sidebar.classList.contains('sidebar-visible') ? closeSidebar() : openSidebar();
    }
};
    
// --- Notifications ---
function showNotification(text, duration = 3000) {
    console.log("Notification:", text);
    if (notificationTimeoutId) clearTimeout(notificationTimeoutId);
    notificationBubble.textContent = text;
    notificationContainer.classList.add('active');
    notificationTimeoutId = setTimeout(() => {
notificationContainer.classList.remove('active');
notificationTimeoutId = null;
    }, duration);
}
    
// --- Confirm Modal ---
function showConfirm(title = '确认操作', message = '你确定要执行此操作吗？', confirmText = '确认', cancelText = '取消') {
    return new Promise(resolve => {
const currentModal = document.getElementById('confirmModal');
const currentBackdrop = document.getElementById('confirmBackdrop');
const currentContent = document.getElementById('confirmContent');
const currentTitle = document.getElementById('confirmTitle');
const currentMessage = document.getElementById('confirmMessage');
let currentOkBtn = document.getElementById('confirmOk');
let currentCancelBtn = document.getElementById('confirmCancel');
let currentOkText = document.getElementById('confirmOkText');
    
currentTitle.textContent = title;
currentMessage.textContent = message;
    
const newOkBtn = currentOkBtn.cloneNode(true);
currentOkBtn.parentNode.replaceChild(newOkBtn, currentOkBtn);
currentOkBtn = newOkBtn;
currentOkText = currentOkBtn.querySelector('span');
if (currentOkText) currentOkText.textContent = confirmText;
currentOkBtn.addEventListener('mousemove', handleButtonMouseMove);
    
const newCancelBtn = currentCancelBtn.cloneNode(true);
currentCancelBtn.parentNode.replaceChild(newCancelBtn, currentCancelBtn);
currentCancelBtn = newCancelBtn;
currentCancelBtn.textContent = cancelText;
    
const newBackdrop = currentBackdrop.cloneNode(true);
currentBackdrop.parentNode.replaceChild(newBackdrop, currentBackdrop);
const currentClonedBackdrop = newBackdrop;
    
currentModal.classList.remove('hidden');
currentModal.classList.add('flex');
currentModal.classList.remove('confirm-leave-active');
currentModal.classList.add('modal-entering');
    
let resolved = false;
const close = (result) => {
    if (resolved) return;
    resolved = true;
    currentModal.classList.remove('modal-entering');
    currentModal.classList.add('confirm-leave-active');
    
    const onAnimationEnd = (e) => {
       if (e.target === currentContent && resolved && currentModal.classList.contains('confirm-leave-active')) {
   currentModal.classList.add('hidden');
   currentModal.classList.remove('flex', 'confirm-leave-active');
   currentContent.removeEventListener('animationend', onAnimationEnd);
   resolve(result);
       }
    };
    currentContent.addEventListener('animationend', onAnimationEnd);
    
     setTimeout(() => {
  if (!currentModal.classList.contains('hidden') && resolved) {
      console.warn("Confirm modal close fallback timeout triggered.");
      currentModal.classList.add('hidden');
      currentModal.classList.remove('flex', 'confirm-leave-active');
      currentContent.removeEventListener('animationend', onAnimationEnd);
      resolve(result);
  }
     }, 350);
};
    
currentOkBtn.addEventListener('click', () => close(true), { once: true });
currentCancelBtn.addEventListener('click', () => close(false), { once: true });
currentClonedBackdrop.addEventListener('click', () => close(false), { once: true });
    });
}
    
    
// --- Message Rendering ---
const renderMessage = (role, content, isLoading = false) => {
    initialMessage.classList.add('hidden');
    const isUser = role === 'user';
    const bubbleWrapper = document.createElement('div');
    bubbleWrapper.className = `message-enter flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`;
    const bubbleContent = document.createElement('div');
    bubbleContent.className = `message-bubble ${isUser ? 'user-bubble' : 'assistant-bubble'}`;
    
    if (isLoading) {
bubbleContent.innerHTML = `<div class="typing-loader-container"><div class="typing-loader flex gap-1.5"><div class="w-2 h-2 bg-gray-500 rounded-full" style="animation-delay: 0s;"></div><div class="w-2 h-2 bg-gray-500 rounded-full" style="animation-delay: 0.2s;"></div><div class="w-2 h-2 bg-gray-500 rounded-full" style="animation-delay: 0.4s;"></div></div></div>`;
bubbleWrapper.dataset.loadingId = 'assistant-loading';
    } else {
const parsedContent = marked.parse(content || '');
const innerDiv = document.createElement('div');
innerDiv.className = `message-content ${isUser ? 'user-content' : 'assistant-content'}`;
innerDiv.innerHTML = parsedContent;
bubbleContent.appendChild(innerDiv);
 if (role === 'assistant' && content && content.match(/(\$|\\\(|\\\[|\\begin\{)/)) {
     requestAnimationFrame(() => {
 if (typeof MathJax !== 'undefined' && MathJax.typesetPromise) {
     MathJax.typesetPromise([innerDiv]).catch(err => console.error('MathJax typeset failed:', err));
 }
     });
 }
    }
    bubbleWrapper.appendChild(bubbleContent);
    chatMessagesContainer.appendChild(bubbleWrapper);
    requestAnimationFrame(() => chatMessagesContainer.scrollTo({ top: chatMessagesContainer.scrollHeight, behavior: 'smooth' }));
    return bubbleWrapper;
 };
const updateLoadingMessage = (content) => {
    const loadingBubbleWrapper = chatMessagesContainer.querySelector('[data-loading-id="assistant-loading"]');
    if (loadingBubbleWrapper) {
const bubbleContent = loadingBubbleWrapper.querySelector('.message-bubble');
if (bubbleContent) {
    const parsedContent = marked.parse(content || '');
    let innerDiv = bubbleContent.querySelector('.message-content');
    if (!innerDiv) {
bubbleContent.innerHTML = '';
innerDiv = document.createElement('div');
innerDiv.className = 'message-content assistant-content';
bubbleContent.appendChild(innerDiv);
    }
    innerDiv.innerHTML = parsedContent;
    if (content && content.match(/(\$|\\\(|\\\[|\\begin\{)/)) {
requestAnimationFrame(() => {
    if (typeof MathJax !== 'undefined' && MathJax.typesetPromise) {
 MathJax.typesetPromise([innerDiv]).catch(err => console.error('MathJax stream update failed:', err));
    }
 });
    }
    const isScrolledToBottom = chatMessagesContainer.scrollHeight - chatMessagesContainer.clientHeight <= chatMessagesContainer.scrollTop + 100;
    if (isScrolledToBottom) {
 requestAnimationFrame(() => chatMessagesContainer.scrollTo({ top: chatMessagesContainer.scrollHeight, behavior: 'smooth' }));
    }
    return loadingBubbleWrapper;
}
    }
    return null;
};
const removeLoadingIndicator = () => {
     const loadingBubbleWrapper = chatMessagesContainer.querySelector('[data-loading-id="assistant-loading"]');
     if (loadingBubbleWrapper) {
 const innerContent = loadingBubbleWrapper.querySelector('.message-content');
 if (!innerContent || (innerContent.innerHTML.trim().length === 0 && innerContent.textContent.trim().length === 0)) {
     loadingBubbleWrapper.remove();
 } else {
     delete loadingBubbleWrapper.dataset.loadingId;
 }
     }
     if (chatMessagesContainer.children.length === 0 && !chatMessagesContainer.querySelector('[data-loading-id="assistant-loading"]')) {
  initialMessage.classList.remove('hidden');
     }
};
    
// --- API Interaction ---
const loadChatList = async () => {
    console.log("Loading chat list...");
    chatListContainer.innerHTML = '<div class="text-center text-gray-400 py-4">加载中...</div>';
    try {
const response = await fetch('/api/chats');
if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
const fetchedChats = await response.json();
existingChats = fetchedChats || [];
existingChats.sort((a, b) => (b.last_accessed || 0) - (a.last_accessed || 0));
console.log(`Loaded ${existingChats.length} chats.`);
renderChatListFromCache();
    } catch (error) {
console.error('加载聊天列表失败:', error);
chatListContainer.innerHTML = '<div class="text-center text-red-500 py-4">加载列表失败</div>';
showNotification('加载聊天列表失败', 3000);
existingChats = [];
    }
};
    
const renderChatListFromCache = () => {
     console.log("Rendering chat list from cache...");
     chatListContainer.innerHTML = '';
     if (existingChats.length === 0) {
 chatListContainer.innerHTML = '<div class="text-center text-gray-400 py-4">暂无对话</div>';
 return;
     }
     existingChats.forEach(chat => {
 const chatItem = document.createElement('div');
 const isActive = currentSessionId === chat.id;
 chatItem.className = `chat-list-item group relative p-3 rounded-lg cursor-pointer transition-colors ${isActive ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-gray-100'}`;
 chatItem.dataset.sessionId = chat.id;
 const lastAccessedDate = chat.last_accessed ? new Date(chat.last_accessed * 1000) : null;
 const displayDate = lastAccessedDate ? lastAccessedDate.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }) : 'N/A';
    
 chatItem.innerHTML = `
    <div class="font-medium text-sm text-gray-800 truncate pr-8">${chat.title || '未命名对话'}</div>
    <div class="text-xs text-gray-500 mt-1 flex justify-between items-center">
<span>${displayDate}</span>
<button class="delete-chat-btn absolute right-2 top-1/2 p-1 rounded-full transition-all focus:outline-none z-10
       md:opacity-0 md:group-hover:opacity-100 text-gray-400 hover:text-red-500 hover:bg-red-100 interactive-button"
data-session-id="${chat.id}" aria-label="删除对话">
    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
</button>
    </div>
`;
    
chatItem.addEventListener('click', () => {
    if (currentSessionId === chat.id) { if (window.innerWidth < 768 && sidebar.classList.contains('sidebar-visible')) closeSidebar(); return; }
    if (isStreaming) { showNotification('请等待当前回答完成', 2000); return; }
    loadChatSession(chat.id);
    if (window.innerWidth < 768) closeSidebar();
});
    
const deleteBtn = chatItem.querySelector('.delete-chat-btn');
deleteBtn.addEventListener('click', (event) => { event.stopPropagation(); handleDeleteChat(chat.id); });
deleteBtn.addEventListener('mousemove', handleButtonMouseMove);
chatListContainer.appendChild(chatItem);
     });
     console.log("Chat list rendered.");
}
    
const handleDeleteChat = async (sessionId) => {
     console.log(`Attempting to delete chat: ${sessionId}`);
    if (isStreaming && currentSessionId === sessionId) { showNotification('请等待当前对话结束后再删除', 3000); return; }
    const confirmed = await showConfirm('确认删除', '确定要删除这个对话吗？此操作不可恢复。', '确认删除', '取消');
    
    if (confirmed) {
console.log(`Confirmed deletion for: ${sessionId}`);
const originalSessionIdToDelete = sessionId;
const wasCurrentSession = currentSessionId === originalSessionIdToDelete;
const originalChats = [...existingChats];
const deletedIndex = existingChats.findIndex(chat => chat.id === originalSessionIdToDelete);
if (deletedIndex > -1) existingChats.splice(deletedIndex, 1);
renderChatListFromCache();
    
if (wasCurrentSession) {
     currentSessionId = null;
     chatMessagesContainer.innerHTML = '';
     initialMessage.classList.remove('hidden');
     messageInput.value = '';
     messageInput.disabled = true;
     sendButton.disabled = true;
}
try {
    const response = await fetch(`/api/chat/${originalSessionIdToDelete}`, { method: 'DELETE' });
    if (!response.ok) { let errorData = `HTTP error! status: ${response.status}`; try { const text = await response.text(); errorData += `, ${text}`; } catch (e) {} throw new Error(errorData); }
    showNotification('对话已删除', 2000);
     if (wasCurrentSession) {
 if (existingChats.length > 0) { const nextSessionId = existingChats[0]?.id; if (nextSessionId) await loadChatSession(nextSessionId); else await createNewChat(); }
 else { await createNewChat(); }
     }
} catch (error) {
    console.error('删除对话失败:', error);
    showNotification(`删除对话失败: ${error.message || '未知错误'}`, 4000);
    existingChats = originalChats; renderChatListFromCache();
     if (wasCurrentSession) { await loadChatSession(originalSessionIdToDelete); }
     else if (currentSessionId) { renderChatListFromCache(); }
}
    } else { console.log(`Deletion cancelled for: ${sessionId}`); }
 };
    
const loadChatSession = async (sessionId) => {
     if (isStreaming) { showNotification('请等待当前回答完成后再切换对话', 3000); return; }
    if (currentSessionId === sessionId) { console.log(`Session ${sessionId} is already active.`); if (window.innerWidth < 768 && sidebar.classList.contains('sidebar-visible')) closeSidebar(); return; }
    console.log(`Attempting to load session: ${sessionId}`);
    currentSessionId = sessionId;
    chatMessagesContainer.innerHTML = '<div class="text-center text-gray-400 py-8">加载中...</div>';
    initialMessage.classList.add('hidden');
    messageInput.disabled = true; sendButton.disabled = true;
    renderChatListFromCache();
    
    try {
const response = await fetch(`/api/chat/${sessionId}`);
if (!response.ok) { let errorData = `HTTP error! status: ${response.status}`; try { const errorText = await response.text(); errorData += `, message: ${errorText.substring(0, 200)}`; } catch (e) {} throw new Error(errorData); }
const data = await response.json(); const messages = Array.isArray(data) ? data : [];
console.log(`Loaded ${messages.length} messages for session ${sessionId}.`);
chatMessagesContainer.innerHTML = '';
if (messages.length === 0) { initialMessage.classList.remove('hidden'); }
else { initialMessage.classList.add('hidden'); messages.forEach(msg => { if (msg && typeof msg.role === 'string' && typeof msg.content === 'string') { renderMessage(msg.role, msg.content); } else { console.warn("Skipping invalid message object:", msg); } }); }
messageInput.disabled = false; sendButton.disabled = false;
 if (messageInput.offsetWidth > 0 || messageInput.offsetHeight > 0 || messageInput.getClientRects().length > 0) { messageInput.focus(); }
 setTimeout(() => { chatMessagesContainer.scrollTo({ top: chatMessagesContainer.scrollHeight, behavior: 'auto' }); }, 150);
const chatIndex = existingChats.findIndex(c => c.id === sessionId);
 if (chatIndex > -1) { const visitedChat = existingChats[chatIndex]; visitedChat.last_accessed = Math.floor(Date.now() / 1000); if (chatIndex > 0) { existingChats.splice(chatIndex, 1); existingChats.unshift(visitedChat); renderChatListFromCache(); } }
    } catch (error) {
console.error(`加载会话 ${sessionId} 失败:`, error);
chatMessagesContainer.innerHTML = `<div class="p-4 m-4 bg-red-100 border border-red-300 text-red-700 rounded-lg text-center"><p class="font-semibold">加载对话失败</p><p class="text-sm mt-1">${error.message || '未知错误'}</p></div>`;
initialMessage.classList.add('hidden'); showNotification('加载对话失败', 3000);
currentSessionId = null; renderChatListFromCache();
messageInput.disabled = true; sendButton.disabled = true;
    }
  };
    
const createNewChat = async () => {
    if (isStreaming) { showNotification('请等待当前回答完成后再新建对话', 3000); return; }
    console.log("Creating new chat...");
    currentSessionId = 'temp-creating';
    chatMessagesContainer.innerHTML = ''; initialMessage.classList.remove('hidden');
    messageInput.value = ''; messageInput.disabled = true; sendButton.disabled = true;
    renderChatListFromCache();
    
    try {
const response = await fetch('/api/new_chat', { method: 'POST' });
if (!response.ok) { const errorData = await response.text(); throw new Error(`HTTP error! status: ${response.status}, ${errorData}`); }
const newChatData = await response.json();
if (!newChatData || !newChatData.session_id) { throw new Error("服务器未返回有效的 session_id"); }
console.log(`New chat created successfully: ${newChatData.session_id}`);
currentSessionId = newChatData.session_id;
const newChatEntry = { id: newChatData.session_id, title: newChatData.title || '新对话', last_accessed: newChatData.last_accessed || Math.floor(Date.now() / 1000) };
existingChats.unshift(newChatEntry); renderChatListFromCache();
messageInput.disabled = false; sendButton.disabled = false;
if (messageInput.offsetWidth > 0 || messageInput.offsetHeight > 0 || messageInput.getClientRects().length > 0) { messageInput.focus(); }
if (window.innerWidth < 768) { closeSidebar(); }
    } catch (error) {
console.error('创建新对话失败:', error); showNotification(`创建新对话失败: ${error.message || '未知错误'}`, 4000);
currentSessionId = null; messageInput.disabled = true; sendButton.disabled = true; renderChatListFromCache();
 if (existingChats.length > 0) { await loadChatSession(existingChats[0].id); }
 else { initialMessage.classList.remove('hidden'); }
    }
};
    
    
// --- Form Submission ---
chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (isStreaming) { showNotification('请等待当前回答完成', 2000); return; }
    const message = messageInput.value.trim();
    if (!message) return;
    if (!currentSessionId || currentSessionId === 'temp-creating') { showNotification('请先选择或创建一个对话', 3000); return; }
    console.log(`Sending message to session ${currentSessionId}: ${message.substring(0, 50)}...`);
    const userMessageContent = message;
    messageInput.value = ''; messageInput.disabled = true; sendButton.disabled = true; isStreaming = true; initialMessage.classList.add('hidden');
    renderMessage('user', userMessageContent);
    const loadingIndicator = renderMessage('assistant', '', true);
    let assistantContent = ''; let lastMessageElement = loadingIndicator;
    
    try {
const response = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: userMessageContent, session_id: currentSessionId }) });
if (!response.ok) { const errorText = await response.text(); throw new Error(`HTTP error! status: ${response.status} - ${errorText}`); }
if (!response.body) throw new Error("Response body is missing.");
const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = ''; let doneStreaming = false;
console.log("Starting to read stream...");
while (!doneStreaming) {
    const { done, value } = await reader.read();
    if (done) {
doneStreaming = true;
if (buffer.startsWith('data: ')) { const dataStr = buffer.substring(6).trim(); if (dataStr !== '[DONE]' && dataStr) { try { const data = JSON.parse(dataStr); if (data.content) assistantContent += data.content; } catch (err) {} } }
 const updatedElement = updateLoadingMessage(assistantContent); if (updatedElement) lastMessageElement = updatedElement;
break;
    }
    buffer += decoder.decode(value, { stream: true }); let boundary = buffer.indexOf('\n\n');
    while (boundary !== -1) {
const messagePart = buffer.substring(0, boundary); buffer = buffer.substring(boundary + 2);
if (messagePart.startsWith('data: ')) {
    const dataStr = messagePart.substring(6).trim();
    if (dataStr === '[DONE]') { doneStreaming = true; const updatedElement = updateLoadingMessage(assistantContent); if (updatedElement) lastMessageElement = updatedElement; break; }
    try {
const data = JSON.parse(dataStr);
if (data.content) { assistantContent += data.content; const updatedElement = updateLoadingMessage(assistantContent); if (updatedElement) lastMessageElement = updatedElement; }
if (data.done) { doneStreaming = true; const finalUpdateElement = updateLoadingMessage(assistantContent); if (finalUpdateElement) lastMessageElement = finalUpdateElement; break; }
    } catch (err) { console.error('解析 SSE JSON 数据错误:', err, 'Data string:', dataStr); }
}
if (doneStreaming) break; boundary = buffer.indexOf('\n\n');
    }
     if (doneStreaming) break;
}
console.log("Stream finished reading.");
    } catch (error) {
console.error('发送消息或处理流失败:', error);
if (lastMessageElement && lastMessageElement.dataset.loadingId) { lastMessageElement.remove(); renderMessage('assistant', `抱歉，处理时遇到错误：${error.message || '未知错误'}`); }
else { showNotification(`消息处理出错: ${error.message || '未知错误'}`, 4000); }
    } finally {
console.log("Stream processing finished or failed. Running finally block.");
isStreaming = false; removeLoadingIndicator();
 const finalAssistantBubble = chatMessagesContainer.querySelector('.assistant-bubble:last-child .message-content');
 if (finalAssistantBubble && assistantContent && assistantContent.match(/(\$|\\\(|\\\[|\\begin\{)/)) { requestAnimationFrame(() => { if (typeof MathJax !== 'undefined' && MathJax.typesetPromise) { MathJax.typesetPromise([finalAssistantBubble]).catch(err => console.error('Final MathJax typeset failed:', err)); } }); }
const chatIndex = existingChats.findIndex(c => c.id === currentSessionId);
if (chatIndex !== -1) { const currentChat = existingChats[chatIndex]; currentChat.last_accessed = Math.floor(Date.now() / 1000); if(chatIndex > 0) { existingChats.splice(chatIndex, 1); existingChats.unshift(currentChat); renderChatListFromCache(); } }
else if(currentSessionId && currentSessionId !== 'temp-creating') { console.warn(`Current session ${currentSessionId} not found in cache after streaming. Reloading list.`); loadChatList(); }
if (currentSessionId && currentSessionId !== 'temp-creating') { messageInput.disabled = false; sendButton.disabled = false; if (messageInput.offsetWidth > 0 || messageInput.offsetHeight > 0 || messageInput.getClientRects().length > 0) { messageInput.focus(); } }
else { messageInput.disabled = true; sendButton.disabled = true; console.warn("Input remains disabled as currentSessionId is invalid after streaming."); }
    }
});
    
// --- Button Mouse Interaction ---
function handleButtonMouseMove(event) {
    const target = event.currentTarget; const rect = target.getBoundingClientRect();
    const x = event.clientX - rect.left; const y = event.clientY - rect.top;
    target.style.setProperty('--mouse-x', `${(x / target.offsetWidth) * 100}%`); target.style.setProperty('--mouse-y', `${(y / target.offsetHeight) * 100}%`);
 }
    
// --- Event Listeners ---
mobileMenuBtn.addEventListener('click', toggleSidebar);
closeSidebarBtn.addEventListener('click', closeSidebar);
newChatBtn.addEventListener('click', createNewChat);
mobileMenuBtn.addEventListener('mousemove', handleButtonMouseMove);
closeSidebarBtn.addEventListener('mousemove', handleButtonMouseMove);
newChatBtn.addEventListener('mousemove', handleButtonMouseMove);
sendButton.addEventListener('mousemove', handleButtonMouseMove);
    
document.addEventListener('click', (event) => {
     if (window.innerWidth < 768 && sidebar.classList.contains('sidebar-visible')) {
 const isClickInsideSidebar = sidebar.contains(event.target);
 const isClickOnMenuButton = mobileMenuBtn.contains(event.target);
 const isClickInsideConfirm = confirmModal.contains(event.target) && !confirmModal.classList.contains('hidden');
 if (!isClickInsideSidebar && !isClickOnMenuButton && !isClickInsideConfirm) { closeSidebar(); }
     }
});
    
window.addEventListener('resize', () => {
    const isMobile = window.innerWidth < 768;
    if (!isMobile) { sidebar.classList.remove('sidebar-visible', 'sidebar-mobile'); isSidebarAnimating = false; }
    else { if (!sidebar.classList.contains('sidebar-visible') && !sidebar.classList.contains('sidebar-mobile')) { sidebar.classList.add('sidebar-mobile'); } if (sidebar.classList.contains('sidebar-visible')) { mobileMenuBtn.classList.add('btn-hidden'); } else { mobileMenuBtn.classList.remove('btn-hidden'); } }
});
    
// --- Initialize App ---
const initializeApp = async () => {
    console.log("Initializing application...");
    window.dispatchEvent(new Event('resize'));
    messageInput.disabled = true; sendButton.disabled = true; initialMessage.classList.remove('hidden');
    await loadChatList();
    if (existingChats.length > 0) { const latestSessionId = existingChats[0].id; console.log(`Found ${existingChats.length} chats, loading latest: ${latestSessionId}`); await loadChatSession(latestSessionId); }
    else { console.log("No existing chats found, creating a new one."); await createNewChat(); }
    if (currentSessionId && currentSessionId !== 'temp-creating') { messageInput.disabled = false; sendButton.disabled = false; if (messageInput.offsetWidth > 0 || messageInput.offsetHeight > 0 || messageInput.getClientRects().length > 0) { messageInput.focus(); } console.log("Initialization complete, input enabled."); }
    else { messageInput.disabled = true; sendButton.disabled = true; console.log("Initialization ended without a valid session, input remains disabled."); if (chatMessagesContainer.children.length === 0) { initialMessage.classList.remove('hidden'); } }
     requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
     console.log("Application initialized.");
};
    
// Start App
initializeApp();

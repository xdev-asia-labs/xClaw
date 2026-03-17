// ============================================================
// AutoX Embeddable Chat Widget
// Drop-in script for external websites to embed AutoX chat
// Usage: <script src="https://your-autox.com/embed/autox-widget.js" data-api-key="axk_..." data-theme="dark"></script>
// ============================================================

(function () {
    'use strict';

    var script = document.currentScript;
    if (!script) return;

    var API_KEY = script.dataset.apiKey || '';
    var THEME = script.dataset.theme || 'dark';
    var SERVER = script.dataset.server || script.src.replace(/\/embed\/autox-widget\.js.*$/, '');
    var POSITION = script.dataset.position || 'bottom-right';
    var TITLE = script.dataset.title || 'Chat';

    if (!API_KEY) {
        console.warn('[AutoX Widget] No data-api-key provided');
        return;
    }

    // ─── Styles ──────────────────────────────────────
    var isDark = THEME === 'dark';
    var colors = isDark
        ? { bg: '#0f172a', surface: '#1e293b', border: '#334155', text: '#e2e8f0', muted: '#94a3b8', primary: '#6366f1', userBg: '#4f46e5', botBg: '#1e293b' }
        : { bg: '#ffffff', surface: '#f8fafc', border: '#e2e8f0', text: '#1e293b', muted: '#64748b', primary: '#6366f1', userBg: '#6366f1', botBg: '#f1f5f9' };

    var css = '\n'
        + '#autox-widget-btn{position:fixed;z-index:99999;width:56px;height:56px;border-radius:50%;background:' + colors.primary + ';color:#fff;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,0.3);transition:transform 0.2s}'
        + '#autox-widget-btn:hover{transform:scale(1.08)}'
        + '#autox-widget-panel{position:fixed;z-index:99999;width:380px;height:520px;border-radius:16px;overflow:hidden;display:none;flex-direction:column;background:' + colors.bg + ';border:1px solid ' + colors.border + ';box-shadow:0 8px 32px rgba(0,0,0,0.25);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}'
        + '#autox-widget-panel.open{display:flex}'
        + '.axw-header{padding:12px 16px;background:' + colors.surface + ';border-bottom:1px solid ' + colors.border + ';display:flex;align-items:center;gap:8px}'
        + '.axw-header h3{margin:0;font-size:14px;font-weight:600;color:' + colors.text + ';flex:1}'
        + '.axw-close{background:none;border:none;cursor:pointer;color:' + colors.muted + ';font-size:18px;padding:4px;line-height:1}'
        + '.axw-messages{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px}'
        + '.axw-msg{max-width:85%;padding:8px 12px;border-radius:12px;font-size:13px;line-height:1.5;word-wrap:break-word;color:' + colors.text + '}'
        + '.axw-msg.user{align-self:flex-end;background:' + colors.userBg + ';color:#fff;border-bottom-right-radius:4px}'
        + '.axw-msg.bot{align-self:flex-start;background:' + colors.botBg + ';border-bottom-left-radius:4px}'
        + '.axw-input-row{padding:12px;border-top:1px solid ' + colors.border + ';display:flex;gap:8px}'
        + '.axw-input{flex:1;border:1px solid ' + colors.border + ';border-radius:8px;padding:8px 12px;font-size:13px;background:' + colors.surface + ';color:' + colors.text + ';outline:none}'
        + '.axw-input:focus{border-color:' + colors.primary + '}'
        + '.axw-send{background:' + colors.primary + ';color:#fff;border:none;border-radius:8px;padding:8px 14px;cursor:pointer;font-size:13px;font-weight:500}'
        + '.axw-send:disabled{opacity:0.5;cursor:not-allowed}'
        + '.axw-typing{align-self:flex-start;padding:8px 12px;font-size:12px;color:' + colors.muted + ';font-style:italic}';

    var styleEl = document.createElement('style');
    styleEl.textContent = css;
    document.head.appendChild(styleEl);

    // ─── Position ───────────────────────────────────
    var posStyle = { btn: '', panel: '' };
    switch (POSITION) {
        case 'bottom-left':
            posStyle.btn = 'left:20px;bottom:20px';
            posStyle.panel = 'left:20px;bottom:88px';
            break;
        default:
            posStyle.btn = 'right:20px;bottom:20px';
            posStyle.panel = 'right:20px;bottom:88px';
    }

    // ─── DOM ────────────────────────────────────────
    var btn = document.createElement('button');
    btn.id = 'autox-widget-btn';
    btn.setAttribute('style', posStyle.btn);
    btn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';

    var panel = document.createElement('div');
    panel.id = 'autox-widget-panel';
    panel.setAttribute('style', posStyle.panel);
    panel.innerHTML =
        '<div class="axw-header">'
        + '<h3>' + TITLE + '</h3>'
        + '<button class="axw-close">&times;</button>'
        + '</div>'
        + '<div class="axw-messages"></div>'
        + '<div class="axw-input-row">'
        + '<input class="axw-input" placeholder="Type a message..." />'
        + '<button class="axw-send">Send</button>'
        + '</div>';

    document.body.appendChild(btn);
    document.body.appendChild(panel);

    var messagesEl = panel.querySelector('.axw-messages');
    var inputEl = panel.querySelector('.axw-input');
    var sendBtn = panel.querySelector('.axw-send');
    var closeBtn = panel.querySelector('.axw-close');

    var isOpen = false;
    var sessionId = null;
    var sending = false;

    btn.addEventListener('click', function () {
        isOpen = !isOpen;
        panel.classList.toggle('open', isOpen);
        if (isOpen) inputEl.focus();
    });

    closeBtn.addEventListener('click', function () {
        isOpen = false;
        panel.classList.remove('open');
    });

    function addMessage(content, role) {
        var div = document.createElement('div');
        div.className = 'axw-msg ' + role;
        div.textContent = content;
        messagesEl.appendChild(div);
        messagesEl.scrollTop = messagesEl.scrollHeight;
        return div;
    }

    async function sendMessage() {
        var text = inputEl.value.trim();
        if (!text || sending) return;

        sending = true;
        sendBtn.disabled = true;
        inputEl.value = '';
        addMessage(text, 'user');

        var botDiv = addMessage('...', 'bot');

        try {
            var res = await fetch(SERVER + '/api/embed/chat/stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
                body: JSON.stringify({ message: text, sessionId: sessionId }),
            });

            if (!res.ok) throw new Error('HTTP ' + res.status);

            var reader = res.body.getReader();
            var decoder = new TextDecoder();
            var fullContent = '';
            botDiv.textContent = '';

            while (true) {
                var chunk = await reader.read();
                if (chunk.done) break;
                var lines = decoder.decode(chunk.value, { stream: true }).split('\n');
                for (var i = 0; i < lines.length; i++) {
                    if (!lines[i].startsWith('data: ')) continue;
                    try {
                        var data = JSON.parse(lines[i].slice(6));
                        if (data.type === 'delta') {
                            fullContent += data.content;
                            botDiv.textContent = fullContent;
                            messagesEl.scrollTop = messagesEl.scrollHeight;
                        } else if (data.type === 'done' && data.sessionId) {
                            sessionId = data.sessionId;
                        }
                    } catch (e) { /* skip */ }
                }
            }

            if (!fullContent) botDiv.textContent = '(No response)';
        } catch (err) {
            botDiv.textContent = 'Error: ' + err.message;
        }

        sending = false;
        sendBtn.disabled = false;
        inputEl.focus();
    }

    sendBtn.addEventListener('click', sendMessage);
    inputEl.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
})();

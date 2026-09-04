/* ================================================================= *
 * Composer Component - src/components/composer.js                   *
 * ================================================================= */

import { store } from '../core/store.js';
import { icons } from './icons.js';

export function renderComposer() {
  const container = document.createElement('div');
  container.className = 'composer-container';
  container.style.cssText = `
    padding: 12px 16px 16px;
    background-color: var(--bg-bone);
  `;

  const composer = document.createElement('form');
  composer.className = 'composer';
  composer.style.cssText = `
    position: relative;
    width: 100%;
    min-height: 52px;
    box-sizing: border-box;
    background-color: var(--surface-sand);
    border: 1px solid rgba(44, 37, 35, 0.08);
    border-radius: 9999px;
    padding: 8px;
    transition: border-radius 0.18s ease, min-height 0.18s ease;
  `;

  /* --------------------------------------------------------------- *
   * Input Area
   * --------------------------------------------------------------- */

  const inputContainer = document.createElement('div');
  inputContainer.style.cssText = `
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
    padding-left: 40px;
    padding-right: 126px;
    padding-bottom: 0;
    transition: padding-bottom 0.16s ease;
  `;

  const input = document.createElement('textarea');
  input.rows = 1;
  input.placeholder = 'Type a message...';
  input.style.cssText = `
    display: block;
    width: 100%;
    height: 36px;
    min-height: 36px;
    max-height: 160px;
    background: transparent;
    border: none;
    outline: none;
    font-family: inherit;
    font-size: 14px;
    line-height: 20px;
    color: var(--text-espresso);
    padding: 8px 2px 8px 4px;
    margin: 0;
    resize: none;
    overflow-y: hidden;
    overflow-x: hidden;
    scrollbar-gutter: stable;
    box-sizing: border-box;
    transition: height 0.16s ease;
  `;

  inputContainer.appendChild(input);
  composer.appendChild(inputContainer);

  /* --------------------------------------------------------------- *
   * Attachment Dropup Menu
   * --------------------------------------------------------------- */

  const attachWrapper = document.createElement('div');
  attachWrapper.style.cssText = `
    position: absolute;
    left: 8px;
    bottom: 8px;
    display: flex;
    z-index: 20;
  `;

  const attachBtn = document.createElement('button');
  attachBtn.type = 'button';
  attachBtn.innerHTML = icons.plus;
  attachBtn.title = 'Attach';
  attachBtn.setAttribute('aria-label', 'Attach file');
  styleButton(attachBtn);

  const dropup = document.createElement('div');
  dropup.className = 'composer-dropup';
  dropup.style.cssText = `
    display: none;
    position: absolute;
    left: 0;
    bottom: 44px;
    width: 180px;
    background-color: var(--surface-sand);
    border: 1px solid rgba(44, 37, 35, 0.08);
    border-radius: 12px;
    box-shadow: 0 -4px 20px rgba(44, 37, 35, 0.08);
    z-index: 100;
    padding: 6px;
  `;

  const dropupOptions = [
    { label: 'Photos & Videos', action: () => store.sendMessage('[Photo Attachment]') },
    { label: 'Document', action: () => store.sendMessage('[Document Attachment]') },
    { label: 'Audio File', action: () => store.sendMessage('[Audio Attachment]') }
  ];

  dropupOptions.forEach(opt => {
    const item = document.createElement('div');
    item.textContent = opt.label;
    item.style.cssText = `
      padding: 8px 12px;
      font-size: 13px;
      border-radius: 8px;
      cursor: pointer;
      color: var(--text-espresso);
      transition: background 0.2s ease;
    `;

    item.addEventListener('mouseenter', () => item.style.backgroundColor = 'rgba(44, 37, 35, 0.06)');
    item.addEventListener('mouseleave', () => item.style.backgroundColor = 'transparent');
    item.addEventListener('click', e => {
      e.stopPropagation();
      dropup.style.display = 'none';
      opt.action();
    });

    dropup.appendChild(item);
  });

  attachWrapper.appendChild(attachBtn);
  attachWrapper.appendChild(dropup);
  composer.appendChild(attachWrapper);

  /* --------------------------------------------------------------- *
   * Right Tools Wrapper (Emoji, Mic, Send)
   * --------------------------------------------------------------- */

  const rightTools = document.createElement('div');
  rightTools.style.cssText = `
    position: absolute;
    right: 8px;
    bottom: 8px;
    display: flex;
    align-items: center;
    gap: 2px;
    z-index: 20;
  `;

  /* Emoji Picker Setup */
  const emojiWrapper = document.createElement('div');
  emojiWrapper.style.cssText = 'position: relative; display: flex;';

  const emojiBtn = document.createElement('button');
  emojiBtn.type = 'button';
  emojiBtn.innerHTML = icons.emoji;
  emojiBtn.title = 'Add Emoji';
  emojiBtn.setAttribute('aria-label', 'Add emoji');
  styleButton(emojiBtn);

  const emojiPicker = document.createElement('div');
  emojiPicker.className = 'emoji-picker';
  emojiPicker.style.cssText = `
    display: none;
    position: absolute;
    right: 0;
    bottom: 44px;
    width: 220px;
    background-color: var(--surface-sand);
    border: 1px solid rgba(44, 37, 35, 0.08);
    border-radius: 12px;
    box-shadow: 0 -4px 20px rgba(44, 37, 35, 0.08);
    z-index: 100;
    padding: 10px;
    grid-template-columns: repeat(5, 1fr);
    gap: 6px;
  `;

  const emojis = ['😊', '😂', '❤️', '👍', '🔥', '✨', '🙌', '😍', '😎', '🙏', '🎉', '💡', '☕', '🌿', '💬'];

  emojis.forEach(emo => {
    const emoItem = document.createElement('button');
    emoItem.type = 'button';
    emoItem.textContent = emo;
    emoItem.style.cssText = `
      background: transparent;
      border: none;
      font-size: 18px;
      cursor: pointer;
      padding: 6px;
      border-radius: 6px;
      transition: background 0.2s ease;
    `;

    emoItem.addEventListener('mouseenter', () => emoItem.style.backgroundColor = 'rgba(44, 37, 35, 0.06)');
    emoItem.addEventListener('mouseleave', () => emoItem.style.backgroundColor = 'transparent');
    emoItem.addEventListener('click', e => {
      e.stopPropagation();
      const start = input.selectionStart;
      const end = input.selectionEnd;
      input.value = input.value.slice(0, start) + emo + input.value.slice(end);
      input.selectionStart = input.selectionEnd = start + emo.length;
      input.focus();
      updateComposer();
    });

    emojiPicker.appendChild(emoItem);
  });

  emojiWrapper.appendChild(emojiBtn);
  emojiWrapper.appendChild(emojiPicker);

  /* Microphone / Voice Note Setup */
  let isRecording = false;
  let recordingTimer = null;
  let secondsCount = 0;

  const micBtn = document.createElement('button');
  micBtn.type = 'button';
  micBtn.innerHTML = icons.mic;
  micBtn.title = 'Record Voice Note';
  micBtn.setAttribute('aria-label', 'Record voice note');
  styleButton(micBtn);

  function stopRecording() {
    clearInterval(recordingTimer);
    recordingTimer = null;
    isRecording = false;
    micBtn.style.color = 'var(--text-espresso)';
    micBtn.style.backgroundColor = 'transparent';
    input.value = '';
    input.disabled = false;
    updateComposer();
    input.focus();
  }

  micBtn.addEventListener('click', () => {
    if (!isRecording) {
      isRecording = true;
      micBtn.style.color = '#C94A4A';
      micBtn.style.backgroundColor = 'rgba(201, 74, 74, 0.08)';
      input.value = 'Recording voice note (0:00)...';
      input.disabled = true;
      secondsCount = 0;
      updateComposer();

      recordingTimer = setInterval(() => {
        secondsCount++;
        const mins = Math.floor(secondsCount / 60);
        const secs = secondsCount % 60;
        input.value = `Recording voice note (${mins}:${secs < 10 ? '0' : ''}${secs})...`;
        updateComposer();
      }, 1000);
      return;
    }

    stopRecording();
    store.sendMessage('[Voice Note]');
  });

  /* Send Button Setup */
  const sendBtn = document.createElement('button');
  sendBtn.type = 'submit';
  sendBtn.innerHTML = icons.send;
  sendBtn.title = 'Send';
  sendBtn.setAttribute('aria-label', 'Send message');
  styleButton(sendBtn);
  sendBtn.style.backgroundColor = 'var(--accent-sage)';
  sendBtn.style.color = '#FFFFFF';

  rightTools.appendChild(emojiWrapper);
  rightTools.appendChild(micBtn);
  rightTools.appendChild(sendBtn);
  composer.appendChild(rightTools);

  /* --------------------------------------------------------------- *
   * Component Logic & Auto-Resize
   * --------------------------------------------------------------- */

  function updateComposer() {
    const maxHeight = 160;
    const previousHeight = input.offsetHeight;

    input.style.height = 'auto';
    const contentHeight = input.scrollHeight;
    const targetHeight = Math.min(contentHeight, maxHeight);

    input.style.height = `${targetHeight}px`;

    const expanded = input.value.length > 0 && (contentHeight > 36 || input.value.includes('\n'));

    if (expanded || isRecording) {
      composer.style.borderRadius = '22px';
      inputContainer.style.paddingLeft = '40px';
      inputContainer.style.paddingRight = '4px';
      inputContainer.style.paddingBottom = '40px';
      input.style.overflowY = contentHeight > maxHeight ? 'auto' : 'hidden';

      if (contentHeight > maxHeight) {
        requestAnimationFrame(() => {
          input.scrollTop = input.scrollHeight;
        });
      }
    } else {
      composer.style.borderRadius = '9999px';
      inputContainer.style.paddingLeft = '40px';
      inputContainer.style.paddingRight = '126px';
      inputContainer.style.paddingBottom = '0';
      input.style.height = '36px';
      input.style.overflowY = 'hidden';
      input.scrollTop = 0;
    }

    if (previousHeight !== targetHeight) {
      requestAnimationFrame(() => {
        if (contentHeight <= maxHeight) {
          input.style.height = `${targetHeight}px`;
        }
      });
    }
  }

  /* Event Handlers */
  input.addEventListener('input', updateComposer);

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      composer.requestSubmit();
    }
  });

  attachBtn.addEventListener('click', e => {
    e.stopPropagation();
    emojiPicker.style.display = 'none';
    dropup.style.display = dropup.style.display === 'block' ? 'none' : 'block';
  });

  emojiBtn.addEventListener('click', e => {
    e.stopPropagation();
    dropup.style.display = 'none';
    emojiPicker.style.display = emojiPicker.style.display === 'grid' ? 'none' : 'grid';
  });

  document.addEventListener('click', () => {
    dropup.style.display = 'none';
    emojiPicker.style.display = 'none';
  });

  composer.addEventListener('click', e => e.stopPropagation());

  composer.addEventListener('submit', e => {
    e.preventDefault();

    if (isRecording) {
      stopRecording();
      store.sendMessage('[Voice Note]');
      return;
    }

    const text = input.value.trim();
    if (!text) return;

    store.sendMessage(text);

    input.value = '';
    input.style.height = '36px';
    input.style.overflowY = 'hidden';
    input.scrollTop = 0;

    updateComposer();
    input.focus();
  });

  container.appendChild(composer);
  updateComposer();

  return container;
}

function styleButton(btn) {
  btn.style.cssText += `
    width: 36px;
    height: 36px;
    min-width: 36px;
    min-height: 36px;
    border-radius: 9999px;
    border: none;
    background: transparent;
    color: var(--text-espresso);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    margin: 0;
    flex-shrink: 0;
    box-sizing: border-box;
    transition: background 0.2s ease, color 0.2s ease;
  `;

  btn.addEventListener('mouseenter', () => {
    if (btn.style.backgroundColor !== 'var(--accent-sage)' && !btn.style.color.includes('201')) {
      btn.style.backgroundColor = 'rgba(44, 37, 35, 0.06)';
    }
  });

  btn.addEventListener('mouseleave', () => {
    if (btn.style.backgroundColor !== 'var(--accent-sage)' && !btn.style.color.includes('201')) {
      btn.style.backgroundColor = 'transparent';
    }
  });
}

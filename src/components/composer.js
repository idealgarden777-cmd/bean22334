/* ================================================================= *
 * Composer Component - src/components/composer.js                   *
 * ================================================================= */

import { store } from '../core/store.js';
import { icons } from './icons.js';

export function renderComposer() {
  const container = document.createElement('div');
  container.className = 'composer-container';
  container.style.padding = '12px 16px 16px';
  container.style.backgroundColor = 'var(--bg-bone)';

  const composer = document.createElement('form');
  composer.className = 'composer';
  composer.style.display = 'flex';
  composer.style.alignItems = 'flex-end'; // Align action buttons nicely as the text grows
  composer.style.backgroundColor = 'var(--surface-sand)';
  composer.style.borderRadius = '20px';
  composer.style.padding = '8px 12px';
  composer.style.gap = '8px';
  composer.style.border = '1px solid rgba(44, 37, 35, 0.08)';
  composer.style.position = 'relative';

  const attachWrapper = document.createElement('div');
  attachWrapper.style.position = 'relative';
  attachWrapper.style.display = 'flex';
  attachWrapper.style.alignItems = 'center';
  attachWrapper.style.height = '36px';

  const attachBtn = document.createElement('button');
  attachBtn.type = 'button';
  attachBtn.innerHTML = icons.plus;
  styleButton(attachBtn, '9999px');

  const dropup = document.createElement('div');
  dropup.className = 'composer-dropup';
  dropup.style.display = 'none';
  dropup.style.position = 'absolute';
  dropup.style.bottom = '52px';
  dropup.style.left = '0';
  dropup.style.width = '180px';
  dropup.style.backgroundColor = 'var(--surface-sand)';
  dropup.style.border = '1px solid rgba(44, 37, 35, 0.08)';
  dropup.style.borderRadius = '12px';
  dropup.style.boxShadow = '0 -4px 20px rgba(44, 37, 35, 0.08)';
  dropup.style.zIndex = '100';
  dropup.style.padding = '6px';

  const dropupOptions = [
    { label: 'Photos & Videos', action: () => store.sendMessage('[Photo Attachment]') },
    { label: 'Document', action: () => store.sendMessage('[Document Attachment]') },
    { label: 'Audio File', action: () => store.sendMessage('[Audio Attachment]') }
  ];

  dropupOptions.forEach(opt => {
    const item = document.createElement('div');
    item.textContent = opt.label;
    item.style.padding = '8px 12px';
    item.style.fontSize = '13px';
    item.style.borderRadius = '8px';
    item.style.cursor = 'pointer';
    item.style.color = 'var(--text-espresso)';
    item.style.transition = 'background 0.2s ease';

    item.addEventListener('mouseenter', () => {
      item.style.backgroundColor = 'rgba(44, 37, 35, 0.06)';
    });
    item.addEventListener('mouseleave', () => {
      item.style.backgroundColor = 'transparent';
    });

    item.addEventListener('click', (e) => {
      e.stopPropagation();
      dropup.style.display = 'none';
      opt.action();
    });

    dropup.appendChild(item);
  });

  attachBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    emojiPicker.style.display = 'none';
    const isVisible = dropup.style.display === 'block';
    dropup.style.display = isVisible ? 'none' : 'block';
  });

  attachWrapper.appendChild(attachBtn);
  attachWrapper.appendChild(dropup);

  const inputContainer = document.createElement('div');
  inputContainer.style.flex = '1';
  inputContainer.style.display = 'flex';
  inputContainer.style.alignItems = 'center';
  inputContainer.style.position = 'relative';

  // Replaced input with an auto-growing textarea for multi-line support
  const textarea = document.createElement('textarea');
  textarea.placeholder = 'Type a message...';
  textarea.rows = 1;
  textarea.style.width = '100%';
  textarea.style.background = 'transparent';
  textarea.style.border = 'none';
  textarea.style.outline = 'none';
  textarea.style.fontFamily = 'inherit';
  textarea.style.fontSize = '14px';
  textarea.style.lineHeight = '20px';
  textarea.style.color = 'var(--text-espresso)';
  textarea.style.padding = '8px 4px';
  textarea.style.resize = 'none';
  textarea.style.overflowY = 'hidden';
  textarea.style.maxHeight = '120px';

  textarea.addEventListener('input', () => {
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    if (textarea.scrollHeight > 120) {
      textarea.style.overflowY = 'auto';
    } else {
      textarea.style.overflowY = 'hidden';
    }
  });

  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      composer.requestSubmit();
    }
  });

  inputContainer.appendChild(textarea);

  const emojiWrapper = document.createElement('div');
  emojiWrapper.style.position = 'relative';
  emojiWrapper.style.display = 'flex';
  emojiWrapper.style.alignItems = 'center';
  emojiWrapper.style.height = '36px';

  const emojiBtn = document.createElement('button');
  emojiBtn.type = 'button';
  emojiBtn.innerHTML = icons.emoji;
  styleButton(emojiBtn, '9999px');
  emojiBtn.title = 'Add Emoji';

  const emojiPicker = document.createElement('div');
  emojiPicker.className = 'emoji-picker';
  emojiPicker.style.display = 'none';
  emojiPicker.style.position = 'absolute';
  emojiPicker.style.bottom = '52px';
  emojiPicker.style.right = '0';
  emojiPicker.style.width = '220px';
  emojiPicker.style.backgroundColor = 'var(--surface-sand)';
  emojiPicker.style.border = '1px solid rgba(44, 37, 35, 0.08)';
  emojiPicker.style.borderRadius = '12px';
  emojiPicker.style.boxShadow = '0 -4px 20px rgba(44, 37, 35, 0.08)';
  emojiPicker.style.zIndex = '100';
  emojiPicker.style.padding = '10px';
  emojiPicker.style.displayGrid = 'grid';
  emojiPicker.style.gridTemplateColumns = 'repeat(5, 1fr)';
  emojiPicker.style.gap = '6px';

  const emojis = ['😊', '😂', '❤️', '👍', '🔥', '✨', '🙌', '😍', '😎', '🙏', '🎉', '💡', '☕', '🌿', '💬'];
  emojis.forEach(emo => {
    const emoItem = document.createElement('button');
    emoItem.type = 'button';
    emoItem.textContent = emo;
    emoItem.style.background = 'transparent';
    emoItem.style.border = 'none';
    emoItem.style.fontSize = '18px';
    emoItem.style.cursor = 'pointer';
    emoItem.style.padding = '6px';
    emoItem.style.borderRadius = '6px';
    emoItem.style.transition = 'background 0.2s ease';

    emoItem.addEventListener('mouseenter', () => {
      emoItem.style.backgroundColor = 'rgba(44, 37, 35, 0.06)';
    });
    emoItem.addEventListener('mouseleave', () => {
      emoItem.style.backgroundColor = 'transparent';
    });

    emoItem.addEventListener('click', (e) => {
      e.stopPropagation();
      textarea.value += emo;
      textarea.focus();
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    });

    emojiPicker.appendChild(emoItem);
  });

  emojiBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    dropup.style.display = 'none';
    const isVisible = emojiPicker.style.display === 'grid';
    emojiPicker.style.display = isVisible ? 'none' : 'grid';
  });

  emojiWrapper.appendChild(emojiBtn);
  emojiWrapper.appendChild(emojiPicker);

  document.addEventListener('click', () => {
    dropup.style.display = 'none';
    emojiPicker.style.display = 'none';
  });

  let isRecording = false;
  let recordingTimer = null;
  let secondsCount = 0;

  const micWrapper = document.createElement('div');
  micWrapper.style.display = 'flex';
  micWrapper.style.alignItems = 'center';
  micWrapper.style.height = '36px';

  const micBtn = document.createElement('button');
  micBtn.type = 'button';
  micBtn.innerHTML = icons.mic;
  styleButton(micBtn, '9999px');
  micBtn.title = 'Record Voice Note';

  micBtn.addEventListener('click', () => {
    isRecording = !isRecording;
    if (isRecording) {
      micBtn.style.color = '#C94A4A';
      micBtn.style.backgroundColor = 'rgba(201, 74, 74, 0.08)';
      textarea.value = 'Recording voice note (0:00)...';
      textarea.disabled = true;
      secondsCount = 0;

      recordingTimer = setInterval(() => {
        secondsCount++;
        const mins = Math.floor(secondsCount / 60);
        const secs = secondsCount % 60;
        textarea.value = `Recording voice note (${mins}:${secs < 10 ? '0' : ''}${secs})...`;
      }, 1000);
    } else {
      stopRecording();
      store.sendMessage('[Voice Note]');
    }
  });

  function stopRecording() {
    clearInterval(recordingTimer);
    isRecording = false;
    micBtn.style.color = 'var(--text-espresso)';
    micBtn.style.backgroundColor = 'transparent';
    textarea.value = '';
    textarea.disabled = false;
    textarea.style.height = 'auto';
  }

  micWrapper.appendChild(micBtn);

  const sendWrapper = document.createElement('div');
  sendWrapper.style.display = 'flex';
  sendWrapper.style.alignItems = 'center';
  sendWrapper.style.height = '36px';

  const sendBtn = document.createElement('button');
  sendBtn.type = 'submit';
  sendBtn.innerHTML = icons.send;
  styleButton(sendBtn, '9999px');
  sendBtn.style.backgroundColor = 'var(--accent-sage)';
  sendBtn.style.color = '#FFFFFF';

  sendWrapper.appendChild(sendBtn);

  composer.addEventListener('submit', (e) => {
    e.preventDefault();
    if (isRecording) {
      stopRecording();
      store.sendMessage('[Voice Note]');
      return;
    }
    const text = textarea.value.trim();
    if (text === '') return;
    store.sendMessage(text);
    textarea.value = '';
    textarea.style.height = 'auto';
    textarea.style.overflowY = 'hidden';
  });

  composer.appendChild(attachWrapper);
  composer.appendChild(inputContainer);
  composer.appendChild(emojiWrapper);
  composer.appendChild(micWrapper);
  composer.appendChild(sendWrapper);
  container.appendChild(composer);

  return container;
}

function styleButton(btn, radius) {
  btn.style.width = '36px';
  btn.style.height = '36px';
  btn.style.minWidth = '36px';
  btn.style.borderRadius = radius;
  btn.style.border = 'none';
  btn.style.background = 'transparent';
  btn.style.color = 'var(--text-espresso)';
  btn.style.cursor = 'pointer';
  btn.style.display = 'flex';
  btn.style.alignItems = 'center';
  btn.style.justifyContent = 'center';
  btn.style.transition = 'background 0.2s ease, color 0.2s ease';

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

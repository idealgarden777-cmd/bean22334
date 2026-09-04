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
  composer.style.alignItems = 'flex-end';
  composer.style.backgroundColor = 'var(--surface-sand)';
  composer.style.borderRadius = '28px';
  composer.style.padding = '8px';
  composer.style.gap = '8px';
  composer.style.border = '1px solid rgba(44, 37, 35, 0.08)';
  composer.style.position = 'relative';

  const attachWrapper = document.createElement('div');
  attachWrapper.style.position = 'relative';
  attachWrapper.style.display = 'flex';

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

    item.addEventListener('click', e => {
      e.stopPropagation();
      dropup.style.display = 'none';
      opt.action();
    });

    dropup.appendChild(item);
  });

  const inputContainer = document.createElement('div');
  inputContainer.style.flex = '1';
  inputContainer.style.display = 'flex';
  inputContainer.style.alignItems = 'flex-end';
  inputContainer.style.position = 'relative';

  const input = document.createElement('textarea');
  input.rows = 1;
  input.placeholder = 'Type a message...';
  input.style.width = '100%';
  input.style.minHeight = '36px';
  input.style.maxHeight = '160px';
  input.style.background = 'transparent';
  input.style.border = 'none';
  input.style.outline = 'none';
  input.style.resize = 'none';
  input.style.overflowY = 'hidden';
  input.style.boxSizing = 'border-box';
  input.style.fontFamily = 'inherit';
  input.style.fontSize = '14px';
  input.style.lineHeight = '20px';
  input.style.color = 'var(--text-espresso)';
  input.style.padding = '8px';

  function autoGrow() {
    input.style.height = 'auto';

    const maxHeight = 160;
    const height = Math.min(input.scrollHeight, maxHeight);

    input.style.height = `${height}px`;
    input.style.overflowY = input.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }

  input.addEventListener('input', autoGrow);

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      composer.requestSubmit();
    }
  });

  inputContainer.appendChild(input);

  const emojiWrapper = document.createElement('div');
  emojiWrapper.style.position = 'relative';
  emojiWrapper.style.display = 'flex';

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

  const emojis = [
    '😊', '😂', '❤️', '👍', '🔥',
    '✨', '🙌', '😍', '😎', '🙏',
    '🎉', '💡', '☕', '🌿', '💬'
  ];

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

    emoItem.addEventListener('click', e => {
      e.stopPropagation();
      input.value += emo;
      input.focus();
      autoGrow();
    });

    emojiPicker.appendChild(emoItem);
  });

  attachBtn.addEventListener('click', e => {
    e.stopPropagation();
    emojiPicker.style.display = 'none';

    dropup.style.display =
      dropup.style.display === 'block' ? 'none' : 'block';
  });

  emojiBtn.addEventListener('click', e => {
    e.stopPropagation();
    dropup.style.display = 'none';

    emojiPicker.style.display =
      emojiPicker.style.display === 'grid' ? 'none' : 'grid';
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
      input.value = 'Recording voice note (0:00)...';
      input.disabled = true;
      secondsCount = 0;
      autoGrow();

      recordingTimer = setInterval(() => {
        secondsCount++;

        const mins = Math.floor(secondsCount / 60);
        const secs = secondsCount % 60;

        input.value =
          `Recording voice note (${mins}:${secs < 10 ? '0' : ''}${secs})...`;
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

    input.value = '';
    input.disabled = false;
    input.style.height = '36px';
    input.style.overflowY = 'hidden';
  }

  const sendBtn = document.createElement('button');
  sendBtn.type = 'submit';
  sendBtn.innerHTML = icons.send;
  styleButton(sendBtn, '9999px');
  sendBtn.style.backgroundColor = 'var(--accent-sage)';
  sendBtn.style.color = '#FFFFFF';

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
    input.focus();
  });

  composer.appendChild(attachWrapper);
  composer.appendChild(inputContainer);
  composer.appendChild(emojiWrapper);
  composer.appendChild(micBtn);
  composer.appendChild(sendBtn);

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
    if (
      btn.style.backgroundColor !== 'var(--accent-sage)' &&
      !btn.style.color.includes('201')
    ) {
      btn.style.backgroundColor = 'rgba(44, 37, 35, 0.06)';
    }
  });

  btn.addEventListener('mouseleave', () => {
    if (
      btn.style.backgroundColor !== 'var(--accent-sage)' &&
      !btn.style.color.includes('201')
    ) {
      btn.style.backgroundColor = 'transparent';
    }
  });
}

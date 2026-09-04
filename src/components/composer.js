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
  composer.style.flexDirection = 'row';
  composer.style.alignItems = 'center';
  composer.style.backgroundColor = 'var(--surface-sand)';
  composer.style.borderRadius = '9999px';
  composer.style.padding = '8px';
  composer.style.gap = '8px';
  composer.style.border = '1px solid rgba(44, 37, 35, 0.08)';
  composer.style.position = 'relative';
  composer.style.boxSizing = 'border-box';

  /* --------------------------------------------------------------- *
   * Input
   * --------------------------------------------------------------- */

  const inputContainer = document.createElement('div');
  inputContainer.style.flex = '1';
  inputContainer.style.minWidth = '0';
  inputContainer.style.width = '100%';
  inputContainer.style.position = 'relative';

  const input = document.createElement('textarea');
  input.rows = 1;
  input.placeholder = 'Type a message...';

  input.style.display = 'block';
  input.style.width = '100%';
  input.style.height = '36px';
  input.style.minHeight = '36px';
  input.style.maxHeight = '160px';
  input.style.background = 'transparent';
  input.style.border = 'none';
  input.style.outline = 'none';
  input.style.fontFamily = 'inherit';
  input.style.fontSize = '14px';
  input.style.lineHeight = '20px';
  input.style.color = 'var(--text-espresso)';
  input.style.padding = '8px 2px 8px 8px';
  input.style.margin = '0';
  input.style.resize = 'none';
  input.style.overflowY = 'hidden';
  input.style.overflowX = 'hidden';
  input.style.scrollbarGutter = 'stable';
  input.style.boxSizing = 'border-box';

  inputContainer.appendChild(input);

  /* --------------------------------------------------------------- *
   * Toolbar
   * --------------------------------------------------------------- */

  const toolbar = document.createElement('div');
  toolbar.style.display = 'flex';
  toolbar.style.alignItems = 'center';
  toolbar.style.justifyContent = 'space-between';
  toolbar.style.flexShrink = '0';
  toolbar.style.gap = '4px';

  const leftTools = document.createElement('div');
  leftTools.style.display = 'flex';
  leftTools.style.alignItems = 'center';

  const rightTools = document.createElement('div');
  rightTools.style.display = 'flex';
  rightTools.style.alignItems = 'center';
  rightTools.style.gap = '2px';

  /* --------------------------------------------------------------- *
   * Attachment
   * --------------------------------------------------------------- */

  const attachWrapper = document.createElement('div');
  attachWrapper.style.position = 'relative';
  attachWrapper.style.display = 'flex';
  attachWrapper.style.flexShrink = '0';

  const attachBtn = document.createElement('button');
  attachBtn.type = 'button';
  attachBtn.innerHTML = icons.plus;
  styleButton(attachBtn);
  attachBtn.title = 'Attach';

  const dropup = document.createElement('div');
  dropup.className = 'composer-dropup';
  dropup.style.display = 'none';
  dropup.style.position = 'absolute';
  dropup.style.bottom = '44px';
  dropup.style.left = '0';
  dropup.style.width = '180px';
  dropup.style.backgroundColor = 'var(--surface-sand)';
  dropup.style.border = '1px solid rgba(44, 37, 35, 0.08)';
  dropup.style.borderRadius = '12px';
  dropup.style.boxShadow = '0 -4px 20px rgba(44, 37, 35, 0.08)';
  dropup.style.zIndex = '100';
  dropup.style.padding = '6px';
  dropup.style.boxSizing = 'border-box';

  const dropupOptions = [
    {
      label: 'Photos & Videos',
      action: () => store.sendMessage('[Photo Attachment]')
    },
    {
      label: 'Document',
      action: () => store.sendMessage('[Document Attachment]')
    },
    {
      label: 'Audio File',
      action: () => store.sendMessage('[Audio Attachment]')
    }
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

  attachWrapper.appendChild(attachBtn);
  attachWrapper.appendChild(dropup);

  /* --------------------------------------------------------------- *
   * Emoji
   * --------------------------------------------------------------- */

  const emojiWrapper = document.createElement('div');
  emojiWrapper.style.position = 'relative';
  emojiWrapper.style.display = 'flex';
  emojiWrapper.style.flexShrink = '0';

  const emojiBtn = document.createElement('button');
  emojiBtn.type = 'button';
  emojiBtn.innerHTML = icons.emoji;
  styleButton(emojiBtn);
  emojiBtn.title = 'Add Emoji';

  const emojiPicker = document.createElement('div');
  emojiPicker.className = 'emoji-picker';
  emojiPicker.style.display = 'none';
  emojiPicker.style.position = 'absolute';
  emojiPicker.style.bottom = '44px';
  emojiPicker.style.right = '0';
  emojiPicker.style.width = '220px';
  emojiPicker.style.backgroundColor = 'var(--surface-sand)';
  emojiPicker.style.border = '1px solid rgba(44, 37, 35, 0.08)';
  emojiPicker.style.borderRadius = '12px';
  emojiPicker.style.boxShadow = '0 -4px 20px rgba(44, 37, 35, 0.08)';
  emojiPicker.style.zIndex = '100';
  emojiPicker.style.padding = '10px';
  emojiPicker.style.gridTemplateColumns = 'repeat(5, 1fr)';
  emojiPicker.style.gap = '6px';
  emojiPicker.style.boxSizing = 'border-box';

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
    emoItem.style.transition = 'background 0.2s ease';

    emoItem.addEventListener('mouseenter', () => {
      emoItem.style.backgroundColor = 'rgba(44, 37, 35, 0.06)';
    });

    emoItem.addEventListener('mouseleave', () => {
      emoItem.style.backgroundColor = 'transparent';
    });

    emoItem.addEventListener('click', e => {
      e.stopPropagation();

      const start = input.selectionStart;
      const end = input.selectionEnd;

      input.value =
        input.value.slice(0, start) +
        emo +
        input.value.slice(end);

      input.selectionStart = input.selectionEnd = start + emo.length;

      input.focus();
      updateLayout();
    });

    emojiPicker.appendChild(emoItem);
  });

  emojiWrapper.appendChild(emojiBtn);
  emojiWrapper.appendChild(emojiPicker);

  /* --------------------------------------------------------------- *
   * Mic
   * --------------------------------------------------------------- */

  let isRecording = false;
  let recordingTimer = null;
  let secondsCount = 0;

  const micBtn = document.createElement('button');
  micBtn.type = 'button';
  micBtn.innerHTML = icons.mic;
  styleButton(micBtn);
  micBtn.title = 'Record Voice Note';

  function stopRecording() {
    clearInterval(recordingTimer);
    recordingTimer = null;
    isRecording = false;

    micBtn.style.color = 'var(--text-espresso)';
    micBtn.style.backgroundColor = 'transparent';

    input.value = '';
    input.disabled = false;

    updateLayout();
    input.focus();
  }

  micBtn.addEventListener('click', () => {
    if (isRecording) {
      stopRecording();
      store.sendMessage('[Voice Note]');
      return;
    }

    isRecording = true;
    secondsCount = 0;

    micBtn.style.color = '#C94A4A';
    micBtn.style.backgroundColor = 'rgba(201, 74, 74, 0.08)';

    input.value = 'Recording voice note (0:00)...';
    input.disabled = true;

    updateLayout();

    recordingTimer = setInterval(() => {
      secondsCount++;

      const mins = Math.floor(secondsCount / 60);
      const secs = secondsCount % 60;

      input.value =
        `Recording voice note (${mins}:${secs < 10 ? '0' : ''}${secs})...`;

      updateLayout();
    }, 1000);
  });

  /* --------------------------------------------------------------- *
   * Send
   * --------------------------------------------------------------- */

  const sendBtn = document.createElement('button');
  sendBtn.type = 'submit';
  sendBtn.innerHTML = icons.send;
  styleButton(sendBtn);
  sendBtn.style.backgroundColor = 'var(--accent-sage)';
  sendBtn.style.color = '#FFFFFF';
  sendBtn.title = 'Send';

  /* --------------------------------------------------------------- *
   * Toolbar Layout
   * --------------------------------------------------------------- */

  leftTools.appendChild(attachWrapper);

  rightTools.appendChild(emojiWrapper);
  rightTools.appendChild(micBtn);
  rightTools.appendChild(sendBtn);

  toolbar.appendChild(leftTools);
  toolbar.appendChild(rightTools);

  /* --------------------------------------------------------------- *
   * Composer
   * --------------------------------------------------------------- */

  composer.appendChild(attachWrapper);
  composer.appendChild(inputContainer);
  composer.appendChild(toolbar);

  /*
   * The toolbar already contains attachWrapper visually.
   * Move only the reference into the correct layout without recreating
   * the element. This keeps the + button alive in every state.
   */
  toolbar.removeChild(leftTools);
  toolbar.insertBefore(leftTools, toolbar.firstChild);

  /* --------------------------------------------------------------- *
   * Layout Update
   * --------------------------------------------------------------- */

  function updateLayout() {
    const maxHeight = 160;

    input.style.height = 'auto';

    const contentHeight = input.scrollHeight;
    const height = Math.min(contentHeight, maxHeight);

    input.style.height = `${height}px`;

    const hasText = input.value.trim().length > 0;
    const multiline = contentHeight > 36;

    if (!hasText && !multiline && !isRecording) {
      composer.style.flexDirection = 'row';
      composer.style.alignItems = 'center';
      composer.style.borderRadius = '9999px';
      composer.style.gap = '8px';

      inputContainer.style.flex = '1';
      inputContainer.style.width = '100%';

      toolbar.style.width = 'auto';
      toolbar.style.height = '36px';
      toolbar.style.marginTop = '0';

      leftTools.style.display = 'flex';
      rightTools.style.display = 'flex';

      input.style.overflowY = 'hidden';

      if (!composer.contains(attachWrapper)) {
        composer.insertBefore(attachWrapper, inputContainer);
      }

      return;
    }

    composer.style.flexDirection = 'column';
    composer.style.alignItems = 'stretch';
    composer.style.borderRadius = '22px';
    composer.style.gap = '4px';

    inputContainer.style.flex = 'none';
    inputContainer.style.width = '100%';

    toolbar.style.width = '100%';
    toolbar.style.height = '36px';
    toolbar.style.marginTop = '0';

    input.style.overflowY =
      contentHeight > maxHeight ? 'auto' : 'hidden';

    if (contentHeight > maxHeight) {
      input.scrollTop = input.scrollHeight;
    }
  }

  /* --------------------------------------------------------------- *
   * Input Events
   * --------------------------------------------------------------- */

  input.addEventListener('input', updateLayout);

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      composer.requestSubmit();
    }
  });

  /* --------------------------------------------------------------- *
   * Menu Events
   * --------------------------------------------------------------- */

  attachBtn.addEventListener('click', e => {
    e.stopPropagation();

    emojiPicker.style.display = 'none';

    const visible = dropup.style.display === 'block';

    dropup.style.display = visible ? 'none' : 'block';
  });

  emojiBtn.addEventListener('click', e => {
    e.stopPropagation();

    dropup.style.display = 'none';

    const visible = emojiPicker.style.display === 'grid';

    emojiPicker.style.display = visible ? 'none' : 'grid';
  });

  document.addEventListener('click', () => {
    dropup.style.display = 'none';
    emojiPicker.style.display = 'none';
  });

  /* --------------------------------------------------------------- *
   * Submit
   * --------------------------------------------------------------- */

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

    updateLayout();

    input.focus();
  });

  container.appendChild(composer);

  updateLayout();

  return container;
}

function styleButton(btn) {
  btn.style.width = '36px';
  btn.style.height = '36px';
  btn.style.minWidth = '36px';
  btn.style.borderRadius = '9999px';
  btn.style.border = 'none';
  btn.style.background = 'transparent';
  btn.style.color = 'var(--text-espresso)';
  btn.style.cursor = 'pointer';
  btn.style.display = 'flex';
  btn.style.alignItems = 'center';
  btn.style.justifyContent = 'center';
  btn.style.padding = '0';
  btn.style.flexShrink = '0';
  btn.style.boxSizing = 'border-box';
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

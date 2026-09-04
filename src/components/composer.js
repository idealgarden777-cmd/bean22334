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
  composer.style.alignItems = 'center';
  composer.style.backgroundColor = 'var(--surface-sand)';
  composer.style.borderRadius = '9999px';
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

  // Functional Dropup Menu
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
    { label: 'Photos & Videos', action: () => simulateAttachment('photo') },
    { label: 'Document', action: () => simulateAttachment('document') },
    { label: 'Audio File', action: () => simulateAttachment('audio') }
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
    const isVisible = dropup.style.display === 'block';
    dropup.style.display = isVisible ? 'none' : 'block';
  });

  document.addEventListener('click', () => {
    dropup.style.display = 'none';
  });

  attachWrapper.appendChild(attachBtn);
  attachWrapper.appendChild(dropup);

  const inputContainer = document.createElement('div');
  inputContainer.style.flex = '1';
  inputContainer.style.display = 'flex';
  inputContainer.style.alignItems = 'center';
  inputContainer.style.position = 'relative';

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Type a message...';
  input.style.width = '100%';
  input.style.background = 'transparent';
  input.style.border = 'none';
  input.style.outline = 'none';
  input.style.fontFamily = 'inherit';
  input.style.fontSize = '14px';
  input.style.color = 'var(--text-espresso)';
  input.style.padding = '0 8px';

  inputContainer.appendChild(input);

  // Functional Microphone / Voice Recording State
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
      micBtn.style.color = '#C94A4A'; // Active red recording color indicator
      micBtn.style.backgroundColor = 'rgba(201, 74, 74, 0.08)';
      input.value = 'Recording voice note (0:00)...';
      input.disabled = true;
      secondsCount = 0;

      recordingTimer = setInterval(() => {
        secondsCount++;
        const mins = Math.floor(secondsCount / 60);
        const secs = secondsCount % 60;
        input.value = `Recording voice note (${mins}:${secs < 10 ? '0' : ''}${secs})...`;
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
  }

  function simulateAttachment(type) {
    const labels = {
      photo: '[Photo Attachment]',
      document: '[Document Attachment]',
      audio: '[Audio Attachment]'
    };
    store.sendMessage(labels[type] || '[Attachment]');
  }

  const sendBtn = document.createElement('button');
  sendBtn.type = 'submit';
  sendBtn.innerHTML = icons.send;
  styleButton(sendBtn, '9999px');
  sendBtn.style.backgroundColor = 'var(--accent-sage)';
  sendBtn.style.color = '#FFFFFF';

  composer.addEventListener('submit', (e) => {
    e.preventDefault();
    if (isRecording) {
      stopRecording();
      store.sendMessage('[Voice Note]');
      return;
    }
    const text = input.value.trim();
    if (text === '') return;
    store.sendMessage(text);
    input.value = '';
  });

  composer.appendChild(attachWrapper);
  composer.appendChild(inputContainer);
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

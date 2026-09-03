"use strict";

const app = document.getElementById("app");

if (!app) {
  throw new Error("Bean: app root not found.");
}

function initApp() {
  app.innerHTML = `
    <main class="bean-app">
      <div id="bean-root"></div>
    </main>
  `;
}

initApp();

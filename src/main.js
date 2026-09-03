/*
=========================================================
BEAN — MAIN ENTRY
=========================================================

Frontend prototype only.

Backend, authentication, Supabase, realtime,
messaging logic, NEYO and Ghost will be added later.
=========================================================
*/

"use strict";

const app = document.getElementById("app");

if (!app) {
  throw new Error("Bean: #app element not found.");
}

/*
=========================================================
APP START
=========================================================
*/

function startApp() {
  app.innerHTML = `
    <div class="bean-app">
      <!-- Bean frontend will render here -->
    </div>
  `;
}

startApp();


"use strict";

const stockSW = "/scramjet/sw.js";
const stockSWScope = "/scramjet/";
const swAllowedHostnames = ["localhost", "127.0.0.1"];

async function registerSW() {
  if (!("serviceWorker" in navigator)) {
    if (location.protocol !== "https:" && !swAllowedHostnames.includes(location.hostname)) {
      throw new Error("Service workers cannot be registered without https.");
    }
    throw new Error("Your browser does not support service workers.");
  }

  return navigator.serviceWorker.register(stockSW, { scope: stockSWScope });
}

window.registerSW = registerSW;

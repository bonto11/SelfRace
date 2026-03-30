"use client";

import { useState } from "react";
import * as idbKeyval from "idb-keyval";

export default function DebugPage() {
  const [results, setResults] = useState({
    localStorage: "Ešte nenačítané",
    sessionStorage: "Ešte nenačítané",
    cookie: "Ešte nenačítané",
    indexedDB: "Ešte nenačítané",
  });

  const [savedTime, setSavedTime] = useState<string | null>(null);

  const writeData = async () => {
    const timestamp = new Date().toLocaleTimeString();
    const testValue = `Prežilo z: ${timestamp}`;

    // 1. LocalStorage
    window.localStorage.setItem("debug_ls", testValue);

    // 2. SessionStorage
    window.sessionStorage.setItem("debug_ss", testValue);

    // 3. JS Cookie (Platnosť 1 rok)
    const d = new Date();
    d.setTime(d.getTime() + 365 * 24 * 60 * 60 * 1000);
    document.cookie = `debug_cookie=${encodeURIComponent(testValue)};expires=${d.toUTCString()};path=/;SameSite=Lax`;

    // 4. IndexedDB
    try {
      await idbKeyval.set("debug_idb", testValue);
    } catch (e) {
      console.error("IndexedDB chyba:", e);
    }

    setSavedTime(timestamp);
    alert(`Dáta zapísané o ${timestamp}. Teraz vyswajpni apku a vráť sa sem!`);
  };

  const readData = async () => {
    // 1. LocalStorage
    const ls = window.localStorage.getItem("debug_ls") || "❌ ZMAZANÉ";

    // 2. SessionStorage
    const ss = window.sessionStorage.getItem("debug_ss") || "❌ ZMAZANÉ";

    // 3. JS Cookie
    const cookieMatch = document.cookie.match(new RegExp("(^| )debug_cookie=([^;]+)"));
    const cookie = cookieMatch ? decodeURIComponent(cookieMatch[2]) : "❌ ZMAZANÉ";

    // 4. IndexedDB
    let idb = "❌ ZMAZANÉ";
    try {
      const dbVal = await idbKeyval.get<string>("debug_idb");
      if (dbVal) idb = dbVal;
    } catch (e) {
      idb = "⚠️ CHYBA ČÍTANIA";
    }

    setResults({
      localStorage: ls,
      sessionStorage: ss,
      cookie: cookie,
      indexedDB: idb,
    });
  };

  return (
    <div className="p-8 max-w-md mx-auto text-white">
      <h1 className="text-2xl font-bold mb-4">PWA Storage Diagnostika</h1>
      <p className="mb-6 text-sm text-gray-400">
        Zistime, čo Apple naozaj maže po vyswajpnutí.
      </p>

      <div className="flex gap-4 mb-8">
        <button onClick={writeData} className="bg-blue-600 px-4 py-2 rounded font-bold">
          1. Zapísať dáta
        </button>
        <button onClick={readData} className="bg-green-600 px-4 py-2 rounded font-bold">
          2. Načítať dáta
        </button>
      </div>

      {savedTime && <p className="mb-4 text-sm text-blue-300">Naposledy zapísané: {savedTime}</p>}

      <div className="space-y-4 bg-gray-900 p-4 rounded-lg font-mono text-sm border border-gray-700">
        <div>
          <span className="text-gray-500">LocalStorage:</span>
          <p className={results.localStorage.includes("❌") ? "text-red-500" : "text-green-400"}>
            {results.localStorage}
          </p>
        </div>
        <div>
          <span className="text-gray-500">SessionStorage:</span>
          <p className={results.sessionStorage.includes("❌") ? "text-red-500" : "text-green-400"}>
            {results.sessionStorage}
          </p>
        </div>
        <div>
          <span className="text-gray-500">JS Cookie:</span>
          <p className={results.cookie.includes("❌") ? "text-red-500" : "text-green-400"}>
            {results.cookie}
          </p>
        </div>
        <div>
          <span className="text-gray-500">IndexedDB:</span>
          <p className={results.indexedDB.includes("❌") ? "text-red-500" : "text-green-400"}>
            {results.indexedDB}
          </p>
        </div>
      </div>
    </div>
  );
}
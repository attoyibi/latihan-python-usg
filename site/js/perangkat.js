// ID perangkat: angka acak yang dibuat sekali per browser dan disimpan di penyimpanan lokal dan sebuah cookie
// (dua tempat supaya tidak mudah hilang). Bukan sidik jari perangkat: tidak membaca perangkat keras, hanya
// berarti "browser ini" bagi situs ini. Tidak terkait akun; dicatat di database tiap kali ada yang masuk, sehingga
// instruktur bisa melihat akun mana saja yang pernah dipakai dari browser yang sama.
const KUNCI = "latihan:perangkat";
const COOKIE = "lp_perangkat";

function acak() {
  const b = new Uint8Array(12);
  (globalThis.crypto || window.crypto).getRandomValues(b);
  return "dev-" + Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

const sah = (x) => typeof x === "string" && /^dev-[0-9a-f]{24}$/.test(x);

function bacaCookie() {
  try {
    const m = new RegExp("(?:^|; )" + COOKIE + "=([^;]*)").exec(document.cookie || "");
    return m ? decodeURIComponent(m[1]) : null;
  } catch (e) {
    return null;
  }
}

function tulis(id) {
  try {
    localStorage.setItem(KUNCI, id);
  } catch (e) {}
  try {
    document.cookie = COOKIE + "=" + encodeURIComponent(id) + "; max-age=31536000; path=/; SameSite=Lax";
  } catch (e) {}
}

export function idPerangkat() {
  let id = null;
  try {
    id = localStorage.getItem(KUNCI);
  } catch (e) {}
  if (!sah(id)) id = bacaCookie();
  if (!sah(id)) id = acak();
  tulis(id); // pulihkan salah satu tempat yang hilang
  return id;
}

// Ringkasan jenis browser dan sistem (tanpa versi rinci), cukup untuk membedakan "Chrome di Windows" dari "Safari di iPhone".
export function agenRingkas(ua = typeof navigator !== "undefined" ? navigator.userAgent : "") {
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\/|Opera/.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Browser lain";
  const os = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad|iPod/.test(ua) ? "iOS" : /Mac OS X|Macintosh/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "sistem lain";
  return browser + " di " + os + (/Mobile|Android|iPhone/.test(ua) ? " (ponsel)" : "");
}

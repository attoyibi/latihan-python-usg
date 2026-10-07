// Inti pencatat sesi belajar (tanpa DOM dan tanpa jaringan sendiri; jam dan pengirim disuntikkan) supaya bisa diuji dengan node.
// Dipakai oleh sesi.js. Lihat sesi.js untuk aturan lengkap tentang apa yang dicatat.
export const IDLE_MS = 90 * 1000;
export const DENYUT_MS = 30 * 1000;
export const SESI_BARU_MS = 30 * 60 * 1000;
const TIK_MAKS_MS = 10 * 1000; // satu tik tidak dihitung lebih dari ini (menghindari lonjakan setelah perangkat tidur)
const SISA_MAKS = 600;

export class Pencatat {
  /**
   * @param {{sekarang?:()=>number, kirim:(p:{sesi:string,mk:string,bab:number|null,tambah:number})=>Promise<boolean>, idBaru:()=>string, idle?:number, jeda?:number, sesiBaru?:number, simpan?:{ambil:()=>any, tulis:(v:any)=>void}}} o
   */
  constructor(o) {
    this.sekarang = o.sekarang || Date.now;
    this.kirim = o.kirim;
    this.idBaru = o.idBaru;
    this.idle = o.idle || IDLE_MS;
    this.jeda = o.jeda || DENYUT_MS;
    this.sesiBaru = o.sesiBaru || SESI_BARU_MS;
    this.simpan = o.simpan || null;
    this.mk = null;
    this.bab = null;
    this.sesi = null;
    this.terakhirKetuk = 0;
    this.terakhirTik = this.sekarang();
    this.terakhirKirim = 0;
    this.sisa = 0; // detik aktif yang belum terkirim
    this.mengirim = false;
    this.perluKirim = true; // ada yang perlu dikirim walau tanpa waktu aktif (sesi baru atau bab berpindah)
    const lama = this.simpan && this.simpan.ambil();
    if (lama && lama.id && this.sekarang() - lama.terakhir < this.sesiBaru) {
      this.sesi = lama.id;
      this.terakhirKetuk = lama.terakhir;
      this.perluKirim = false;
    }
  }
  _catat() {
    if (this.simpan && this.sesi) this.simpan.tulis({ id: this.sesi, terakhir: this.terakhirKetuk || this.sekarang() });
  }
  _pastikanSesi() {
    const t = this.sekarang();
    if (!this.sesi || (this.terakhirKetuk && t - this.terakhirKetuk > this.sesiBaru)) {
      this.sesi = this.idBaru();
      this.perluKirim = true;
      this.sisa = 0;
    }
  }
  /** Dipanggil saat peserta berpindah mata kuliah atau bab. */
  konteks(mk, bab) {
    const berubah = mk !== this.mk || bab !== this.bab;
    this.mk = mk;
    this.bab = bab;
    this._pastikanSesi();
    this.terakhirKetuk = this.sekarang();
    this._catat();
    if (berubah) {
      this.terakhirKirim = 0; // kirim secepatnya agar bab baru tercatat
      this.perluKirim = true;
    }
  }
  /** Dipanggil tiap ada gerakan pengguna. */
  ketuk() {
    const t = this.sekarang();
    if (this.terakhirKetuk && t - this.terakhirKetuk > this.sesiBaru) this._pastikanSesi();
    this.terakhirKetuk = t;
  }
  /** Dipanggil berkala (mis. tiap 5 detik); menambah waktu aktif bila tab terlihat dan pengguna baru bergerak. */
  tik(terlihat) {
    const t = this.sekarang();
    const dt = Math.min(t - this.terakhirTik, TIK_MAKS_MS);
    this.terakhirTik = t;
    if (!terlihat || !this.mk || dt <= 0) return;
    if (t - this.terakhirKetuk <= this.idle) this.sisa = Math.min(SISA_MAKS, this.sisa + dt / 1000);
  }
  /** Mengirim denyut bila sudah waktunya (atau dipaksa). Mengembalikan true bila terkirim. */
  async denyut(paksa = false) {
    if (this.mengirim || !this.mk) return false;
    const t = this.sekarang();
    if (!paksa && t - this.terakhirKirim < this.jeda) return false;
    this._pastikanSesi();
    const tambah = Math.floor(this.sisa);
    if (tambah <= 0 && !this.perluKirim && !paksa) {
      this.terakhirKirim = t;
      return false; // tidak ada yang baru: tidak perlu memanggil server
    }
    this.mengirim = true;
    let ok = false;
    try {
      ok = !!(await this.kirim({ sesi: this.sesi, mk: this.mk, bab: this.bab, tambah }));
    } catch (e) {
      ok = false;
    }
    this.mengirim = false;
    if (ok) {
      this.sisa = Math.max(0, this.sisa - tambah);
      this.perluKirim = false;
      this.terakhirKirim = this.sekarang();
      this._catat();
    }
    return ok;
  }
  reset() {
    this.sesi = null;
    this.mk = null;
    this.bab = null;
    this.sisa = 0;
    this.terakhirKetuk = 0;
    this.perluKirim = true;
    if (this.simpan) this.simpan.tulis(null);
  }
}

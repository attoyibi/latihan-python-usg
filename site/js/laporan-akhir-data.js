// Mengumpulkan bahan laporan akhir: dari server (percobaan, progres, laporan bab, berkas dan status praktik, form akhir) dan, untuk
// peserta sendiri, dari penyimpanan browser (yang terbaru di perangkat ini). Dosen memakai data server saja.
// Tabel yang belum ada (mis. migrasi 0008 belum dijalankan) dilewati: laporan tetap bisa dibuat dengan bahan yang ada.
import * as Auth from "./auth.js";
import { ambilSemua } from "./rekap.js";
import { susunPaket, ringkasAkhir, PID_AKHIR } from "./laporan-akhir.js";
import { muatIndeks, muatPraktik, bacaLokal as bacaPraktikLokal, antreLaporanAkhir } from "./praktik-data.js";
import { laporanKosong, gabungkan } from "./laporan.js";

const aman = async (f) => {
  try {
    return await f();
  } catch (e) {
    return [];
  }
};

const kunciAkhir = (mk) => "lapakhir:" + mk;
const kunciDi = (mk, k, n) => k + ":" + mk + ":" + n;

/** Keadaan lokal peserta sendiri untuk satu bab, dalam bentuk yang dipahami susunPaket. */
export function pengakses(store, mk) {
  return {
    latihan: (bab) => {
      const k = store.get(kunciDi(mk, "kirimTerakhir", bab), null);
      const tries = store.get(kunciDi(mk, "tries", bab), 0);
      return { selesai: !!store.get(kunciDi(mk, "done", bab), false), mulai: !!store.get(kunciDi(mk, "started", bab), false) || tries > 0, kirim: tries, kode: k && !k.konsep && typeof k.kode === "string" ? k.kode : "", lulus: k ? !!k.lulus : null, kasus_lulus: k ? k.kasus_lulus : null, kasus_total: k ? k.kasus_total : null };
    },
    laporan: (bab) => store.get(kunciDi(mk, "laporan", bab), null),
    praktik: (bab, bagian = "A") => bacaPraktikLokal(store, mk, bab, bagian),
  };
}

/** Ringkasan cepat (tanpa jaringan) dari penyimpanan browser, untuk kartu di halaman mata kuliah. */
export async function ringkasLokal(store, kuliah, profil) {
  const babPraktik = await muatIndeks(kuliah.id, kuliah.praktik === true);
  return ringkasAkhir(susunPaket({ profil, matakuliah: { id: kuliah.id, nama: kuliah.nama }, materi: kuliah.materi, babPraktik, defPraktik: new Map(), progres: [], percobaan: [], laporan: [], berkasPraktik: [], tahapPraktik: [], akhir: { jawaban: bacaAkhirLokal(store, kuliah.id).jawaban, kode: "" }, lokal: pengakses(store, kuliah.id) }));
}

/** Form akhir: gabungan lokal dan server, atau keadaan kosong baru (dengan kode verifikasi). */
export function bacaAkhirLokal(store, mk) {
  return Object.assign(laporanKosong(), store.get(kunciAkhir(mk), null) || {});
}
export function simpanAkhir(store, mk, lap) {
  lap.diperbarui = new Date().toISOString();
  store.set(kunciAkhir(mk), lap);
  antreLaporanAkhir(mk, { jawaban: lap.jawaban, jumlah_ketikan: lap.ketikan, percobaan_tempel: lap.tempel, durasi_menulis_detik: Math.round(lap.durasi), kode_verifikasi: lap.kode, dikumpulkan_pada: lap.diekspor });
}
/** Mengambil form akhir dari server dan menggabungkannya dengan yang lokal. Mengembalikan keadaan gabungan (atau lokal bila gagal). */
export async function susulAkhir(store, mk) {
  const lokal = bacaAkhirLokal(store, mk);
  if (!Auth.enabled() || !Auth.getUserId() || !Auth.getClient()) return lokal;
  const { data, error } = await Auth.getClient().from("praktikum_laporan").select("*").eq("user_id", Auth.getUserId()).eq("matakuliah_id", mk).eq("praktikum_id", PID_AKHIR);
  if (error || !data || !data[0]) return lokal;
  const gab = Object.assign(laporanKosong(), gabungkan(lokal, data[0]));
  store.set(kunciAkhir(mk), gab);
  return gab;
}

/**
 * Paket laporan akhir satu peserta untuk satu mata kuliah.
 * @param {{kuliah:{id,nama,materi}, profil:{nama,nim,kelas}, uid:string, store?:object}} d store diisi bila peserta sendiri.
 */
export async function kumpulkan({ kuliah, profil, uid, store = null }) {
  const c = Auth.getClient();
  const mk = kuliah.id;
  const sel = (tabel, kolom) => aman(() => ambilSemua(() => c.from(tabel).select(kolom).eq("user_id", uid).eq("matakuliah_id", mk).order("bab")));
  const [progres, percobaan, laporan, berkas, tahap, akhirRows] = await Promise.all([
    sel("progres", "bab,status,jumlah_kirim"),
    aman(() => ambilSemua(() => c.from("percobaan").select("bab,lulus,kasus_lulus,kasus_total,kode,dibuat_pada").eq("user_id", uid).eq("matakuliah_id", mk).eq("jenis", "kirim").order("id"))),
    sel("laporan", "bab,jawaban"),
    aman(() => ambilSemua(() => c.from("praktikum_berkas").select("praktikum_id,nama,isi").eq("user_id", uid).eq("matakuliah_id", mk).order("praktikum_id"))),
    aman(() => ambilSemua(() => c.from("praktikum_tahap").select("praktikum_id,tahap_id,status,jumlah_kirim").eq("user_id", uid).eq("matakuliah_id", mk).order("praktikum_id"))),
    aman(() => ambilSemua(() => c.from("praktikum_laporan").select("*").eq("user_id", uid).eq("matakuliah_id", mk).order("praktikum_id"))),
  ]);
  const babPraktik = await muatIndeks(mk, kuliah.praktik === true);
  const defPraktik = new Map();
  for (const b of babPraktik) {
    const def = await muatPraktik(mk, b);
    if (def) defPraktik.set(b, { judul: def.judul, berkas: def.berkas, bagianB: def.bagianB ? { berkas: def.bagianB.berkas } : null });
  }
  const barisAkhir = (akhirRows || []).find((r) => r.praktikum_id === PID_AKHIR) || null;
  let akhir;
  if (store) {
    const lap = barisAkhir ? Object.assign(laporanKosong(), gabungkan(bacaAkhirLokal(store, mk), barisAkhir)) : bacaAkhirLokal(store, mk);
    akhir = { jawaban: lap.jawaban || {}, kode: lap.kode };
  } else akhir = barisAkhir ? { jawaban: barisAkhir.jawaban || {}, kode: barisAkhir.kode_verifikasi } : { jawaban: {}, kode: "" };
  return susunPaket({ profil, matakuliah: { id: mk, nama: kuliah.nama }, materi: kuliah.materi, babPraktik, defPraktik, progres, percobaan, laporan, berkasPraktik: berkas, tahapPraktik: tahap, akhir, lokal: store ? pengakses(store, mk) : null });
}

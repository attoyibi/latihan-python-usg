// Kunci jawaban soal latihan untuk tombol "Isi kunci" khusus instruktur.
// Kunci TIDAK ada di situs: ia disimpan di tabel kunci_jawaban (migrasi 0009) yang hanya bisa dibaca instruktur (aturan keamanan
// database). Memasukkannya: python tools/buat_sql_kunci.py, lalu tempel kunci/kunci_jawaban.sql di Supabase SQL Editor.
import * as Auth from "./auth.js";

export const adalahInstruktur = () => !!Auth.getProfile() && Auth.getProfile().peran === "instruktur";

/** @returns {Promise<{isi:string}|{galat:string}>} */
export async function ambilKunci(mataKuliah, bab) {
  if (!adalahInstruktur()) return { galat: "Khusus instruktur." };
  try {
    const { data, error } = await Auth.getClient().from("kunci_jawaban").select("isi,bahasa").eq("matakuliah_id", mataKuliah).eq("bab", bab).maybeSingle();
    if (error) {
      const tabelHilang = error.code === "42P01" || error.code === "PGRST205" || /does not exist|could not find the table/i.test(String(error.message || ""));
      return { galat: tabelHilang ? "Tabel kunci belum ada. Jalankan supabase/migrations/0009_kunci_jawaban.sql, lalu kunci/kunci_jawaban.sql, di Supabase SQL Editor." : "Gagal membaca kunci: " + (error.message || error.code) };
    }
    if (!data) return { galat: "Kunci bab ini belum dimasukkan. Jalankan kunci/kunci_jawaban.sql (dibuat python tools/buat_sql_kunci.py) di Supabase SQL Editor." };
    return { isi: String(data.isi) };
  } catch (e) {
    return { galat: "Gagal membaca kunci: " + (e.message || e) };
  }
}

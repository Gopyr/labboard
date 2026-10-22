# Lab Board

Dashboard visual untuk laporan benchmark GP-1. Buka file JSON laporan di browser, lihat grafik batangnya, dan bandingkan dua laporan bersebelahan untuk menemukan regresi kinerja. Semuanya jalan di browser, tanpa library chart eksternal, tanpa data yang keluar dari mesin kamu.

## Fitur

- Grafik SVG untuk metrik benchmark: request, throughput, persentil latency
- Perbandingan Report A vs Report B dengan delta otomatis, regresi langsung terlihat
- Export hasil perbandingan ke CSV untuk dokumentasi
- React + Vite + FileReader bawaan browser. Tidak ada dependensi chart.

## Cepat mulai

```bash
npm install
npm run dev
```

## Lisensi

[MIT License](LICENSE)

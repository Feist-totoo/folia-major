// The standalone tool has its own small translation namespace, without booting the player UI.
const en = { title: 'Folium Studio', timeline: 'Timeline', subtitle: 'Preview a standard visualizer mod. Final checks belong in desktop Folia.',
    play: 'Play / pause', reload: 'Reload source', check: 'Check mod', capture: 'Canvas PNG', report: 'Export report',
    normal: 'Phrases', long: 'Long / fast', rtl: 'Multilingual', instrumental: 'Instrumental', landscape: 'Landscape', portrait: 'Portrait',
    light: 'Light / dark', font: 'Lyric size', hide: 'Show / hide lyrics', still: 'Static preview', fixture: 'Import FoliumLine JSON',
    settings: 'Mod settings JSON', apply: 'Apply settings', ready: 'Preview loaded', failed: 'Error:', waiting: 'Loading preview…',
    scope: 'Visual preview only: no host subtitle overlays, accounts, persistence or Node entry. Unsupported APIs show an error.',
    reference: 'Video reference', videoHint: 'Local video stays on your device. Frames are evidence, not recovered source code.', videoImport: 'Choose video',
    videoSample: 'Sample frames', videoExport: 'Export reference ZIP', videoStart: 'Start (s)', videoEnd: 'End (s)', videoNote: 'Observation',
    videoMark: 'Mark current time', videoReady: 'Video ready', referenceRange: 'Choose an interval of 0–60 seconds.',
    videoLimit: 'Choose a video no larger than 250 MiB.', videoDecode: 'Video could not be decoded.', videoDuration: 'Invalid video duration.',
    videoCapture: 'Could not capture this frame.', videoChanged: 'Video changed; retry.', frames: 'frames' };
type Labels = { [K in keyof typeof en]: string };
const zh: Labels = { title: 'Folium 调试器', timeline: '时间轴', subtitle: '预览标准视觉模组，最终在 Folia 桌面版验收。', play: '播放／暂停', reload: '重载源码', check: '检查模组',
    capture: '画布截图', report: '导出报告', normal: '普通乐句', long: '长句／快句', rtl: '多语言', instrumental: '纯音乐', landscape: '横屏', portrait: '竖屏',
    light: '明暗主题', font: '歌词字号', hide: '显示／隐藏歌词', still: '静态预览', fixture: '导入 FoliumLine JSON', settings: '模组设置 JSON', apply: '应用设置',
    ready: '预览已加载', failed: '错误：', waiting: '正在加载预览…', scope: '仅预览视觉部分：不模拟宿主字幕层、账号、持久化或 Node 入口。不支持的接口会明确报错。',
    reference: '视频参考', videoHint: '视频仅在本机读取。抽帧是观察证据，不代表恢复了原程序。', videoImport: '选择视频', videoSample: '抽取参考帧', videoExport: '导出参考 ZIP',
    videoStart: '起点（秒）', videoEnd: '终点（秒）', videoNote: '观察记录', videoMark: '标注当前时刻', videoReady: '视频已就绪', referenceRange: '请选择不超过 60 秒的有效区间。',
    videoLimit: '请选择不超过 250 MiB 的视频。', videoDecode: '视频解码失败。', videoDuration: '视频时长无效。', videoCapture: '截取当前帧失败。', videoChanged: '视频已更换，请重试。', frames: '帧' };
const id: Labels = { title: 'Folium Studio', timeline: 'Linimasa', subtitle: 'Pratinjau mod visual standar. Validasi akhir di Folia desktop.', play: 'Putar / jeda', reload: 'Muat ulang kode', check: 'Periksa mod',
    capture: 'PNG kanvas', report: 'Ekspor laporan', normal: 'Frasa', long: 'Panjang / cepat', rtl: 'Multibahasa', instrumental: 'Instrumental', landscape: 'Lanskap', portrait: 'Potret',
    light: 'Terang / gelap', font: 'Ukuran lirik', hide: 'Tampilkan / sembunyikan lirik', still: 'Pratinjau statis', fixture: 'Impor FoliumLine JSON', settings: 'Pengaturan mod JSON', apply: 'Terapkan',
    ready: 'Pratinjau dimuat', failed: 'Kesalahan:', waiting: 'Memuat pratinjau…', scope: 'Hanya visual: tanpa subtitel host, akun, penyimpanan atau entri Node. API tidak didukung menghasilkan pesan kesalahan.',
    reference: 'Referensi video', videoHint: 'Video tetap di perangkat Anda. Bingkai bukan kode sumber yang dipulihkan.', videoImport: 'Pilih video', videoSample: 'Ambil bingkai', videoExport: 'Ekspor ZIP referensi',
    videoStart: 'Mulai (d)', videoEnd: 'Akhir (d)', videoNote: 'Catatan', videoMark: 'Tandai waktu', videoReady: 'Video siap', referenceRange: 'Pilih interval hingga 60 detik.',
    videoLimit: 'Pilih video maksimal 250 MiB.', videoDecode: 'Dekode video gagal.', videoDuration: 'Durasi video tidak valid.', videoCapture: 'Pengambilan bingkai gagal.', videoChanged: 'Video berubah; coba lagi.', frames: 'bingkai' };
export const labels = navigator.language.startsWith('zh') ? zh : /^(id|in)/.test(navigator.language) ? id : en;
export const t = (key: keyof Labels) => labels[key];


        const productData = {
            "Madu Sarang": ["700gr"],
            "Madu": ["700gr", "300gr"],
            "Lemon": ["500ml", "250ml"],
            "VCO": ["500ml", "250ml"],
            "Garlic": ["500ml", "250ml"],
            "Kunyit Asem": ["1000ml", "250ml"],
            "Beras Kencur": ["1000ml", "250ml"],
        };

        // WILAYAH INDONESIA AUTOCOMPLETE
        let allWilayah = []; // Semua wilayah (kota + kelurahan/desa)

        async function loadWilayahData() {
            try {
                // Langsung load dari file JSON
                const response = await fetch('indonesia-region.min.json');
                const wilayahData = await response.json();
                console.log('✓ Wilayah loaded from JSON file');
                
                // Build flat list of all wilayah
                buildWilayahList(wilayahData);
            } catch (e) {
                console.warn('Gagal load wilayah data:', e);
                // Fallback: gunakan data dasar
                loadBasicWilayahList();
            }
        }
        
        function buildWilayahList(wilayahData) {
            allWilayah = [];
            
            wilayahData.forEach(province => {
                if (province.regencies) {
                    province.regencies.forEach(regency => {
                        // Nama kota/kabupaten
                        const kotaName = regency.name.replace(/^KABUPATEN\s+/i, '').replace(/^KOTA\s+/i, '');
                        
                        // Tambah kota/kabupaten
                        allWilayah.push({
                            name: kotaName,
                            type: 'Kota/Kabupaten',
                            full: `${kotaName}, ${province.name}`
                        });
                        
                        // Tambah kelurahan/desa jika ada
                        if (regency.districts) {
                            regency.districts.forEach(district => {
                                if (district.villages) {
                                    district.villages.forEach(village => {
                                        // Format: "Nama Kelurahan, Nama Kecamatan, Kota, Provinsi"
                                        allWilayah.push({
                                            name: village.name,
                                            type: 'Kelurahan/Desa',
                                            full: `${village.name}, ${district.name}, ${kotaName}, ${province.name}`
                                        });
                                    });
                                }
                            });
                        }
                    });
                }
            });
            
            console.log('Total wilayah:', allWilayah.length);
            // Update datalist
            updateWilayahDatalist('');
        }
        
        // Fallback list jika JSON gagal load
        function loadBasicWilayahList() {
            allWilayah = [
                {name: 'Jakarta', type: 'Kota/Kabupaten', full: 'Jakarta, DKI Jakarta'},
                {name: 'Bandung', type: 'Kota/Kabupaten', full: 'Bandung, Jawa Barat'},
                {name: 'Surabaya', type: 'Kota/Kabupaten', full: 'Surabaya, Jawa Timur'},
                {name: 'Medan', type: 'Kota/Kabupaten', full: 'Medan, Sumatera Utara'},
                {name: 'Semarang', type: 'Kota/Kabupaten', full: 'Semarang, Jawa Tengah'},
                {name: 'Makassar', type: 'Kota/Kabupaten', full: 'Makassar, Sulawesi Selatan'},
                {name: 'Palembang', type: 'Kota/Kabupaten', full: 'Palembang, Sumatera Selatan'},
                {name: 'Tangerang', type: 'Kota/Kabupaten', full: 'Tangerang, Banten'},
                {name: 'Rawabadak Selatan', type: 'Kelurahan/Desa', full: 'Rawabadak Selatan, Koja, Jakarta Utara, DKI Jakarta'},
                {name: 'Kelapa Gading Barat', type: 'Kelurahan/Desa', full: 'Kelapa Gading Barat, Kelapa Gading, Jakarta Utara, DKI Jakarta'},
            ];
            updateWilayahDatalist('');
        }
        
        function updateWilayahDatalist(filter) {
            const datalist = document.getElementById('kotaSuggestions');
            if (!datalist) return;
            
            datalist.innerHTML = '';
            
            const filtered = filter 
                ? allWilayah.filter(w => w.full.toLowerCase().includes(filter.toLowerCase()))
                : allWilayah;
            
            // Ambil max 50 untuk performa
            filtered.slice(0, 50).forEach(wilayah => {
                const option = document.createElement('option');
                option.value = wilayah.full;
                datalist.appendChild(option);
            });
        }
        
        // Listener untuk autocomplete kota
        document.getElementById('kota').addEventListener('input', function(e) {
            updateWilayahDatalist(e.target.value);
        });

        // GANTI URL INI DENGAN URL WEB APP ANDA DARI GOOGLE APPS SCRIPT
        const GOOGLE_SHEETS_URL = 'https://script.google.com/macros/s/AKfycbxdlrwZIr3KfTfZd-gfiq475LENrIaezSAK7HwNYpNGUxqQ_bkMEy2FfeZx3Y1_Nj-Z/exec';

        let orders = [];
        let productList = []; // Untuk menyimpan produk sementara di form
        let html5QrCode = null;
        let isLoading = false;
        let isDataLoaded = false; // Flag untuk tracking apakah initial load selesai
        
        // Sort Configuration - klik header kolom untuk urutkan
        let currentSort = JSON.parse(localStorage.getItem('sortPreference')) || { field: 'waktu', direction: 'desc' };
        
        window.toggleSort = function(field) {
            if (currentSort.field === field) {
                // Toggle direction jika field sama
                currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
            } else {
                // Default ke descending untuk field baru (kecuali alfabet)
                currentSort = { field: field, direction: 'desc' };
                if (['nama', 'kota', 'produk'].includes(field)) {
                    currentSort.direction = 'asc'; // A-Z default untuk teks
                }
            }
            localStorage.setItem('sortPreference', JSON.stringify(currentSort));
            updateHeaderSortIcons();
            render();
        };
        
        function updateHeaderSortIcons() {
            // Reset semua header
            document.querySelectorAll('th.sortable').forEach(th => {
                th.classList.remove('asc', 'desc');
            });
            // Aktifkan yang aktif
            const activeTh = document.querySelector(`th.sortable[onclick*="${currentSort.field}"]`);
            if (activeTh) {
                activeTh.classList.add(currentSort.direction);
            }
        }
        
        // Helper untuk parse waktu - format: 17/4/2026, 15.53.35
        function parseWaktu(waktuStr) {
            if (!waktuStr) return 0;
            
            // Format: 17/4/2026, 15.53.35 ATAU 17/4/2026 15.53.35
            const match = waktuStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})[, ]+(\d{1,2})\.(\d{2})\.(\d{2})$/);
            if (match) {
                const [, day, month, year, hour, minute, second] = match;
                return new Date(year, month - 1, day, hour, minute, second).getTime();
            }
            
            // Coba format lain: 17/4/2026 15:53:35
            const match2 = waktuStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})$/);
            if (match2) {
                const [, day, month, year, hour, minute, second] = match2;
                return new Date(year, month - 1, day, hour, minute, second).getTime();
            }
            
            // Fallback ke Date native
            const date = new Date(waktuStr);
            return isNaN(date.getTime()) ? 0 : date.getTime();
        }
        
        function getSortedOrders() {
            const sorted = [...orders];
            const { field, direction } = currentSort;
            
            sorted.sort((a, b) => {
                let valA, valB;
                
                if (field === 'no') {
                    // Untuk No, tetap urutan input (index array + 1)
                    valA = orders.indexOf(a) + 1;
                    valB = orders.indexOf(b) + 1;
                } else if (field === 'waktu') {
                    // Gunakan timestamp (angka) untuk perbandingan
                    valA = parseWaktu(a.createdAt);
                    valB = parseWaktu(b.createdAt);
                } else if (field === 'nama') {
                    valA = (a.nama || '').toLowerCase();
                    valB = (b.nama || '').toLowerCase();
                } else if (field === 'kota') {
                    valA = (a.kota || '').toLowerCase();
                    valB = (b.kota || '').toLowerCase();
                } else if (field === 'resi') {
                    valA = (a.resi || '').toLowerCase();
                    valB = (b.resi || '').toLowerCase();
                } else if (field === 'produk') {
                    // Ambil produk pertama dari array
                    valA = (a.products && a.products[0] ? a.products[0].produk : '').toLowerCase();
                    valB = (b.products && b.products[0] ? b.products[0].produk : '').toLowerCase();
                }
                
                if (direction === 'asc') {
                    return valA > valB ? 1 : valA < valB ? -1 : 0;
                } else {
                    return valA < valB ? 1 : valA > valB ? -1 : 0;
                }
            });
            
            return sorted;
        }

        // FUNGSI GOOGLE SHEETS - dengan localStorage backup
        async function loadData() {
            if (isLoading) return;
            isLoading = true;
            
            // Simpan dulu data yang ada di localStorage sebelum overwrite
            const localBackup = localStorage.getItem('orders');
            const localOrders = localBackup ? JSON.parse(localBackup) : [];
            
            try {
                const response = await fetch(GOOGLE_SHEETS_URL);
                const result = await response.json();
                if (result.success && result.data && result.data.length > 0) {
                    // Cek apakah data dari Sheets lebih baru
                    const serverData = result.data;
                    const lastSync = localStorage.getItem('lastSyncTime');
                    
                    // Jika ada data di server, gunakan data server
                    orders = serverData;
                    
                    // Simpan ke localStorage
                    localStorage.setItem('orders', JSON.stringify(orders));
                    console.log('✓ Data loaded from Google Sheets:', orders.length, 'orders');
                    render();
                } else {
                    // Tidak ada data di server, gunakan localStorage
                    orders = localOrders.length > 0 ? localOrders : [];
                    console.log('⚠️ Using localStorage:', orders.length, 'orders');
                    render();
                }
            } catch (error) {
                console.warn("Gagal fetch dari Google Sheets, gunakan localStorage:", error);
                // Fallback ke localStorage jika fetch error
                orders = localOrders.length > 0 ? localOrders : [];
                console.log('⚠️ Using localStorage (offline):', orders.length, 'orders');
                render();
            } finally {
                isLoading = false;
                isDataLoaded = true;
                const submitBtn = document.querySelector('#orderForm button[type="submit"]');
                if (submitBtn) submitBtn.disabled = false;
            }
        }
        
        // Fungsi restore data dari backup jika data hilang
        window.restoreFromBackup = function() {
            const backup = localStorage.getItem('ordersBackup');
            if (backup) {
                const backupData = JSON.parse(backup);
                if (confirm(`Restore ${backupData.length} data dari backup? Data saat ini akan diganti.`)) {
                    orders = backupData;
                    localStorage.setItem('orders', JSON.stringify(orders));
                    saveData().then(() => {
                        render();
                        showToast(`✓ ${orders.length} data direstore dari backup!`, 'success');
                    });
                }
            } else {
                showToast('Tidak ada backup tersedia', 'warning');
            }
        }

        async function saveData() {
            return new Promise((resolve, reject) => {
                console.log('Saving data to Google Sheets:', orders.length, 'orders');
                
                // STEP 1: Simpan ke localStorage DULU sebagai backup
                try {
                    localStorage.setItem('orders', JSON.stringify(orders));
                    localStorage.setItem('ordersBackup', JSON.stringify(orders)); // Backup tambahan
                    console.log('✓ Data saved to localStorage');
                } catch (error) {
                    console.error('✗ Gagal save ke localStorage:', error);
                }
                
                // STEP 2: Cek apakah URL sudah diisi
                if (!GOOGLE_SHEETS_URL || GOOGLE_SHEETS_URL.includes('YOUR_SCRIPT_ID')) {
                    alert('⚠️ URL Google Sheets belum dikonfigurasi!');
                    resolve();
                    return;
                }
                
                // STEP 3: Kirim ke Google Sheets via fetch API (lebih reliable dari iframe)
                showToast('Menyimpan data...', 'primary');
                
                fetch(GOOGLE_SHEETS_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'text/plain',
                    },
                    body: JSON.stringify(orders)
                })
                .then(response => response.json())
                .then(result => {
                    console.log('Google Sheets response:', result);
                    if (result.success) {
                        // Update localStorage dengan data dari server untuk sinkronisasi
                        localStorage.setItem('orders', JSON.stringify(orders));
                        localStorage.setItem('lastSyncTime', Date.now().toString());
                        showToast('✓ Data berhasil disimpan!', 'success');
                        resolve();
                    } else {
                        console.error('Google Sheets error:', result.message);
                        showToast('⚠️ Data disimpan di Lokal, gagal ke Sheets', 'warning');
                        resolve();
                    }
                })
                .catch(error => {
                    console.error('Gagal kirim ke Google Sheets:', error);
                    // Data sudah ada di localStorage, jadi tidak hilang
                    showToast('Sukses Menyimpan di Google Sheets', 'warning');
                    resolve();
                });
            });
        }

        // FUNGSI NOTIFIKASI TOAST (Lebih cantik dari Alert)
        function showToast(message, type = "danger") {
            const toastArea = document.getElementById('toastArea');
            const bgClass = type === "danger" ? "bg-danger" : "bg-success";
            const iconClass = type === "danger" ? "bi-exclamation-triangle" : "bi-check-circle";

            const toast = document.createElement('div');
            toast.className = `toast align-items-center text-white ${bgClass} border-0`;
            toast.setAttribute('role', 'alert');
            toast.setAttribute('aria-live', 'assertive');
            toast.setAttribute('aria-atomic', 'true');
            toast.style.marginBottom = '10px';

            const toastBody = document.createElement('div');
            toastBody.className = 'toast-body fw-bold d-flex align-items-center justify-content-between';
            toastBody.innerHTML = `<span><i class="bi ${iconClass} me-2"></i> ${message}</span>`;

            const closeButton = document.createElement('button');
            closeButton.type = 'button';
            closeButton.className = 'btn-close btn-close-white ms-2';
            closeButton.setAttribute('aria-label', 'Close');
            closeButton.addEventListener('click', () => {
                toast.classList.remove('show');
                toast.classList.add('hide-right');
                setTimeout(() => toast.remove(), 300);
            });

            toastBody.appendChild(closeButton);
            toast.appendChild(toastBody);
            toastArea.appendChild(toast);

            requestAnimationFrame(() => {
                toast.classList.add('show');
            });

            setTimeout(() => {
                toast.classList.remove('show');
                toast.classList.add('hide-right');
                setTimeout(() => toast.remove(), 300);
            }, 3000);
        }

        // KAMERA - DENGAN PILIHAN KAMERA (SESUAI qrscanner.html)
        let currentCameraId = null;

        function onScanSuccess(decodedText) {
            document.getElementById('resi').value = decodedText;
            document.getElementById('resi').dispatchEvent(new Event('input'));
            stopScanner();
        }

        function onScanError(errorMessage) {
            // optional - abaikan error scan biasa
        }

        function loadCameras() {
            Html5Qrcode.getCameras().then(devices => {
                const select = document.getElementById('cameraSelect');
                if (!select) return;
                select.innerHTML = '';

                devices.forEach(device => {
                    const option = document.createElement('option');
                    option.value = device.id;
                    option.text = device.label || `Kamera ${select.length + 1}`;
                    select.appendChild(option);
                });

                if (devices.length > 0) {
                    // Ambil kamera terakhir yang dipilih dari localStorage
                    const savedCamera = localStorage.getItem('selectedCameraId');
                    if (savedCamera && devices.some(d => d.id === savedCamera)) {
                        currentCameraId = savedCamera;
                        select.value = savedCamera;
                    } else {
                        currentCameraId = devices[0].id;
                    }
                }

                select.onchange = function() {
                    currentCameraId = this.value;
                    // Simpan pilihan kamera ke localStorage
                    localStorage.setItem('selectedCameraId', this.value);
                    // Refresh scanner jika sedang aktif
                    if (html5QrCode) {
                        stopScanner();
                        startScanner();
                    }
                };
            }).catch(err => {
                console.error("Gagal ambil kamera:", err);
            });
        }

        function startScanner() {
            if (!currentCameraId) {
                showToast("Pilih kamera terlebih dahulu");
                return;
            }

            if (!html5QrCode) html5QrCode = new Html5Qrcode("reader");

            html5QrCode.start(
                currentCameraId,
                { fps: 10, qrbox: 250 },
                onScanSuccess,
                onScanError
            ).catch(err => {
                console.error("Gagal start scanner:", err);
                showToast("Gagal memulai kamera");
            });
        }

        function stopScanner() {
            if (html5QrCode) {
                html5QrCode.stop().then(() => {
                    html5QrCode.clear();
                    html5QrCode = null;
                    document.getElementById('cameraArea').classList.add('d-none');
                }).catch(err => console.error(err));
            }
        }

        // Load kamera saat awal
        loadCameras();

        // Tombol start scanner
        document.getElementById('startBtn').onclick = async () => {
            document.getElementById('cameraArea').classList.remove('d-none');
            
            // Load dulu daftar kamera
            const devices = await Html5Qrcode.getCameras().catch(err => []);
            if (devices && devices.length > 0) {
                // Buat dropdown jika belum ada
                let cameraSelect = document.getElementById('cameraSelect');
                if (!cameraSelect) {
                    cameraSelect = document.createElement('select');
                    cameraSelect.id = 'cameraSelect';
                    cameraSelect.className = 'form-select form-select-sm mb-2';
                    cameraSelect.style.maxWidth = '200px';
                    
                    const cameraArea = document.getElementById('cameraArea');
                    const reader = document.getElementById('reader');
                    cameraArea.insertBefore(cameraSelect, reader);
                    
                    devices.forEach((device, index) => {
                        const option = document.createElement('option');
                        option.value = device.id;
                        option.text = device.label || `Kamera ${index + 1}`;
                        cameraSelect.appendChild(option);
                    });
                    
                    // Ambil kamera terakhir dari localStorage
                    const savedCamera = localStorage.getItem('selectedCameraId');
                    if (savedCamera && devices.some(d => d.id === savedCamera)) {
                        currentCameraId = savedCamera;
                        cameraSelect.value = savedCamera;
                    } else {
                        currentCameraId = devices[0].id;
                    }
                    
                    cameraSelect.onchange = function() {
                        currentCameraId = this.value;
                        localStorage.setItem('selectedCameraId', this.value);
                        // Refresh scanner jika sedang aktif
                        if (html5QrCode) {
                            stopScanner();
                            startScanner();
                        }
                    };
                }
                
                startScanner();
            } else {
                showToast("Tidak ada kamera ditemukan");
            }
        };

        function normalizeResi(value) {
            return value ? value.toString().toUpperCase().trim() : '';
        }

        function isDuplicateResi(resi, excludeIndex = -1) {
            const normalizedResi = normalizeResi(resi);
            if (!normalizedResi) return false;

            const duplicateInOrders = orders.some((o, idx) => normalizeResi(o.resi) === normalizedResi && idx !== excludeIndex);
            if (duplicateInOrders) return true;

            const backupData = localStorage.getItem('orders');
            if (backupData) {
                try {
                    const backupOrders = JSON.parse(backupData);
                    return backupOrders.some((o, idx) => normalizeResi(o.resi) === normalizedResi && idx !== excludeIndex);
                } catch (e) {
                    console.error('Gagal parse localStorage orders untuk duplicate check', e);
                }
            }

            return false;
        }

        function setResiErrorState(show) {
            const resiInput = document.getElementById('resi');
            const errorMsg = document.getElementById('resiErrorMsg');
            if (show) {
                resiInput.classList.add('is-invalid');
                errorMsg.classList.remove('d-none');
            } else {
                resiInput.classList.remove('is-invalid');
                errorMsg.classList.add('d-none');
            }
        }

        // AUTO DETEKSI EKSPEDISI & VALIDASI DUPLIKAT REAL-TIME
        document.getElementById('resi').oninput = (e) => {
            const val = normalizeResi(e.target.value);
            e.target.value = val; // Force uppercase & hilangkan spasi
            const currentIndex = parseInt(document.getElementById('editIndex').value, 10);
            const hasDuplicate = isDuplicateResi(val, currentIndex);
            setResiErrorState(val && hasDuplicate);
            
            const manualContainer = document.getElementById('ekspedisiManualContainer');
            const exp = document.getElementById('ekspedisi');
            if (manualContainer && manualContainer.classList.contains('d-none')) {
                if (val.startsWith("1100") || val.startsWith("TSA")) exp.value = "Anter Aja";
                else if (val.startsWith("SPXID") || val.startsWith("2604")) exp.value = "SPX ID";
                else if (val.startsWith("JX") || val.startsWith("JP")) exp.value = "JNT";
                else if (val.startsWith("CM")) exp.value = "JNT";
                else if (val.startsWith("58")) exp.value = "Grab";
                
            }
        };

        function updateSizes() {
            const prod = document.getElementById('produk').value;
            const select = document.getElementById('ukuran');
            select.innerHTML = '';
            if(productData[prod]) {
                productData[prod].forEach(s => select.innerHTML += `<option value="${s}">${s}</option>`);
            }
        }

        window.toggleEkspedisiManual = function() {
            const select = document.getElementById('ekspedisi');
            const manualContainer = document.getElementById('ekspedisiManualContainer');
            const manualInput = document.getElementById('ekspedisiManual');
            if (select.value === 'Manual') {
                select.style.display = 'none';
                manualContainer.classList.remove('d-none');
                manualInput.required = true;
                manualInput.value = '';
                manualInput.focus();
            } else {
                manualContainer.classList.add('d-none');
                manualInput.required = false;
                manualInput.value = '';
                select.style.display = 'block';
            }
        }

        window.resetEkspedisiManual = function() {
            const select = document.getElementById('ekspedisi');
            const manualContainer = document.getElementById('ekspedisiManualContainer');
            const manualInput = document.getElementById('ekspedisiManual');
            manualContainer.classList.add('d-none');
            manualInput.required = false;
            manualInput.value = '';
            select.style.display = 'block';
            select.value = 'JNE';
        }

        // COPY RESI FUNCTION
        window.copyResi = async function(resi, element) {
            try {
                await navigator.clipboard.writeText(resi);
                // Visual feedback
                element.classList.add('copied');
                showToast(`Resi ${resi} disalin ke clipboard!`, 'success');
                // Reset class setelah animasi
                setTimeout(() => {
                    element.classList.remove('copied');
                }, 1200);
            } catch (err) {
                // Fallback untuk browser lama
                const textArea = document.createElement('textarea');
                textArea.value = resi;
                textArea.style.position = 'fixed';
                textArea.style.left = '-999999px';
                textArea.style.top = '-999999px';
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                try {
                    document.execCommand('copy');
                    element.classList.add('copied');
                    showToast(`Resi ${resi} disalin!`, 'success');
                    setTimeout(() => element.classList.remove('copied'), 1200);
                } catch (fallbackErr) {
                    showToast('Gagal salin resi. Copy manual: ' + resi, 'danger');
                } finally {
                    document.body.removeChild(textArea);
                }
            }
        };

        window.getEkspedisiValue = function() {
            const manualContainer = document.getElementById('ekspedisiManualContainer');
            const manualInput = document.getElementById('ekspedisiManual');
            const select = document.getElementById('ekspedisi');
            if (manualContainer && !manualContainer.classList.contains('d-none')) {
                return manualInput.value.trim();
            }
            return select.value;
        }

        window.setEkspedisiValue = function(value) {
            const select = document.getElementById('ekspedisi');
            const manualContainer = document.getElementById('ekspedisiManualContainer');
            const manualInput = document.getElementById('ekspedisiManual');
            const optionExists = Array.from(select.options).some(opt => opt.value === value && opt.value !== 'Manual');
            if (optionExists) {
                manualContainer.classList.add('d-none');
                manualInput.required = false;
                manualInput.value = '';
                select.style.display = 'block';
                select.value = value;
            } else {
                select.style.display = 'none';
                manualContainer.classList.remove('d-none');
                manualInput.required = true;
                manualInput.value = value || '';
                select.value = 'Manual';
            }
        }

        window.addProduct = function() {
            const prodDate = productList.length > 0 ? productList[0].prodDate || '' : '';
            productList.push({produk: '', ukuran: '', qty: 1, batch: '', exp: '', prodDate: prodDate});
            renderProductContainer();
        }

        window.addProductItem = function(produk, ukuran, qty, index) {
            const container = document.getElementById('productContainer');
            const div = document.createElement('div');
            div.className = 'product-item border rounded p-3 mb-2 bg-light';
            div.innerHTML = `
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <span class="fw-bold">Produk ${index + 1}</span>
                    <button type="button" onclick="removeProduct(${index})" class="btn btn-sm btn-outline-danger">Hapus</button>
                </div>
                <div class="row mb-2">
                    <div class="col-6">
                        <select class="form-select produk-select" onchange="updateProductFields(${index})" required>
                            <option value="">-- Pilih --</option>
                            <option value="Madu Sarang">Madu Sarang</option>
                            <option value="Madu">Madu</option>
                            <option value="Lemon">Lemon</option>
                            <option value="Garlic">Garlic</option>
                            <option value="VCO">VCO</option>
                            <option value="Beras Kencur">Beras Kencur</option>
                            <option value="Kunyit Asem">Kunyit Asem</option>
                        </select>
                    </div>
                    <div class="col-3">
                        <select class="form-select ukuran-select" required onchange="productList[${index}].ukuran = this.value"></select>
                    </div>
                    <div class="col-3">
                        <input type="number" class="form-control qty-input text-center" min="1" value="1" required onchange="productList[${index}].qty = this.value">
                    </div>
                </div>
                <div class="batch-exp-container" style="display: none;">
                    <div class="row">
                        <div class="col-6">
                            <label class="form-label small fw-bold">Tanggal Produksi</label>
                            <input type="date" class="form-control prod-date" onchange="calculateBatchExp(${index})">
                        </div>
                        <div class="col-6">
                            <label class="form-label small fw-bold">Batch & Exp</label>
                            <input type="text" class="form-control batch-exp-display" readonly>
                        </div>
                    </div>
                </div>
            `;
            container.appendChild(div);
            
            // Simpan ukuran dulu sebelum update fields
            const savedUkuran = ukuran;
            
            // Set values
            div.querySelector('.produk-select').value = produk;
            div.querySelector('.qty-input').value = qty;
            
            if (produk) {
                updateProductFields(index);
                updateSizesForProduct(index);
                
                // Setelah dropdown di-rebuild, set ukuran yang disimpan
                const select = div.querySelector('.ukuran-select');
                if (savedUkuran && productData[produk] && productData[produk].includes(savedUkuran)) {
                    select.value = savedUkuran;
                    productList[index].ukuran = savedUkuran;
                } else if (select.options.length > 0) {
                    // Pilih ukuran pertama jika tidak ada yang cocok
                    select.selectedIndex = 0;
                    productList[index].ukuran = select.value;
                }
            }
            
            // Set batch/exp if exists
            if (productList[index].batch || productList[index].exp) {
                div.querySelector('.batch-exp-display').value = (productList[index].batch ? 'Batch: ' + productList[index].batch : '') + (productList[index].exp ? (productList[index].batch ? ' | ' : '') + 'Exp: ' + productList[index].exp : '');
            }
        }

        window.updateProductFields = function(index) {
            const produk = document.querySelectorAll('.produk-select')[index].value;
            const container = document.querySelectorAll('.batch-exp-container')[index];
            productList[index].produk = produk;
            if (produk === 'Madu' || produk === 'Madu Sarang' || produk === 'VCO' || produk === 'Garlic' || produk === 'Lemon' || produk === 'Kunyit Asem' || produk === 'Beras Kencur') {
                container.style.display = 'block';
                if (productList[index].prodDate) {
                    calculateBatchExp(index);
                }
            } else {
                container.style.display = 'none';
                productList[index].batch = '';
                productList[index].exp = '';
                productList[index].prodDate = '';
            }
            updateSizesForProduct(index);
        }

        window.calculateBatchExp = function(index) {
            const prodDateInput = document.querySelectorAll('.prod-date')[index];
            const display = document.querySelectorAll('.batch-exp-display')[index];
            const produk = productList[index].produk;
            const rawValue = prodDateInput.value || productList[index].prodDate;
            const prodDate = normalizeDateInput(rawValue);
            prodDateInput.value = prodDate;
            productList[index].prodDate = prodDate;
            if (!prodDate) {
                display.value = '';
                productList[index].batch = '';
                productList[index].exp = '';
                return;
            }
            const date = new Date(prodDate);
            let batch = '';
            let exp = '';
            if (produk === 'Madu') {
                batch = '1.' + formatDate(date);
                const expDate = new Date(date);
                expDate.setFullYear(expDate.getFullYear() + 2);
                exp = formatDate(expDate);
            } else if (produk === 'Madu Sarang') {
                batch = '2.' + formatDate(date);
                const expDate = new Date(date);
                expDate.setFullYear(expDate.getFullYear() + 2);
                exp = formatDate(expDate);
            } else if (produk === 'VCO') {
                batch = '5.' + formatDate(date);
                const expDate = new Date(date);
                expDate.setFullYear(expDate.getFullYear() + 2);
                exp = formatDate(expDate);
            } else if (produk === 'Garlic') {
                batch = '6.' + formatDate(date);
                const expDate = new Date(date);
                expDate.setMonth(expDate.getMonth() + 6);
                exp = formatDate(expDate);
            } else if (produk === 'Lemon') {
                batch = '4.' + formatDate(date);
                const expDate = new Date(date);
                expDate.setMonth(expDate.getMonth() + 5);
                exp = formatDate(expDate);
            } else if (produk === 'Kunyit Asem') {
                batch = '7.' + formatDate(date);
                const expDate = new Date(date);
                expDate.setDate(expDate.getDate() + 7);
                exp = formatDate(expDate);
            } else if (produk === 'Beras Kencur') {
                batch = '8.' + formatDate(date);
                const expDate = new Date(date);
                expDate.setDate(expDate.getDate() + 7);
                exp = formatDate(expDate);
            }
            productList[index].batch = batch;
            productList[index].exp = exp;
            display.value = (batch ? 'Batch: ' + batch : '') + (exp ? (batch ? ' | ' : '') + 'Exp: ' + exp : '');
        }

        window.filterModal = function() {
            const query = document.getElementById('modalSearchInput').value.toLowerCase();
            const rows = document.querySelectorAll('#modalDetailBody tr');
            rows.forEach(row => {
                const text = row.textContent.toLowerCase();
                const visible = text.includes(query);
                row.style.display = visible ? '' : 'none';
            });
        }

        window.filterTable = function() {
            const query = document.getElementById('searchInput').value.toLowerCase();
            const rows = document.querySelectorAll('#tableBody tr');
            const ordersVisibility = {};
            rows.forEach(row => {
                const orderIndex = row.getAttribute('data-order');
                const text = row.textContent.toLowerCase();
                if (!ordersVisibility[orderIndex]) ordersVisibility[orderIndex] = false;
                if (text.includes(query)) ordersVisibility[orderIndex] = true;
            });
            rows.forEach(row => {
                const orderIndex = row.getAttribute('data-order');
                const visible = ordersVisibility[orderIndex];
                row.style.display = visible ? '' : 'none';
            });
            
            // Update counter di rekap
            updateStatCounter();
        }
        
        // Pencarian khusus resi - langsung fokus ke baris yang cocok
        window.searchByResi = function() {
            // Fungsi ini sekarang digunakan oleh scanner QR resi
            // Input manual resi sudah dihapus dari UI
            console.log('searchByResi called - now used by QR scanner');
        }
        
        // Scanner QR untuk cari resi di tabel
        window.openResiScanner = async function() {
            const scannerModal = new bootstrap.Modal(document.getElementById('resiScannerModal'));
            scannerModal.show();
            
            // Load kamera
            const devices = await Html5Qrcode.getCameras().catch(err => []);
            if (devices && devices.length > 0) {
                let cameraSelect = document.getElementById('resiCameraSelect');
                if (!cameraSelect) {
                    cameraSelect = document.createElement('select');
                    cameraSelect.id = 'resiCameraSelect';
                    cameraSelect.className = 'form-select form-select-sm mb-2';
                    
                    const modalBody = document.querySelector('#resiScannerModal .modal-body');
                    modalBody.insertBefore(cameraSelect, document.getElementById('resiReader'));
                    
                    devices.forEach((device, index) => {
                        const option = document.createElement('option');
                        option.value = device.id;
                        option.text = device.label || `Kamera ${index + 1}`;
                        cameraSelect.appendChild(option);
                    });
                    
                    currentResiScannerCamera = devices[0].id;
                    
                    cameraSelect.onchange = function() {
                        currentResiScannerCamera = this.value;
                        restartResiScanner();
                    };
                }
                
                startResiScanner();
            } else {
                showToast("Tidak ada kamera ditemukan");
            }
        }
        
        let currentResiScannerCamera = null;
        let resiHtml5QrCode = null;
        
        function startResiScanner() {
            if (!currentResiScannerCamera) return;
            
            if (!resiHtml5QrCode) resiHtml5QrCode = new Html5Qrcode("resiReader");
            
            resiHtml5QrCode.start(
                currentResiScannerCamera,
                { fps: 10, qrbox: 250 },
                (decodedText) => {
                    // Isi input search dan jalankan pencarian
                    document.getElementById('searchInput').value = decodedText;
                    filterTable();
                    stopResiScanner();
                    bootstrap.Modal.getInstance(document.getElementById('resiScannerModal')).hide();
                    showToast("Resi ditemukan: " + decodedText);
                },
                (errorMessage) => {}
            ).catch(err => {
                console.error("Gagal start resi scanner:", err);
                showToast("Gagal memulai kamera");
            });
        }
        
        function stopResiScanner() {
            if (resiHtml5QrCode) {
                resiHtml5QrCode.stop().then(() => {
                    resiHtml5QrCode.clear();
                    resiHtml5QrCode = null;
                }).catch(err => console.error(err));
            }
        }
        
        function restartResiScanner() {
            stopResiScanner();
            startResiScanner();
        }
        
        function updateStatCounter() {
            const visibleRows = document.querySelectorAll('#tableBody tr:not([style*="display: none"])[data-order]');
            const uniqueOrders = new Set();
            visibleRows.forEach(row => {
                const orderIndex = row.getAttribute('data-order');
                if (orderIndex) uniqueOrders.add(orderIndex);
            });
            document.getElementById('statTotal').textContent = uniqueOrders.size;
        }

        window.removeProduct = function(index) {
            productList.splice(index, 1);
            renderProductContainer();
        }

        window.renderProductContainer = function() {
            const container = document.getElementById('productContainer');
            container.innerHTML = '';
            productList.forEach((p, i) => addProductItem(p.produk, p.ukuran, p.qty, i));
        }

        window.updateSizesForProduct = function(index) {
            const produkSelect = document.querySelectorAll('.produk-select')[index];
            if (!produkSelect) return;
            const produk = productList[index].produk = produkSelect.value;
            const select = document.querySelectorAll('.ukuran-select')[index];
            
            // Simpan ukuran yang sekarang dulu SEBELUM rebuild dropdown
            const currentUkuran = productList[index].ukuran;
            
            select.innerHTML = '';
            if (productData[produk] && productData[produk].length > 0) {
                productData[produk].forEach(s => {
                    const option = document.createElement('option');
                    option.value = s;
                    option.text = s;
                    select.appendChild(option);
                });
                
                // Cek apakah ukuran sekarang masih valid untuk produk ini
                if (currentUkuran && productData[produk].includes(currentUkuran)) {
                    select.value = currentUkuran;
                    productList[index].ukuran = currentUkuran;
                } else {
                    // Pilih ukuran pertama sebagai default
                    select.selectedIndex = 0;
                    productList[index].ukuran = select.value;
                }
            } else {
                productList[index].ukuran = '';
            }
        }

        function normalizeDateInput(value) {
            if (!value) return '';
            const text = value.toString().trim();
            if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

            const date = new Date(text);
            if (!isNaN(date)) {
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            }

            const parts = text.split(/[-\/]/);
            if (parts.length === 3) {
                const [a, b, c] = parts;
                if (a.length === 2 && c.length === 4) {
                    return `${c}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`;
                }
            }
            return '';
        }

        function formatDate(date) {
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            return `${day}-${month}-${year}`;
        }

        // FUNGSI RENDER & REKAP
        function render() {
            const tbody = document.getElementById('tableBody');
            tbody.innerHTML = '';
            
            const summary = {}; 
            let globalNo = 1; 
            
            // Gunakan data yang sudah diurutkan
            const sortedOrders = getSortedOrders();
            
            // Buat mapping dari index asli ke posisi di array yang sudah diurutkan
            const indexMap = {};
            sortedOrders.forEach((o, newIndex) => {
                const originalIndex = orders.indexOf(o);
                indexMap[originalIndex] = newIndex;
            });

            sortedOrders.forEach((o, orderIndex) => {
                o.products.forEach((p, productIndex) => {
                    const isFirst = productIndex === 0;
                    const rowspan = isFirst ? `rowspan="${o.products.length}"` : '';
                    const originalIndex = orders.indexOf(o);
                    const aksi = isFirst ? `<button onclick="edit(${originalIndex})" class="btn btn-sm btn-outline-warning me-1" title="Edit"><i class="bi bi-pencil-fill"></i></button>
                        <button onclick="hapus(${originalIndex})" class="btn btn-sm btn-outline-danger" title="Hapus"><i class="bi bi-trash-fill"></i></button>` : '';

                    // Logika Summary Group
                    if(!summary[p.produk]) summary[p.produk] = {};
                    if(!summary[p.produk][p.ukuran]) summary[p.produk][p.ukuran] = { count: 0, items: [] };
                    
                    summary[p.produk][p.ukuran].count += parseInt(p.kuantitas);
                    summary[p.produk][p.ukuran].items.push({...o, produk: p.produk, ukuran: p.ukuran, kuantitas: p.kuantitas, batch: p.batch, exp: p.exp});

                    let expColor = "bg-secondary";
                    if(o.ekspedisi === "JNE") expColor = "bg-primary";
                    if(o.ekspedisi === "JNT") expColor = "bg-danger";
                    if(o.ekspedisi === "SPX ID") expColor = "bg-warning text-dark";
                    if(o.ekspedisi === "Anter Aja") expColor = "bg-pink";
                    if(o.ekspedisi === "Paxel") expColor = "bg-purple";
                    if(o.ekspedisi === "Gojek" || o.ekspedisi === "Grab") expColor = "bg-success";
                    const isEdited = o.updatedAt && o.updatedAt !== o.createdAt;
                    const rowBg = isEdited ? "bg-warning bg-opacity-25" : "";

                    tbody.innerHTML += `
                    <tr data-order="${originalIndex}" class="${rowBg}">
                        ${isFirst ? `<td class="ps-4" ${rowspan}>${globalNo++}</td>
                        <td ${rowspan}>
                            <div class="font-monospace mb-1" style="font-size: 0.9rem;">
                                <span class="resi-copyable font-monospace fw-bold text-dark" onclick="copyResi('${o.resi}', this)" title="Klik untuk salin">${o.resi}</span>
                            </div>
                            <span class="badge ${expColor} badge-exp">${o.ekspedisi}</span>
                        </td>
                        <td class="fw-semibold text-secondary" ${rowspan}>${o.nama}</td>
                        <td class="text-secondary" ${rowspan}>${o.kota || ''}</td>` : ''}
                        <td>${p.produk}</td>
                        <td><span class="badge bg-light text-secondary border">${p.ukuran}</span></td>
                        <td class="text-center">
                            <span class="badge bg-success fs-6 rounded-circle p-2">${p.kuantitas}</span>
                        </td>
                        <td>${p.batch ? p.batch : ''}</td>
                        <td>${p.exp ? p.exp : ''}</td>
                        ${isFirst ? `<td class="small text-nowrap" ${rowspan}>${o.createdAt || ''}<br><small class="text-muted">${isEdited ? '(Edit: ' + o.updatedAt + ')' : ''}</small></td>` : ''}
                        ${isFirst ? `<td class="text-center pe-4" ${rowspan}>${aksi}</td>` : ''}
                    </tr>`;
                });
            });

            document.getElementById('statTotal').textContent = sortedOrders.length;
            const area = document.getElementById('rekapProdukArea');
            if (sortedOrders.length === 0) {
                area.innerHTML = '<p class="text-center text-muted small mt-4">Belum ada pesanan masuk hari ini.</p>';
                return;
            }
            area.innerHTML = '';

            // Tampilkan Rekap & Simpan data ke window untuk Modal
            window.modalData = summary;

            for (const productName in summary) {
                const sizes = summary[productName];
                let sizeStrings = [];
                let totalProductCount = 0;
                
                for (const sizeName in sizes) {
                    sizeStrings.push(`${sizeName}: <span class="text-primary">${sizes[sizeName].count}</span>`);
                    totalProductCount += sizes[sizeName].count;
                }

                area.innerHTML += `
                    <div class="summary-box" onclick="bukaModalDetail('${productName}')" title="Klik untuk lihat detail pembeli">
                        <div class="product-title">
                            <span>${productName}</span>
                            <span class="badge bg-light text-success border"><i class="bi bi-box"></i> ${totalProductCount}</span>
                        </div>
                        <div class="size-detail">${sizeStrings.join(' <span class="text-muted fw-normal">|</span> ')}</div>
                    </div>
                `;
            }

        }

        // BUKA MODAL DETAIL
        window.bukaModalDetail = (productName) => {
            const data = window.modalData[productName];
            document.getElementById('modalTitle').innerHTML = `<i class="bi bi-card-list"></i> Detail Pembeli: ${productName}`;
            
            const tbody = document.getElementById('modalDetailBody');
            tbody.innerHTML = '';

            // Group by nama pembeli + resi untuk menyatukan baris
            const grouped = {};
            for (const sizeName in data) {
                data[sizeName].items.forEach(item => {
                    const key = `${item.nama}||${item.resi}`;
                    if (!grouped[key]) {
                        grouped[key] = { nama: item.nama, kota: item.kota || '', resi: item.resi, ekspedisi: item.ekspedisi, rows: [] };
                    }
                    grouped[key].rows.push(item);
                });
            }

            let modalCounter = 1;
            for (const key in grouped) {
                const group = grouped[key];
                group.rows.forEach((item, rowIndex) => {
                    tbody.innerHTML += `
                        <tr>
                            <td class="ps-3">${rowIndex === 0 ? modalCounter++ : ''}</td>
                            <td class="fw-bold text-secondary">${rowIndex === 0 ? group.nama : ''}</td>
                            <td class="text-secondary">${rowIndex === 0 ? group.kota || '' : ''}</td>
                            <td><span class="badge border text-dark">${item.ukuran}</span></td>
                            <td class="text-center fw-bold text-success">${item.kuantitas}</td>
                            <td>${item.batch ? item.batch : ''}</td>
                            <td>${item.exp ? item.exp : ''}</td>
                            <td class="font-monospace small">${rowIndex === 0 ? group.resi : ''}</td>
                            <td><span class="badge bg-secondary">${rowIndex === 0 ? group.ekspedisi : ''}</span></td>
                        </tr>
                    `;
                });
            }

            document.getElementById('modalSearchInput').value = '';
            const modal = new bootstrap.Modal(document.getElementById('detailModal'));
            modal.show();
        };

        // AKSI FORM & CEK DUPLIKASI
        document.getElementById('orderForm').onsubmit = async (e) => {
            e.preventDefault();
            const idx = document.getElementById('editIndex').value;
            const resiInput = normalizeResi(document.getElementById('resi').value);
            const currentIndex = parseInt(idx, 10);
            const errorMsg = document.getElementById('resiErrorMsg');
            
            // STEP 1: Cek apakah ada pesan error duplikat yang ditampilkan
            if (!errorMsg.classList.contains('d-none')) {
                showToast('<i class="bi bi-exclamation-circle"></i> Resi duplikat! Ganti nomor resi Anda.', "danger");
                console.warn('🚫 Submit blocked - error message displayed');
                return;
            }
            
            // STEP 2: Pastikan normalisasi resi juga dilakukan saat submit
            if (resiInput && isDuplicateResi(resiInput, currentIndex)) {
                setResiErrorState(true);
                showToast(`<i class="bi bi-exclamation-circle"></i> Resi <b>${resiInput}</b> sudah ada!`, "danger");
                console.warn('🚫 Submit blocked - Duplicate Resi after normalize:', resiInput);
                return;
            }

            // Collect products
            const products = productList.map(p => ({ produk: p.produk, ukuran: p.ukuran, kuantitas: p.qty, batch: p.batch || '', exp: p.exp || '', prodDate: p.prodDate || '' }));
            
            // Validasi produk dengan pesan yang lebih jelas
            const invalidProducts = [];
            products.forEach((p, idx) => {
                if (!p.produk) invalidProducts.push(`Produk ${idx + 1}: pilih produk`);
                else if (!p.ukuran) invalidProducts.push(`Produk ${idx + 1}: ${p.produk} - pilih ukuran`);
                else if (!p.kuantitas || p.kuantitas < 1) invalidProducts.push(`Produk ${idx + 1}: ${p.produk} - masukkan jumlah`);
            });
            
            if (invalidProducts.length > 0) {
                showToast('⚠️ ' + invalidProducts[0], "danger");
                return;
            }
            const ekspedisi = getEkspedisiValue();
            if (!ekspedisi) {
                showToast("Harap isi ekspedisi manual jika memilih Tulis Manual!", "danger");
                return;
            }
            
            // --- LOGIKA CEK RESI DUPLIKAT (IMPROVED) ---
            if (idx === "-1") {
                // Saat tambah data baru
                if (isDuplicateResi(resiInput)) {
                    setResiErrorState(true);
                    showToast(`<i class="bi bi-exclamation-circle"></i> Resi <b>${resiInput}</b> sudah ada di daftar!`, "danger");
                    console.warn('🚫 Save blocked - Duplicate Resi:', resiInput);
                    return; // Hentikan proses simpan
                }
            } else {
                // Saat edit data, cek apakah resi dipakai oleh index lain
                if (isDuplicateResi(resiInput, parseInt(idx, 10))) {
                    setResiErrorState(true);
                    showToast(`<i class="bi bi-exclamation-circle"></i> Resi <b>${resiInput}</b> digunakan pesanan lain!`, "danger");
                    console.warn('🚫 Save blocked - Duplicate Resi on edit:', resiInput);
                    return; // Hentikan proses simpan
                }
            }

            const data = {
                nama: document.getElementById('nama').value,
                kota: document.getElementById('kota').value,
                resi: resiInput,
                ekspedisi: ekspedisi,
                products: products,
                createdAt: idx === "-1" ? new Date().toLocaleString('id-ID') : orders[idx].createdAt,
                updatedAt: new Date().toLocaleString('id-ID')
            };
            
            if(idx === "-1") {
                orders.push(data); // Tambah ke akhir sehingga entri pertama tetap nomor 1
                showToast("Data berhasil ditambahkan!", "success");
            } else { 
                orders[idx] = data;
                document.getElementById('editIndex').value = "-1"; 
                document.getElementById('btnBatal').classList.add('d-none');
                showToast("Data berhasil diubah!", "success");
            }
            
            await saveData();
            
            e.target.reset();
            resetEkspedisiManual();
            errorMsg.classList.add('d-none'); // Sembunyikan error message
            productList = [];
            renderProductContainer();
            addProduct(); // Reset to one product
            render();
        };

        window.edit = (i) => {
            const o = orders[i];
            document.getElementById('nama').value = o.nama;
            document.getElementById('kota').value = o.kota || '';
            document.getElementById('resi').value = o.resi;
            // Clear error message saat edit
            document.getElementById('resiErrorMsg').classList.add('d-none');
            document.getElementById('resi').classList.remove('is-invalid');
            setEkspedisiValue(o.ekspedisi);
            productList = o.products.map(p => ({
                produk: p.produk,
                ukuran: p.ukuran,
                qty: p.kuantitas,
                batch: p.batch || '',
                exp: p.exp || '',
                prodDate: normalizeDateInput(p.prodDate || '')
            }));
            renderProductContainer();
            document.getElementById('editIndex').value = i;
            document.getElementById('btnBatal').classList.remove('d-none');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        };

        document.getElementById('btnBatal').onclick = () => {
            document.getElementById('orderForm').reset();
            resetEkspedisiManual();
            // Clear error message saat batal
            document.getElementById('resiErrorMsg').classList.add('d-none');
            document.getElementById('resi').classList.remove('is-invalid');
            document.getElementById('editIndex').value = "-1";
            document.getElementById('btnBatal').classList.add('d-none');
            productList = [];
            renderProductContainer();
            addProduct();
        };

        window.hapus = async (i) => { 
            if(confirm('Hapus data pesanan ini?')) { 
                orders.splice(i, 1); 
                await saveData();
                render(); 
                showToast("Data dihapus", "success");
            } 
        };

        window.hapusSemua = async () => {
            if(confirm('Apakah Anda yakin ingin menghapus semua data pesanan? Tindakan ini tidak dapat dibatalkan.')) {
                orders = [];
                await saveData();
                render();
                showToast("Semua data berhasil dihapus!", "success");
            }
        };

        // IMPORT / EKSPORT CSV
        function downloadCSV() {
            if(orders.length === 0) return showToast("Tidak ada data untuk diunduh!");
            
            // Gunakan data yang sudah diurutkan sesuai preferensi
            const sortedOrders = getSortedOrders();
            
            let csv = "Nama,Kota,Resi,Ekspedisi,Produk,Ukuran,Qty,Batch,Exp,ProdDate,CreatedAt,UpdatedAt\n";
            sortedOrders.forEach(o => {
                o.products.forEach(p => csv += `"${o.nama}","${o.kota || ''}","${o.resi}","${o.ekspedisi}","${p.produk}","${p.ukuran}","${p.kuantitas}","${p.batch || ''}","${p.exp || ''}","${p.prodDate || ''}","${o.createdAt || ''}","${o.updatedAt || ''}"\n`);
            });
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = 'rekap_penjualan.csv'; a.click();
        }

        document.getElementById('importCSV').onchange = (e) => {
            const r = new FileReader();
            r.onload = (ev) => {
                const rows = ev.target.result.split('\n').slice(1);
                const grouped = {};
                rows.filter(l => l.trim()).forEach(l => {
                    const c = l.split(',').map(v => v.replace(/"/g, ''));
                    let nama = c[0];
                    let kota = '';
                    let resi = '';
                    let ekspedisi = '';
                    let produk = '';
                    let ukuran = '';
                    let kuantitas = '';
                    let batch = '';
                    let exp = '';
                    let prodDate = '';
                    let createdAt = '';
                    let updatedAt = '';
                    if (c.length >= 12) {
                        nama = c[0];
                        kota = c[1];
                        resi = c[2];
                        ekspedisi = c[3];
                        produk = c[4];
                        ukuran = c[5];
                        kuantitas = c[6];
                        batch = c[7] || '';
                        exp = c[8] || '';
                        prodDate = c[9] || '';
                        createdAt = c[10] || '';
                        updatedAt = c[11] || '';
                    } else if (c.length >= 10) {
                        nama = c[0];
                        kota = c[1];
                        resi = c[2];
                        ekspedisi = c[3];
                        produk = c[4];
                        ukuran = c[5];
                        kuantitas = c[6];
                        batch = c[7] || '';
                        exp = c[8] || '';
                        prodDate = c[9] || '';
                    } else if (c.length >= 7) {
                        nama = c[0];
                        kota = c[1];
                        resi = c[2];
                        ekspedisi = c[3];
                        produk = c[4];
                        ukuran = c[5];
                        kuantitas = c[6];
                    } else {
                        nama = c[0];
                        resi = c[1];
                        ekspedisi = c[2];
                        produk = c[3];
                        ukuran = c[4];
                        kuantitas = c[5];
                    }
                    const key = resi;
                    if (!grouped[key]) grouped[key] = { nama, kota, resi, ekspedisi, products: [], createdAt: createdAt || new Date().toLocaleString('id-ID'), updatedAt: updatedAt || new Date().toLocaleString('id-ID') };
                    grouped[key].products.push({ produk, ukuran, kuantitas, batch, exp, prodDate });
                });
                const importedOrders = Object.values(grouped);
                if(confirm(`Timpa tabel dengan ${importedOrders.length} data baru?`)) {
                    orders = importedOrders;
                    render();
                    
                    // SIMPAN ke localStorage dan Google Sheets
                    saveData().then(() => {
                        showToast(`✓ ${importedOrders.length} data berhasil diimpor & disimpan!`, "success");
                    });
                }
            };
            r.readAsText(e.target.files[0]);
        };
        function formatDate(date) {
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            return `${day}-${month}-${year}`;
        }
        // Render Awal
        (async () => {
            // Disable submit button sampai data selesai dimuat
            const submitBtn = document.querySelector('#orderForm button[type="submit"]');
            const resiInput = document.getElementById('resi');
            
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="bi bi-hourglass-end"></i> Sedang mengambil data..';
            }
            if (resiInput) resiInput.disabled = true;
            
            console.log('⏳ Loading initial data...');
            
            // Load data dari Google Sheets
            await loadData();
            
            // Load data wilayah Indonesia untuk autocomplete
            await loadWilayahData();
            
            // Re-enable submit button & form
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="bi bi-save"></i> Simpan Data';
            }
            if (resiInput) resiInput.disabled = false;
            
            console.log('✓ App ready - all data loaded, form unlocked');
            
            // Update ikon sort di header sesuai preferensi
            updateHeaderSortIcons();
        })();
        
        // Polling setiap 30 detik untuk sync dengan Google Sheets
        setInterval(loadData, 30000);
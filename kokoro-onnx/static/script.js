import { KokoroTTS } from 'https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/dist/kokoro.web.min.js';

document.addEventListener('DOMContentLoaded', async () => {
    const textInput = document.getElementById('textInput');
    const charCount = document.getElementById('charCount');
    const resetBtn = document.getElementById('resetBtn');
    const synthesizeBtn = document.getElementById('synthesizeBtn');
    const personaCards = document.querySelectorAll('.persona-card');
    const outputPanel = document.getElementById('outputPanel');
    const playBtn = document.getElementById('playBtn');
    const fileNameDisplay = document.getElementById('fileNameDisplay');
    const personaDisplay = document.getElementById('personaDisplay');
    const downloadBtn = document.getElementById('downloadBtn');
    const voiceSelector = document.getElementById('voiceSelector');
    const waveformCanvas = document.getElementById('waveformCanvas');
    const ctx = waveformCanvas.getContext('2d');

    let selectedPersona = 'aeon';
    let audioBlob = null;
    let audioUrl = null;
    let audioObj = null;
    let isPlaying = false;
    let kokoroEngine = null;

    // Voice Mapping for Kokoro-JS (Comprehensive v1.0 Palette)
    const VOICE_MAP = {
        // American Female
        "aeon": "am_adam", // Keeping original persona IDs for base UI
        "lyra": "af_bella",
        "kael": "am_michael",
        "nova": "af_sky",

        // Extended US Female
        "heart": "af_heart",
        "alloy": "af_alloy",
        "aoede": "af_aoede",
        "jessica": "af_jessica",
        "kore": "af_kore",
        "nicole": "af_nicole",
        "sarah": "af_sarah",
        "river": "af_river",

        // Extended US Male
        "echo": "am_echo",
        "eric": "am_eric",
        "fenrir": "am_fenrir",
        "liam": "am_liam",
        "onyx": "am_onyx",
        "puck": "am_puck",
        "santa": "am_santa",

        // British Female
        "emma": "bf_emma",
        "isabella": "bf_isabella",
        "alice": "bf_alice",
        "lily": "bf_lily",

        // British Male
        "george": "bm_george",
        "lewis": "bm_lewis",
        "daniel": "bm_daniel",
        "fable": "bm_fable"
    };

    // UI Helper to find display name
    const VOICE_NAMES = {
        "am_adam": "Adam Prime", "af_bella": "Bella Weaver", "am_michael": "Michael Core", "af_sky": "Sky Zen",
        "af_heart": "Heart (Premium)", "af_alloy": "Alloy", "af_aoede": "Aoede", "af_jessica": "Jessica",
        "af_kore": "Kore", "af_nicole": "Nicole", "af_sarah": "Sarah", "af_river": "River",
        "am_echo": "Echo", "am_eric": "Eric", "am_fenrir": "Fenrir", "am_liam": "Liam",
        "am_onyx": "Onyx", "am_puck": "Puck (Playful)", "am_santa": "Santa Clause",
        "bf_emma": "Emma (UK)", "bf_isabella": "Isabella (UK)", "bf_alice": "Alice (UK)", "bf_lily": "Lily (UK)",
        "bm_george": "George (UK)", "bm_lewis": "Lewis (UK)", "bm_daniel": "Daniel (UK)", "bm_fable": "Fable (Drama)"
    };

    // Initialize Canvas
    function resizeCanvas() {
        waveformCanvas.width = waveformCanvas.parentElement.clientWidth;
        waveformCanvas.height = waveformCanvas.parentElement.clientHeight;
        drawWaveform(0);
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // Persona Selection
    personaCards.forEach(card => {
        card.addEventListener('click', () => {
            personaCards.forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            selectedPersona = card.dataset.persona;
            voiceSelector.value = selectedPersona; // Sync dropdown
        });
    });

    // Dropdown Selection
    voiceSelector.addEventListener('change', () => {
        selectedPersona = voiceSelector.value;

        // Sync cards if it's a core persona
        personaCards.forEach(card => {
            card.classList.remove('active');
            if (card.dataset.persona === selectedPersona) {
                card.classList.add('active');
            }
        });
    });

    // Character Count
    textInput.addEventListener('input', () => {
        const length = textInput.value.length;
        charCount.textContent = `${length} / 2500 QUANTA`;
    });

    // Reset
    resetBtn.addEventListener('click', () => {
        textInput.value = '';
        charCount.textContent = '0 / 2500 QUANTA';
    });

    // Lazy load Kokoro
    async function initKokoro() {
        if (kokoroEngine) return kokoroEngine;

        synthesizeBtn.disabled = true;
        synthesizeBtn.innerHTML = '<span class="icon">⌛</span> DOWNLOADING ENGINE...';

        try {
            console.log("Initializing Kokoro in stable WASM mode...");
            const loadConfig = {
                dtype: "q8",
                device: "wasm",
                progress_callback: (p) => {
                    if (p.status === 'progress') {
                        if (isNaN(p.progress) || p.progress === undefined) {
                            synthesizeBtn.innerHTML = `<span class="icon">⌛</span> DOWNLOADING...`;
                        } else {
                            synthesizeBtn.innerHTML = `<span class="icon">⌛</span> LOADING ${Math.round(p.progress)}%`;
                        }
                    } else if (p.status === 'ready') {
                        synthesizeBtn.innerHTML = `<span class="icon">⌛</span> INITIALIZING...`;
                    }
                }
            };

            kokoroEngine = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", loadConfig);
            return kokoroEngine;
        } catch (error) {
            console.error("Initialization error:", error);
            throw error;
        }
    }

    // Synthesize
    synthesizeBtn.addEventListener('click', async () => {
        const text = textInput.value.trim();
        if (!text) {
            alert('Please enter some text to synthesize.');
            return;
        }

        try {
            await initKokoro();

            synthesizeBtn.disabled = true;
            synthesizeBtn.innerHTML = '<span class="icon">⌛</span> SYNTHESIZING...';

            const selectedVoice = VOICE_MAP[selectedPersona];
            console.log(`Synthesizing text: "${text}" with voice: ${selectedVoice}`);

            const audioResponse = await kokoroEngine.generate(text, {
                voice: selectedVoice,
            });

            audioBlob = audioResponse.toBlob();
            if (audioUrl) URL.revokeObjectURL(audioUrl);
            audioUrl = URL.createObjectURL(audioBlob);

            // Setup Player
            if (audioObj) {
                audioObj.pause();
                audioObj.currentTime = 0;
            }

            audioObj = new Audio(audioUrl);

            const currentTimeSpan = document.getElementById('currentTime');
            const totalTimeSpan = document.getElementById('totalTime');

            audioObj.addEventListener('loadedmetadata', () => {
                const duration = Math.floor(audioObj.duration);
                const mins = Math.floor(duration / 60).toString().padStart(2, '0');
                const secs = (duration % 60).toString().padStart(2, '0');
                totalTimeSpan.textContent = `${mins}:${secs}`;
                currentTimeSpan.textContent = '00:00';
            });

            audioObj.addEventListener('timeupdate', () => {
                const current = Math.floor(audioObj.currentTime);
                const mins = Math.floor(current / 60).toString().padStart(2, '0');
                const secs = (current % 60).toString().padStart(2, '0');
                currentTimeSpan.textContent = `${mins}:${secs}`;
            });

            audioObj.onended = () => {
                isPlaying = false;
                playBtn.innerHTML = '<div class="play-icon"></div>';
            };

            // Update UI
            const displayName = VOICE_NAMES[selectedVoice] || (selectedPersona.charAt(0).toUpperCase() + selectedPersona.slice(1));
            personaDisplay.textContent = displayName;
            fileNameDisplay.textContent = `PROJECT_${selectedPersona.toUpperCase()}_SYNTHESIS_${Math.floor(Math.random() * 100)}.WAV`;
            outputPanel.style.display = 'block';
            outputPanel.scrollIntoView({ behavior: 'smooth' });

            synthesizeBtn.disabled = false;
            synthesizeBtn.innerHTML = '<span class="icon">⚡</span> SYNTHESIZE AUDIO';

            // Auto-play
            audioObj.play();
            isPlaying = true;
            playBtn.innerHTML = '<div style="width:20px; height:20px; display:flex; gap:4px;"><div style="flex:1; background:#00f2ff;"></div><div style="flex:1; background:#00f2ff;"></div></div>';
            requestAnimationFrame(updateWaveform);

        } catch (error) {
            console.error(error);
            alert('Error during synthesis. Browser-side engine might still be loading or incompatible.');
            synthesizeBtn.disabled = false;
            synthesizeBtn.innerHTML = '<span class="icon">⚡</span> SYNTHESIZE AUDIO';
        }
    });

    // Play/Pause
    playBtn.addEventListener('click', () => {
        if (!audioObj) return;

        if (isPlaying) {
            audioObj.pause();
            isPlaying = false;
            playBtn.innerHTML = '<div class="play-icon"></div>';
        } else {
            audioObj.play();
            isPlaying = true;
            playBtn.innerHTML = '<div style="width:20px; height:20px; display:flex; gap:4px;"><div style="flex:1; background:#00f2ff;"></div><div style="flex:1; background:#00f2ff;"></div></div>';
            requestAnimationFrame(updateWaveform);
        }
    });

    // Download
    downloadBtn.addEventListener('click', () => {
        if (!audioUrl) return;
        const a = document.createElement('a');
        a.href = audioUrl;
        a.download = fileNameDisplay.textContent;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    });

    // Waveform Animation (Simulated)
    function drawWaveform(progress) {
        ctx.clearRect(0, 0, waveformCanvas.width, waveformCanvas.height);
        ctx.beginPath();
        ctx.strokeStyle = '#e100ff';
        ctx.lineWidth = 2;

        const width = waveformCanvas.width;
        const height = waveformCanvas.height;
        const centerY = height / 2;

        for (let x = 0; x < width; x++) {
            const relativeX = x / width;
            const sine = Math.sin(relativeX * 15 + progress * 0.1);
            const amplitude = 20 * Math.sin(relativeX * Math.PI);
            const y = centerY + sine * amplitude;

            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();

        if (isPlaying && audioObj) {
            const playedX = (audioObj.currentTime / audioObj.duration) * width;
            ctx.beginPath();
            ctx.strokeStyle = '#00f2ff';
            ctx.lineWidth = 4;
            ctx.moveTo(playedX, 0);
            ctx.lineTo(playedX, height);
            ctx.stroke();
        }
    }

    let progressCount = 0;
    function updateWaveform() {
        if (!isPlaying) return;
        progressCount++;
        drawWaveform(progressCount);
        requestAnimationFrame(updateWaveform);
    }
});

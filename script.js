document.addEventListener('DOMContentLoaded', () => {
    fetch('settings.json')
        .then(response => response.json())
        .then(data => {
            setupGreeting(data.person);
            setupDesign(data.design);
            
            if (data.media && data.media.gallery && data.media.gallery.length > 0) {
                const gallery = data.media.gallery;
                preloadUniqueVideos(gallery);
                const itemsCount = data.media.itemsPerColumn || 10;
                
                // Создаем "умные плейлисты" для каждой колонки
                const leftColumnItems = generateFairRandomList(gallery, itemsCount);
                const rightColumnItems = generateFairRandomList(gallery, itemsCount);
                
                populateWaterfall('left-column', leftColumnItems);
                populateWaterfall('right-column', rightColumnItems);
            }
            startEffects(data.design.effects);
        })
        .catch(error => console.error("Ошибка при загрузке settings.json:", error));

    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    let isAudioContextInitialized = false;
    const masterGain = audioContext.createGain();
    const lowPassFilter = audioContext.createBiquadFilter();
    const delay = audioContext.createDelay();
    const feedback = audioContext.createGain();
    masterGain.gain.value = 0.8;
    lowPassFilter.type = 'lowpass';
    lowPassFilter.frequency.value = 3000;
    delay.delayTime.value = 0.1;
    feedback.gain.value = 0.15;
    lowPassFilter.connect(delay);
    delay.connect(masterGain);
    masterGain.connect(audioContext.destination);
    delay.connect(feedback);
    feedback.connect(delay);
    const globalAudioPlayer = new Audio();
    let globalAudioSource;

    function initializeAudioContext() {
        if (isAudioContextInitialized) return;
        audioContext.resume();
        globalAudioSource = audioContext.createMediaElementSource(globalAudioPlayer);
        globalAudioSource.connect(lowPassFilter);
        isAudioContextInitialized = true;
    }

    function generateFairRandomList(gallery, count) {
        // 1. Создаем копию галереи, чтобы не изменять оригинал
        let shuffledGallery = [...gallery];

        // 2. Перемешиваем эту копию по алгоритму Фишера–Йейтса (самый надежный способ)
        for (let i = shuffledGallery.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffledGallery[i], shuffledGallery[j]] = [shuffledGallery[j], shuffledGallery[i]];
        }

        // 3. Создаем финальный длинный список, повторяя перемешанный плейлист
        const resultList = [];
        if (shuffledGallery.length > 0) {
            for (let i = 0; i < count; i++) {
                // Оператор % позволяет зациклить массив
                resultList.push(shuffledGallery[i % shuffledGallery.length]);
            }
        }
        return resultList;
    }

    function preloadUniqueVideos(gallery) {
        const uniqueVideoUrls = new Set();
        gallery.forEach(item => { if (item.type === 'video') uniqueVideoUrls.add(item.src); });
        uniqueVideoUrls.forEach(url => {
            fetch(url).then(response => response.blob())
            .then(() => console.log(`Видео ${url} предзагружено.`))
            .catch(err => console.error(`Ошибка предзагрузки ${url}:`, err));
        });
    }

    function setupGreeting(person) {
        const names = person.name;
        let phrases1, phrases2;
        if (person.sex === 'Female') { phrases1 = person.phrase_pos_1_girl; phrases2 = person.phrase_pos_2_girl; }
        else { phrases1 = person.phrase_pos_1_boy; phrases2 = person.phrase_pos_2_boy; }
        if (!names?.length || !phrases1?.length || !phrases2?.length) { console.error("Массивы в settings.json не могут быть пустыми."); return; }
        const fullGreetings = [];
        const loopCount = Math.max(names.length, phrases1.length, phrases2.length);
        for (let i = 0; i < loopCount; i++) {
            const name = names[i % names.length];
            const phrase1 = phrases1[i % phrases1.length];
            const phrase2 = phrases2[i % phrases2.length];
            fullGreetings.push(`${name}, ${phrase1} ${phrase2}!`);
        }
        createSingleSlotAnimation('greeting-slot-wrapper', fullGreetings);
    }

    function createSingleSlotAnimation(wrapperId, items) {
        const wrapper = document.getElementById(wrapperId);
        if (!wrapper || !items || items.length === 0) return;
        const container = document.createElement('div');
        container.className = 'slot-container';
        wrapper.appendChild(container);
        items.forEach(text => {
            const item = document.createElement('div');
            item.className = 'slot-item';
            item.textContent = text;
            container.appendChild(item);
        });
        if (items.length > 1) {
            let currentIndex = 0;
            setInterval(() => {
                currentIndex = (currentIndex + 1) % items.length;
                container.style.transform = `translateY(-${currentIndex * 1.5}em)`;
            }, 5000);
        } else {
            container.style.transform = 'translateY(0)';
        }
    }
    
    function populateWaterfall(columnId, mediaItems) {
        const column = document.getElementById(columnId).querySelector('.waterfall-content');
        const itemsToLoad = [...mediaItems, ...mediaItems];
        itemsToLoad.forEach(item => {
            const container = document.createElement('div');
            container.className = 'media-item loading';
            
            if (item.type === 'image' || item.type === 'photo') {
                const mediaElement = document.createElement('img');
                mediaElement.onload = () => { container.classList.remove('loading'); mediaElement.style.opacity = '1'; };
                mediaElement.onerror = () => { console.error(`ОШИБКА: Не удалось загрузить: ${item.src}`); container.style.border = "2px dashed red"; container.classList.remove('loading'); };
                mediaElement.src = item.src;
                container.appendChild(mediaElement);
                if (item.text) {
                    const caption = document.createElement('div');
                    caption.className = 'media-caption';
                    caption.textContent = item.text;
                    container.appendChild(caption);
                }
                if (item.audio) setupAudioHover(container, item.audio);
            } else if (item.type === 'video') {
                const mediaElement = document.createElement('video');
                mediaElement.crossOrigin = 'anonymous';
                mediaElement.muted = true;
                mediaElement.loop = true;
                mediaElement.autoplay = false;
                mediaElement.playsInline = true;
                mediaElement.preload = 'metadata';
                mediaElement.addEventListener('loadeddata', () => { container.classList.remove('loading'); mediaElement.style.opacity = '1'; });
                mediaElement.src = item.src;
                container.appendChild(mediaElement);
                const soundIcon = document.createElement('span');
                soundIcon.className = 'sound-indicator';
                soundIcon.textContent = '🔊';
                container.appendChild(soundIcon);
                setupVideoHoverControls(container, mediaElement);
            } else if (item.type === 'audio') {
                container.classList.remove('loading');
                container.classList.add('media-item-audio');
                if (item.text) {
                    const textElement = document.createElement('p');
                    textElement.textContent = item.text;
                    container.appendChild(textElement);
                }
                setupAudioHover(container, item.src);
            }
            column.appendChild(container);
        });
    }

    function setupVideoHoverControls(container, videoElement) {
        const videoSource = audioContext.createMediaElementSource(videoElement);
        videoSource.connect(lowPassFilter);
        container.addEventListener('mouseenter', () => {
            initializeAudioContext();
            videoElement.muted = false;
            const playPromise = videoElement.play();
            if (playPromise !== undefined) {
                playPromise.catch(error => console.warn("Браузер заблокировал воспроизведение:", error));
            }
            container.classList.add('sound-on');
        });
        container.addEventListener('mouseleave', () => {
            videoElement.pause();
            container.classList.remove('sound-on');
        });
    }

    function setupAudioHover(element, audioSrc) {
        element.addEventListener('mouseenter', () => {
            initializeAudioContext();
            globalAudioPlayer.src = audioSrc;
            globalAudioPlayer.play();
            element.classList.add('playing');
        });
        element.addEventListener('mouseleave', () => {
            globalAudioPlayer.pause();
            globalAudioPlayer.currentTime = 0;
            element.classList.remove('playing');
        });
    }

    function startEffects(effectType) {
        const container = document.getElementById('effects-container');
        const effectsMap = { 'hearts': '❤️', 'snowflakes': '❄️', 'stars': '✨' };
        const effectChar = effectsMap[effectType] || '❤️';
        setInterval(() => {
            const effect = document.createElement('div');
            effect.className = effectType.slice(0, -1);
            effect.textContent = effectChar;
            effect.style.left = `${Math.random() * 100}vw`;
            effect.style.animationDuration = `${Math.random() * 7 + 5}s`;
            effect.style.opacity = Math.random() * 0.6 + 0.2;
            container.appendChild(effect);
            setTimeout(() => { effect.remove(); }, 13000);
        }, 300);
    }

    function generateRandomMediaList(gallery, count) {
        const randomList = [];
        for (let i = 0; i < count; i++) {
            const randomIndex = Math.floor(Math.random() * gallery.length);
            randomList.push(gallery[randomIndex]);
        }
        return randomList;
    }

    function setupDesign(design) {
        const root = document.documentElement;
        root.style.setProperty('--primary-color', design.colors.primary);
        root.style.setProperty('--secondary-color', design.colors.secondary);
        root.style.setProperty('--text-color', design.colors.text);
    }
});
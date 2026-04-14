document.addEventListener('DOMContentLoaded', () => {
    const btnBack = document.getElementById('btn-back');
    const mainMenu = document.getElementById('main-menu');
    const testView = document.getElementById('test-view');
    const dynamicTestContainer = document.getElementById('dynamic-test-container');
    const testTitle = document.getElementById('test-title');
    const tooltip = document.getElementById('tooltip');
    const navTabs = document.querySelectorAll('.nav-tab');
    const versionLabel = document.getElementById('app-version');
    const COMPLETED_TESTS_KEY = 'pruefer_completed_tests_v1';

    let allData = null;
    let woerterData = null;
    let currentTest = null;
    let currentModule = "lesen"; // Default module
    
    // Trainer state
    let currentWoerterList = [];
    let currentTrainerIndex = 0;

    // UI state preservation
    let menuState = { scrollY: 0, expandedParts: {} };
    let completedTests = loadCompletedTests();

    function loadCompletedTests() {
        try {
            const raw = localStorage.getItem(COMPLETED_TESTS_KEY);
            const parsed = raw ? JSON.parse(raw) : [];
            return new Set(Array.isArray(parsed) ? parsed : []);
        } catch (error) {
            console.error('Completed tests state not available:', error);
            return new Set();
        }
    }

    function saveCompletedTests() {
        try {
            localStorage.setItem(COMPLETED_TESTS_KEY, JSON.stringify([...completedTests]));
        } catch (error) {
            console.error('Completed tests state could not be saved:', error);
        }
    }

    function isTestCompleted(testId) {
        return completedTests.has(testId);
    }

    function setTestCompleted(testId, completed) {
        if (!testId) return;

        if (completed) completedTests.add(testId);
        else completedTests.delete(testId);

        saveCompletedTests();
        updateCompleteButtonState();
        initMenu();
    }

    function resetPartCompletedTests(module, part) {
        if (!allData || !allData.tests) return;

        allData.tests
            .filter(test => test.module === module && test.part === part)
            .forEach(test => completedTests.delete(test.id));

        saveCompletedTests();
        initMenu();
    }

    function updateCompleteButtonState() {
        const btnCompleteToggle = document.getElementById('btn-complete-toggle');
        if (!btnCompleteToggle || !currentTest) return;

        if (isTestCompleted(currentTest.id)) {
            btnCompleteToggle.textContent = 'Markierung entfernen';
            btnCompleteToggle.classList.add('is-completed');
        } else {
            btnCompleteToggle.textContent = 'Als bestanden markieren';
            btnCompleteToggle.classList.remove('is-completed');
        }
    }
    const cacheToken = `${Date.now()}`;

    function withCacheBust(file) {
        const separator = file.includes('?') ? '&' : '?';
        return `${file}${separator}v=${cacheToken}`;
    }

    function fetchJson(file, errorLabel) {
        return fetch(withCacheBust(file), {
            cache: 'no-store'
        }).then(response => {
            if (!response.ok) throw new Error(`${file} fetch failed`);
            return response.json();
        }).catch(err => {
            console.error(`${errorLabel} not found:`, err);
            return null;
        });
    }

    async function updateVersionLabel() {
        if (!versionLabel) return;

        const trackedFiles = [
            'index.html',
            'app.js',
            'style.css',
            'data.json',
            'hoeren.json',
            'sprachbausteine.json',
            'sprechen.json',
            'schreiben.json',
            'woerter.json'
        ];

        const responses = await Promise.allSettled(
            trackedFiles.map(file =>
                fetch(withCacheBust(file), {
                    method: 'HEAD',
                    cache: 'no-store'
                })
            )
        );

        const timestamps = responses
            .filter(result => result.status === 'fulfilled' && result.value.ok)
            .map(result => result.value.headers.get('last-modified'))
            .filter(Boolean)
            .map(value => new Date(value))
            .filter(date => !Number.isNaN(date.getTime()))
            .map(date => date.getTime());

        const versionDate = timestamps.length > 0
            ? new Date(Math.max(...timestamps))
            : new Date(document.lastModified);

        const year = versionDate.getFullYear();
        const month = String(versionDate.getMonth() + 1).padStart(2, '0');
        const day = String(versionDate.getDate()).padStart(2, '0');
        const hours = String(versionDate.getHours()).padStart(2, '0');
        const minutes = String(versionDate.getMinutes()).padStart(2, '0');

        versionLabel.textContent = `Version ${year}.${month}.${day} ${hours}:${minutes}`;
    }

    updateVersionLabel();

    // Load JSON data
    Promise.all([
        fetchJson('data.json', 'Data'),
        fetchJson('woerter.json', 'Woerter'),
        fetchJson('sprachbausteine.json', 'Sprachbausteine'),
        fetchJson('hoeren.json', 'Hoeren'),
        fetchJson('sprechen.json', 'Sprechen'),
        fetchJson('schreiben.json', 'Schreiben')
    ]).then(([r1, r2, r3, r4, r5, r6]) => {
        allData = r1;
        woerterData = r2;
        if (allData && allData.tests) {
            if (r3) allData.tests = allData.tests.concat(r3);
            if (r4) allData.tests = allData.tests.concat(r4);
            if (r5) allData.tests = allData.tests.concat(r5);
            if (r6) allData.tests = allData.tests.concat(r6);
        }
        if (!allData) {
            document.getElementById('test-list').innerHTML = '<p class="error">Fehler beim Laden der Daten.</p>';
        } else {
            initMenu();
        }
    });

    // Top Navigation Listeners
    navTabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            navTabs.forEach(t => t.classList.remove('active'));
            e.currentTarget.classList.add('active');
            currentModule = e.currentTarget.getAttribute('data-module');
            
            const trainerView = document.getElementById('trainer-view');
            if (currentModule === 'trainer') {
                mainMenu.classList.remove('active');
                testView.classList.remove('active');
                if (trainerView) trainerView.classList.add('active');
                initTrainer();
            } else {
                if (trainerView) trainerView.classList.remove('active');
                testView.classList.remove('active');
                mainMenu.classList.add('active');
                initMenu();
            }
        });
    });

    // Make header logo go back to main menu
    const headerTitle = document.querySelector('header h1');
    headerTitle.style.cursor = 'pointer';
    headerTitle.addEventListener('click', () => {
        if (testView.classList.contains('active')) {
            btnBack.click();
        }
    });

    function formatPartName(part) {
        if (currentModule === 'schreiben') {
            if (part === "teil_1") return "Überblick";
            if (part === "teil_2") return "Beschwerde";
            if (part === "teil_3") return "Telefonnotiz";
            if (part === "teil_4") return "Forumsbeitrag";
        }
        if (part === "teil_1") return "Teil 1";
        if (part === "teil_2") return "Teil 2";
        if (part === "teil_3") return "Teil 3";
        if (part === "teil_4") return "Teil 4";
        return part;
    }

    function formatTranscriptContent(content) {
        if (!content) return '';

        const rawLines = content
            .split(/<br\s*\/?>/i)
            .map(line => line.replace(/\s+/g, ' ').trim())
            .filter(Boolean);

        const paragraphs = [];

        function startsNewParagraph(line) {
            return /^Nummer \d+/.test(line) ||
                /^(?:TN ?\d+|MA ?\d+|TL ?\d+|Frau ?\d+|Herr ?\d+)\s*[:-]/.test(line) ||
                /^[A-ZÄÖÜ][^:]{0,40}:/.test(line) ||
                /^(?:Name|Telefonnummer|Weiteren Informationen|Zu erledigen):/.test(line) ||
                /^•/.test(line) ||
                /^(?:Beschwerde|Telefonnotiz)/.test(line);
        }

        rawLines.forEach(line => {
            if (paragraphs.length === 0 || startsNewParagraph(line)) {
                paragraphs.push(line);
                return;
            }

            paragraphs[paragraphs.length - 1] += ` ${line}`;
        });

        return paragraphs.join('<br>').trim();
    }

    function isReferenceCard(test) {
        return Boolean(test && test.display_mode === 'notes');
    }

    function initMenu() {
        if (!allData || !allData.tests) return;

        const testListContainer = document.getElementById('test-list');
        testListContainer.innerHTML = '';

        // Filter by current module
        const moduleTests = allData.tests.filter(t => t.module === currentModule);

        if (moduleTests.length === 0) {
            testListContainer.innerHTML = '<p>Noch keine Tests für dieses Modul verfügbar.</p>';
            return;
        }

        // Group by part
        const parts = {};
        moduleTests.forEach(t => {
            if (!parts[t.part]) parts[t.part] = [];
            parts[t.part].push(t);
        });

        const sortedParts = Object.entries(parts).sort(([partA], [partB]) => {
            const orderA = parseInt(partA.replace('teil_', ''), 10);
            const orderB = parseInt(partB.replace('teil_', ''), 10);
            return orderA - orderB;
        });

        // Render sections for each part
        for (const [part, tests] of sortedParts) {
            if (menuState.expandedParts[part] === undefined) {
                menuState.expandedParts[part] = false; // Default collapsed
            }

            const isExpanded = menuState.expandedParts[part];
            const completedCount = tests.filter(test => isTestCompleted(test.id)).length;
            const section = document.createElement('div');
            section.className = 'part-section';

            section.innerHTML = `
                <div class="part-header ${isExpanded ? 'active' : ''}" data-part="${part}">
                    <div class="part-header-main">
                        <h3 class="part-title">${formatPartName(part)}</h3>
                        <span class="part-progress">${completedCount}/${tests.length}</span>
                    </div>
                    <div class="part-header-actions">
                        <button class="secondary-btn part-reset-btn" type="button" data-part="${part}">Сбросить</button>
                        <span class="toggle-icon">${isExpanded ? '▼' : '▶'}</span>
                    </div>
                </div>
                <div class="part-grid ${isExpanded ? 'expanded' : 'collapsed'}">
                    ${tests.map(test => `
                        <button class="primary-btn test-btn" data-id="${test.id}">
                            <span class="test-btn-content">
                                <span class="icon">📖</span>
                                <span class="test-btn-label">${test.test_title}</span>
                            </span>
                            <span class="test-complete-check ${isTestCompleted(test.id) ? 'visible' : ''}" aria-hidden="true">✓</span>
                        </button>
                    `).join('')}
                </div>
            `;
            testListContainer.appendChild(section);
        }

        // Toggle Listeners
        document.querySelectorAll('.part-header').forEach(header => {
            header.addEventListener('click', (e) => {
                const part = e.currentTarget.getAttribute('data-part');
                menuState.expandedParts[part] = !menuState.expandedParts[part];
                // Record scroll exactly where we are to prevent jump upon re-render
                menuState.scrollY = window.scrollY;
                initMenu();
                window.scrollTo(0, menuState.scrollY);
            });
        });

        document.querySelectorAll('.part-reset-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                menuState.scrollY = window.scrollY;
                resetPartCompletedTests(currentModule, e.currentTarget.getAttribute('data-part'));
                window.scrollTo(0, menuState.scrollY);
            });
        });

        document.querySelectorAll('.test-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const testId = e.currentTarget.getAttribute('data-id');
                currentTest = allData.tests.find(t => t.id === testId);
                openTest();
            });
        });
    }

    function openTest() {
        menuState.scrollY = window.scrollY; // Save scroll position before layout switch
        mainMenu.classList.remove('active');
        testView.classList.add('active');
        window.scrollTo(0, 0);

        const testControls = document.querySelector('.test-controls');
        const scoreDisplay = document.getElementById('score-display');
        if (currentTest.module === 'sprechen' || currentTest.module === 'schreiben' || isReferenceCard(currentTest)) {
            testControls.classList.add('hidden');
            scoreDisplay.textContent = '';
        } else {
            testControls.classList.remove('hidden');
            scoreDisplay.textContent = `Punkte: - / ${currentTest.statements.length}`;
            scoreDisplay.style.color = 'var(--text-primary)';
            updateCompleteButtonState();
        }

        initTestUI();
    }

    // View Navigation (Back Button)
    btnBack.addEventListener('click', () => {
        testView.classList.remove('active');
        mainMenu.classList.add('active');
        currentTest = null;
        window.scrollTo(0, menuState.scrollY || 0); // Restore scroll position
    });

    // Initialize UI for a specific test based on its format (Part 1 vs Part 2)
    function initTestUI() {
        if (!currentTest) return;
        testTitle.textContent = `${formatPartName(currentTest.part)} - ${currentTest.test_title}`;
        dynamicTestContainer.innerHTML = ''; // Clear container

        if (isReferenceCard(currentTest)) {
            renderReferenceCard();
            attachTooltipListeners();
            return;
        }

        if (currentTest.module === 'sprachbausteine') {
            dynamicTestContainer.innerHTML = `
                <section class="sprachbausteine-section glass-panel" style="width: 100%;">
                    <h3>Sprachbausteine</h3>
                    <p class="instruction">Wählen Sie für jede Lücke das richtige Wort direkt im Text aus.</p>
                    <div id="inline-text-container" class="inline-text-box"></div>
                </section>
            `;
            renderSprachbausteine();
            attachTooltipListeners();
            initExamControls();
            return;
        }

        if (currentTest.module === 'sprechen') {
            renderSprechen();
            attachTooltipListeners();
            return;
        }

        if (currentTest.module === 'schreiben') {
            renderSchreiben();
            attachTooltipListeners();
            return;
        }

        if (currentTest.module === 'hoeren') {
            let audioHtml = '';
            if (currentTest.audio_url) {
                audioHtml = `
                    <section class="glass-panel" style="margin-bottom: 1.5rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap;">
                        <span style="font-weight: 500;">🎧 Hören Sie den Audio-Clip:</span>
                        <a href="${currentTest.audio_url}" target="_blank" class="primary-btn" style="text-decoration: none;">🔊 Audio in neuem Tab öffnen</a>
                    </section>
                `;
            }

            let normalTextsHtml = '';
            if (currentTest.texts) {
                const normalTexts = currentTest.texts.filter(t => t.title !== 'Transkript');
                if (normalTexts.length > 0) {
                    normalTextsHtml = `
                        <section class="texts-section glass-panel" style="margin-bottom: 1.5rem;">
                            <h3>Informationen zur Aufgabe</h3>
                            ${normalTexts.map(t => `<div class="text-content large-text">${highlightVocab(t.content)}</div>`).join('')}
                        </section>
                    `;
                }
            }

            let transcriptHtml = '';
            const transcriptData = currentTest.texts ? currentTest.texts.find(t => t.title === 'Transkript') : null;
            const transcriptContent = transcriptData ? formatTranscriptContent(transcriptData.content) : '';
            if (transcriptContent) {
                transcriptHtml = `
                    <section class="glass-panel transcript-section" style="margin-bottom: 1.5rem;">
                        <button id="btn-toggle-transcript" class="secondary-btn" style="margin-bottom: 1rem;">Transkript anzeigen</button>
                        <div id="transcript-content" class="hidden text-content transcript-content" style="border-top: 1px solid var(--border-color); padding-top: 1rem;">
                            ${highlightVocab(transcriptContent)}
                        </div>
                    </section>
                `;
            } else {
                transcriptHtml = `
                    <section class="glass-panel transcript-section" style="margin-bottom: 1.5rem;">
                        <p class="transcript-missing">Für diese Aufgabe ist im PDF kein vollständiges Transkript erhalten.</p>
                    </section>
                `;
            }

            dynamicTestContainer.innerHTML = `
                ${audioHtml}
                ${normalTextsHtml}
                ${transcriptHtml}
                <section class="statements-section glass-panel teil-2-statements" style="width: 100%;">
                    <h3>Höraufgaben</h3>
                    <div id="statements-container" class="statements-col"></div>
                </section>
            `;
            renderHoeren();

            const btnTranscript = document.getElementById('btn-toggle-transcript');
            if (btnTranscript) {
                btnTranscript.addEventListener('click', () => {
                    const content = document.getElementById('transcript-content');
                    if (content.classList.contains('hidden')) {
                        content.classList.remove('hidden');
                        btnTranscript.textContent = 'Transkript ausblenden';
                    } else {
                        content.classList.add('hidden');
                        btnTranscript.textContent = 'Transkript anzeigen';
                    }
                });
            }

            attachTooltipListeners();
            initExamControls();
            return;
        }

        if (currentTest.part === 'teil_1' || currentTest.part === 'teil_3') {
            const isTeil3 = currentTest.part === 'teil_3';
            const instructions = isTeil3
                ? 'Lesen Sie die Situationen und die Anzeigen. Welche Anzeige passt zu welcher Situation? Für eine Situation gibt es keine passende Anzeige. In diesem Fall markieren Sie ein x.'
                : 'Lesen Sie die Aufgaben und die Texte. Welcher Text passt zu welcher Person?';

            const startId = currentTest.statements[0].id;
            const endId = currentTest.statements[currentTest.statements.length - 1].id;

            dynamicTestContainer.innerHTML = `
                <section class="statements-section glass-panel">
                    <h3>Aufgaben (${startId}-${endId})</h3>
                    <p class="instruction">${instructions}</p>
                    <div id="statements-container" class="statements-grid"></div>
                </section>
                <section class="texts-section">
                    <h3>Texte ${isTeil3 ? '(a-f)' : '(a-h)'}</h3>
                    <div id="texts-container" class="texts-grid"></div>
                </section>
            `;
            renderTeil1();
        } else if (currentTest.part === 'teil_2' || currentTest.part === 'teil_4') {
            const isTeil4 = currentTest.part === 'teil_4';
            const instructions = isTeil4
                ? 'Lesen Sie den Text und die Aufgaben. Welche Lösung (a, b oder c) passt am besten?'
                : 'Lesen Sie den Text. Sind die Aussagen richtig oder falsch? Wählen Sie a, b oder c.';

            dynamicTestContainer.innerHTML = `
                <section class="texts-section teil-2-text">
                    <h3>Text</h3>
                    <div id="texts-container" class="texts-container-single"></div>
                </section>
                <section class="statements-section glass-panel teil-2-statements">
                    <h3>Aufgaben</h3>
                    <p class="instruction">${instructions}</p>
                    <div id="statements-container" class="statements-col"></div>
                </section>
            `;
            renderTeil2();
        }

        attachTooltipListeners();
        initExamControls();
    }

    function renderTeil1() {
        const statementsContainer = document.getElementById('statements-container');
        const textsContainer = document.getElementById('texts-container');

        const isTeil3 = currentTest.part === 'teil_3';
        let optionsList = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
        if (isTeil3) optionsList = ['a', 'b', 'c', 'd', 'e', 'f', 'x'];
        else if (currentTest.module === 'sprachbausteine') optionsList = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];

        statementsContainer.innerHTML = currentTest.statements.map(stmt => `
            <div class="statement-item" id="stmt-${stmt.id}">
                <div class="statement-id">${stmt.id}.</div>
                <select class="answer-select" data-id="${stmt.id}">
                    <option value="">-</option>
                    ${optionsList.map(opt => `<option value="${opt}">${opt}</option>`).join('')}
                </select>
                <div class="statement-text">${highlightVocab(stmt.text)}</div>
            </div>
        `).join('');

        textsContainer.innerHTML = currentTest.texts.map(text => `
            <div class="text-card">
                <div class="text-card-header">
                    <div class="text-id">${text.id}</div>
                    <div class="text-title">${highlightVocab(text.title)}</div>
                </div>
                <div class="text-content">${highlightVocab(text.content)}</div>
            </div>
        `).join('');
    }

    function renderTeil2() {
        const statementsContainer = document.getElementById('statements-container');
        const textsContainer = document.getElementById('texts-container');

        // Render large single text
        textsContainer.innerHTML = currentTest.texts.map(text => `
            <div class="text-card large-card">
                <div class="text-card-header">
                    <div class="text-title">${highlightVocab(text.title)}</div>
                </div>
                <div class="text-content">${highlightVocab(text.content)}</div>
            </div>
        `).join('');

        // Render statements (nested types)
        statementsContainer.innerHTML = currentTest.statements.map(stmt => {
            let optionsHtml = '';

            if (stmt.type === 'richtig_falsch') {
                optionsHtml = `
                    <select class="answer-select" data-id="${stmt.id}">
                        <option value="">- Wählen -</option>
                        <option value="richtig">richtig</option>
                        <option value="falsch">falsch</option>
                    </select>
                `;
            } else if (stmt.type === 'multiple_choice' || stmt.type === 'abc') {
                optionsHtml = `
                    <div class="mc-options">
                        ${Object.entries(stmt.options).map(([key, val]) => `
                            <div><strong>${key})</strong> ${highlightVocab(val)}</div>
                        `).join('')}
                    </div>
                    <select class="answer-select" data-id="${stmt.id}" style="margin-top: 0.5rem; width: 100%;">
                        <option value="">- Wählen -</option>
                        ${Object.keys(stmt.options).map(key => `<option value="${key}">${key}</option>`).join('')}
                    </select>
                `;
            }

            return `
                <div class="statement-item statement-col-item" id="stmt-${stmt.id}">
                    <div class="statement-header">
                        <span class="statement-id">${stmt.id}.</span>
                        <div class="statement-text">${highlightVocab(stmt.text)}</div>
                    </div>
                    ${optionsHtml}
                </div>
            `;
        }).join('');
    }

    function renderHoeren() {
        const statementsContainer = document.getElementById('statements-container');
        statementsContainer.innerHTML = currentTest.statements.map(stmt => {
            let selectHtml = '';
            let optionsHtml = '';

            if (stmt.type === 'richtig_falsch') {
                selectHtml = `
                    <select class="answer-select" data-id="${stmt.id}" style="margin-left: 0.5rem; width: auto; display: inline-block; vertical-align: middle; padding: 0.2rem 0.5rem;">
                        <option value="">- Wählen -</option>
                        <option value="richtig">richtig</option>
                        <option value="falsch">falsch</option>
                    </select>
                `;
            } else if (stmt.type === 'multiple_choice' || stmt.type === 'abc') {
                selectHtml = `
                    <select class="answer-select" data-id="${stmt.id}" style="margin-left: 0.5rem; width: auto; display: inline-block; vertical-align: middle; padding: 0.2rem 0.5rem;">
                        <option value="">- Wählen -</option>
                        ${stmt.options ? Object.keys(stmt.options).map(key => `<option value="${key}">${key}</option>`).join('') : ''}
                    </select>
                `;
                optionsHtml = `
                    <div class="mc-options" style="margin-top: 0.5rem; margin-left: 2rem;">
                        ${stmt.options ? Object.entries(stmt.options).map(([key, val]) => `
                            <div><strong>${key})</strong> ${highlightVocab(val)}</div>
                        `).join('') : ''}
                    </div>
                `;
            }

            return `
                <div class="statement-item statement-col-item" id="stmt-${stmt.id}" style="display: block;">
                    <div class="statement-text" style="display: inline; line-height: 2;">
                        <span class="statement-id" style="font-weight: bold; margin-right: 0.5rem; color: var(--accent);">${stmt.id}.</span>
                        <span style="display: inline; vertical-align: middle;">${highlightVocab(stmt.text)}</span>
                        ${selectHtml}
                    </div>
                    ${optionsHtml}
                </div>
            `;
        }).join('');
    }

    function renderReferenceCard() {
        const resourcesHtml = currentTest.resource_groups && currentTest.resource_groups.length > 0
            ? `
                <section class="glass-panel schreiben-panel">
                    <h3>Materialien & Links</h3>
                    <div class="schreiben-resource-groups">
                        ${currentTest.resource_groups.map(group => `
                            <div class="schreiben-resource-group">
                                <h4>${group.title}</h4>
                                <div class="schreiben-link-grid">
                                    ${group.links.map(link => `
                                        <a href="${link.url}" target="_blank" class="secondary-btn schreiben-link-btn">${link.label}</a>
                                    `).join('')}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </section>
            `
            : '';

        const sectionsHtml = currentTest.sections && currentTest.sections.length > 0
            ? currentTest.sections.map(section => `
                <section class="glass-panel schreiben-panel">
                    <h3>${section.title}</h3>
                    ${section.lead ? `<p class="instruction">${highlightVocab(section.lead)}</p>` : ''}
                    ${section.paragraphs && section.paragraphs.length > 0 ? `
                        <div class="schreiben-subsection">
                            ${section.paragraphs.map(paragraph => `<p class="instruction">${highlightVocab(paragraph)}</p>`).join('')}
                        </div>
                    ` : ''}
                    ${section.bullets && section.bullets.length > 0 ? `
                        <ul class="schreiben-bullet-list">
                            ${section.bullets.map(item => `<li>${highlightVocab(item)}</li>`).join('')}
                        </ul>
                    ` : ''}
                    ${section.links && section.links.length > 0 ? `
                        <div class="schreiben-link-grid">
                            ${section.links.map(link => `
                                <a href="${link.url}" target="_blank" class="secondary-btn schreiben-link-btn">${link.label}</a>
                            `).join('')}
                        </div>
                    ` : ''}
                </section>
            `).join('')
            : '';

        const notesHtml = currentTest.notes && currentTest.notes.length > 0
            ? `
                <section class="glass-panel schreiben-panel">
                    <h3>Notizen aus dem PDF</h3>
                    <ul class="schreiben-bullet-list">
                        ${currentTest.notes.map(note => `<li>${highlightVocab(note)}</li>`).join('')}
                    </ul>
                </section>
            `
            : '';

        dynamicTestContainer.innerHTML = `
            <section class="glass-panel schreiben-panel">
                <h3>${currentTest.test_title}</h3>
                <p class="instruction">${highlightVocab(currentTest.intro || '')}</p>
            </section>
            ${resourcesHtml}
            ${sectionsHtml}
            ${notesHtml}
        `;
    }

    function renderSprechen() {
        const statsHtml = currentTest.stats && currentTest.stats.length > 0
            ? `
                <section class="glass-panel sprechen-panel">
                    <h3>Punkte & Zeit</h3>
                    <div class="sprechen-stats-grid">
                        ${currentTest.stats.map(stat => `
                            <div class="sprechen-stat-card">
                                <div class="sprechen-stat-label">${stat.label}</div>
                                <div class="sprechen-stat-value">${stat.value}</div>
                            </div>
                        `).join('')}
                    </div>
                </section>
            `
            : '';

        const resourcesHtml = currentTest.resource_groups && currentTest.resource_groups.length > 0
            ? `
                <section class="glass-panel sprechen-panel">
                    <h3>Materialien & Links</h3>
                    <div class="sprechen-resource-groups">
                        ${currentTest.resource_groups.map(group => `
                            <div class="sprechen-resource-group">
                                <h4>${group.title}</h4>
                                <div class="sprechen-link-grid">
                                    ${group.links.map(link => `
                                        <a href="${link.url}" target="_blank" class="secondary-btn sprechen-link-btn">${link.label}</a>
                                    `).join('')}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </section>
            `
            : '';

        const situationsHtml = currentTest.situations && currentTest.situations.length > 0
            ? `
                <section class="glass-panel sprechen-panel">
                    <h3>Situationen</h3>
                    <div class="sprechen-situations">
                        ${currentTest.situations.map(situation => `
                            <details class="sprechen-situation">
                                <summary>${situation.title}</summary>
                                <div class="sprechen-situation-body">
                                    <p class="instruction" style="margin-bottom: 1rem;">${highlightVocab(situation.description)}</p>
                                    <ul class="sprechen-bullet-list">
                                        ${situation.prompts.map(prompt => `<li>${highlightVocab(prompt)}</li>`).join('')}
                                    </ul>
                                </div>
                            </details>
                        `).join('')}
                    </div>
                </section>
            `
            : '';

        const notesHtml = currentTest.notes && currentTest.notes.length > 0
            ? `
                <section class="glass-panel sprechen-panel">
                    <h3>Notizen aus dem PDF</h3>
                    <ul class="sprechen-bullet-list">
                        ${currentTest.notes.map(note => `<li>${highlightVocab(note)}</li>`).join('')}
                    </ul>
                </section>
            `
            : '';

        dynamicTestContainer.innerHTML = `
            <section class="glass-panel sprechen-panel">
                <h3>${currentTest.test_title}</h3>
                <p class="instruction">${highlightVocab(currentTest.intro || '')}</p>
            </section>
            ${statsHtml}
            ${resourcesHtml}
            ${situationsHtml}
            ${notesHtml}
        `;
    }

    function renderSchreiben() {
        const isTelefonnotiz = currentTest.part === 'teil_3';

        const statsHtml = currentTest.stats && currentTest.stats.length > 0
            ? `
                <section class="glass-panel schreiben-panel">
                    <h3>Punkte & Zeit</h3>
                    <div class="schreiben-stats-grid">
                        ${currentTest.stats.map(stat => `
                            <div class="schreiben-stat-card">
                                <div class="schreiben-stat-label">${stat.label}</div>
                                <div class="schreiben-stat-value">${stat.value}</div>
                            </div>
                        `).join('')}
                    </div>
                </section>
            `
            : '';

        const resourcesHtml = currentTest.resource_groups && currentTest.resource_groups.length > 0
            ? `
                <section class="glass-panel schreiben-panel">
                    <h3>Materialien & Links</h3>
                    <div class="schreiben-resource-groups">
                        ${currentTest.resource_groups.map(group => `
                            <div class="schreiben-resource-group">
                                <h4>${group.title}</h4>
                                <div class="schreiben-link-grid">
                                    ${group.links.map(link => `
                                        <a href="${link.url}" target="_blank" class="secondary-btn schreiben-link-btn">${link.label}</a>
                                    `).join('')}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </section>
            `
            : '';

        const variantsHtml = currentTest.variants && currentTest.variants.length > 0
            ? `
                <section class="glass-panel schreiben-panel">
                    <h3>Varianten</h3>
                    <div class="schreiben-variants">
                        ${currentTest.variants.map(variant => `
                            ${isTelefonnotiz ? `
                                <div class="schreiben-variant schreiben-variant-static">
                                    <div class="schreiben-variant-body">
                                        <h4 class="schreiben-variant-title">${variant.title}</h4>
                                        ${variant.links && variant.links.length > 0 ? `
                                            <div class="schreiben-subsection">
                                                <h4>Audio</h4>
                                                <div class="schreiben-link-grid">
                                                    ${variant.links.map(link => `
                                                        <a href="${link.url}" target="_blank" class="secondary-btn schreiben-link-btn">${link.label}</a>
                                                    `).join('')}
                                                </div>
                                            </div>
                                        ` : ''}
                                        <details class="schreiben-hint">
                                            <summary>Подсказка</summary>
                                            <div class="schreiben-hint-body">
                                                ${variant.question_points && variant.question_points.length > 0 ? `
                                                    <div class="schreiben-subsection">
                                                        <h4>Aufgaben / Hinweise</h4>
                                                        <ul class="schreiben-bullet-list">
                                                            ${variant.question_points.map(point => `<li>${highlightVocab(point)}</li>`).join('')}
                                                        </ul>
                                                    </div>
                                                ` : ''}
                                                ${variant.data_points && variant.data_points.length > 0 ? `
                                                    <div class="schreiben-subsection">
                                                        <h4>Wichtige Notizfelder</h4>
                                                        <ul class="schreiben-bullet-list">
                                                            ${variant.data_points.map(point => `<li>${highlightVocab(point)}</li>`).join('')}
                                                        </ul>
                                                    </div>
                                                ` : ''}
                                                ${variant.todo ? `
                                                    <div class="schreiben-subsection">
                                                        <h4>Zu erledigen</h4>
                                                        <p class="instruction">${highlightVocab(variant.todo)}</p>
                                                    </div>
                                                ` : ''}
                                            </div>
                                        </details>
                                    </div>
                                </div>
                            ` : `
                                <details class="schreiben-variant">
                                    <summary>${variant.title}</summary>
                                    <div class="schreiben-variant-body">
                                        ${variant.question_points && variant.question_points.length > 0 ? `
                                            <div class="schreiben-subsection">
                                                <h4>Aufgaben / Hinweise</h4>
                                                <ul class="schreiben-bullet-list">
                                                    ${variant.question_points.map(point => `<li>${highlightVocab(point)}</li>`).join('')}
                                                </ul>
                                            </div>
                                        ` : ''}
                                        ${variant.situation_points && variant.situation_points.length > 0 ? `
                                            <div class="schreiben-subsection">
                                                <h4>Situation aus dem PDF</h4>
                                                <ul class="schreiben-bullet-list">
                                                    ${variant.situation_points.map(point => `<li>${highlightVocab(point)}</li>`).join('')}
                                                </ul>
                                            </div>
                                        ` : ''}
                                        ${variant.data_points && variant.data_points.length > 0 ? `
                                            <div class="schreiben-subsection">
                                                <h4>Wichtige Notizfelder</h4>
                                                <ul class="schreiben-bullet-list">
                                                    ${variant.data_points.map(point => `<li>${highlightVocab(point)}</li>`).join('')}
                                                </ul>
                                            </div>
                                        ` : ''}
                                        ${variant.reply_points && variant.reply_points.length > 0 ? `
                                            <div class="schreiben-subsection">
                                                <h4>Was in die Antwort muss</h4>
                                                <ul class="schreiben-bullet-list">
                                                    ${variant.reply_points.map(point => `<li>${highlightVocab(point)}</li>`).join('')}
                                                </ul>
                                            </div>
                                        ` : ''}
                                        ${variant.todo ? `
                                            <div class="schreiben-subsection">
                                                <h4>Zu erledigen</h4>
                                                <p class="instruction">${highlightVocab(variant.todo)}</p>
                                            </div>
                                        ` : ''}
                                        ${variant.links && variant.links.length > 0 ? `
                                            <div class="schreiben-subsection">
                                                <h4>Links</h4>
                                                <div class="schreiben-link-grid">
                                                    ${variant.links.map(link => `
                                                        <a href="${link.url}" target="_blank" class="secondary-btn schreiben-link-btn">${link.label}</a>
                                                    `).join('')}
                                                </div>
                                            </div>
                                        ` : ''}
                                    </div>
                                </details>
                            `}
                        `).join('')}
                    </div>
                </section>
            `
            : '';

        const recentTopicsHtml = currentTest.recent_topics && currentTest.recent_topics.length > 0
            ? `
                <section class="glass-panel schreiben-panel">
                    <h3>Letzte Themen aus dem PDF</h3>
                    <div class="schreiben-topic-grid">
                        ${currentTest.recent_topics.map(topic => `
                            <div class="schreiben-topic-card">
                                <div class="schreiben-topic-meta">${topic.exam} · ${topic.label}</div>
                                <div class="schreiben-topic-text">${highlightVocab(topic.text)}</div>
                            </div>
                        `).join('')}
                    </div>
                </section>
            `
            : '';

        const themesHtml = currentTest.themes && currentTest.themes.length > 0
            ? `
                <section class="glass-panel schreiben-panel">
                    <h3>Themenpool</h3>
                    <div class="schreiben-theme-grid">
                        ${currentTest.themes.map((theme, index) => `
                            <div class="schreiben-theme-card">
                                <div class="schreiben-theme-index">${index + 1}</div>
                                <div class="schreiben-theme-text">${highlightVocab(theme)}</div>
                            </div>
                        `).join('')}
                    </div>
                </section>
            `
            : '';

        const historicalTopicsHtml = currentTest.historical_topics && currentTest.historical_topics.length > 0
            ? `
                <section class="glass-panel schreiben-panel">
                    <h3>Bereits gelaufene Forum-Themen</h3>
                    <div class="schreiben-theme-grid">
                        ${currentTest.historical_topics.map((theme, index) => `
                            <div class="schreiben-theme-card">
                                <div class="schreiben-theme-index">${index + 1}</div>
                                <div class="schreiben-theme-text">${highlightVocab(theme)}</div>
                            </div>
                        `).join('')}
                    </div>
                </section>
            `
            : '';

        const notesHtml = currentTest.notes && currentTest.notes.length > 0
            ? `
                <section class="glass-panel schreiben-panel">
                    <h3>Notizen aus dem PDF</h3>
                    <ul class="schreiben-bullet-list">
                        ${currentTest.notes.map(note => `<li>${highlightVocab(note)}</li>`).join('')}
                    </ul>
                </section>
            `
            : '';

        dynamicTestContainer.innerHTML = `
            <section class="glass-panel schreiben-panel">
                <h3>${currentTest.test_title}</h3>
                <p class="instruction">${highlightVocab(currentTest.intro || '')}</p>
            </section>
            ${statsHtml}
            ${resourcesHtml}
            ${variantsHtml}
            ${recentTopicsHtml}
            ${themesHtml}
            ${historicalTopicsHtml}
            ${notesHtml}
        `;
    }

    function renderSprachbausteine() {
        const container = document.getElementById('inline-text-container');
        let content = currentTest.texts[0].content;

        // Sort statements by id descending so replacing 51 before 5
        const sortedStmts = [...currentTest.statements].sort((a, b) => b.id - a.id);

        sortedStmts.forEach(stmt => {
            // Find pattern like "46 (" in content, then find closing ")"
            const searchStart = String(stmt.id) + ' (';
            const searchStart2 = String(stmt.id) + '(';
            let idx = content.indexOf(searchStart);
            if (idx === -1) idx = content.indexOf(searchStart2);
            if (idx === -1) return;

            // Find the closing parenthesis
            const closeIdx = content.indexOf(')', idx);
            if (closeIdx === -1) return;

            const fullMatch = content.substring(idx, closeIdx + 1);

            let optionsHtml = '<option value="">- ' + stmt.id + ' -</option>';
            Object.keys(stmt.options).sort().forEach(key => {
                optionsHtml += '<option value="' + key + '">' + key + ') ' + stmt.options[key] + '</option>';
            });

            const selectHtml = '<span class="statement-item inline-statement" id="stmt-' + stmt.id + '">' +
                '<select class="answer-select inline-select" data-id="' + stmt.id + '">' +
                optionsHtml +
                '</select></span>';

            content = content.replace(fullMatch, selectHtml);
        });

        container.innerHTML = '<div class="text-content large-text">' + content + '</div>';
    }

    // Function to highlight vocabulary words in text (Fixed single-pass regex algorithm)
    function highlightVocab(text) {
        if (!allData || !allData.vocabulary || !text) return text;

        const vocabWords = Object.keys(allData.vocabulary);
        // Sort by length descending so longer words are matched first
        vocabWords.sort((a, b) => b.length - a.length);

        const regexStr = `(^|[^a-zA-ZäöüÄÖÜß])(${vocabWords.join('|')})(?=[^a-zA-ZäöüÄÖÜß]|$)`;
        const regex = new RegExp(regexStr, 'g');

        return text.replace(regex, (match, before, word) => {
            const vocabEntry = allData.vocabulary[word];
            if (!vocabEntry) return match;

            const dataStr = encodeURIComponent(JSON.stringify(vocabEntry));
            return `${before}<span class="vocab-word" data-vocab="${dataStr}">${word}</span>`;
        });
    }

    // Tooltip Logic
    function attachTooltipListeners() {
        const vocabElements = document.querySelectorAll('.vocab-word');
        vocabElements.forEach(el => {
            el.addEventListener('mouseenter', showTooltip);
            el.addEventListener('mouseleave', hideTooltip);
        });
    }

    function showTooltip(e) {
        const target = e.target;
        const vocabDataStr = target.getAttribute('data-vocab');
        if (!vocabDataStr) return;

        const vocabData = JSON.parse(decodeURIComponent(vocabDataStr));

        document.querySelector('.tooltip-translation').textContent = vocabData.translation;

        const grammarContainer = document.querySelector('.tooltip-grammar');
        if (vocabData.grammar) {
            let grammarHtml = '';
            if (vocabData.grammar.type === 'Nomen') {
                grammarHtml = `<span class="gram-article">${vocabData.grammar.article}</span> <span class="gram-type">${vocabData.grammar.type}</span> <span class="gram-plural">(Pl: ${vocabData.grammar.plural})</span>`;
            } else if (vocabData.grammar.type === 'Verb') {
                grammarHtml = `<span class="gram-type">${vocabData.grammar.type}</span> <span class="gram-form">[${vocabData.grammar.form}]</span>`;
            } else {
                grammarHtml = `<span class="gram-type">${vocabData.grammar.type}</span>`;
            }
            grammarContainer.innerHTML = grammarHtml;
            grammarContainer.classList.remove('hidden');
        } else {
            grammarContainer.innerHTML = '';
            grammarContainer.classList.add('hidden');
        }

        document.querySelector('.tooltip-beispiel').textContent = vocabData.beispiel || '-';

        const synonymsContainer = document.querySelector('.tooltip-synonyms');
        const synonymsLabel = document.querySelector('.tooltip-synonyms-label');

        if (vocabData.synonyms && vocabData.synonyms.length > 0) {
            synonymsLabel.classList.remove('hidden');
            synonymsContainer.textContent = vocabData.synonyms.join(', ');
        } else {
            synonymsLabel.classList.add('hidden');
            synonymsContainer.textContent = '';
        }

        tooltip.classList.remove('hidden');
        tooltip.classList.add('visible');
        positionTooltip(target);
    }

    function hideTooltip() {
        tooltip.classList.remove('visible');
        tooltip.classList.add('hidden');
    }

    function positionTooltip(target) {
        const rect = target.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();

        let top = rect.top + window.scrollY - tooltipRect.height - 15;
        let left = rect.left + window.scrollX + (rect.width / 2) - (tooltipRect.width / 2);

        if (top < window.scrollY + 10) {
            top = rect.bottom + window.scrollY + 15;
            tooltip.classList.add('arrow-top');
        } else {
            tooltip.classList.remove('arrow-top');
        }

        if (left < 10) left = 10;
        if (left + tooltipRect.width > window.innerWidth - 10) left = window.innerWidth - tooltipRect.width - 10;

        tooltip.style.top = `${top}px`;
        tooltip.style.left = `${left}px`;
    }

    // Exam Mode Logic
    function initExamControls() {
        const btnSubmit = document.getElementById('btn-submit');
        const btnCompleteToggle = document.getElementById('btn-complete-toggle');
        const scoreDisplay = document.getElementById('score-display');
        const hintTooltip = document.getElementById('hint-tooltip');

        // Populate hints
        const correctAnswersHtml = currentTest.statements.map(stmt =>
            `<div><b>${stmt.id}.</b> ${stmt.answer}</div>`
        ).join('');
        hintTooltip.innerHTML = correctAnswersHtml;

        // Clone and replace to fix duplicate listener
        const newBtnSubmit = btnSubmit.cloneNode(true);
        btnSubmit.parentNode.replaceChild(newBtnSubmit, btnSubmit);
        const newBtnCompleteToggle = btnCompleteToggle.cloneNode(true);
        btnCompleteToggle.parentNode.replaceChild(newBtnCompleteToggle, btnCompleteToggle);
        const newHintWrapper = document.querySelector('.hint-wrapper').cloneNode(true);
        document.querySelector('.hint-wrapper').parentNode.replaceChild(newHintWrapper, document.querySelector('.hint-wrapper'));
        const updatedHintTooltip = newHintWrapper.querySelector('.hint-tooltip');

        updateCompleteButtonState();

        newHintWrapper.addEventListener('mouseenter', () => updatedHintTooltip.classList.remove('hidden'));
        newHintWrapper.addEventListener('mouseleave', () => updatedHintTooltip.classList.add('hidden'));

        newBtnCompleteToggle.addEventListener('click', () => {
            setTestCompleted(currentTest.id, !isTestCompleted(currentTest.id));
        });

        newBtnSubmit.addEventListener('click', () => {
            let score = 0;
            const selects = document.querySelectorAll('.answer-select');

            selects.forEach(select => {
                const id = parseInt(select.getAttribute('data-id'));
                const statement = currentTest.statements.find(s => s.id === id);
                const itemDiv = document.getElementById(`stmt-${id}`);
                itemDiv.classList.remove('correct', 'incorrect');

                if (select.value === statement.answer) {
                    score++;
                    itemDiv.classList.add('correct');
                } else if (select.value !== "") {
                    itemDiv.classList.add('incorrect');
                }
            });

            scoreDisplay.textContent = `Punkte: ${score} / ${currentTest.statements.length}`;
            if (score === currentTest.statements.length) {
                scoreDisplay.style.color = '#10B981';
            } else {
                scoreDisplay.style.color = 'var(--text-primary)';
            }
        });
    }

    // --- Trainer Logic ---
    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    function initTrainer() {
        if (!woerterData || woerterData.length === 0) return;
        
        // Setup listeners if not already done
        if (!document.getElementById('flashcard').hasAttribute('data-bound')) {
            document.getElementById('flashcard').setAttribute('data-bound', 'true');
            
            document.getElementById('flashcard').addEventListener('click', (e) => {
                if(e.target.id === 'btn-fc-hint') return;
                document.getElementById('flashcard').classList.toggle('flipped');
            });

            document.getElementById('btn-next-word').addEventListener('click', () => {
                currentTrainerIndex++;
                showTrainerWord();
            });

            document.getElementById('btn-fc-hint').addEventListener('click', (e) => {
                e.stopPropagation();
                document.getElementById('btn-fc-hint').classList.add('hidden');
                document.getElementById('fc-hint-text').classList.remove('hidden');
            });

            const dirRadios = document.querySelectorAll('input[name="trainer-dir"]');
            dirRadios.forEach(radio => {
                radio.addEventListener('change', () => showTrainerWord());
            });
        }
        
        currentWoerterList = [...woerterData];
        shuffleArray(currentWoerterList);
        currentTrainerIndex = 0;
        
        showTrainerWord();
    }

    function showTrainerWord() {
        if (!currentWoerterList.length) return;

        if (currentTrainerIndex >= currentWoerterList.length) {
            shuffleArray(currentWoerterList);
            currentTrainerIndex = 0;
        }
        
        const wordObj = currentWoerterList[currentTrainerIndex];
        const direction = document.querySelector('input[name="trainer-dir"]:checked').value;
        
        const fcFrontWord = document.getElementById('fc-word-front');
        const fcBackWord = document.getElementById('fc-word-back');
        const fcExDe = document.getElementById('fc-ex-de');
        const fcExRu = document.getElementById('fc-ex-ru');
        const hintContainer = document.getElementById('fc-hint-container');
        const hintText = document.getElementById('fc-hint-text');
        const btnHint = document.getElementById('btn-fc-hint');
        
        document.getElementById('flashcard').classList.remove('flipped');
        
        if (direction === 'de-ru') {
            fcFrontWord.textContent = wordObj.de;
            fcBackWord.textContent = wordObj.ru;
            hintContainer.classList.remove('hidden');
            btnHint.classList.remove('hidden');
            hintText.classList.add('hidden');
            hintText.textContent = wordObj.example_de;
        } else {
            fcFrontWord.textContent = wordObj.ru;
            fcBackWord.textContent = wordObj.de;
            hintContainer.classList.add('hidden');
            btnHint.classList.add('hidden');
        }
        
        fcExDe.textContent = wordObj.example_de;
        fcExRu.textContent = wordObj.example_ru;
    }

});

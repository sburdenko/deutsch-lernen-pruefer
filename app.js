document.addEventListener('DOMContentLoaded', () => {
    const btnBack = document.getElementById('btn-back');
    const mainMenu = document.getElementById('main-menu');
    const testView = document.getElementById('test-view');
    const dynamicTestContainer = document.getElementById('dynamic-test-container');
    const testTitle = document.getElementById('test-title');
    const tooltip = document.getElementById('tooltip');
    const navTabs = document.querySelectorAll('.nav-tab');

    let allData = null;
    let currentTest = null;
    let currentModule = "lesen"; // Default module

    // UI state preservation
    let menuState = { scrollY: 0, expandedParts: {} };

    // Load JSON data
    fetch('data.json')
        .then(response => response.json())
        .then(data => {
            allData = data;
            initMenu();
        })
        .catch(error => {
            console.error('Error loading data:', error);
            document.getElementById('test-list').innerHTML = '<p class="error">Fehler beim Laden der Daten.</p>';
        });

    // Top Navigation Listeners
    navTabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            navTabs.forEach(t => t.classList.remove('active'));
            e.currentTarget.classList.add('active');
            currentModule = e.currentTarget.getAttribute('data-module');
            initMenu();
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
        if (part === "teil_1") return "Teil 1";
        if (part === "teil_2") return "Teil 2";
        if (part === "teil_3") return "Teil 3";
        if (part === "teil_4") return "Teil 4";
        return part;
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

        // Render sections for each part
        for (const [part, tests] of Object.entries(parts)) {
            if (menuState.expandedParts[part] === undefined) {
                menuState.expandedParts[part] = false; // Default collapsed
            }

            const isExpanded = menuState.expandedParts[part];
            const section = document.createElement('div');
            section.className = 'part-section';

            section.innerHTML = `
                <div class="part-header ${isExpanded ? 'active' : ''}" data-part="${part}">
                    <h3 class="part-title">${formatPartName(part)}</h3>
                    <span class="toggle-icon">${isExpanded ? '▼' : '▶'}</span>
                </div>
                <div class="part-grid ${isExpanded ? 'expanded' : 'collapsed'}">
                    ${tests.map(test => `
                        <button class="primary-btn test-btn" data-id="${test.id}">
                            <span class="icon">📖</span>
                            ${test.test_title}
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

        // Reset score display Context
        const scoreDisplay = document.getElementById('score-display');
        scoreDisplay.textContent = `Punkte: - / ${currentTest.statements.length}`;
        scoreDisplay.style.color = 'var(--text-primary)';

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
        const optionsList = isTeil3 ? ['a', 'b', 'c', 'd', 'e', 'f', 'x'] : ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

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
        const newHintWrapper = document.querySelector('.hint-wrapper').cloneNode(true);
        document.querySelector('.hint-wrapper').parentNode.replaceChild(newHintWrapper, document.querySelector('.hint-wrapper'));
        const updatedHintTooltip = newHintWrapper.querySelector('.hint-tooltip');

        newHintWrapper.addEventListener('mouseenter', () => updatedHintTooltip.classList.remove('hidden'));
        newHintWrapper.addEventListener('mouseleave', () => updatedHintTooltip.classList.add('hidden'));

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
});

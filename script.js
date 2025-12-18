// DOM Elements
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const fileInfo = document.getElementById('fileInfo');
const apiKeyInput = document.getElementById('apiKey');
const userPromptInput = document.getElementById('userPrompt');
const fullSystemPromptInput = document.getElementById('fullSystemPrompt');
const generateBtn = document.getElementById('generateBtn');
const statusMessage = document.getElementById('statusMessage');
const pdfPreviewContainer = document.getElementById('pdfPreviewContainer');
const pdfViewer = document.getElementById('pdfViewer');
const selectAllBtn = document.getElementById('selectAllBtn');
const deselectAllBtn = document.getElementById('deselectAllBtn');
const outputFormat = document.getElementById('outputFormat');
const aiModelSelect = document.getElementById('aiModel');
const temperatureSlider = document.getElementById('temperatureSlider');
const temperatureValue = document.getElementById('temperatureValue');

// Tabs
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

// State
let currentFile = null;
let pdfPagesData = []; // Array of { pageNum: number, text: string, selected: boolean }

// Initialize PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';

// --- Event Listeners ---

// Tab Switching
tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        // Remove active class from all
        tabBtns.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));

        // Add active to clicked
        btn.classList.add('active');
        document.getElementById(btn.dataset.tab).classList.add('active');
    });
});

// File Upload Drag & Drop
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0) handleFile(files[0]);
});

dropZone.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) handleFile(e.target.files[0]);
});


// Generate Button
generateBtn.addEventListener('click', generateWorkbook);

// Select All / Deselect All
selectAllBtn.addEventListener('click', () => {
    pdfPagesData.forEach(page => page.selected = true);
    document.querySelectorAll('.page-container').forEach(el => {
        el.classList.add('selected');
        el.classList.remove('excluded');
    });
});

deselectAllBtn.addEventListener('click', () => {
    pdfPagesData.forEach(page => page.selected = false);
    document.querySelectorAll('.page-container').forEach(el => {
        el.classList.remove('selected');
        el.classList.add('excluded');
    });
});

// Temperature Slider
temperatureSlider.addEventListener('input', (e) => {
    const value = (e.target.value / 10).toFixed(1);
    temperatureValue.textContent = value;
});

// --- Functions ---

async function handleFile(file) {
    if (file.type !== 'application/pdf') {
        alert('PDF 파일만 업로드 가능합니다.');
        return;
    }
    currentFile = file;

    // UI Update
    const content = dropZone.querySelector('.upload-content');
    content.querySelector('h3').textContent = file.name;
    content.querySelector('p').textContent = `(${(file.size / 1024 / 1024).toFixed(2)} MB)`;
    content.querySelector('.icon').textContent = '✅';

    updateStatus('PDF 처리 중... (텍스트 추출 및 미리보기 생성)');
    pdfPreviewContainer.classList.remove('hidden');

    try {
        // Parallel execution: Text Extraction + Preview Rendering
        // Note: We now extract text per page and store it
        pdfPagesData = await extractTextFromPDF(file);

        // Render PDF pages (visuals)
        await renderPDFInViewer(file);

        updateStatus('준비 완료! 필요 없는 페이지는 클릭해서 제외하세요.');
        checkReady();
    } catch (error) {
        console.error(error);
        updateStatus('오류 발생: ' + error.message);
        content.querySelector('.icon').textContent = '❌';
    }
}

async function extractTextFromPDF(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
    const pagesData = [];

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        pagesData.push({
            pageNum: i,
            text: pageText,
            selected: true // Default to selected
        });
    }
    return pagesData;
}

async function renderPDFInViewer(file) {
    pdfViewer.innerHTML = ''; // Clear previous content
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);

        // Container for Page
        const container = document.createElement('div');
        container.className = 'page-container selected'; // Default selected
        container.dataset.pageNum = i;
        container.title = '클릭하여 포함/제외 토글';

        // Page Number Indicator
        const numBadge = document.createElement('div');
        numBadge.className = 'page-number';
        numBadge.textContent = `${i}p`;
        container.appendChild(numBadge);

        // Selection Indicator (Checkmark)
        const indicator = document.createElement('div');
        indicator.className = 'selection-indicator';
        indicator.textContent = '✅';
        container.appendChild(indicator);

        // Click Event to Toggle Selection
        container.addEventListener('click', () => {
            const pageIndex = i - 1;
            const isSelected = pdfPagesData[pageIndex].selected;

            // Toggle state
            pdfPagesData[pageIndex].selected = !isSelected;

            // Toggle Visuals
            if (!isSelected) { // Was not selected, now selected
                container.classList.add('selected');
                container.classList.remove('excluded');
            } else { // Was selected, now excluded
                container.classList.remove('selected');
                container.classList.add('excluded');
            }
        });

        // Canvas setting
        const scale = 1.0; // Reduced scale for preview performance
        const viewport = page.getViewport({ scale: scale });

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        container.appendChild(canvas);
        pdfViewer.appendChild(container);

        await page.render({
            canvasContext: context,
            viewport: viewport
        }).promise;
    }
}


function checkReady() {
    // API키 입력은 실행 시점에 체크
    if (currentFile && pdfPagesData.length > 0) {
        generateBtn.disabled = false;
    }
}

function updateStatus(msg) {
    statusMessage.textContent = msg;
}


async function generateWorkbook() {
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
        alert('OpenAI API Key를 입력해주세요.');
        apiKeyInput.focus();
        return;
    }

    if (pdfPagesData.length === 0) {
        alert('PDF 파일 내용 추출에 실패했습니다.');
        return;
    }

    // Filter text from selected pages
    const selectedText = pdfPagesData
        .filter(p => p.selected)
        .map(p => p.text)
        .join('\n\n');

    if (!selectedText.trim()) {
        alert('선택된 페이지가 없습니다. 최소 1개 이상의 페이지를 선택해주세요.');
        return;
    }

    // Unified type is comprehensive, but logic depends on prompt now

    // UI Loading State
    generateBtn.disabled = true;
    updateStatus('AI가 학습지를 생성하고 있습니다... (시간이 걸릴 수 있습니다)');

    try {
        const generatedData = await callOpenAI(apiKey, selectedText, fullSystemPromptInput.value, userPromptInput.value);
        updateStatus('문서 생성 중...');

        const format = outputFormat.value;
        switch (format) {
            case 'pdf':
                await createPDF(generatedData);
                break;
            case 'html':
                await createHTML(generatedData);
                break;
            case 'docx':
            default:
                await createDocx(generatedData, 'comprehensive');
                break;
        }

        updateStatus('완료! 다운로드가 시작되었습니다.');
    } catch (error) {
        console.error(error);
        alert('오류 발생: ' + error.message);
        updateStatus('오류가 발생했습니다.');
    } finally {
        generateBtn.disabled = false;
    }
}

async function callOpenAI(apiKey, text, systemPromptTemplate, userRequest) {
    // 텍스트 길이 제한
    const truncatedText = text.substring(0, 15000);

    // The user can edit the Main Persona/Task/OutputFormat in the textarea.
    // Automatically append JSON format specification (hidden from user)
    const jsonFormatSpec = `

---
**중요: 출력 형식**
위 내용을 바탕으로 아래 JSON 구조로 출력하세요.

⚠️ **품질 요구사항 (반드시 준수):**
- 모든 설명은 최소 3-5문장으로 상세하게 작성
- 핵심 개념: 최소 8-12개 (각각 2-3문장 이상 설명)
- 필수 용어: 최소 15-20개 (각각 1-2문장 이상 설명)
- 개념 설명: 각 개념마다 정의(2문장 이상), 설명(3-5문장 이상), 사례(2-3문장 이상)
- 활동 문항: 각 유형당 최소 개수 충족 (빈칸 6개 이상, OX 5개 이상, 단답 4개 이상)
- 해설: 각 문항당 최소 3-4문장의 구체적인 설명
- 루브릭: 상/중/하 각각 2-3문장으로 명확한 기준 제시

{
  "title": "학습지 제목",
  "metadata": {
    "grade": "대상 학년",
    "subject": "과목/단원",
    "duration": "수업 시간",
    "level": "학생 수준"
  },
  "design": {
    "core_concepts": [
      {"concept": "개념명", "definition": "2-3문장으로 상세한 정의", "page": "p.X"}
    ],
    "key_terms": [
      {"term": "용어", "definition": "1-2문장으로 설명", "page": "p.X"}
    ],
    "misconceptions": ["오개념 설명 (왜 헷갈리는지 구체적으로)", "오개념 2"]
  },
  "student_worksheet": {
    "lesson_info": {
      "title": "수업 제목",
      "objectives": ["구체적인 행동 동사로 된 목표 (3-5개)"],
      "keywords": ["핵심 키워드 (5-8개)"]
    },
    "concept_explanations": [
      {
        "concept": "개념명",
        "definition": "2문장: 짧고 명확한 정의",
        "explanation": "3-5문장: 쉽고 상세한 설명",
        "example": "2-3문장: PDF 내 구체적 사례",
        "page": "p.X",
        "check_question": {"question": "확인 질문", "answer": "정답"}
      }
    ],
    "activities": {
      "fill_blanks": [{"question": "문제", "answer": "정답", "page": "p.X"}],
      "ox_questions": [{"question": "문제", "answer": "O 또는 X", "page": "p.X"}],
      "short_answers": [{"question": "문제", "answer": "정답", "page": "p.X"}],
      "find_evidence": {"instruction": "근거 찾기 지시", "page": "p.X"}
    },
    "application_task": {
      "description": "3-5문장으로 과제 설명",
      "output_format": "명확한 산출물 형태",
      "guidelines": ["구체적인 주의사항 (3-5개)"]
    },
    "assessment": {
      "multiple_choice": [
        {"question": "문제", "options": ["보기 1", "보기 2", "보기 3", "보기 4"], "answer": 1, "page": "p.X"}
      ],
      "short_answer": [
        {"question": "문제", "answer": "정답", "page": "p.X"}
      ],
      "essay": [
        {"question": "문제", "rubric_elements": ["채점 요소 1", "요소 2"], "page": "p.X"}
      ]
    }
  },
  "teacher_guide": {
    "answer_key": "한눈에 볼 수 있는 정답표 (2-3문장)",
    "explanations": [
      {"question_num": "1", "explanation": "3-4문장: 왜 이게 정답인지 구체적 설명", "page": "p.X"}
    ],
    "rubric": [
      {
        "question": "서술형 문제", 
        "high": "2-3문장: 상 수준 기준", 
        "mid": "2-3문장: 중 수준 기준", 
        "low": "2-3문장: 하 수준 기준"
      }
    ],
    "feedback_tips": [
      {"misconception": "오답 유형", "feedback": "2-3문장: 교사가 바로 쓸 수 있는 피드백"}
    ]
  },
  "quality_check": {
    "no_external_content": true,
    "all_pages_cited": true,
    "no_ambiguous_questions": true,
    "time_appropriate": true,
    "difficulty_met": true,
    "no_answer_leak": true
  }
}`;

    const fullSystemPrompt = systemPromptTemplate + jsonFormatSpec;

    // Construct messages
    let dbContentPrompt = `\n[자료 내용]\n${truncatedText}`;

    if (userRequest) {
        dbContentPrompt += `\n\n[📢 사용자 추가 요구사항]\n${userRequest}\n`;
    }

    // Get selected model and temperature
    const selectedModel = aiModelSelect.value;
    const temperature = parseFloat(temperatureSlider.value) / 10;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: selectedModel,
            messages: [
                { role: "system", content: fullSystemPrompt },
                { role: "user", content: dbContentPrompt }
            ],
            response_format: { type: "json_object" },
            temperature: temperature,
            max_tokens: 4000  // Increased from default for more detailed content
        })
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'API 호출 실패');
    }

    const data = await response.json();
    return JSON.parse(data.choices[0].message.content);
}

async function createDocx(data) {
    const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, PageBreak } = docx;
    const children = [];
    // Title
    children.push(new Paragraph({
        text: data.title || "학습자료",
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 }
    }));
    // Metadata
    if (data.metadata) {
        const meta = data.metadata;
        children.push(new Paragraph({
            children: [
                new TextRun({ text: `대상: ${meta.grade || ''} | `, bold: true }),
                new TextRun({ text: `과목: ${meta.subject || ''} | `, bold: true }),
                new TextRun({ text: `시간: ${meta.duration || ''} | `, bold: true }),
                new TextRun({ text: `수준: ${meta.level || ''}`, bold: true })
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 }
        }));
    }
    // 1) 설계도
    children.push(new Paragraph({
        text: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
        spacing: { before: 400, after: 200 }
    }));
    children.push(new Paragraph({
        text: "1. 근거 기반 설계도",
        heading: HeadingLevel.HEADING_1,
        spacing: { after: 200 }
    }));
    if (data.design) {
        if (data.design.core_concepts && data.design.core_concepts.length > 0) {
            children.push(new Paragraph({
                text: "📌 핵심 개념 목록",
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 200, after: 100 }
            }));
            data.design.core_concepts.forEach(c => {
                children.push(new Paragraph({
                    children: [
                        new TextRun({ text: `• ${c.concept}: `, bold: true }),
                        new TextRun({ text: c.definition }),
                        new TextRun({ text: ` (${c.page})`, italics: true, color: "666666" })
                    ],
                    spacing: { after: 100 }
                }));
            });
        }
        if (data.design.key_terms && data.design.key_terms.length > 0) {
            children.push(new Paragraph({
                text: "📌 필수 용어",
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 200, after: 100 }
            }));
            data.design.key_terms.forEach(t => {
                children.push(new Paragraph({
                    children: [
                        new TextRun({ text: `• ${t.term}: `, bold: true }),
                        new TextRun({ text: t.definition }),
                        new TextRun({ text: ` (${t.page})`, italics: true, color: "666666" })
                    ],
                    spacing: { after: 100 }
                }));
            });
        }
        if (data.design.misconceptions && data.design.misconceptions.length > 0) {
            children.push(new Paragraph({
                text: "📌 학생이 헷갈리기 쉬운 지점",
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 200, after: 100 }
            }));
            data.design.misconceptions.forEach(m => {
                children.push(new Paragraph({
                    text: `• ${m}`,
                    spacing: { after: 100 }
                }));
            });
        }
    }
    // PAGE BREAK: 학생용 시작
    children.push(new Paragraph({
        children: [new PageBreak()]
    }));
    children.push(new Paragraph({
        text: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
        spacing: { after: 200 }
    }));
    children.push(new Paragraph({
        text: "학생용 학습지",
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 }
    }));
    // 2) 학생용 학습지
    if (data.student_worksheet) {
        const sw = data.student_worksheet;
        // [A] 수업 안내
        if (sw.lesson_info) {
            children.push(new Paragraph({
                text: sw.lesson_info.title || "수업 제목",
                heading: HeadingLevel.HEADING_1,
                spacing: { after: 200 }
            }));
            if (sw.lesson_info.objectives && sw.lesson_info.objectives.length > 0) {
                children.push(new Paragraph({
                    text: "📚 학습 목표",
                    heading: HeadingLevel.HEADING_2,
                    spacing: { before: 200, after: 100 }
                }));
                sw.lesson_info.objectives.forEach(obj => {
                    children.push(new Paragraph({
                        text: `• ${obj}`,
                        spacing: { after: 50 }
                    }));
                });
            }
            if (sw.lesson_info.keywords && sw.lesson_info.keywords.length > 0) {
                children.push(new Paragraph({
                    children: [
                        new TextRun({ text: "🔑 핵심 키워드: ", bold: true }),
                        new TextRun({ text: sw.lesson_info.keywords.join(', ') })
                    ],
                    spacing: { before: 200, after: 300 }
                }));
            }
        }
        // [B] 핵심 개념 정리
        if (sw.concept_explanations && sw.concept_explanations.length > 0) {
            children.push(new Paragraph({
                text: "[A] 핵심 개념 정리",
                heading: HeadingLevel.HEADING_1,
                spacing: { before: 400, after: 200 }
            }));
            sw.concept_explanations.forEach((ce, idx) => {
                children.push(new Paragraph({
                    children: [
                        new TextRun({ text: `개념 ${idx + 1}. ${ce.concept}`, bold: true, size: 24 })
                    ],
                    spacing: { before: 200, after: 100 }
                }));
                children.push(new Paragraph({
                    children: [
                        new TextRun({ text: "[정의] ", bold: true }),
                        new TextRun({ text: ce.definition })
                    ],
                    spacing: { after: 100 }
                }));
                children.push(new Paragraph({
                    children: [
                        new TextRun({ text: "[설명] ", bold: true }),
                        new TextRun({ text: ce.explanation })
                    ],
                    spacing: { after: 100 }
                }));
                if (ce.example) {
                    children.push(new Paragraph({
                        children: [
                            new TextRun({ text: "[사례] ", bold: true }),
                            new TextRun({ text: ce.example })
                        ],
                        spacing: { after: 100 }
                    }));
                }
                children.push(new Paragraph({
                    children: [
                        new TextRun({ text: `근거: ${ce.page}`, italics: true, color: "666666" })
                    ],
                    spacing: { after: 100 }
                }));
                if (ce.check_question) {
                    children.push(new Paragraph({
                        children: [
                            new TextRun({ text: "✓ 확인 질문: ", bold: true, color: "0066CC" }),
                            new TextRun({ text: ce.check_question.question })
                        ],
                        spacing: { after: 300 }
                    }));
                }
            });
        }
        // [C] 개념 확인 활동
        if (sw.activities) {
            children.push(new Paragraph({
                text: "[B] 개념 확인 활동",
                heading: HeadingLevel.HEADING_1,
                spacing: { before: 400, after: 200 }
            }));
            if (sw.activities.fill_blanks && sw.activities.fill_blanks.length > 0) {
                children.push(new Paragraph({
                    text: "1. 빈칸 채우기",
                    heading: HeadingLevel.HEADING_2,
                    spacing: { before: 200, after: 100 }
                }));
                sw.activities.fill_blanks.forEach((fb, idx) => {
                    children.push(new Paragraph({
                        children: [
                            new TextRun({ text: `${idx + 1}) ${fb.question} ` }),
                            new TextRun({ text: `(${fb.page})`, italics: true, color: "666666" })
                        ],
                        spacing: { after: 100 }
                    }));
                });
            }
            if (sw.activities.ox_questions && sw.activities.ox_questions.length > 0) {
                children.push(new Paragraph({
                    text: "2. O/X 퀴즈",
                    heading: HeadingLevel.HEADING_2,
                    spacing: { before: 200, after: 100 }
                }));
                sw.activities.ox_questions.forEach((ox, idx) => {
                    children.push(new Paragraph({
                        children: [
                            new TextRun({ text: `${idx + 1}) ${ox.question} ` }),
                            new TextRun({ text: `(${ox.page})`, italics: true, color: "666666" })
                        ],
                        spacing: { after: 100 }
                    }));
                });
            }
            if (sw.activities.short_answers && sw.activities.short_answers.length > 0) {
                children.push(new Paragraph({
                    text: "3. 단답형",
                    heading: HeadingLevel.HEADING_2,
                    spacing: { before: 200, after: 100 }
                }));
                sw.activities.short_answers.forEach((sa, idx) => {
                    children.push(new Paragraph({
                        children: [
                            new TextRun({ text: `${idx + 1}) ${sa.question} ` }),
                            new TextRun({ text: `(${sa.page})`, italics: true, color: "666666" })
                        ],
                        spacing: { after: 100 }
                    }));
                });
            }
            if (sw.activities.find_evidence) {
                children.push(new Paragraph({
                    text: "4. 근거 찾기",
                    heading: HeadingLevel.HEADING_2,
                    spacing: { before: 200, after: 100 }
                }));
                children.push(new Paragraph({
                    children: [
                        new TextRun({ text: sw.activities.find_evidence.instruction }),
                        new TextRun({ text: ` (${sw.activities.find_evidence.page})`, italics: true, color: "666666" })
                    ],
                    spacing: { after: 200 }
                }));
            }
        }
        // [D] 적용·확장 활동
        if (sw.application_task) {
            children.push(new Paragraph({
                text: "[C] 적용·확장 활동",
                heading: HeadingLevel.HEADING_1,
                spacing: { before: 400, after: 200 }
            }));
            children.push(new Paragraph({
                text: sw.application_task.description,
                spacing: { after: 100 }
            }));
            children.push(new Paragraph({
                children: [
                    new TextRun({ text: "산출물 형태: ", bold: true }),
                    new TextRun({ text: sw.application_task.output_format })
                ],
                spacing: { after: 100 }
            }));
            if (sw.application_task.guidelines && sw.application_task.guidelines.length > 0) {
                children.push(new Paragraph({
                    text: "주의할 점:",
                    bold: true,
                    spacing: { before: 100, after: 50 }
                }));
                sw.application_task.guidelines.forEach(g => {
                    children.push(new Paragraph({
                        text: `• ${g}`,
                        spacing: { after: 50 }
                    }));
                });
            }
        }
        // [E] 형성평가
        if (sw.assessment) {
            children.push(new Paragraph({
                text: "[D] 형성평가",
                heading: HeadingLevel.HEADING_1,
                spacing: { before: 400, after: 200 }
            }));
            let questionNum = 1;
            if (sw.assessment.multiple_choice && sw.assessment.multiple_choice.length > 0) {
                children.push(new Paragraph({
                    text: "객관식",
                    heading: HeadingLevel.HEADING_2,
                    spacing: { before: 200, after: 100 }
                }));
                sw.assessment.multiple_choice.forEach(mc => {
                    children.push(new Paragraph({
                        children: [
                            new TextRun({ text: `${questionNum}. ${mc.question} `, bold: true }),
                            new TextRun({ text: `(${mc.page})`, italics: true, color: "666666" })
                        ],
                        spacing: { before: 100, after: 50 }
                    }));
                    mc.options.forEach((opt, idx) => {
                        children.push(new Paragraph({
                            text: `   ${idx + 1}) ${opt}`,
                            spacing: { after: 30 }
                        }));
                    });
                    questionNum++;
                    children.push(new Paragraph({ text: "", spacing: { after: 100 } }));
                });
            }
            if (sw.assessment.short_answer && sw.assessment.short_answer.length > 0) {
                children.push(new Paragraph({
                    text: "단답형",
                    heading: HeadingLevel.HEADING_2,
                    spacing: { before: 200, after: 100 }
                }));
                sw.assessment.short_answer.forEach(sa => {
                    children.push(new Paragraph({
                        children: [
                            new TextRun({ text: `${questionNum}. ${sa.question} `, bold: true }),
                            new TextRun({ text: `(${sa.page})`, italics: true, color: "666666" })
                        ],
                        spacing: { after: 100 }
                    }));
                    questionNum++;
                });
            }
            if (sw.assessment.essay && sw.assessment.essay.length > 0) {
                children.push(new Paragraph({
                    text: "서술형",
                    heading: HeadingLevel.HEADING_2,
                    spacing: { before: 200, after: 100 }
                }));
                sw.assessment.essay.forEach(es => {
                    children.push(new Paragraph({
                        children: [
                            new TextRun({ text: `${questionNum}. ${es.question} `, bold: true }),
                            new TextRun({ text: `(${es.page})`, italics: true, color: "666666" })
                        ],
                        spacing: { after: 100 }
                    }));
                    questionNum++;
                });
            }
        }
    }
    // PAGE BREAK: 교사용 시작
    children.push(new Paragraph({
        children: [new PageBreak()]
    }));
    children.push(new Paragraph({
        text: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
        spacing: { after: 200 }
    }));
    children.push(new Paragraph({
        text: "교사용 자료 (정답 및 해설)",
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 }
    }));
    // 3) 교사용 자료
    if (data.teacher_guide) {
        const tg = data.teacher_guide;
        if (tg.answer_key) {
            children.push(new Paragraph({
                text: "📋 정답표",
                heading: HeadingLevel.HEADING_1,
                spacing: { after: 200 }
            }));
            children.push(new Paragraph({
                text: tg.answer_key,
                spacing: { after: 300 }
            }));
        }
        if (tg.explanations && tg.explanations.length > 0) {
            children.push(new Paragraph({
                text: "📝 문항별 해설",
                heading: HeadingLevel.HEADING_1,
                spacing: { before: 400, after: 200 }
            }));
            tg.explanations.forEach(exp => {
                children.push(new Paragraph({
                    children: [
                        new TextRun({ text: `문항 ${exp.question_num}: `, bold: true }),
                        new TextRun({ text: exp.explanation }),
                        new TextRun({ text: ` (${exp.page})`, italics: true, color: "666666" })
                    ],
                    spacing: { after: 150 }
                }));
            });
        }
        if (tg.rubric && tg.rubric.length > 0) {
            children.push(new Paragraph({
                text: "📊 서술형 채점 기준",
                heading: HeadingLevel.HEADING_1,
                spacing: { before: 400, after: 200 }
            }));
            tg.rubric.forEach(rub => {
                children.push(new Paragraph({
                    text: `[${rub.question}]`,
                    bold: true,
                    spacing: { before: 100, after: 50 }
                }));
                children.push(new Paragraph({
                    text: `상: ${rub.high}`,
                    spacing: { after: 50 }
                }));
                children.push(new Paragraph({
                    text: `중: ${rub.mid}`,
                    spacing: { after: 50 }
                }));
                children.push(new Paragraph({
                    text: `하: ${rub.low}`,
                    spacing: { after: 150 }
                }));
            });
        }
        if (tg.feedback_tips && tg.feedback_tips.length > 0) {
            children.push(new Paragraph({
                text: "💬 오개념 피드백 멘트",
                heading: HeadingLevel.HEADING_1,
                spacing: { before: 400, after: 200 }
            }));
            tg.feedback_tips.forEach(ft => {
                children.push(new Paragraph({
                    children: [
                        new TextRun({ text: `[${ft.misconception}] `, bold: true, color: "CC0000" }),
                        new TextRun({ text: ft.feedback })
                    ],
                    spacing: { after: 100 }
                }));
            });
        }
    }
    // 4) 검수 체크리스트
    if (data.quality_check) {
        children.push(new Paragraph({
            text: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
            spacing: { before: 400, after: 200 }
        }));
        children.push(new Paragraph({
            text: "✅ 검수 체크리스트",
            heading: HeadingLevel.HEADING_1,
            spacing: { after: 200 }
        }));
        const qc = data.quality_check;
        const checks = [
            { label: "PDF 외 내용 없음", value: qc.no_external_content },
            { label: "모든 개념/문항에 페이지 근거 표기", value: qc.all_pages_cited },
            { label: "애매한 문항 없음", value: qc.no_ambiguous_questions },
            { label: "시간(차시) 내 가능한 분량", value: qc.time_appropriate },
            { label: "난이도 분포 충족", value: qc.difficulty_met },
            { label: "학생용에 정답 미노출", value: qc.no_answer_leak }
        ];
        checks.forEach(check => {
            const icon = check.value ? "✓" : "✗";
            const color = check.value ? "008000" : "CC0000";
            children.push(new Paragraph({
                children: [
                    new TextRun({ text: `${icon} `, color: color, bold: true }),
                    new TextRun({ text: check.label })
                ],
                spacing: { after: 100 }
            }));
        });
    }
    // CREATE DOCUMENT
    const doc = new Document({
        sections: [{
            properties: {},
            children: children
        }]
    });
    const blob = await Packer.toBlob(doc);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${data.title || '학습자료'}.docx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}


// PDF Generation Function
async function createPDF(data) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    let yPos = 20;
    const lineHeight = 7;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 20;

    // Helper to add text with auto page break
    const addText = (text, fontSize = 12, isBold = false) => {
        doc.setFontSize(fontSize);
        if (isBold) doc.setFont(undefined, 'bold');
        else doc.setFont(undefined, 'normal');

        const lines = doc.splitTextToSize(text, 170);
        lines.forEach(line => {
            if (yPos > pageHeight - margin) {
                doc.addPage();
                yPos = 20;
            }
            doc.text(line, 20, yPos);
            yPos += lineHeight;
        });
    };

    // Title
    addText(data.title || "심화 학습지", 18, true);
    yPos += 10;

    // 1. Vocabulary
    addText("1. [도입] 핵심 어휘 및 개념 정리", 14, true);
    yPos += 5;
    if (data.vocabulary && Array.isArray(data.vocabulary)) {
        data.vocabulary.forEach(v => {
            addText(`• ${v.word}: ${v.definition}`);
        });
    }
    yPos += 10;

    // 2. Summary
    addText("2. [전개] 텍스트 구조화 및 요약", 14, true);
    yPos += 5;
    if (data.summary) addText(`[요약] ${data.summary}`);
    if (data.structure) addText(`[구조] ${data.structure}`);
    yPos += 10;

    // 3. Check Questions
    addText("3. [확인] 사실적 이해", 14, true);
    yPos += 5;
    if (data.check_questions && Array.isArray(data.check_questions)) {
        data.check_questions.forEach((q, i) => {
            const prefix = q.type === 'OX' ? '(O/X)' : '(단답형)';
            addText(`${i + 1}. [${prefix}] ${q.question}`);
        });
    }
    yPos += 10;

    // 4. Discussion
    addText("4. [심화] 비판적 사고와 토론", 14, true);
    yPos += 5;
    if (data.discussion && Array.isArray(data.discussion)) {
        data.discussion.forEach((d, i) => {
            addText(`Q${i + 1}. ${d.question}`, 12, true);
            addText(`💡 Tip: ${d.guide}`, 10);
        });
    }
    yPos += 10;

    // 5. CSAT Problem
    addText("5. [실전] 수능형 변형 문제", 14, true);
    yPos += 5;
    if (data.csat_problem) {
        addText(`Q. ${data.csat_problem.question}`);
        if (data.csat_problem.options) {
            data.csat_problem.options.forEach((opt, i) => {
                addText(`   ${i + 1}) ${opt}`);
            });
        }
    }

    // Answer Page
    doc.addPage();
    yPos = 20;
    addText("[정답 및 해설]", 16, true);
    yPos += 10;

    addText("<사실적 이해 정답>", 12, true);
    if (data.check_questions) {
        data.check_questions.forEach((q, i) => {
            addText(`${i + 1}. ${q.answer}`);
        });
    }
    yPos += 10;

    if (data.csat_problem) {
        addText("<수능형 문제 정답>", 12, true);
        addText(`정답: ${data.csat_problem.answer}`);
        addText(`해설: ${data.csat_problem.explanation}`);
    }

    doc.save(`${data.title || '심화학습지'}.pdf`);
}
async function createHTML(data) {
    let htmlContent = `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${data.title || '학습자료'}</title>
    <style>
        body {
            font-family: 'Malgun Gothic', sans-serif;
            max-width: 900px;
            margin: 40px auto;
            padding: 20px;
            line-height: 1.8;
            background: #f9fafb;
        }
        h1 {
            text-align: center;
            color: #1f2937;
            border-bottom: 3px solid #6366f1;
            padding-bottom: 10px;
        }
        h2 {
            color: #4f46e5;
            margin-top: 30px;
            border-left: 4px solid #6366f1;
            padding-left: 10px;
        }
        h3 {
            color: #6366f1;
            margin-top: 20px;
        }
        .metadata {
            text-align: center;
            font-weight: bold;
            margin-bottom: 30px;
            padding: 10px;
            background: #e0e7ff;
            border-radius: 8px;
        }
        .section {
            margin: 30px 0;
            padding: 20px;
            background: white;
            border-radius: 12px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .concept-item, .term-item {
            margin: 10px 0;
            padding: 10px;
            background: #f3f4f6;
            border-radius: 6px;
        }
        .concept-name, .term-name {
            font-weight: bold;
            color: #6366f1;
        }
        .page-ref {
            color: #9ca3af;
            font-style: italic;
            font-size: 0.9em;
        }
        .question {
            margin: 15px 0;
            padding: 15px;
            background: #fef3c7;
            border-radius: 8px;
            border-left: 3px solid #f59e0b;
        }
        .answer-section {
            margin-top: 50px;
            padding: 20px;
            background: #d1fae5;
            border-radius: 12px;
        }
        .page-break {
            page-break-before: always;
            margin-top: 50px;
            padding-top: 20px;
            border-top: 3px solid #6366f1;
        }
        .checklist-item {
            padding: 8px;
            margin: 5px 0;
        }
        .check-ok { color: #10b981; }
        .check-fail { color: #ef4444; }
    </style>
</head>
<body>
    <h1>${data.title || '학습자료'}</h1>
`;
    // Metadata
    if (data.metadata) {
        const m = data.metadata;
        htmlContent += `
    <div class="metadata">
        대상: ${m.grade || ''} | 과목: ${m.subject || ''} | 시간: ${m.duration || ''} | 수준: ${m.level || ''}
    </div>`;
    }
    // 1) 설계도
    htmlContent += `
    <div class="section">
        <h2>1. 근거 기반 설계도</h2>`;
    if (data.design) {
        if (data.design.core_concepts && data.design.core_concepts.length > 0) {
            htmlContent += `<h3>📌 핵심 개념 목록</h3>`;
            data.design.core_concepts.forEach(c => {
                htmlContent += `
        <div class="concept-item">
            <span class="concept-name">${c.concept}:</span> ${c.definition}
            <span class="page-ref">(${c.page})</span>
        </div>`;
            });
        }
        if (data.design.key_terms && data.design.key_terms.length > 0) {
            htmlContent += `<h3>📌 필수 용어</h3>`;
            data.design.key_terms.forEach(t => {
                htmlContent += `
        <div class="term-item">
            <span class="term-name">${t.term}:</span> ${t.definition}
            <span class="page-ref">(${t.page})</span>
        </div>`;
            });
        }
        if (data.design.misconceptions && data.design.misconceptions.length > 0) {
            htmlContent += `<h3>📌 학생이 헷갈리기 쉬운 지점</h3><ul>`;
            data.design.misconceptions.forEach(m => {
                htmlContent += `<li>${m}</li>`;
            });
            htmlContent += `</ul>`;
        }
    }
    htmlContent += `</div>`;
    // 2) 학생용 학습지
    htmlContent += `
    <div class="page-break">
        <h1>학생용 학습지</h1>
    </div>`;
    if (data.student_worksheet) {
        const sw = data.student_worksheet;
        // 수업 안내
        if (sw.lesson_info) {
            htmlContent += `
    <div class="section">
        <h2>${sw.lesson_info.title || '수업 제목'}</h2>`;
            if (sw.lesson_info.objectives && sw.lesson_info.objectives.length > 0) {
                htmlContent += `<h3>📚 학습 목표</h3><ul>`;
                sw.lesson_info.objectives.forEach(obj => {
                    htmlContent += `<li>${obj}</li>`;
                });
                htmlContent += `</ul>`;
            }
            if (sw.lesson_info.keywords && sw.lesson_info.keywords.length > 0) {
                htmlContent += `<p><strong>🔑 핵심 키워드:</strong> ${sw.lesson_info.keywords.join(', ')}</p>`;
            }
            htmlContent += `</div>`;
        }
        // 핵심 개념 정리
        if (sw.concept_explanations && sw.concept_explanations.length > 0) {
            htmlContent += `
    <div class="section">
        <h2>[A] 핵심 개념 정리</h2>`;
            sw.concept_explanations.forEach((ce, idx) => {
                htmlContent += `
        <h3>개념 ${idx + 1}. ${ce.concept}</h3>
        <p><strong>[정의]</strong> ${ce.definition}</p>
        <p><strong>[설명]</strong> ${ce.explanation}</p>`;
                if (ce.example) {
                    htmlContent += `<p><strong>[사례]</strong> ${ce.example}</p>`;
                }
                htmlContent += `<p class="page-ref">근거: ${ce.page}</p>`;
                if (ce.check_question) {
                    htmlContent += `<p style="color: #0066CC;"><strong>✓ 확인 질문:</strong> ${ce.check_question.question}</p>`;
                }
            });
            htmlContent += `</div>`;
        }
        // 개념 확인 활동
        if (sw.activities) {
            htmlContent += `
    <div class="section">
        <h2>[B] 개념 확인 활동</h2>`;
            if (sw.activities.fill_blanks && sw.activities.fill_blanks.length > 0) {
                htmlContent += `<h3>1. 빈칸 채우기</h3>`;
                sw.activities.fill_blanks.forEach((fb, idx) => {
                    htmlContent += `<p>${idx + 1}) ${fb.question} <span class="page-ref">(${fb.page})</span></p>`;
                });
            }
            if (sw.activities.ox_questions && sw.activities.ox_questions.length > 0) {
                htmlContent += `<h3>2. O/X 퀴즈</h3>`;
                sw.activities.ox_questions.forEach((ox, idx) => {
                    htmlContent += `<p>${idx + 1}) ${ox.question} <span class="page-ref">(${ox.page})</span></p>`;
                });
            }
            if (sw.activities.short_answers && sw.activities.short_answers.length > 0) {
                htmlContent += `<h3>3. 단답형</h3>`;
                sw.activities.short_answers.forEach((sa, idx) => {
                    htmlContent += `<p>${idx + 1}) ${sa.question} <span class="page-ref">(${sa.page})</span></p>`;
                });
            }
            if (sw.activities.find_evidence) {
                htmlContent += `<h3>4. 근거 찾기</h3>`;
                htmlContent += `<p>${sw.activities.find_evidence.instruction} <span class="page-ref">(${sw.activities.find_evidence.page})</span></p>`;
            }
            htmlContent += `</div>`;
        }
        // 적용·확장 활동
        if (sw.application_task) {
            htmlContent += `
    <div class="section">
        <h2>[C] 적용·확장 활동</h2>
        <p>${sw.application_task.description}</p>
        <p><strong>산출물 형태:</strong> ${sw.application_task.output_format}</p>`;
            if (sw.application_task.guidelines && sw.application_task.guidelines.length > 0) {
                htmlContent += `<p><strong>주의할 점:</strong></p><ul>`;
                sw.application_task.guidelines.forEach(g => {
                    htmlContent += `<li>${g}</li>`;
                });
                htmlContent += `</ul>`;
            }
            htmlContent += `</div>`;
        }
        // 형성평가
        if (sw.assessment) {
            htmlContent += `
    <div class="section">
        <h2>[D] 형성평가</h2>`;
            let questionNum = 1;
            if (sw.assessment.multiple_choice && sw.assessment.multiple_choice.length > 0) {
                htmlContent += `<h3>객관식</h3>`;
                sw.assessment.multiple_choice.forEach(mc => {
                    htmlContent += `
        <div class="question">
            <p><strong>${questionNum}. ${mc.question}</strong> <span class="page-ref">(${mc.page})</span></p>`;
                    mc.options.forEach((opt, idx) => {
                        htmlContent += `<p style="margin-left: 20px;">${idx + 1}) ${opt}</p>`;
                    });
                    htmlContent += `</div>`;
                    questionNum++;
                });
            }
            if (sw.assessment.short_answer && sw.assessment.short_answer.length > 0) {
                htmlContent += `<h3>단답형</h3>`;
                sw.assessment.short_answer.forEach(sa => {
                    htmlContent += `<p><strong>${questionNum}. ${sa.question}</strong> <span class="page-ref">(${sa.page})</span></p>`;
                    questionNum++;
                });
            }
            if (sw.assessment.essay && sw.assessment.essay.length > 0) {
                htmlContent += `<h3>서술형</h3>`;
                sw.assessment.essay.forEach(es => {
                    htmlContent += `<p><strong>${questionNum}. ${es.question}</strong> <span class="page-ref">(${es.page})</span></p>`;
                    questionNum++;
                });
            }
            htmlContent += `</div>`;
        }
    }
    // 3) 교사용 자료
    htmlContent += `
    <div class="page-break">
        <h1>교사용 자료 (정답 및 해설)</h1>
    </div>`;
    if (data.teacher_guide) {
        const tg = data.teacher_guide;
        if (tg.answer_key) {
            htmlContent += `
    <div class="answer-section">
        <h2>📋 정답표</h2>
        <p>${tg.answer_key}</p>
    </div>`;
        }
        if (tg.explanations && tg.explanations.length > 0) {
            htmlContent += `
    <div class="section">
        <h2>📝 문항별 해설</h2>`;
            tg.explanations.forEach(exp => {
                htmlContent += `<p><strong>문항 ${exp.question_num}:</strong> ${exp.explanation} <span class="page-ref">(${exp.page})</span></p>`;
            });
            htmlContent += `</div>`;
        }
        if (tg.rubric && tg.rubric.length > 0) {
            htmlContent += `
    <div class="section">
        <h2>📊 서술형 채점 기준</h2>`;
            tg.rubric.forEach(rub => {
                htmlContent += `
        <h3>[${rub.question}]</h3>
        <p><strong>상:</strong> ${rub.high}</p>
        <p><strong>중:</strong> ${rub.mid}</p>
        <p><strong>하:</strong> ${rub.low}</p>`;
            });
            htmlContent += `</div>`;
        }
        if (tg.feedback_tips && tg.feedback_tips.length > 0) {
            htmlContent += `
    <div class="section">
        <h2>💬 오개념 피드백 멘트</h2>`;
            tg.feedback_tips.forEach(ft => {
                htmlContent += `<p><strong style="color: #CC0000;">[${ft.misconception}]</strong> ${ft.feedback}</p>`;
            });
            htmlContent += `</div>`;
        }
    }
    // 4) 검수 체크리스트
    if (data.quality_check) {
        htmlContent += `
    <div class="section">
        <h2>✅ 검수 체크리스트</h2>`;
        const qc = data.quality_check;
        const checks = [
            { label: "PDF 외 내용 없음", value: qc.no_external_content },
            { label: "모든 개념/문항에 페이지 근거 표기", value: qc.all_pages_cited },
            { label: "애매한 문항 없음", value: qc.no_ambiguous_questions },
            { label: "시간(차시) 내 가능한 분량", value: qc.time_appropriate },
            { label: "난이도 분포 충족", value: qc.difficulty_met },
            { label: "학생용에 정답 미노출", value: qc.no_answer_leak }
        ];
        checks.forEach(check => {
            const icon = check.value ? "✓" : "✗";
            const className = check.value ? "check-ok" : "check-fail";
            htmlContent += `<div class="checklist-item"><span class="${className}">${icon}</span> ${check.label}</div>`;
        });
        htmlContent += `</div>`;
    }
    htmlContent += `
</body>
</html>`;
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${data.title || '학습자료'}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}
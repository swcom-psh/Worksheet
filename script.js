// DOM Elements
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const fileInfo = document.getElementById('fileInfo');
const apiKeyInput = document.getElementById('apiKey');
const userPromptInput = document.getElementById('userPrompt');
const generateBtn = document.getElementById('generateBtn');
const statusMessage = document.getElementById('statusMessage');
const pdfPreviewContainer = document.getElementById('pdfPreviewContainer');
const pdfViewer = document.getElementById('pdfViewer');

// State
let currentFile = null;
let currentPdfText = "";

// Initialize PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';

// --- Event Listeners ---

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
        const textPromise = extractTextFromPDF(file);
        const renderPromise = renderPDFInViewer(file);

        [currentPdfText] = await Promise.all([textPromise, renderPromise]);

        updateStatus('준비 완료! API 키 입력 후 생성 버튼을 눌러주세요.');
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
    let fullText = "";

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += pageText + "\n\n";
    }
    return fullText;
}

async function renderPDFInViewer(file) {
    pdfViewer.innerHTML = ''; // Clear previous content
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);

        // Canvas setting
        const scale = 1.5;
        const viewport = page.getViewport({ scale: scale });

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        // Responsive width
        canvas.style.maxWidth = '100%';
        canvas.style.height = 'auto';

        pdfViewer.appendChild(canvas);

        await page.render({
            canvasContext: context,
            viewport: viewport
        }).promise;
    }
}


function checkReady() {
    // API키 입력은 실행 시점에 체크 (지금은 버튼 활성화만 고려)
    if (currentFile && currentPdfText) {
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

    if (!currentPdfText) {
        alert('PDF 파일 내용 추출에 실패했습니다.');
        return;
    }

    const type = document.querySelector('input[name="workbookType"]:checked').value;
    const additionalPrompt = userPromptInput.value;

    // UI Loading State
    generateBtn.disabled = true;
    updateStatus('AI가 학습지를 생성하고 있습니다... (시간이 걸릴 수 있습니다)');

    try {
        const generatedData = await callOpenAI(apiKey, currentPdfText, type, additionalPrompt);
        updateStatus('문서 생성 중...');
        await createDocx(generatedData, type);
        updateStatus('완료! 다운로드가 시작되었습니다.');
    } catch (error) {
        console.error(error);
        alert('오류 발생: ' + error.message);
        updateStatus('오류가 발생했습니다.');
    } finally {
        generateBtn.disabled = false;
    }
}

async function callOpenAI(apiKey, text, type, userPrompt) {
    // 텍스트 길이 제한 (토큰 절약 및 에러 방지)
    const truncatedText = text.substring(0, 15000); // 약 15000자 제한

    let systemPrompt = "너는 교육 자료를 만드는 전문 선생님이야. 주어진 텍스트를 바탕으로 학습지를 만들어줘.";
    let contentPrompt = "";

    if (type === 'blank') {
        contentPrompt = `
        다음 텍스트를 기반으로 '빈칸 채우기' 학습지를 만들어줘.
        중요한 키워드에 빈칸을 뚫고, 정답은 따로 제공해줘.
        JSON 형식으로 반환해줘: { "title": "학습지 제목", "questions": [ {"sentence": "문장 내용 (빈칸은 __ 로 표시)", "answer": "정답"} ] }
        `;
    } else {
        contentPrompt = `
        다음 텍스트를 기반으로 '형성 평가' 문제(객관식)를 5개 만들어줘.
        JSON 형식으로 반환해줘: { "title": "형성 평가", "questions": [ {"question": "지문", "options": ["보기1", "보기2", "보기3", "보기4"], "answer": 1 (정답 번호 인덱스 혹은 번호)} ] }
        `;
    }

    if (userPrompt) {
        contentPrompt += `\n추가 요구사항: ${userPrompt}`;
    }

    contentPrompt += `\n\n[본문 텍스트]\n${truncatedText}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: "gpt-3.5-turbo",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: contentPrompt }
            ],
            response_format: { type: "json_object" }
        })
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'API 호출 실패');
    }

    const data = await response.json();
    return JSON.parse(data.choices[0].message.content);
}

async function createDocx(data, type) {
    const { Document, Packer, Paragraph, TextRun, HeadingLevel } = docx;

    const children = [];

    // Title
    children.push(new Paragraph({
        text: data.title || "학습지",
        heading: HeadingLevel.HEADING_1,
        alignment: "center",
        spacing: { after: 400 }
    }));

    // Content
    if (type === 'blank') {
        data.questions.forEach((q, idx) => {
            children.push(new Paragraph({
                children: [
                    new TextRun({ text: `${idx + 1}. `, bold: true }),
                    new TextRun(q.sentence)
                ],
                spacing: { after: 200 }
            }));
        });

        // 답안지
        children.push(new Paragraph({
            text: "\n[정답]",
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 200 }
        }));
        data.questions.forEach((q, idx) => {
            children.push(new Paragraph({
                text: `${idx + 1}. ${q.answer}`
            }));
        });

    } else {
        data.questions.forEach((q, idx) => {
            children.push(new Paragraph({
                children: [
                    new TextRun({ text: `${idx + 1}. ${q.question}`, bold: true })
                ]
            }));
            q.options.forEach((opt, optIdx) => {
                children.push(new Paragraph({
                    text: `   ${optIdx + 1}) ${opt}`,
                    spacing: { after: 100 }
                }));
            });
            children.push(new Paragraph({ text: "" })); // Empty line
        });

        // 답안지
        children.push(new Paragraph({
            text: "\n[정답]",
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 200 }
        }));
        data.questions.forEach((q, idx) => {
            children.push(new Paragraph({
                text: `${idx + 1}번 정답: ${q.answer}`
            }));
        });
    }

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
    a.download = `${data.title || '학습지'}.docx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

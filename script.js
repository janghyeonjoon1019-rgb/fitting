// --- DOM 요소 가져오기 ---
const fileInput = document.getElementById('fileInput');
const frameListContainer = document.getElementById('frame-list-container');
const rangeMinInput = document.getElementById('rangeMinInput');
const rangeMaxInput = document.getElementById('rangeMaxInput');
const pixelInfo = document.getElementById('pixel-info');
const previewCanvas = document.getElementById('previewCanvas');
const pCtx = previewCanvas.getContext('2d');
const profileCanvas = document.getElementById('profileCanvas');
const pfCtx = profileCanvas.getContext('2d');
const setPeak1Btn = document.getElementById('setPeak1');
const setPeak2Btn = document.getElementById('setPeak2');
const peakDeltaDisplay = document.getElementById('peakDelta');
const peakCenterDisplay = document.getElementById('peakCenter');
// ▼▼▼ Background 버튼 DOM 요소 추가 ▼▼▼
const setBg1Btn = document.getElementById('setBg1Btn');
const setBg2Btn = document.getElementById('setBg2Btn');
// ▲▲▲ Background 버튼 DOM 요소 추가 ▲▲▲
const setIntegral1Btn = document.getElementById('setIntegral1');
const setIntegral2Btn = document.getElementById('setIntegral2');
const integralValueDisplay = document.getElementById('integralValue');
const cropXFrom = document.getElementById('cropXFrom');
const cropXTo = document.getElementById('cropXTo');
const cropXStep = document.getElementById('cropXStep');
const cropYFrom = document.getElementById('cropYFrom');
const cropYTo = document.getElementById('cropYTo');
const cropYStep = document.getElementById('cropYStep');
const calculateAndPlotBtn = document.getElementById('calculateAndPlotBtn');
const saveAvgDataBtn = document.getElementById('saveAvgDataBtn');

// --- 전역 상태 변수 ---
let speFrames = [], currentDisplayData = null, plottedData = null;
let imageWidth = 0, imageHeight = 0, selectedRowY = -1;
let settingPeakLine = 0, peakLine1X = -1, peakLine2X = -1;
let settingIntegralLine = 0, integralLine1X = -1, integralLine2X = -1;
// ▼▼▼ Background 상태 변수 추가 ▼▼▼
let settingBgPoint = 0, bgPoint1 = null, bgPoint2 = null;
// ▲▲▲ Background 상태 변수 추가 ▲▲▲

// --- 초기화 ---
function initialize() { /* 이전과 동일 */ }
function initializeProfileCanvas() { /* 이전과 동일 */ }
initialize();

// --- 파일 처리 ---
async function handleFileSelect(input) { /* 이전과 동일 */ }
async function parseSpeFile(file) { /* 이전과 동일 */ }

// --- UI 업데이트 및 상태 관리 ---
function updateFrameList(numFrames) { /* 이전과 동일 */ }
function updateDisplay() {
    const checkedIndexes = [...document.querySelectorAll('#frame-list-container input:checked')].map(cb => parseInt(cb.dataset.index));
    if (checkedIndexes.length === 0) { currentDisplayData = null; initialize(); }
    else if (checkedIndexes.length === 1) { currentDisplayData = speFrames[checkedIndexes[0]]; }
    else {
        const frameSize = imageWidth * imageHeight, avgData = new Float32Array(frameSize).fill(0);
        for (const index of checkedIndexes) for (let i = 0; i < frameSize; i++) avgData[i] += speFrames[index][i];
        for (let i = 0; i < frameSize; i++) avgData[i] /= checkedIndexes.length;
        currentDisplayData = avgData;
    }
    drawImage();
    plottedData = null; saveAvgDataBtn.style.display = 'none';
    // ▼▼▼ 표시 이미지가 바뀌면 Background 정보도 초기화 ▼▼▼
    bgPoint1 = null; bgPoint2 = null;
    initializeProfileCanvas();
}

// --- 캔버스 드로잉 ---
function drawImage() { /* 이전과 동일 */ }

function drawProfileGraph() {
    if (!plottedData) return initializeProfileCanvas();
    pfCtx.clearRect(0, 0, profileCanvas.width, profileCanvas.height);
    let minVal = plottedData[0], maxVal = plottedData[0];
    plottedData.forEach(v => { if (v < minVal) minVal = v; if (v > maxVal) maxVal = v; });
    const range = maxVal - minVal === 0 ? 1 : maxVal - minVal;
    
    // Y 데이터 값을 캔버스 Y 좌표로 변환하는 헬퍼 함수
    const toCanvasY = (dataY) => (1 - (dataY - minVal) / range) * (profileCanvas.height - 20) + 10;

    // 초록색 신호 그리기
    pfCtx.beginPath(); pfCtx.strokeStyle = 'green'; pfCtx.lineWidth = 2;
    for (let x = 0; x < plottedData.length; x++) {
        const canvasX = (x / (plottedData.length - 1)) * profileCanvas.width;
        const canvasY = toCanvasY(plottedData[x]);
        x === 0 ? pfCtx.moveTo(canvasX, canvasY) : pfCtx.lineTo(canvasX, canvasY);
    }
    pfCtx.stroke();

    // ▼▼▼ Background 선 그리기 로직 추가 ▼▼▼
    if (bgPoint1 && bgPoint2) {
        const bgLine = getBackgroundLine();
        const startY = bgLine.slope * 0 + bgLine.intercept;
        const endY = bgLine.slope * (plottedData.length - 1) + bgLine.intercept;

        pfCtx.beginPath();
        pfCtx.strokeStyle = 'red';
        pfCtx.lineWidth = 1;
        pfCtx.setLineDash([5, 3]); // 점선으로 설정
        pfCtx.moveTo(0, toCanvasY(startY));
        pfCtx.lineTo(profileCanvas.width, toCanvasY(endY));
        pfCtx.stroke();
        pfCtx.setLineDash([]); // 점선 설정 해제
    }
    // ▲▲▲ Background 선 그리기 로직 추가 ▲▲▲

    // 분석선(파랑, 주황, 노랑) 그리기
    const drawLine = (x, color) => { /* 이전과 동일 */ };
    drawLine(peakLine1X, 'blue'); drawLine(peakLine2X, 'orange');
    drawLine(integralLine1X, 'gold'); drawLine(integralLine2X, 'gold');
}

// --- 이벤트 리스너 ---
rangeMinInput.addEventListener('input', drawImage);
rangeMaxInput.addEventListener('input', drawImage);
function showPixelInfo(e) { /* 이전과 동일 */ }
previewCanvas.addEventListener('mousemove', showPixelInfo);
previewCanvas.addEventListener('mouseleave', () => { pixelInfo.style.display = 'none'; });
previewCanvas.addEventListener('click', (e) => {
    if (!currentDisplayData) return;
    const rect = previewCanvas.getBoundingClientRect();
    const y = Math.round((e.clientY - rect.top) * (previewCanvas.height / rect.height));
    if (y >= 0 && y < imageHeight) { selectedRowY = y; drawImage(); }
});

profileCanvas.addEventListener('click', (e) => {
    if (!plottedData) return;
    const rect = profileCanvas.getBoundingClientRect(), x = Math.round((e.clientX - rect.left) * (plottedData.length - 1) / rect.width);
    
    if (settingPeakLine === 1) peakLine1X = x; else if (settingPeakLine === 2) peakLine2X = x;
    if (settingIntegralLine === 1) integralLine1X = x; else if (settingIntegralLine === 2) integralLine2X = x;
    
    // ▼▼▼ Background 포인트 설정 로직 추가 ▼▼▼
    if (settingBgPoint === 1) bgPoint1 = { x, y: plottedData[x] };
    else if (settingBgPoint === 2) bgPoint2 = { x, y: plottedData[x] };
    // ▲▲▲ Background 포인트 설정 로직 추가 ▲▲▲

    settingPeakLine = 0; settingIntegralLine = 0; settingBgPoint = 0;
    updateAnalysis();
    drawProfileGraph();
});

calculateAndPlotBtn.addEventListener('click', () => { /* 이전과 동일 */ });
saveAvgDataBtn.addEventListener('click', () => { /* 이전과 동일 */ });

setPeak1Btn.addEventListener('click', () => settingPeakLine = 1);
setPeak2Btn.addEventListener('click', () => settingPeakLine = 2);
// ▼▼▼ Background 버튼 이벤트 리스너 추가 ▼▼▼
setBg1Btn.addEventListener('click', () => settingBgPoint = 1);
setBg2Btn.addEventListener('click', () => settingBgPoint = 2);
// ▲▲▲ Background 버튼 이벤트 리스너 추가 ▲▲▲
setIntegral1Btn.addEventListener('click', () => settingIntegralLine = 1);
setIntegral2Btn.addEventListener('click', () => settingIntegralLine = 2);

// --- 분석 계산 ---
// ▼▼▼ Background 라인 계산 헬퍼 함수 추가 ▼▼▼
function getBackgroundLine() {
    if (!bgPoint1 || !bgPoint2) return null;
    if (bgPoint1.x === bgPoint2.x) return { slope: 0, intercept: bgPoint1.y }; // 수직선 방지
    
    const slope = (bgPoint2.y - bgPoint1.y) / (bgPoint2.x - bgPoint1.x);
    const intercept = bgPoint1.y - slope * bgPoint1.x;
    return { slope, intercept };
}
// ▲▲▲ Background 라인 계산 헬퍼 함수 추가 ▲▲▲

function updateAnalysis() {
    if (!plottedData) { /* 초기화 로직 이전과 동일 */ return; }
    if (peakLine1X !== -1 && peakLine2X !== -1) { /* 이전과 동일 */ } 
    else { /* 이전과 동일 */ }

    // ▼▼▼ Integral 계산 로직 수정 ▼▼▼
    if (integralLine1X !== -1 && integralLine2X !== -1) {
        const start = Math.min(integralLine1X, integralLine2X), end = Math.max(integralLine1X, integralLine2X);
        let sum = 0;
        const bgLine = getBackgroundLine(); // 배경선 정보 가져오기

        for (let i = start; i <= end; i++) {
            const signal = plottedData[i];
            if (bgLine) {
                const background = bgLine.slope * i + bgLine.intercept;
                sum += (signal - background);
            } else {
                sum += signal; // 배경선 없으면 원래대로
            }
        }
        integralValueDisplay.textContent = sum.toExponential(3);
    } else {
        integralValueDisplay.textContent = "N/A";
    }
    // ▲▲▲ Integral 계산 로직 수정 ▲▲▲
}

// --- 헬퍼 함수 및 드래그 앤 드롭 ---
function downloadTextFile(filename, text) { /* 이전과 동일 */ }
document.body.addEventListener('dragover', (e) => { /* 이전과 동일 */ });
document.body.addEventListener('drop', async (e) => { /* 이전과 동일 */ });

// (길고 변하지 않는 함수들은 간결하게 표시)
function showPixelInfo(e) { if (!currentDisplayData) return; const rect = previewCanvas.getBoundingClientRect(), x = Math.floor((e.clientX - rect.left) * (previewCanvas.width / rect.width)), y = Math.floor((e.clientY - rect.top) * (previewCanvas.height / rect.height)); if (x >= 0 && x < imageWidth && y >= 0 && y < imageHeight) { const pixelValue = currentDisplayData[y * imageWidth + x]; pixelInfo.style.display = 'block'; pixelInfo.textContent = `X:${x}, Y:${y}, Val:${pixelValue.toFixed(2)}`; } else { pixelInfo.style.display = 'none'; } }
function calculateAndPlotBtn.onclick() { if (!currentDisplayData) return alert("먼저 파일을 불러오세요."); const xFrom = parseInt(cropXFrom.value), xTo = parseInt(cropXTo.value), yFrom = parseInt(cropYFrom.value), yTo = parseInt(cropYTo.value); if ([xFrom, xTo, yFrom, yTo].some(isNaN)) return alert("모든 X, Y Range 값을 입력해주세요."); plottedData = []; for (let x = xFrom; x < xTo; x++) { let ySum = 0; for (let y = yFrom; y < yTo; y++) ySum += currentDisplayData[y * imageWidth + x]; plottedData.push(ySum / (yTo - yFrom)); } bgPoint1 = null; bgPoint2 = null; drawProfileGraph(); saveAvgDataBtn.style.display = 'inline-block'; }
function saveAvgDataBtn.onclick() { if (!currentDisplayData) return alert("먼저 파일을 불러오세요."); const xFrom = parseInt(cropXFrom.value), xTo = parseInt(cropXTo.value), xStep = parseInt(cropXStep.value), yFrom = parseInt(cropYFrom.value), yTo = parseInt(cropYTo.value), yStep = parseInt(cropYStep.value); if ([xFrom, xTo, xStep, yFrom, yTo, yStep].some(isNaN)) return alert("모든 From, To, Step 값을 입력해주세요."); let textContent = "X_center,Y_center,Average_Value\n"; for (let y = yFrom; y < yTo; y += yStep) for (let x = xFrom; x < xTo; x += xStep) { let sum = 0, count = 0; for (let j = y; j < y + yStep && j < yTo && j < imageHeight; j++) for (let i = x; i < x + xStep && i < xTo && i < imageWidth; i++) { sum += currentDisplayData[j * imageWidth + i]; count++; } if (count > 0) textContent += `${(x + (x+xStep-1))/2},${(y + (y+yStep-1))/2},${(sum / count).toFixed(4)}\n`; } downloadTextFile("cropped_average_data.txt", textContent); }

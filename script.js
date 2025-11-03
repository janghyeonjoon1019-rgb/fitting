// --- DOM 요소 가져오기 ---
const fileInput = document.getElementById('fileInput');
// ... (기존과 동일)

// --- 전역 상태 변수 ---
let speFrames = [], currentDisplayData = null, plottedData = null;
let imageWidth = 0, imageHeight = 0, selectedRowY = -1;
let settingPeakLine = 0, peakLine1X = -1, peakLine2X = -1;
let settingIntegralLine = 0, integralLine1X = -1, integralLine2X = -1;
let settingBgPoint = 0, bgPoint1 = null, bgPoint2 = null;
// ▼▼▼ 줌/패닝 상태 변수 추가 ▼▼▼
let zoom = 1;
let panOffset = { x: 0, y: 0 };
let isPanning = false;
let panStart = { x: 0, y: 0 };
// ▲▲▲ 줌/패닝 상태 변수 추가 ▲▲▲

// --- 초기화 ---
function initialize() {
    pCtx.font = '20px sans-serif'; pCtx.fillStyle = '#aaa'; pCtx.textAlign = 'center';
    pCtx.fillText('Select or Drop SPE file here', previewCanvas.width / 2, previewCanvas.height / 2);
    initializeProfileCanvas();
}
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
    else { /* 평균 계산 로직 이전과 동일 */ }
    
    // ▼▼▼ 줌/패닝 상태 초기화 ▼▼▼
    zoom = 1;
    panOffset = { x: 0, y: 0 };
    // ▲▲▲ 줌/패닝 상태 초기화 ▲▲▲
    
    drawImage();
    plottedData = null; saveAvgDataBtn.style.display = 'none';
    bgPoint1 = null; bgPoint2 = null;
    initializeProfileCanvas();
}

// --- 캔버스 드로잉 ---
// ▼▼▼ 줌/패닝 로직을 반영하여 drawImage 함수 전면 수정 ▼▼▼
function drawImage() {
    if (!currentDisplayData) return;

    // 1. 원본 이미지 데이터를 임시(오프스크린) 캔버스에 그립니다.
    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = imageWidth;
    offscreenCanvas.height = imageHeight;
    const offscreenCtx = offscreenCanvas.getContext('2d');
    const imageData = offscreenCtx.createImageData(imageWidth, imageHeight);
    const data = imageData.data;
    const min = parseFloat(rangeMinInput.value), max = parseFloat(rangeMaxInput.value);
    const range = max - min;
    
    if (range > 0) {
        for (let i = 0; i < currentDisplayData.length; i++) {
            let value = (currentDisplayData[i] - min) / range * 255;
            value = Math.max(0, Math.min(255, value));
            const j = i * 4;
            data[j] = data[j + 1] = data[j + 2] = value;
            data[j + 3] = 255;
        }
    }
    offscreenCtx.putImageData(imageData, 0, 0);

    // 2. 메인 캔버스를 지우고 변환(이동, 확대)을 적용합니다.
    pCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    pCtx.save(); // 현재 상태 저장
    pCtx.translate(panOffset.x, panOffset.y);
    pCtx.scale(zoom, zoom);

    // 3. 변환이 적용된 상태에서 임시 캔버스의 이미지를 메인 캔버스에 그립니다.
    pCtx.drawImage(offscreenCanvas, 0, 0);
    pCtx.restore(); // 변환 상태 복원

    // 4. 변환과 관계없이 화면 기준으로 붉은 선을 그립니다.
    if (selectedRowY !== -1) {
        const screenY = selectedRowY * zoom + panOffset.y;
        pCtx.fillStyle = 'rgba(255, 0, 0, 0.5)';
        pCtx.fillRect(0, screenY, previewCanvas.width, 1);
    }
}
// ▲▲▲ drawImage 함수 전면 수정 ▲▲▲

function drawProfileGraph() { /* 이전과 동일 */ }

// --- 이벤트 리스너 ---
rangeMinInput.addEventListener('input', drawImage);
rangeMaxInput.addEventListener('input', drawImage);

// ▼▼▼ 줌/패닝/좌표계산을 위한 헬퍼 및 이벤트 리스너 추가 ▼▼▼

// 화면 좌표(마우스 위치)를 실제 이미지 좌표로 변환하는 핵심 함수
function getMousePosOnImage(event) {
    const rect = previewCanvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    return {
        x: (mouseX - panOffset.x) / zoom,
        y: (mouseY - panOffset.y) / zoom
    };
}

function showPixelInfo(e) {
    if (!currentDisplayData) return;
    const pos = getMousePosOnImage(e);
    const x = Math.floor(pos.x), y = Math.floor(pos.y);
    if (x >= 0 && x < imageWidth && y >= 0 && y < imageHeight) {
        const pixelValue = currentDisplayData[y * imageWidth + x];
        pixelInfo.style.display = 'block';
        pixelInfo.textContent = `X:${x}, Y:${y}, Val:${pixelValue.toFixed(2)}`;
    } else {
        pixelInfo.style.display = 'none';
    }
}
previewCanvas.addEventListener('mousemove', showPixelInfo);

previewCanvas.addEventListener('click', (e) => {
    if (!currentDisplayData) return;
    const pos = getMousePosOnImage(e);
    const y = Math.round(pos.y);
    if (y >= 0 && y < imageHeight) {
        selectedRowY = y;
        drawImage();
    }
});

// 줌 이벤트 처리
function handleZoom(e) {
    e.preventDefault();
    if (!currentDisplayData) return;

    const zoomFactor = 1.1;
    const mousePos = getMousePosOnImage(e);
    
    const oldZoom = zoom;
    if (e.deltaY < 0) { // Scroll up -> Zoom in
        zoom *= zoomFactor;
    } else { // Scroll down -> Zoom out
        zoom /= zoomFactor;
    }
    // 줌 레벨 제한
    zoom = Math.max(0.1, Math.min(20, zoom));

    // 마우스 위치를 중심으로 줌이 되도록 panOffset 조정
    panOffset.x = panOffset.x - (mousePos.x * zoom - mousePos.x * oldZoom);
    panOffset.y = panOffset.y - (mousePos.y * zoom - mousePos.y * oldZoom);

    drawImage();
}
previewCanvas.addEventListener('wheel', handleZoom);

// 패닝(드래그) 이벤트 처리
previewCanvas.addEventListener('mousedown', (e) => {
    if (!currentDisplayData) return;
    isPanning = true;
    panStart.x = e.clientX;
    panStart.y = e.clientY;
    previewCanvas.style.cursor = 'grabbing';
});
previewCanvas.addEventListener('mouseup', () => {
    isPanning = false;
    previewCanvas.style.cursor = 'crosshair';
});
previewCanvas.addEventListener('mouseleave', () => {
    isPanning = false;
    previewCanvas.style.cursor = 'crosshair';
});
previewCanvas.addEventListener('mousemove', (e) => {
    if (isPanning) {
        const dx = e.clientX - panStart.x;
        const dy = e.clientY - panStart.y;
        panOffset.x += dx;
        panOffset.y += dy;
        panStart.x = e.clientX;
        panStart.y = e.clientY;
        drawImage();
    }
});
// ▲▲▲ 헬퍼 및 이벤트 리스너 추가 ▲▲▲

profileCanvas.addEventListener('click', (e) => { /* 이전과 동일 */ });
calculateAndPlotBtn.addEventListener('click', () => { /* 이전과 동일 */ });
saveAvgDataBtn.addEventListener('click', () => { /* 이전과 동일 */ });
setPeak1Btn.addEventListener('click', () => settingPeakLine = 1);
setPeak2Btn.addEventListener('click', () => settingPeakLine = 2);
setBg1Btn.addEventListener('click', () => settingBgPoint = 1);
setBg2Btn.addEventListener('click', () => settingBgPoint = 2);
setIntegral1Btn.addEventListener('click', () => settingIntegralLine = 1);
setIntegral2Btn.addEventListener('click', () => settingIntegralLine = 2);

// --- 분석 계산 ---
function getBackgroundLine() { /* 이전과 동일 */ }
function updateAnalysis() { /* 이전과 동일 */ }

// --- 헬퍼 함수 및 드래그 앤 드롭 ---
function downloadTextFile(filename, text) { /* 이전과 동일 */ }
document.body.addEventListener('dragover', (e) => { /* 이전과 동일 */ });
document.body.addEventListener('drop', async (e) => { /* 이전과 동일 */ });

// (자주 사용되는 긴 함수들은 여기에 전체 코드를 다시 기재합니다)
function getBackgroundLine() { if (!bgPoint1 || !bgPoint2) return null; if (bgPoint1.x === bgPoint2.x) return { slope: 0, intercept: bgPoint1.y }; const slope = (bgPoint2.y - bgPoint1.y) / (bgPoint2.x - bgPoint1.x); const intercept = bgPoint1.y - slope * bgPoint1.x; return { slope, intercept }; }
function updateAnalysis() { if (!plottedData) { peakDeltaDisplay.textContent = "N/A"; peakCenterDisplay.textContent = "N/A"; integralValueDisplay.textContent = "N/A"; return; } if (peakLine1X !== -1 && peakLine2X !== -1) { peakDeltaDisplay.textContent = Math.abs(peakLine1X - peakLine2X); peakCenterDisplay.textContent = ((peakLine1X + peakLine2X) / 2).toFixed(2); } else { peakDeltaDisplay.textContent = "N/A"; peakCenterDisplay.textContent = "N/A"; } if (integralLine1X !== -1 && integralLine2X !== -1) { const start = Math.min(integralLine1X, integralLine2X), end = Math.max(integralLine1X, integralLine2X); let sum = 0; const bgLine = getBackgroundLine(); for (let i = start; i <= end; i++) { const signal = plottedData[i]; if (bgLine) { const background = bgLine.slope * i + bgLine.intercept; sum += (signal - background); } else { sum += signal; } } integralValueDisplay.textContent = sum.toExponential(3); } else { integralValueDisplay.textContent = "N/A"; } }
function downloadTextFile(filename, text) { const a = document.createElement('a'); a.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(text); a.download = filename; document.body.appendChild(a); a.click(); document.body.removeChild(a); }
document.body.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
document.body.addEventListener('drop', async (e) => { e.preventDefault(); if (e.dataTransfer.files.length > 0 && e.dataTransfer.files[0].name.toLowerCase().endsWith('.spe')) await parseSpeFile(e.dataTransfer.files[0]); });

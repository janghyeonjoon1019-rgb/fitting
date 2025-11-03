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
const setIntegral1Btn = document.getElementById('setIntegral1');
const setIntegral2Btn = document.getElementById('setIntegral2');
const integralValueDisplay = document.getElementById('integralValue');
// ▼▼▼ STEP 입력창 DOM 요소 추가 ▼▼▼
const cropXFrom = document.getElementById('cropXFrom');
const cropXTo = document.getElementById('cropXTo');
const cropXStep = document.getElementById('cropXStep');
const cropYFrom = document.getElementById('cropYFrom');
const cropYTo = document.getElementById('cropYTo');
const cropYStep = document.getElementById('cropYStep');
// ▲▲▲ STEP 입력창 DOM 요소 추가 ▲▲▲
const calculateAndPlotBtn = document.getElementById('calculateAndPlotBtn');
const saveAvgDataBtn = document.getElementById('saveAvgDataBtn');

// --- 전역 상태 변수 ---
let speFrames = [], currentDisplayData = null, plottedData = null;
let imageWidth = 0, imageHeight = 0, selectedRowY = -1;
let settingPeakLine = 0, peakLine1X = -1, peakLine2X = -1;
let settingIntegralLine = 0, integralLine1X = -1, integralLine2X = -1;

// --- 초기화 ---
function initialize() {
    pCtx.font = '20px sans-serif'; pCtx.fillStyle = '#aaa'; pCtx.textAlign = 'center';
    pCtx.fillText('Select or Drop SPE file here', previewCanvas.width / 2, previewCanvas.height / 2);
    pfCtx.font = '16px sans-serif'; pfCtx.fillStyle = '#aaa'; pfCtx.textAlign = 'center';
    pfCtx.fillText('Use "Data Cropping" to generate and plot data', profileCanvas.width / 2, profileCanvas.height / 2);
}
initialize();

// --- 파일 처리 ---
async function handleFileSelect(input) {
    if (input.files.length) await parseSpeFile(input.files[0]);
}
async function parseSpeFile(file) {
    try {
        const buffer = await file.arrayBuffer();
        const dataView = new DataView(buffer);
        const HEADER_SIZE = 4100;
        imageWidth = dataView.getUint16(42, true);
        imageHeight = dataView.getUint16(656, true);
        let numFrames = dataView.getUint32(1446, true);
        if (imageWidth === 0 || imageHeight === 0 || numFrames === 0) return alert('유효한 SPE 파일이 아닙니다.');

        speFrames = [];
        const pixelsPerFrame = imageWidth * imageHeight, bytesPerFrame = pixelsPerFrame * 2;
        for (let i = 0; i < numFrames; i++) {
            const frameOffset = HEADER_SIZE + (i * bytesPerFrame);
            if (frameOffset + bytesPerFrame > buffer.byteLength) { numFrames = i; break; }
            speFrames.push(new Uint16Array(buffer, frameOffset, pixelsPerFrame));
        }
        if (speFrames.length === 0) return alert('파일에서 유효한 프레임을 불러오지 못했습니다.');

        updateFrameList(speFrames.length);
        const firstCheckbox = frameListContainer.querySelector('input[type=checkbox]');
        if (firstCheckbox) { firstCheckbox.checked = true; updateDisplay(); }
    } catch (error) { console.error("파일 파싱 오류:", error); alert("파일을 읽는 중 오류가 발생했습니다."); }
}

// --- UI 업데이트 및 상태 관리 ---
function updateFrameList(numFrames) {
    frameListContainer.innerHTML = '';
    for (let i = 0; i < numFrames; i++) {
        const label = document.createElement('label'), checkbox = document.createElement('input');
        label.className = 'frame-item'; checkbox.type = 'checkbox'; checkbox.dataset.index = i;
        checkbox.addEventListener('change', updateDisplay);
        label.append(checkbox, ` Frame ${i + 1}`);
        frameListContainer.appendChild(label);
    }
}
function updateDisplay() {
    const checkedIndexes = [...frameListContainer.querySelectorAll('input:checked')].map(cb => parseInt(cb.dataset.index));
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
    pfCtx.clearRect(0,0,profileCanvas.width, profileCanvas.height);
}

// --- 캔버스 드로잉 ---
function drawImage() {
    if (!currentDisplayData) return;
    const min = parseFloat(rangeMinInput.value), max = parseFloat(rangeMaxInput.value);
    const range = max - min;
    previewCanvas.width = imageWidth; previewCanvas.height = imageHeight;
    if (range <= 0) return pCtx.clearRect(0, 0, imageWidth, imageHeight);
    const imageData = pCtx.createImageData(imageWidth, imageHeight);
    const data = imageData.data;
    for (let i = 0; i < currentDisplayData.length; i++) {
        let value = (currentDisplayData[i] - min) / range * 255;
        value = Math.max(0, Math.min(255, value));
        const j = i * 4; data[j] = data[j + 1] = data[j + 2] = value; data[j + 3] = 255;
    }
    pCtx.putImageData(imageData, 0, 0);
    if (selectedRowY !== -1) { // 붉은 선 그리기
        pCtx.fillStyle = 'rgba(255, 0, 0, 0.5)';
        pCtx.fillRect(0, selectedRowY, imageWidth, 1);
    }
}
function drawProfileGraph() {
    if (!plottedData) return;
    pfCtx.clearRect(0, 0, profileCanvas.width, profileCanvas.height);
    let minVal = plottedData[0], maxVal = plottedData[0];
    plottedData.forEach(v => { if (v < minVal) minVal = v; if (v > maxVal) maxVal = v; });
    const range = maxVal - minVal === 0 ? 1 : maxVal - minVal;
    pfCtx.beginPath(); pfCtx.strokeStyle = 'green'; pfCtx.lineWidth = 2;
    for (let x = 0; x < plottedData.length; x++) {
        const canvasX = (x / (plottedData.length - 1)) * profileCanvas.width;
        const canvasY = (1 - (plottedData[x] - minVal) / range) * (profileCanvas.height - 20) + 10;
        x === 0 ? pfCtx.moveTo(canvasX, canvasY) : pfCtx.lineTo(canvasX, canvasY);
    }
    pfCtx.stroke();
    const drawLine = (x, color) => {
        if (x === -1) return;
        const canvasX = (x / (plottedData.length - 1)) * profileCanvas.width;
        pfCtx.beginPath(); pfCtx.strokeStyle = color; pfCtx.lineWidth = 1;
        pfCtx.moveTo(canvasX, 0); pfCtx.lineTo(canvasX, profileCanvas.height);
        pfCtx.stroke();
    };
    drawLine(peakLine1X, 'blue'); drawLine(peakLine2X, 'orange');
    drawLine(integralLine1X, 'gold'); drawLine(integralLine2X, 'gold');
}

// --- 이벤트 리스너 ---
rangeMinInput.addEventListener('input', drawImage);
rangeMaxInput.addEventListener('input', drawImage);

function showPixelInfo(e) {
    if (!currentDisplayData) return;
    const rect = previewCanvas.getBoundingClientRect(), x = Math.floor((e.clientX - rect.left) * (previewCanvas.width / rect.width)), y = Math.floor((e.clientY - rect.top) * (previewCanvas.height / rect.height));
    if (x >= 0 && x < imageWidth && y >= 0 && y < imageHeight) {
        const pixelValue = currentDisplayData[y * imageWidth + x];
        pixelInfo.style.display = 'block';
        pixelInfo.textContent = `X:${x}, Y:${y}, Val:${pixelValue.toFixed(2)}`;
    } else { pixelInfo.style.display = 'none'; }
}
previewCanvas.addEventListener('mousemove', showPixelInfo);
previewCanvas.addEventListener('mouseleave', () => { pixelInfo.style.display = 'none'; });

previewCanvas.addEventListener('click', (e) => { // ▼▼▼ 기능 수정: 붉은 선만 그리고 그래프는 그리지 않음 ▼▼▼
    if (!currentDisplayData) return;
    const rect = previewCanvas.getBoundingClientRect();
    const y = Math.round((e.clientY - rect.top) * (previewCanvas.height / rect.height));
    if (y >= 0 && y < imageHeight) {
        selectedRowY = y;
        drawImage(); // 그래프 그리기 호출 제거
    }
});

profileCanvas.addEventListener('click', (e) => {
    if (!plottedData) return;
    const rect = profileCanvas.getBoundingClientRect(), x = Math.round((e.clientX - rect.left) * (plottedData.length - 1) / rect.width);
    if (settingPeakLine === 1) peakLine1X = x; else if (settingPeakLine === 2) peakLine2X = x;
    if (settingIntegralLine === 1) integralLine1X = x; else if (settingIntegralLine === 2) integralLine2X = x;
    settingPeakLine = 0; settingIntegralLine = 0;
    updateAnalysis(); drawProfileGraph();
});

calculateAndPlotBtn.addEventListener('click', () => {
    if (!currentDisplayData) return alert("먼저 파일을 불러오세요.");
    const xFrom = parseInt(cropXFrom.value), xTo = parseInt(cropXTo.value);
    const yFrom = parseInt(cropYFrom.value), yTo = parseInt(cropYTo.value);
    if ([xFrom, xTo, yFrom, yTo].some(isNaN)) return alert("모든 X, Y Range 값을 입력해주세요.");
    plottedData = [];
    for (let x = xFrom; x < xTo; x++) {
        let ySum = 0;
        for (let y = yFrom; y < yTo; y++) ySum += currentDisplayData[y * imageWidth + x];
        plottedData.push(ySum / (yTo - yFrom));
    }
    drawProfileGraph();
    saveAvgDataBtn.style.display = 'inline-block';
});

saveAvgDataBtn.addEventListener('click', () => { // ▼▼▼ STEP 로직 복구 ▼▼▼
    if (!currentDisplayData) return alert("먼저 파일을 불러오세요.");
    const xFrom = parseInt(cropXFrom.value), xTo = parseInt(cropXTo.value), xStep = parseInt(cropXStep.value);
    const yFrom = parseInt(cropYFrom.value), yTo = parseInt(cropYTo.value), yStep = parseInt(cropYStep.value);
    if ([xFrom, xTo, xStep, yFrom, yTo, yStep].some(isNaN)) return alert("모든 From, To, Step 값을 입력해주세요.");
    let textContent = "X_center,Y_center,Average_Value\n";
    for (let y = yFrom; y < yTo; y += yStep) {
        for (let x = xFrom; x < xTo; x += xStep) {
            let sum = 0, count = 0;
            for (let j = y; j < y + yStep && j < yTo && j < imageHeight; j++) {
                for (let i = x; i < x + xStep && i < xTo && i < imageWidth; i++) {
                    sum += currentDisplayData[j * imageWidth + i]; count++;
                }
            }
            if (count > 0) textContent += `${x + xStep / 2},${y + yStep / 2},${(sum / count).toFixed(4)}\n`;
        }
    }
    downloadTextFile("cropped_average_data.txt", textContent);
});

setPeak1Btn.addEventListener('click', () => settingPeakLine = 1);
setPeak2Btn.addEventListener('click', () => settingPeakLine = 2);
setIntegral1Btn.addEventListener('click', () => settingIntegralLine = 1);
setIntegral2Btn.addEventListener('click', () => settingIntegralLine = 2);

function updateAnalysis() { /* 이전과 동일 */ }
function downloadTextFile(filename, text) { /* 이전과 동일 */ }
document.body.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
document.body.addEventListener('drop', async (e) => { /* 이전과 동일 */ });

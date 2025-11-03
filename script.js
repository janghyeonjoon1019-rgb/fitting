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
const setBg1Btn = document.getElementById('setBg1Btn');
const setBg2Btn = document.getElementById('setBg2Btn');
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
let settingBgPoint = 0, bgPoint1 = null, bgPoint2 = null;
let zoom = 1, panOffset = { x: 0, y: 0 };
let isPanning = false, panStartMousePos = { x: 0, y: 0 };
let panTimeout;

// --- 초기화 ---
function initialize() {
    pCtx.clearRect(0,0,previewCanvas.width, previewCanvas.height);
    pCtx.font = '20px sans-serif'; pCtx.fillStyle = '#aaa'; pCtx.textAlign = 'center';
    pCtx.fillText('Select or Drop SPE file here', previewCanvas.width / 2, previewCanvas.height / 2);
    initializeProfileCanvas();
}
function initializeProfileCanvas() {
    pfCtx.clearRect(0, 0, profileCanvas.width, profileCanvas.height);
    pfCtx.font = '16px sans-serif'; pfCtx.fillStyle = '#aaa'; pfCtx.textAlign = 'center';
    pfCtx.fillText('Use "Data Cropping" to generate and plot data', profileCanvas.width / 2, profileCanvas.height / 2);
}
initialize();

// --- 파일 처리 ---
async function handleFileSelect(input) { if (input.files.length) await parseSpeFile(input.files[0]); }
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
            if (frameOffset + bytesPerFrame > buffer.byteLength) {
                console.warn(`파일 끝 도달: 프레임 ${i + 1}부터 읽을 수 없습니다.`);
                numFrames = i;
                break;
            }
            speFrames.push(new Uint16Array(buffer, frameOffset, pixelsPerFrame));
        }
        if (speFrames.length === 0) return alert('파일에서 유효한 프레임을 불러오지 못했습니다.');
        updateFrameList(speFrames.length);
        const firstCheckbox = frameListContainer.querySelector('input[type=checkbox]');
        if (firstCheckbox) { firstCheckbox.checked = true; updateDisplay(); }
    } catch (error) {
        console.error("파일 파싱 오류:", error);
        alert("파일을 읽는 중 오류가 발생했습니다. 개발자 콘솔을 확인해주세요.");
    }
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
    const checkedIndexes = [...document.querySelectorAll('#frame-list-container input:checked')].map(cb => parseInt(cb.dataset.index));
    if (checkedIndexes.length === 0) { currentDisplayData = null; initialize(); return; }
    else if (checkedIndexes.length === 1) { currentDisplayData = speFrames[checkedIndexes[0]]; }
    else {
        const frameSize = imageWidth * imageHeight;
        const avgData = new Float32Array(frameSize).fill(0);
        for (const index of checkedIndexes) {
            for (let i = 0; i < frameSize; i++) avgData[i] += speFrames[index][i];
        }
        for (let i = 0; i < frameSize; i++) avgData[i] /= checkedIndexes.length;
        currentDisplayData = avgData;
    }
    zoom = 1; panOffset = { x: 0, y: 0 };
    drawImage();
    plottedData = null; saveAvgDataBtn.style.display = 'none';
    bgPoint1 = null; bgPoint2 = null;
    initializeProfileCanvas();
}

// --- 캔버스 드로잉 ---
function drawImage() {
    if (!currentDisplayData) return;
    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = imageWidth; offscreenCanvas.height = imageHeight;
    const offscreenCtx = offscreenCanvas.getContext('2d');
    const imageData = offscreenCtx.createImageData(imageWidth, imageHeight);
    const data = imageData.data;
    const min = parseFloat(rangeMinInput.value), max = parseFloat(rangeMaxInput.value);
    const range = max - min;
    if (range > 0) {
        for (let i = 0; i < currentDisplayData.length; i++) {
            let value = Math.max(0, Math.min(255, (currentDisplayData[i] - min) / range * 255));
            const j = i * 4; data[j] = data[j + 1] = data[j + 2] = value; data[j + 3] = 255;
        }
    }
    offscreenCtx.putImageData(imageData, 0, 0);
    pCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    pCtx.save();
    pCtx.translate(panOffset.x, panOffset.y);
    pCtx.scale(zoom, zoom);
    pCtx.drawImage(offscreenCanvas, 0, 0);
    pCtx.restore();
    if (selectedRowY !== -1) {
        const screenY = selectedRowY * zoom + panOffset.y;
        pCtx.fillStyle = 'rgba(255, 0, 0, 0.5)';
        pCtx.fillRect(0, screenY, previewCanvas.width, 1);
    }
}
function drawProfileGraph() {
    if (!plottedData) return initializeProfileCanvas();
    pfCtx.clearRect(0, 0, profileCanvas.width, profileCanvas.height);
    let minVal = plottedData[0], maxVal = plottedData[0];
    plottedData.forEach(v => { if (v < minVal) minVal = v; if (v > maxVal) maxVal = v; });
    const range = maxVal - minVal === 0 ? 1 : maxVal - minVal;
    const toCanvasY = (dataY) => (1 - (dataY - minVal) / range) * (profileCanvas.height - 20) + 10;
    pfCtx.beginPath(); pfCtx.strokeSty

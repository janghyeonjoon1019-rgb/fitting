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
const cropXFrom = document.getElementById('cropXFrom');
const cropXTo = document.getElementById('cropXTo');
const cropXStep = document.getElementById('cropXStep');
const cropYFrom = document.getElementById('cropYFrom');
const cropYTo = document.getElementById('cropYTo');
const cropYStep = document.getElementById('cropYStep');
const saveAvgDataBtn = document.getElementById('saveAvgDataBtn');

// --- 전역 상태 변수 ---
let speFrames = []; // 원본 프레임 데이터 (Uint16Array 배열)
let currentDisplayData = null; // 현재 화면에 표시된 이미지 데이터 (Uint16Array 또는 Float32Array)
let imageWidth = 0;
let imageHeight = 0;
let selectedRowY = -1;

let settingPeakLine = 0;
let peakLine1X = -1; let peakLine2X = -1;
let settingIntegralLine = 0;
let integralLine1X = -1; let integralLine2X = -1;


// --- 초기화 ---
function initialize() {
    pCtx.font = '20px sans-serif'; pCtx.fillStyle = '#aaa'; pCtx.textAlign = 'center';
    pCtx.fillText('Select or Drop SPE file here', previewCanvas.width / 2, previewCanvas.height / 2);
    pfCtx.font = '16px sans-serif'; pfCtx.fillStyle = '#aaa'; pfCtx.textAlign = 'center';
    pfCtx.fillText('Click on the image above to show a row profile', profileCanvas.width / 2, profileCanvas.height / 2);
}
initialize();


// --- 파일 처리 ---
async function handleFileSelect(input) {
    if (!input.files.length) return;
    await parseSpeFile(input.files[0]);
}

async function parseSpeFile(file) {
    try {
        const buffer = await file.arrayBuffer();
        const dataView = new DataView(buffer);
        const HEADER_SIZE = 4100;
        imageWidth = dataView.getUint16(42, true);
        imageHeight = dataView.getUint16(656, true);
        let numFrames = dataView.getUint32(1446, true); // let으로 변경하여 수정 가능하게 함

        if (imageWidth === 0 || imageHeight === 0 || numFrames === 0) {
            alert('유효한 SPE 파일이 아닙니다. (헤더 정보 없음)');
            return;
        }

        speFrames = [];
        const pixelsPerFrame = imageWidth * imageHeight;
        const bytesPerFrame = pixelsPerFrame * 2;

        // ▼▼▼ 안정성을 대폭 향상시킨 프레임 읽기 로직 ▼▼▼
        for (let i = 0; i < numFrames; i++) {
            const frameOffset = HEADER_SIZE + (i * bytesPerFrame);
            
            // 파일 끝을 넘어가는 읽기 시도를 방지하는 안전장치
            if (frameOffset + bytesPerFrame > buffer.byteLength) {
                console.error(`읽기 오류: 프레임 ${i + 1}의 데이터가 파일 크기를 벗어납니다.`);
                alert(`경고: 프레임 ${i + 1}을(를) 읽을 수 없습니다. 파일이 온전하지 않을 수 있습니다. 총 ${i}개의 프레임만 불러옵니다.`);
                numFrames = i; // 실제 불러온 프레임 수로 조정
                break; // 루프 중단
            }
            
            speFrames.push(new Uint16Array(buffer, frameOffset, pixelsPerFrame));
        }

        if (speFrames.length === 0) {
            alert('파일에서 유효한 프레임을 불러오지 못했습니다.');
            return;
        }

        updateFrameList(speFrames.length); // 실제 불러온 프레임 수로 리스트 업데이트
        
        const firstCheckbox = frameListContainer.querySelector('input[type=checkbox]');
        if (firstCheckbox) {
            firstCheckbox.checked = true;
            updateDisplay();
        }

    } catch (error) {
        console.error("파일 파싱 오류:", error);
        alert("파일을 읽는 중 심각한 오류가 발생했습니다. 개발자 콘솔을 확인해주세요.");
    }
}


// --- UI 업데이트 및 상태 관리 ---
function updateFrameList(numFrames) {
    frameListContainer.innerHTML = '';
    for (let i = 0; i < numFrames; i++) {
        const label = document.createElement('label');
        label.className = 'frame-item';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.dataset.index = i;
        checkbox.addEventListener('change', updateDisplay);
        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(` Frame ${i + 1}`));
        frameListContainer.appendChild(label);
    }
}

function updateDisplay() {
    const checkedIndexes = [...frameListContainer.querySelectorAll('input:checked')].map(cb => parseInt(cb.dataset.index));

    if (checkedIndexes.length === 0) {
        currentDisplayData = null;
        initialize();
    } else if (checkedIndexes.length === 1) {
        currentDisplayData = speFrames[checkedIndexes[0]];
        drawImage();
    } else {
        const frameSize = imageWidth * imageHeight;
        const avgData = new Float32Array(frameSize).fill(0);
        for (const index of checkedIndexes) {
            for (let i = 0; i < frameSize; i++) {
                avgData[i] += speFrames[index][i];
            }
        }
        for (let i = 0; i < frameSize; i++) {
            avgData[i] /= checkedIndexes.length;
        }
        currentDisplayData = avgData;
        drawImage();
    }
    pfCtx.clearRect(0,0,profileCanvas.width, profileCanvas.height);
    // Reset analysis lines when display changes
    peakLine1X = peakLine2X = integralLine1X = integralLine2X = -1;
    updateAnalysis();
}

// --- 캔버스 드로잉 ---
function drawImage() {
    if (!currentDisplayData) return;
    previewCanvas.addEventListener('mousemove', showPixelInfo);
    previewCanvas.addEventListener('mouseleave', () => { pixelInfo.style.display = 'none'; });

    const min = parseFloat(rangeMinInput.value);
    const max = parseFloat(rangeMaxInput.value);
    const range = max - min;
    previewCanvas.width = imageWidth;
    previewCanvas.height = imageHeight;
    if (range <= 0) return pCtx.clearRect(0, 0, imageWidth, imageHeight);
    
    const imageData = pCtx.createImageData(imageWidth, imageHeight);
    const data = imageData.data;
    for (let i = 0; i < currentDisplayData.length; i++) {
        let value = (currentDisplayData[i] - min) / range * 255;
        value = Math.max(0, Math.min(255, value));
        const j = i * 4;
        data[j] = data[j + 1] = data[j + 2] = value;
        data[j + 3] = 255;
    }
    pCtx.putImageData(imageData, 0, 0);

    if (selectedRowY !== -1) {
        pCtx.fillStyle = 'rgba(255, 0, 0, 0.5)';
        pCtx.fillRect(0, selectedRowY, imageWidth, 1);
        drawProfileGraph();
    }
}

function drawProfileGraph() {
    if (!currentDisplayData || selectedRowY === -1) return;

    const profileData = currentDisplayData.slice(selectedRowY * imageWidth, (selectedRowY + 1) * imageWidth);
    pfCtx.clearRect(0, 0, profileCanvas.width, profileCanvas.height);
    
    let minVal = profileData[0], maxVal = profileData[0];
    profileData.forEach(v => { if(v < minVal) minVal = v; if(v > maxVal) maxVal = v; });
    const range = maxVal - minVal === 0 ? 1 : maxVal - minVal;

    pfCtx.beginPath();
    pfCtx.strokeStyle = 'green';
    pfCtx.lineWidth = 2;
    for (let x = 0; x < profileData.length; x++) {
        const canvasX = (x / (profileData.length - 1)) * profileCanvas.width;
        const canvasY = (1 - (profileData[x] - minVal) / range) * (profileCanvas.height - 20) + 10;
        x === 0 ? pfCtx.moveTo(canvasX, canvasY) : pfCtx.lineTo(canvasX, canvasY);
    }
    pfCtx.stroke();

    const drawLine = (x, color) => {
        if (x === -1) return;
        const canvasX = (x / (imageWidth - 1)) * profileCanvas.width;
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
    const rect = previewCanvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) * (previewCanvas.width / rect.width));
    const y = Math.floor((e.clientY - rect.top) * (previewCanvas.height / rect.height));
    if (x >= 0 && x < imageWidth && y >= 0 && y < imageHeight) {
        const pixelValue = currentDisplayData[y * imageWidth + x];
        pixelInfo.style.display = 'block';
        pixelInfo.textContent = `X:${x}, Y:${y}, Val:${pixelValue.toFixed(2)}`;
    } else {
        pixelInfo.style.display = 'none';
    }
}

previewCanvas.addEventListener('click', (e) => {
    if (!currentDisplayData) return;
    const rect = previewCanvas.getBoundingClientRect();
    const y = Math.round((e.clientY - rect.top) * (previewCanvas.height / rect.height));
    if (y >= 0 && y < imageHeight) {
        selectedRowY = y;
        drawImage();
    }
});

profileCanvas.addEventListener('click', (e) => {
    if (!currentDisplayData || selectedRowY === -1) return;
    const rect = profileCanvas.getBoundingClientRect();
    const x = Math.round((e.clientX - rect.left) * (imageWidth - 1) / rect.width);
    if (settingPeakLine === 1) peakLine1X = x; else if (settingPeakLine === 2) peakLine2X = x;
    if (settingIntegralLine === 1) integralLine1X = x; else if (settingIntegralLine === 2) integralLine2X = x;
    settingPeakLine = 0; settingIntegralLine = 0;
    updateAnalysis(); drawProfileGraph();
});

setPeak1Btn.addEventListener('click', () => settingPeakLine = 1);
setPeak2Btn.addEventListener('click', () => settingPeakLine = 2);
setIntegral1Btn.addEventListener('click', () => settingIntegralLine = 1);
setIntegral2Btn.addEventListener('click', () => settingIntegralLine = 2);

saveAvgDataBtn.addEventListener('click', () => {
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
                    sum += currentDisplayData[j * imageWidth + i];
                    count++;
                }
            }
            if (count > 0) textContent += `${x + xStep / 2},${y + yStep / 2},${(sum / count).toFixed(4)}\n`;
        }
    }
    downloadTextFile("cropped_average_data.txt", textContent);
});

// --- 분석 계산 ---
function updateAnalysis() {
    const deltaDisp = peakDeltaDisplay, centerDisp = peakCenterDisplay, intDisp = integralValueDisplay;
    if (peakLine1X !== -1 && peakLine2X !== -1) {
        deltaDisp.textContent = Math.abs(peakLine1X - peakLine2X);
        centerDisp.textContent = ((peakLine1X + peakLine2X) / 2).toFixed(2);
    } else { deltaDisp.textContent = "N/A"; centerDisp.textContent = "N/A"; }

    if (integralLine1X !== -1 && integralLine2X !== -1 && selectedRowY !== -1) {
        const profileData = currentDisplayData.slice(selectedRowY * imageWidth, (selectedRowY + 1) * imageWidth);
        const start = Math.min(integralLine1X, integralLine2X), end = Math.max(integralLine1X, integralLine2X);
        let sum = 0;
        for (let i = start; i <= end; i++) sum += profileData[i];
        intDisp.textContent = sum.toExponential(3);
    } else { intDisp.textContent = "N/A"; }
}

// --- 헬퍼 함수 및 드래그 앤 드롭 ---
function downloadTextFile(filename, text) {
    const a = document.createElement('a');
    a.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(text);
    a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
}
document.body.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
document.body.addEventListener('drop', async (e) => {
    e.preventDefault();
    if (e.dataTransfer.files.length > 0 && e.dataTransfer.files[0].name.toLowerCase().endsWith('.spe')) {
        await parseSpeFile(e.dataTransfer.files[0]);
    }
});
